'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import { generateToken } from '@/lib/utils/token'
import { clientEnv } from '@/lib/env'
import {
  customRoleSchema, updateCustomRoleSchema, setRolePermissionsSchema,
  updateMemberProfileSchema, bulkInviteSchema,
} from '@/validations/team'

const fe = (e: import('zod').ZodError) => e.flatten().fieldErrors as Record<string, string[]>

async function ctxOrErr(perm?: string): Promise<{ c: import('@/lib/auth/action-context').ActionContext } | { c?: never; error: import('@/types/action').ActionErr }> {
  try {
    const c = await getActionContext()
    if (perm && !c.has(perm)) return { error: err('forbidden', `Missing ${perm} permission.`) }
    return { c }
  } catch (e) {
    if (e instanceof AuthError) return { error: err(e.code as 'unauthenticated' | 'forbidden', e.message) }
    throw e
  }
}

const INVITE_TTL = 7 * 24 * 60 * 60 * 1000

// ── resendInvitation ──────────────────────────────────────────────────────────

export async function resendInvitation(id: string): Promise<ActionResult<{ acceptUrl: string }>> {
  const r = await ctxOrErr('admin.users'); if ('error' in r) return r.error

  const token     = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL).toISOString()
  const supabase  = await createSupabaseServerClient()

  const { error } = await supabase.from('invitations').update({
    token, expires_at: expiresAt, status: 'pending',
  }).eq('id', id).eq('org_id', r.c.orgId)

  if (error) return err('internal', 'Could not resend invitation.')
  revalidatePath('/users')
  return ok({ acceptUrl: `${clientEnv.NEXT_PUBLIC_APP_URL}/invite/accept?token=${encodeURIComponent(token)}` })
}

// ── bulkInvite ────────────────────────────────────────────────────────────────

export async function bulkInvite(input: unknown): Promise<ActionResult<{ invited: number; skipped: number }>> {
  const r = await ctxOrErr('admin.users'); if ('error' in r) return r.error

  const parsed = bulkInviteSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form.', { fieldErrors: fe(parsed.error) })

  const supabase = await createSupabaseServerClient()
  let invited = 0, skipped = 0

  for (const email of parsed.data.emails) {
    const token     = generateToken()
    const expiresAt = new Date(Date.now() + INVITE_TTL).toISOString()
    const { error } = await supabase.from('invitations').insert({
      org_id: r.c.orgId, email, role_id: parsed.data.roleId,
      token, status: 'pending', invited_by: r.c.userId,
      expires_at: expiresAt, created_by: r.c.userId,
    })
    if (error) skipped++; else invited++
  }

  revalidatePath('/users')
  return ok({ invited, skipped })
}

// ── createCustomRole ──────────────────────────────────────────────────────────

export async function createCustomRole(input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr('admin.roles'); if ('error' in r) return r.error

  const parsed = customRoleSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the role details.', { fieldErrors: fe(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('roles').insert({
    org_id:      r.c.orgId,
    key:         `${r.c.orgId.slice(0, 8)}_${parsed.data.key}`,
    name:        parsed.data.name,
    description: parsed.data.description ?? null,
    color:       parsed.data.color ?? '#6b7280',
    is_system:   false,
    created_by:  r.c.userId,
  }).select('id').single()

  if (error) {
    if (error.code === '23505') return err('conflict', 'A role with that key already exists.')
    return err('internal', error.message)
  }

  revalidatePath('/users/roles')
  return ok({ id: data.id as string })
}

// ── updateCustomRole ──────────────────────────────────────────────────────────

