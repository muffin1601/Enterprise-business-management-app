import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId, getUserMemberships } from '@/lib/auth/session'

export type OrganizationProfile = {
  id: string
  name: string
  legalName: string
  gstin: string
  pan: string
  address: string
}

export type OrganizationSettings = {
  financialYearStart: number
  defaultGstPct: number
  placeOfSupply: string
}

/** The active org's profile (RLS org_select → members). */
export async function getActiveOrganization(): Promise<OrganizationProfile | null> {
  const orgId = await getActiveOrgId()
  if (!orgId) return null
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('organizations')
    .select('id, name, legal_name, gstin, pan, address')
    .eq('id', orgId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    name: (data.name as string) ?? '',
    legalName: (data.legal_name as string | null) ?? '',
    gstin: (data.gstin as string | null) ?? '',
    pan: (data.pan as string | null) ?? '',
    address: (data.address as string | null) ?? '',
  }
}

/** The active org's settings (RLS os_select → members). */
export async function getActiveOrganizationSettings(): Promise<OrganizationSettings | null> {
  const orgId = await getActiveOrgId()
  if (!orgId) return null
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('organization_settings')
    .select('financial_year_start, default_gst_pct, place_of_supply')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data) return null
  return {
    financialYearStart: Number(data.financial_year_start ?? 4),
    defaultGstPct: Number(data.default_gst_pct ?? 18),
    placeOfSupply: (data.place_of_supply as string | null) ?? '',
  }
}

/** Orgs the user belongs to + which is active — drives the org switcher. */
export async function getOrgSwitcherData() {
  const [memberships, activeOrgId] = await Promise.all([getUserMemberships(), getActiveOrgId()])
  return { memberships, activeOrgId }
}
