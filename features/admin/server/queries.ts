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

// ── Enterprise extensions ─────────────────────────────────────────────────────

export type TeamStats = {
  total: number
  active: number
  inactive: number
  pendingInvites: number
  roles: number
}

export type AllInvitation = PendingInvitation & { invitedByEmail: string | null }

export type RoleWithCount = {
  id: string
  key: string
  name: string
  description: string | null
  color: string | null
  isSystem: boolean
  memberCount: number
  permissionCount: number
}

export type PermissionRow = { key: string; module: string; description: string | null }

export type ActivityItem = {
  id: string
  action: string
  entityType: string
  entityId: string
  at: string
  after: Record<string, unknown> | null
}

export type MemberDetailEnriched = MemberDetail & {
  jobTitle:   string | null
  department: string | null
  permissions: string[]  // effective permission keys (union of all roles)
}

export async function getTeamStats(): Promise<TeamStats> {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  if (!orgId) return { total:0, active:0, inactive:0, pendingInvites:0, roles:0 }

  const [{ data: mems }, { data: invs }, { data: roles }] = await Promise.all([
    supabase.from('memberships')
      .select('user_id, users!inner(status)')
      .eq('org_id', orgId),
    supabase.from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'pending'),
    supabase.from('roles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),
  ])

  const members = mems ?? []
  return {
    total:        members.length,
    active:       members.filter(m => (m.users as unknown as { status: string })?.status === 'active').length,
    inactive:     members.filter(m => (m.users as unknown as { status: string })?.status !== 'active').length,
    pendingInvites:Number((invs as unknown as { count: number } | null)?.count ?? 0) || 0,
    roles:        Number((roles as unknown as { count: number } | null)?.count ?? 0) || 0,
  }
}

export async function listAllInvitations(): Promise<AllInvitation[]> {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  if (!orgId) return []

  const { data } = await supabase
    .from('invitations')
    .select('id,email,status,expires_at,invited_by,roles!invitations_role_id_fkey(name)')
    .eq('org_id', orgId)
    .in('status', ['pending','revoked'])
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch inviter emails
  const inviterIds = [...new Set((data ?? []).map(i => i.invited_by as string).filter(Boolean))]
  const inviterMap: Record<string, string> = {}
  if (inviterIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id,email').in('id', inviterIds)
    for (const u of users ?? []) inviterMap[u.id as string] = u.email as string
  }

  return (data ?? []).map(i => ({
    id:             i.id as string,
    email:          i.email as string,
    roleName:       ((i.roles as unknown as { name: string } | null)?.name) ?? '—',
    status:         i.status as string,
    expiresAt:      i.expires_at as string,
    invitedByEmail: i.invited_by ? (inviterMap[i.invited_by as string] ?? null) : null,
  }))
}

export async function listRolesWithCounts(): Promise<RoleWithCount[]> {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  if (!orgId) return []

  // All roles visible to this org (system + org-scoped)
  const { data: roles } = await supabase
    .from('roles')
    .select('id,key,name,description,color,org_id')
    .order('name', { ascending: true })

  const roleIds = (roles ?? []).map(r => r.id as string)

  // Member counts per role
  const { data: urData } = await supabase
    .from('user_roles').select('role_id').eq('org_id', orgId).in('role_id', roleIds)

  const memberCountMap: Record<string, number> = {}
  for (const ur of urData ?? []) {
    const rid = ur.role_id as string
    memberCountMap[rid] = (memberCountMap[rid] ?? 0) + 1
  }

  // Permission counts per role
  const { data: rpData } = await supabase
    .from('role_permissions').select('role_id').in('role_id', roleIds)

  const permCountMap: Record<string, number> = {}
  for (const rp of rpData ?? []) {
    const rid = rp.role_id as string
    permCountMap[rid] = (permCountMap[rid] ?? 0) + 1
  }

  return (roles ?? []).map(r => ({
    id:              r.id as string,
    key:             r.key as string,
    name:            (r.name as string | null) ?? (r.key as string),
    description:     r.description as string | null,
    color:           (r.color as string | null) ?? '#6b7280',
    isSystem:        r.org_id === null,
    memberCount:     memberCountMap[r.id as string] ?? 0,
    permissionCount: permCountMap[r.id as string] ?? 0,
  }))
}

export async function getRolePermissionKeys(roleId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('role_permissions').select('permission_key').eq('role_id', roleId)
  return (data ?? []).map(r => r.permission_key as string)
}

export async function getAllPermissions(): Promise<PermissionRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('permissions').select('key,module,description').order('module').order('key')
  return (data ?? []).map(p => ({
    key:         p.key as string,
    module:      p.module as string,
    description: p.description as string | null,
  }))
}

export async function getMemberDetailEnriched(userId: string): Promise<MemberDetailEnriched | null> {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  if (!orgId) return null

  const { data: mem } = await supabase
    .from('memberships')
    .select('user_id,is_default,joined_at,users!inner(id,email,full_name,phone,status,job_title,department)')
    .eq('org_id', orgId).eq('user_id', userId).maybeSingle()
  if (!mem) return null

  const { data: urs } = await supabase
    .from('user_roles')
    .select('user_id,role_id,roles!user_roles_role_id_fkey(key,name)')
    .eq('org_id', orgId).eq('user_id', userId)

  const roles = ((urs ?? []) as { user_id: string; roles: unknown }[])
    .map(ur => ur.roles as { key: string; name: string | null } | null)
    .filter(Boolean)
    .map(r => ({ key: r!.key, name: r!.name ?? r!.key }))

  // Effective permissions: union of all role permissions
  const roleIds = (urs ?? []).map(ur => (ur as { role_id: string }).role_id)
  let permissions: string[] = []
  if (roleIds.length > 0) {
    const { data: rpData } = await supabase
      .from('role_permissions').select('permission_key').in('role_id', roleIds)
    permissions = [...new Set((rpData ?? []).map(rp => rp.permission_key as string))]
  }

  const u = mem.users as unknown as {
    email: string; full_name: string | null; phone: string | null; status: string
    job_title: string | null; department: string | null
  }

  return {
    userId,
    email:      u?.email ?? '',
    fullName:   u?.full_name ?? '',
    phone:      u?.phone ?? '',
    status:     (u?.status as 'active' | 'inactive') ?? 'active',
    isDefault:  Boolean(mem.is_default),
    joinedAt:   mem.joined_at as string,
    roles,
    isOwner:    roles.some(r => r.key === 'company_owner'),
    jobTitle:   u?.job_title ?? null,
    department: u?.department ?? null,
    permissions,
  }
}

export async function getMemberActivity(userId: string): Promise<ActivityItem[]> {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  if (!orgId) return []

  const { data } = await supabase
    .from('audit_logs')
    .select('id,action,entity_type,entity_id,at,after')
    .eq('org_id', orgId).eq('actor_id', userId)
    .order('at', { ascending: false }).limit(50)

  return (data ?? []).map(a => ({
    id:         a.id as string,
    action:     a.action as string,
    entityType: a.entity_type as string,
    entityId:   a.entity_id as string,
    at:         a.at as string,
    after:      a.after as Record<string, unknown> | null,
  }))
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
