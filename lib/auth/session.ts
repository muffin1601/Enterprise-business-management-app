import 'server-only'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** Cookie holding the active org id for the session (validated against memberships). */
export const ACTIVE_ORG_COOKIE = 'watcon-active-org'

export type Membership = {
  orgId: string
  isDefault: boolean
  orgName: string
}

/** The verified auth user, or null. Uses getUser() (re-validates the JWT). */
export async function getOptionalUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/** Throws-style guard for server code that requires a session. */
export async function requireUser() {
  const user = await getOptionalUser()
  if (!user) throw new Error('unauthenticated')
  return user
}

/** All orgs the user belongs to (RLS: mem_select self-read). */
export async function getUserMemberships(): Promise<Membership[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('memberships')
    .select('org_id, is_default, organizations!inner(name)')
    .order('joined_at', { ascending: true })

  return (data ?? []).map((m) => ({
    orgId: m.org_id as string,
    isDefault: m.is_default as boolean,
    // supabase types the embedded relation loosely; coerce defensively.
    orgName: ((m.organizations as unknown as { name: string } | null)?.name) ?? '',
  }))
}

/**
 * Resolve the active org for the request: the cookie value if it's a real
 * membership, else the default membership, else the first. Returns null when
 * the user has no organizations yet (→ onboarding).
 */
export async function getActiveOrgId(): Promise<string | null> {
  const memberships = await getUserMemberships()
  if (memberships.length === 0) return null

  const cookieStore = await cookies()
  const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
  if (cookieOrg && memberships.some((m) => m.orgId === cookieOrg)) return cookieOrg

  return (memberships.find((m) => m.isDefault) ?? memberships[0]!).orgId
}

/** Persist the active org selection (only callable from Actions/Route Handlers). */
export async function setActiveOrgId(orgId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