export async function updateCustomRole(id: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr('admin.roles'); if ('error' in r) return r.error

  const parsed = updateCustomRoleSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the role details.')

  const supabase = await createSupabaseServerClient()
  const { data: role } = await supabase.from('roles').select('org_id,is_system').eq('id', id).maybeSingle()
  if (!role || role.org_id !== r.c.orgId) return err('not_found', 'Role not found.')
  if (role.is_system) return err('state_transition', 'System roles cannot be modified.')

  await supabase.from('roles').update({
    ...(parsed.data.name        !== undefined ? { name:        parsed.data.name }        : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    ...(parsed.data.color       !== undefined ? { color:       parsed.data.color }       : {}),
  }).eq('id', id)

  revalidatePath('/users/roles')
  return ok(undefined)
}

// ── deleteCustomRole ──────────────────────────────────────────────────────────

export async function deleteCustomRole(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr('admin.roles'); if ('error' in r) return r.error

  const supabase = await createSupabaseServerClient()
  const { data: role } = await supabase.from('roles').select('org_id,is_system').eq('id', id).maybeSingle()
  if (!role || role.org_id !== r.c.orgId) return err('not_found', 'Role not found.')
  if (role.is_system) return err('state_transition', 'System roles cannot be deleted.')

  const { count } = await supabase.from('user_roles')
    .select('id', { count:'exact', head:true }).eq('role_id', id).eq('org_id', r.c.orgId)
  if ((count ?? 0) > 0) {
    return err('conflict', `Cannot delete: ${count} member(s) have this role. Reassign them first.`)
  }

  await supabase.from('role_permissions').delete().eq('role_id', id)
  await supabase.from('roles').delete().eq('id', id)

  revalidatePath('/users/roles')
  return ok(undefined)
}

// ── setRolePermissions ────────────────────────────────────────────────────────

export async function setRolePermissions(input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr('admin.roles'); if ('error' in r) return r.error

  const parsed = setRolePermissionsSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid permissions input.')

  const { roleId, permKeys } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: role } = await supabase.from('roles').select('org_id,is_system').eq('id', roleId).maybeSingle()
  if (!role || role.org_id !== r.c.orgId) return err('not_found', 'Role not found.')
  if (role.is_system) return err('state_transition', 'System role permissions cannot be modified.')

  await supabase.from('role_permissions').delete().eq('role_id', roleId)

  if (permKeys.length > 0) {
    const rows = permKeys.map(k => ({ role_id: roleId, permission_key: k }))
    const { error } = await supabase.from('role_permissions').insert(rows)
    if (error) return err('internal', error.message)
  }

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'roles',
    entityId: roleId, action: 'update', after: { permissions: permKeys.length },
  })

  revalidatePath('/users/roles')
  return ok(undefined)
}

// ── updateMemberProfile ───────────────────────────────────────────────────────

export async function updateMemberProfile(userId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error

  if (r.c.userId !== userId && !r.c.has('admin.users')) {
    return err('forbidden', 'You can only edit your own profile.')
  }

  const parsed = updateMemberProfileSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the profile fields.', { fieldErrors: fe(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const payload: Record<string, unknown> = {}
  if (parsed.data.fullName   !== undefined) payload.full_name  = parsed.data.fullName
  if (parsed.data.phone      !== undefined) payload.phone      = parsed.data.phone
  if (parsed.data.jobTitle   !== undefined) payload.job_title  = parsed.data.jobTitle
  if (parsed.data.department !== undefined) payload.department = parsed.data.department

  const { error } = await supabase.from('users').update(payload).eq('id', userId)
  if (error) return err('internal', error.message)

  revalidatePath(`/users/${userId}`)
  revalidatePath('/users')
  return ok(undefined)
}

// ── removeMember ──────────────────────────────────────────────────────────────

export async function removeMember(userId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr('admin.users'); if ('error' in r) return r.error
  if (r.c.userId === userId) return err('state_transition', 'You cannot remove yourself.')

  const supabase = await createSupabaseServerClient()

  const { data: ur } = await supabase.from('user_roles')
    .select('roles!inner(key)').eq('user_id', userId).eq('org_id', r.c.orgId)
  const isOwner = (ur ?? []).some(row => (row.roles as unknown as { key: string })?.key === 'company_owner')
  if (isOwner) return err('state_transition', 'Cannot remove the company owner.')

  await supabase.from('user_roles').delete().eq('user_id', userId).eq('org_id', r.c.orgId)
  const { error } = await supabase.from('memberships').delete()
    .eq('user_id', userId).eq('org_id', r.c.orgId)
  if (error) return err('internal', error.message)

  revalidatePath('/users')
  return ok(undefined)
}
