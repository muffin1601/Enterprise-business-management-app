import { z } from 'zod'
import { email, gstin, nonEmpty, pan, slug, uuid } from './common'

/**
 * First-company creation (onboarding). Maps to public.create_organization()
 * (RLS_POLICIES.md §1.4 provisioning). Optional fields stay optional so the
 * onboarding form can collect the minimum (just a name) and fill the rest later.
 */
export const createOrganizationSchema = z.object({
  name: nonEmpty('Company name').max(120),
  // Blank is allowed (the onboarding form leaves slug empty and the server
  // derives/omits it). `.optional()` alone only bypasses `undefined`, so an
  // empty string from the form would fail slug's min-length — hence `.or('')`.
  slug: slug.optional().or(z.literal('')),
  legalName: z.string().trim().max(160).optional(),
  gstin: gstin.optional().or(z.literal('')),
  address: z.string().trim().max(500).optional(),
})
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>

/** Switch the active organization for the session (sets the org cookie). */
export const switchOrganizationSchema = z.object({ orgId: uuid })
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>

/**
 * Edit the company profile (organizations row). Owner-only at the DB layer
 * (RLS org_update → app.is_org_owner). Optional fields accept '' from the form.
 */
export const updateOrganizationSchema = z.object({
  name: nonEmpty('Company name').max(120),
  legalName: z.string().trim().max(160).optional().or(z.literal('')),
  gstin: gstin.optional().or(z.literal('')),
  pan: pan.optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
})
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>

/**
 * Per-org configuration (organization_settings). Gated by `settings.manage`
 * (RLS os_write). financial_year_start is a month (1–12; 4 = April, India FY).
 */
export const organizationSettingsSchema = z.object({
  financialYearStart: z.coerce.number().int().min(1).max(12),
  defaultGstPct: z.coerce.number().min(0).max(100),
  placeOfSupply: z.string().trim().max(60).optional().or(z.literal('')),
})
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>

/** Invite a user to the active org with a role to grant on accept (admin.users). */
export const inviteMemberSchema = z.object({
  email,
  roleId: uuid,
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

/** Accept an invitation by its bearer token. */
export const acceptInvitationSchema = z.object({
  token: nonEmpty('Token').max(200),
})
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
