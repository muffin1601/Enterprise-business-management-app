/**
 * Uniform Server Action return contract (API_DESIGN.md §2.1).
 * Actions never throw across the client boundary — they return this union.
 */
export type ActionOk<T> = { ok: true; data: T }
export type ActionErr = { ok: false; error: ActionError }
export type ActionResult<T> = ActionOk<T> | ActionErr

export type ActionErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'state_transition'
  | 'plan_limit'
  | 'seat_limit'
  | 'rate_limited'
  | 'idempotent_replay'
  | 'internal'

export type ActionError = {
  code: ActionErrorCode
  /** user-safe message */
  message: string
  /** mirrors Zod flatten().fieldErrors for React Hook Form setError */
  fieldErrors?: Record<string, string[]>
  details?: Record<string, unknown>
}

export const ok = <T>(data: T): ActionOk<T> => ({ ok: true, data })

export const err = (
  code: ActionErrorCode,
  message: string,
  extra?: Pick<ActionError, 'fieldErrors' | 'details'>,
): ActionErr => ({ ok: false, error: { code, message, ...extra } })
