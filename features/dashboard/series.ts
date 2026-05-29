/**
 * Pure helpers for the dashboard activity chart. No DB/IO so they're unit-testable
 * and shared between the route handler and tests.
 */

export type DayPoint = { date: string; count: number }

/** YYYY-MM-DD in UTC for a date. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Bucket event timestamps into a zero-filled series for the last `days` days
 * (inclusive of today), oldest → newest. Events outside the window are ignored.
 */
export function buildDailySeries(timestamps: string[], days: number, now: Date): DayPoint[] {
  const counts = new Map<string, number>()
  // Seed the window with zeros so sparse data still renders a full axis.
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))

  const order: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const key = dayKey(d)
    counts.set(key, 0)
    order.push(key)
  }

  for (const ts of timestamps) {
    const t = new Date(ts)
    if (Number.isNaN(t.getTime())) continue
    const key = dayKey(t)
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return order.map((date) => ({ date, count: counts.get(date) ?? 0 }))
}

/** Human label for an audit action + entity (e.g. "Member added"). */
export function activityLabel(action: string, entityType: string): string {
  const entity = entityType.replace(/_/g, ' ').replace(/s$/, '')
  switch (action) {
    case 'insert':
      return `${cap(entity)} created`
    case 'update':
      return `${cap(entity)} updated`
    case 'delete':
      return `${cap(entity)} removed`
    case 'login':
      return 'Signed in'
    case 'permission_change':
      return 'Permissions changed'
    case 'restore':
      return `${cap(entity)} restored`
    default:
      return `${cap(entity)} ${action}`
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
