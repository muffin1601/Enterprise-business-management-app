import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext } from '@/lib/auth/action-context'
import { activityLabel, buildDailySeries, type DayPoint } from '@/features/dashboard/series'

/**
 * Dashboard read models, built only from the existing identity schema
 * (organizations, memberships, invitations, user_roles, users, audit_logs).
 * Each query is RLS-respecting via the authenticated client, so results
 * naturally narrow to what the caller may see. No mock data.
 */

export type DashboardOverview = {
  user: { fullName: string; email: string; roles: string[] }
  org: { name: string; currency: string; gstin: string | null; createdAt: string; ageDays: number }
  kpis: { members: number; activeMembers: number; pendingInvites: number; rolesInUse: number }
  perms: { canManageUsers: boolean; canViewAudit: boolean }
}

export type ActivityItem = {
  id: string
  label: string
  action: string
  entityType: string
  at: string
  actorName: string | null
}
export type DashboardActivity = { recent: ActivityItem[]; series: DayPoint[]; canView: boolean }

export type DashboardNotice = { id: string; email: string; roleName: string; expiresAt: string }
export type DashboardNotices = { invitations: DashboardNotice[] }

const ACTIVITY_WINDOW_DAYS = 14

export async function getOverview(now: Date): Promise<DashboardOverview> {
  const ctx = await getActionContext()
  const supabase = await createSupabaseServerClient()

  const [{ data: profile }, { data: org }, { data: roleRows }, { data: mems }, { data: invs }] =
    await Promise.all([
      supabase.from('users').select('full_name, email').eq('id', ctx.userId).maybeSingle(),
      supabase
        .from('organizations')
        .select('name, currency, gstin, created_at')
        .eq('id', ctx.orgId)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('user_id, roles!user_roles_role_id_fkey(name)')
        .eq('org_id', ctx.orgId),
      supabase
        .from('memberships')
        .select('user_id, users!inner(status)')
        .eq('org_id', ctx.orgId),
      supabase.from('invitations').select('id').eq('org_id', ctx.orgId).eq('status', 'pending'),
    ])

  const myRoles = (roleRows ?? [])
    .filter((r) => r.user_id === ctx.userId)
    .map((r) => (r.roles as unknown as { name: string } | null)?.name)
    .filter((n): n is string => Boolean(n))

  const members = mems ?? []
  const activeMembers = members.filter(
    (m) => (m.users as unknown as { status: string } | null)?.status === 'active',
  ).length
  const rolesInUse = new Set((roleRows ?? []).map((r) => (r.roles as unknown as { name: string } | null)?.name)).size

  const createdAt = (org?.created_at as string) ?? now.toISOString()
  const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000))

  return {
    user: {
      fullName: (profile?.full_name as string | null) ?? '',
      email: (profile?.email as string) ?? '',
      roles: myRoles,
    },
    org: {
      name: (org?.name as string) ?? '',
      currency: (org?.currency as string) ?? 'INR',
      gstin: (org?.gstin as string | null) ?? null,
      createdAt,
      ageDays,
    },
    kpis: {
      members: members.length,
      activeMembers,
      pendingInvites: (invs ?? []).length,
      rolesInUse,
    },
    perms: {
      canManageUsers: ctx.has('admin.users'),
      canViewAudit: ctx.isOwner || ctx.isSuperAdmin || ctx.has('admin.audit'),
    },
  }
}

export async function getActivity(now: Date): Promise<DashboardActivity> {
  const ctx = await getActionContext()
  const canView = ctx.isOwner || ctx.isSuperAdmin || ctx.has('admin.audit')
  if (!canView) return { recent: [], series: buildDailySeries([], ACTIVITY_WINDOW_DAYS, now), canView }

  const supabase = await createSupabaseServerClient()
  const since = new Date(now)
  since.setUTCDate(since.getUTCDate() - (ACTIVITY_WINDOW_DAYS - 1))
  since.setUTCHours(0, 0, 0, 0)

  // RLS audit_select gates this to members holding admin.audit (or owner/super).
  const { data } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, at, users!audit_logs_actor_id_fkey(full_name)')
    .eq('org_id', ctx.orgId)
    .gte('at', since.toISOString())
    .order('at', { ascending: false })
    .limit(300)

  const rows = data ?? []
  const recent: ActivityItem[] = rows.slice(0, 8).map((r) => ({
    id: r.id as string,
    label: activityLabel(r.action as string, r.entity_type as string),
    action: r.action as string,
    entityType: r.entity_type as string,
    at: r.at as string,
    actorName: (r.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }))
  const series = buildDailySeries(rows.map((r) => r.at as string), ACTIVITY_WINDOW_DAYS, now)

  return { recent, series, canView }
}

export async function getNotices(): Promise<DashboardNotices> {
  const ctx = await getActionContext()
  const supabase = await createSupabaseServerClient()
  // RLS inv_select gates this to admin.users holders.
  const { data } = await supabase
    .from('invitations')
    .select('id, email, expires_at, roles!invitations_role_id_fkey(name)')
    .eq('org_id', ctx.orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    invitations: (data ?? []).map((i) => ({
      id: i.id as string,
      email: i.email as string,
      roleName: (i.roles as unknown as { name: string } | null)?.name ?? '—',
      expiresAt: i.expires_at as string,
    })),
  }
}
