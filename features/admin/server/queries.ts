import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'

export type AssignableRole = { id: string; key: string; name: string }
export type PendingInvitation = {
  id: string
  email: string
  roleName: string
  status: string
  expiresAt: string
}
export type InvitationPreview = {
  orgName: string
  email: string
  roleName: string
  status: string
  expired: boolean
} | null

/**
 * Roles a member can be invited as: the system roles (org_id NULL) minus
 * company_owner, plus any custom roles for the active org. RLS roles_select
 * returns org_id NULL + the caller's org roles.
 */
export async function getAssignableRoles(): Promise<AssignableRole[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('roles')
    .select('id, key, name')
    .neq('key', 'company_owner')
    .order('name', { ascending: true })
  return (data ?? []).map((r) => ({
    id: r.id as string,
    key: r.key as string,
    name: (r.name as string | null) ?? (r.key as string),
  }))
}

/** Pending invitations for the active org (RLS inv_select → admin.users). */
export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  const orgId = await getActiveOrgId()
  if (!orgId) return []
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('invitations')
    .select('id, email, status, expires_at, roles!invitations_role_id_fkey(name)')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (data ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    roleName: ((i.roles as unknown as { name: string } | null)?.name) ?? '—',
    status: i.status as string,
    expiresAt: i.expires_at as string,
  }))
}

export type MemberRole = { key: string; name: string }
export type Member = {
  userId: string
  email: string
  fullName: string
  status: 'active' | 'inactive'
  isDefault: boolean
  joinedAt: string
  roles: MemberRole[]
}
export type MemberDetail = Member & { phone: string; isOwner: boolean }

function rolesByUser(rows: { user_id: string; roles: unknown }[]): Map<string, MemberRole[]> {
  const map = new Map<string, MemberRole[]>()
  for (const r of rows) {
    const role = r.roles as { key: string; name: string | null } | null
    if (!role) continue
    const list = map.get(r.user_id) ?? []
    list.push({ key: role.key, name: role.name ?? role.key })
    map.set(r.user_id, list)
  }
  return map
}

/** Org roster: members + their roles (RLS mem_select/ur_select → admin.users). */
export async function listMembers(): Promise<Member[]> {
  const orgId = await getActiveOrgId()
  if (!orgId) return []
  const supabase = await createSupabaseServerClient()

  const [{ data: mems }, { data: urs }] = await Promise.all([
    supabase
      .from('memberships')
      .select('user_id, is_default, joined_at, users!inner(id, email, full_name, status)')
      .eq('org_id', orgId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('user_roles')
      .select('user_id, roles!user_roles_role_id_fkey(key, name)')
      .eq('org_id', orgId),
  ])

  const roleMap = rolesByUser((urs ?? []) as { user_id: string; roles: unknown }[])
  return (mems ?? []).map((m) => {
    const u = m.users as unknown as { email: string; full_name: string | null; status: string }
    return {
      userId: m.user_id as string,
      email: u?.email ?? '',
      fullName: u?.full_name ?? '',
      status: (u?.status as 'active' | 'inactive') ?? 'active',
      isDefault: Boolean(m.is_default),
      joinedAt: m.joined_at as string,
      roles: roleMap.get(m.user_id as string) ?? [],
    }
  })
}

/** One member's detail (profile + roles + owner flag) for the active org. */
export async function getMemberDetail(userId: string): Promise<MemberDetail | null> {
  const orgId = await getActiveOrgId()
  if (!orgId) return null
  const supabase = await createSupabaseServerClient()

  const { data: mem } = await supabase
    .from('memberships')
    .select('user_id, is_default, joined_at, users!inner(id, email, full_name, phone, status)')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!mem) return null

  const { data: urs } = await supabase
    .from('user_roles')
    .select('user_id, roles!user_roles_role_id_fkey(key, name)')
    .eq('org_id', orgId)
    .eq('user_id', userId)

  const roles = rolesByUser((urs ?? []) as { user_id: string; roles: unknown }[]).get(userId) ?? []
  const u = mem.users as unknown as {
    email: string
    full_name: string | null
    phone: string | null
    status: string
  }
  return {
    userId,
    email: u?.email ?? '',
    fullName: u?.full_name ?? '',
    phone: u?.phone ?? '',
    status: (u?.status as 'active' | 'inactive') ?? 'active',
    isDefault: Boolean(mem.is_default),
    joinedAt: mem.joined_at as string,
    roles,
    isOwner: roles.some((r) => r.key === 'company_owner'),
  }
}

/** Safe preview for the accept screen (SECURITY DEFINER RPC; token-gated). */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('invitation_preview', { p_token: token })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return null
  return {
    orgName: (row.org_name as string) ?? '',
    email: (row.email as string) ?? '',
    roleName: (row.role_name as string | null) ?? '—',
    status: (row.status as string) ?? '',
    expired: Boolean(row.expired),
  }
}
