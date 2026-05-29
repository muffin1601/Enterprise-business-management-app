import 'server-only'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * App-layer audit intent events (AUDIT_LOGS.md §3b).
 *
 * Row-level CRUD on audited tables is covered automatically by the database
 * trigger `app.fn_audit` (migration 0004) — that is the *coverage guarantee*.
 * This helper is for **intent** events the trigger cannot infer, primarily
 * `login` (action='login') which mutates no row.
 *
 * `audit_logs.org_id` is NOT NULL, so an event must be scoped to an org. The
 * insert relies on the `audit_insert` RLS policy
 * (`is_member(org_id) AND actor_id = auth.uid()`), so it only succeeds for an
 * org the actor belongs to. Auth events are therefore best-effort: if the user
 * has no org yet (pre-onboarding) the event is skipped — there is nothing to
 * scope it to. Audit must never break the primary action, so failures are
 * swallowed (and would surface via Sentry once wired).
 */

export type AuditAction =
  | 'insert'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'permission_change'

export interface AuditIntent {
  orgId: string
  actorId: string | null
  entityType: string
  entityId: string
  action: AuditAction
  /** Curated post-image / event payload (e.g. { event:'login', method:'password' }). */
  after?: Record<string, unknown>
  before?: Record<string, unknown>
}

/** Read request context (forwarded client IP, UA) from the incoming headers. */
export async function getRequestContext() {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  return {
    ip: fwd ? (fwd.split(',')[0]?.trim() ?? null) : null,
    userAgent: h.get('user-agent'),
  }
}

/**
 * Write a single intent row to audit_logs via the authenticated client.
 * Returns true if written, false if skipped/failed (never throws).
 */
export async function recordAuditEvent(intent: AuditIntent): Promise<boolean> {
  try {
    const { ip, userAgent } = await getRequestContext()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('audit_logs').insert({
      org_id: intent.orgId,
      actor_id: intent.actorId,
      entity_type: intent.entityType,
      entity_id: intent.entityId,
      action: intent.action,
      before: intent.before ?? null,
      after: intent.after ?? null,
      ip,
      user_agent: userAgent,
    })
    return !error
  } catch {
    return false
  }
}

/** Convenience: record a successful login against the user's active org. */
export async function recordLogin(params: {
  orgId: string
  userId: string
  method: 'password' | 'magic_link' | 'oauth'
}): Promise<boolean> {
  return recordAuditEvent({
    orgId: params.orgId,
    actorId: params.userId,
    entityType: 'users',
    entityId: params.userId,
    action: 'login',
    after: { event: 'login', method: params.method, success: true },
  })
}
