import 'server-only'
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'

export type ActionContext = {
  userId: string
  orgId: string
  isSuperAdmin: boolean
  isOwner: boolean
  has: (key: string) => boolean
}

export class AuthError extends Error {
  constructor(public code: 'unauthenticated' | 'forbidden', message: string) {
    super(message)
  }
}

// cache() deduplicates this call within a single render tree —
// all server components on the same page share one result.
export const getActionContext = cache(async (): Promise<ActionContext> => {
  const [supabase, orgId] = await Promise.all([
    createSupabaseServerClient(),
    getActiveOrgId(),
  ])

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AuthError('unauthenticated', 'You must be signed in.')
  if (!orgId) throw new AuthError('forbidden', 'No active organization.')

  const isSuperAdmin =
    (user.app_metadata as Record<string, unknown> | undefined)?.is_super_admin === true

  // Run owner-check and role fetch in parallel
  const [ownerRow, ursData] = await Promise.all([
    supabase
      .from('user_roles')
      .select('id, roles!inner(key)')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .eq('roles.key', 'company_owner')
      .maybeSingle()
      .then(r => r.data),
    isSuperAdmin
      ? Promise.resolve(null)
      : supabase
          .from('user_roles')
          .select('role_id')
          .eq('org_id', orgId)
          .eq('user_id', user.id)
          .then(r => r.data),
  ])

  const isOwner = !!ownerRow
  let keys = new Set<string>()

  if (!isSuperAdmin && !isOwner && ursData?.length) {
    const roleIds = ursData.map(r => r.role_id as string)
    const { data: rps } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .in('role_id', roleIds)
    keys = new Set((rps ?? []).map(r => r.permission_key as string))
  }

  return {
    userId: user.id,
    orgId,
    isSuperAdmin,
    isOwner,
    has: (key: string) => isSuperAdmin || isOwner || keys.has(key),
  }
})

export function requirePermission(ctx: ActionContext, key: string) {
  if (!ctx.has(key)) throw new AuthError('forbidden', `Missing permission: ${key}`)
}
