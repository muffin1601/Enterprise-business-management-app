'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { setActiveOrgId } from '@/lib/auth/session'
import { generateToken } from '@/lib/utils/token'
import { clientEnv } from '@/lib/env'
import { ok, err, type ActionResult } from '@/types/action'
import { acceptInvitationSchema, inviteMemberSchema } from '@/validations/company'
import { setUserStatusSchema, userRoleSchema } from '@/validations/user'

/**
 * Org membership administration (API_DESIGN.md §3.14, features/admin).
 * inviteMember/acceptInvitation cover the Company-Setup invite→accept→membership
 * →role-grant flow. Managing *existing* members (roster, role changes, revoke)
 * is the User Management module.
 */

const fieldErrors = (e: import('zod').ZodError) =>
  e.flatten().fieldErrors as Record<string, string[]>

const INVITE_TTL_DAYS = 7

/**
 * Invite a user to the active org with a role to grant on accept (`admin.users`).
 * Creates the `invitations` row (the trg_audit_invitations trigger audits it).
 * Email delivery is the Notifications module's job (Resend); until then the
 * accept URL is returned so it can be shared manually.
 */
export async function inviteMember(
  input: unknown,
): Promise<ActionResult<{ id: string; acceptUrl: string }>> {
  const parsed = inviteMemberSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check the invite details.', { fieldErrors: fieldErrors(parsed.error) })

  let ctx
  try {
    ctx = await getActionContext()
  } catch (e) {
    if (e instanceof AuthError) return err(e.code, e.message)
    throw e
  }
  if (!ctx.has('admin.users'))
    return err('forbidden', 'You do not have permission to invite members.')

  const token = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      org_id: ctx.orgId,
      email: parsed.data.email,
      role_id: parsed.data.roleId,
      token,
      status: 'pending',
      invited_by: ctx.userId,
      expires_at: expiresAt,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error) {
    // uq_invitations_org_email_pending → one live invite per email per org.
    if (error.code === '23505')
      return err('conflict', 'There is already a pending invitation for that email.')
    return err('internal', 'Could not create the invitation. Try again.')
  }

  revalidatePath('/settings/team')
  return ok({
    id: data.id as string,
    acceptUrl: `${clientEnv.NEXT_PUBLIC_APP_URL}/invite/accept?token=${encodeURIComponent(token)}`,
  })
}

/** Revoke a pending invitation (`admin.users`; RLS inv_delete = owner). */
export async function revokeInvitation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const id = typeof input === 'object' && input ? (input as { id?: unknown }).id : undefined
  if (typeof id !== 'string') return err('validation', 'Invalid invitation.')

  let ctx
  try {
    ctx = await getActionContext()
  } catch (e) {
    if (e instanceof AuthError) return err(e.code, e.message)
    throw e
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
  if (error) return err('internal', 'Could not revoke the invitation.')

  revalidatePath('/settings/team')
  return ok({ id })
}

/**
 * Accept an invitation by token. Delegates to the SECURITY DEFINER
 * `public.accept_invitation` RPC (the invitee isn't a member yet, so RLS would
 * block a self-insert). On success the joined org becomes the active org.
 */
export async function acceptInvitation(
  input: unknown,
): Promise<ActionResult<{ orgId: string }>> {
  const parsed = acceptInvitationSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid invitation token.')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('unauthenticated', 'Sign in to accept this invitation.')

  const { data: orgId, error } = await supabase.rpc('accept_invitation', {
    p_token: parsed.data.token,
  })

  if (error || !orgId) {
    if (error?.code === '42501')
      return err('forbidden', 'This invitation was sent to a different email address.')
    if (error?.code === 'P0002') return err('not_found', 'Invitation not found.')
    return err('state_transition', 'This invitation can no longer be accepted.')
  }

  await setActiveOrgId(orgId as string)
  return ok({ orgId: orgId as string })
}

// ───────────────────────── User Management ─────────────────────────────────

/** Resolve the action context, mapping AuthError → ActionResult. */
async function ctxOrErr() {
  try {
    return { ctx: await getActionContext() }
  } catch (e) {
    if (e instanceof AuthError) return { error: err(e.code, e.message) }
    throw e
  }
}

/** Assign an org role to a member (`admin.users`). RLS ur_write + audit trigger back this. */
export async function assignRole(input: unknown): Promise<ActionResult<{ assigned: true }>> {
  const parsed = userRoleSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid role assignment.')

  const r = await ctxOrErr()
  if (r.error) return r.error
  const ctx = r.ctx
  if (!ctx.has('admin.users')) return err('forbidden', 'You cannot manage roles.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('user_roles').insert({
    org_id: ctx.orgId,
    user_id: parsed.data.userId,
    role_id: parsed.data.roleId,
    created_by: ctx.userId,
  })
  if (error) {
    if (error.code === '23505') return ok({ assigned: true }) // already assigned — idempotent
    return err('internal', 'Could not assign the role.')
  }

  revalidatePath(`/users/${parsed.data.userId}`)
  return ok({ assigned: true })
}

/** Revoke an org role from a member (`admin.users`). */
export async function revokeRole(input: unknown): Promise<ActionResult<{ revoked: true }>> {
  const parsed = userRoleSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid role assignment.')

  const r = await ctxOrErr()
  if (r.error) return r.error
  const ctx = r.ctx
  if (!ctx.has('admin.users')) return err('forbidden', 'You cannot manage roles.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('org_id', ctx.orgId)
    .eq('user_id', parsed.data.userId)
    .eq('role_id', parsed.data.roleId)
  if (error) return err('internal', 'Could not revoke the role.')

  revalidatePath(`/users/${parsed.data.userId}`)
  return ok({ revoked: true })
}

/**
 * Activate / deactivate a member (`admin.users`). Delegates to the SECURITY
 * DEFINER `set_user_status` RPC — RLS users_update_self blocks an admin from
 * editing another user's row, and the RPC enforces the guards + writes audit.
 */
export async function setUserStatus(input: unknown): Promise<ActionResult<{ active: boolean }>> {
  const parsed = setUserStatusSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid status change.')

  const r = await ctxOrErr()
  if (r.error) return r.error
  const ctx = r.ctx
  if (!ctx.has('admin.users')) return err('forbidden', 'You cannot change member status.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_user_status', {
    p_user_id: parsed.data.userId,
    p_org: ctx.orgId,
    p_active: parsed.data.active,
  })
  if (error) {
    if (error.code === '42501') return err('forbidden', 'You cannot change member status.')
    if (error.code === 'P0001') return err('state_transition', error.message)
    if (error.code === 'P0002') return err('not_found', 'That user is not a member of this organization.')
    return err('internal', 'Could not update the member status.')
  }

  revalidatePath(`/users/${parsed.data.userId}`)
  revalidatePath('/users')
  return ok({ active: parsed.data.active })
}
