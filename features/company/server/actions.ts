'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { setActiveOrgId } from '@/lib/auth/session'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { ok, err, type ActionResult } from '@/types/action'
import {
  createOrganizationSchema,
  organizationSettingsSchema,
  switchOrganizationSchema,
  updateOrganizationSchema,
} from '@/validations/company'

const fieldErrors = (e: import('zod').ZodError) =>
  e.flatten().fieldErrors as Record<string, string[]>

/**
 * First company creation / onboarding (IMPLEMENTATION_PLAN.md Module 2).
 *
 * Delegates to the SECURITY DEFINER `public.create_organization` RPC, which
 * atomically creates: organizations → organization_settings → owner membership
 * → company_owner user_role → audit row (RLS_POLICIES.md §1.4 provisioning path —
 * needed because the caller is not yet a member of any org). On success the new
 * org becomes the active org for the session.
 */
export async function createOrganization(
  input: unknown,
): Promise<ActionResult<{ orgId: string }>> {
  const parsed = createOrganizationSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check the company details.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('unauthenticated', 'You must be signed in.')

  const { data: orgId, error } = await supabase.rpc('create_organization', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug || null,
    p_legal_name: parsed.data.legalName || null,
    p_gstin: parsed.data.gstin || null,
    p_address: parsed.data.address || null,
  })

  if (error || !orgId) {
    if (error?.code === '23505') return err('conflict', 'That company slug is already taken.')
    // Surface the exact failure (missing RPC, RLS denial, etc.) instead of a
    // generic message so the user/operator can see what actually went wrong.
    return err('internal', error?.message ?? 'Could not create the company. Try again.', {
      details: error?.code ? { code: error.code } : undefined,
    })
  }

  await setActiveOrgId(orgId as string)
  return ok({ orgId: orgId as string })
}

/** Switch the active organization (validated against the user's memberships). */
export async function switchOrganization(
  input: unknown,
): Promise<ActionResult<{ orgId: string }>> {
  const parsed = switchOrganizationSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid organization.')

  const supabase = await createSupabaseServerClient()
  // RLS (mem_select) only returns the caller's own memberships, so a hit proves membership.
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('org_id', parsed.data.orgId)
    .maybeSingle()

  if (!membership) return err('forbidden', 'You are not a member of that organization.')

  await setActiveOrgId(parsed.data.orgId)
  return ok({ orgId: parsed.data.orgId })
}

/**
 * Edit the company profile (organizations row). Owner-only — RLS `org_update`
 * (app.is_org_owner) is the backstop; we check ctx.isOwner for a clean error.
 */
export async function updateOrganization(
  input: unknown,
): Promise<ActionResult<{ updated: true }>> {
  const parsed = updateOrganizationSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check the company details.', { fieldErrors: fieldErrors(parsed.error) })

  let ctx
  try {
    ctx = await getActionContext()
  } catch (e) {
    if (e instanceof AuthError) return err(e.code, e.message)
    throw e
  }
  if (!ctx.isOwner && !ctx.isSuperAdmin)
    return err('forbidden', 'Only the company owner can edit the company profile.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legalName || null,
      gstin: parsed.data.gstin || null,
      pan: parsed.data.pan || null,
      address: parsed.data.address || null,
    })
    .eq('id', ctx.orgId)

  if (error) return err('internal', 'Could not save the company profile. Try again.')

  revalidatePath('/settings/company')
  return ok({ updated: true })
}

/** Update per-org settings (organization_settings). Requires `settings.manage`. */
export async function updateOrganizationSettings(
  input: unknown,
): Promise<ActionResult<{ updated: true }>> {
  const parsed = organizationSettingsSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check the settings.', { fieldErrors: fieldErrors(parsed.error) })

  let ctx
  try {
    ctx = await getActionContext()
  } catch (e) {
    if (e instanceof AuthError) return err(e.code, e.message)
    throw e
  }
  if (!ctx.has('settings.manage'))
    return err('forbidden', 'You do not have permission to manage settings.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('organization_settings')
    .update({
      financial_year_start: parsed.data.financialYearStart,
      default_gst_pct: parsed.data.defaultGstPct,
      place_of_supply: parsed.data.placeOfSupply || null,
    })
    .eq('org_id', ctx.orgId)

  if (error) return err('internal', 'Could not save the settings. Try again.')

  revalidatePath('/settings/company')
  return ok({ updated: true })
}
