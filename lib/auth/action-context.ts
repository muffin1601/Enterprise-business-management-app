import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'

/**
 * Server-action authorization context (API_DESIGN.md §2.3).
 *
 * Resolves the caller, their active org (validated against memberships, never
 * trusted from the client body), super-admin flag, and a synchronous `has(key)`
 * over their granted permission keys in that org. RLS remains the final
 * backstop; this is layer-2 defense-in-depth.
 */
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

export async function getActionContext(): Promise<ActionContext> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError('unauthenticated', 'You must be signed in.')

  const orgId = await getActiveOrgId()
  if (!orgId) throw new AuthError('forbidden', 'No active organization.')

  const isSuperAdmin =
    (user.app_metadata as Record<string, unknown> | undefined)?.is_super_admin === true

  // Owner short-circuit (implicit-all) — PERMISSIONS.md §1.1.
  const { data: ownerRow } = await supabase
    .from('user_roles')
    .select('id, roles!inner(key)')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('roles.key', 'company_owner')
    .maybeSingle()
  const isOwner = !!ownerRow

  let keys = new Set<string>()
  if (!isSuperAdmin && !isOwner) {
    const { data: urs } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
    const roleIds = (urs ?? []).map((r) => r.role_id as string)
    if (roleIds.length) {
      const { data: rps } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .in('role_id', roleIds)
      keys = new Set((rps ?? []).map((r) => r.permission_key as string))
    }
  }

  return {
    userId: user.id,
    orgId,
    isSuperAdmin,
    isOwner,
    has: (key: string) => isSuperAdmin || isOwner || keys.has(key),
  }
}

/** Throws AuthError('forbidden') if the key is absent (mapped to ActionErr by callers). */
export function requirePermission(ctx: ActionContext, key: string) {
  if (!ctx.has(key)) throw new AuthError('forbidden', `Missing permission: ${key}`)
}
