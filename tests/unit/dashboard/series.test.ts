import { describe, it, expect } from 'vitest'
import { buildDailySeries, dayKey, activityLabel } from '@/features/dashboard/series'

const NOW = new Date('2026-05-29T12:00:00.000Z')

describe('buildDailySeries', () => {
  it('returns a zero-filled window of the requested length, oldest → newest', () => {
    const s = buildDailySeries([], 14, NOW)
    expect(s).toHaveLength(14)
    expect(s[0]!.date).toBe('2026-05-16')
    expect(s[13]!.date).toBe(dayKey(NOW))
    expect(s.every((p) => p.count === 0)).toBe(true)
  })

  it('buckets events onto their UTC day', () => {
    const s = buildDailySeries(
      ['2026-05-29T01:00:00Z', '2026-05-29T23:00:00Z', '2026-05-28T10:00:00Z'],
      14,
      NOW,
    )
    expect(s.find((p) => p.date === '2026-05-29')!.count).toBe(2)
    expect(s.find((p) => p.date === '2026-05-28')!.count).toBe(1)
  })

  it('ignores events outside the window and invalid timestamps', () => {
    const s = buildDailySeries(['2026-01-01T00:00:00Z', 'not-a-date'], 14, NOW)
    expect(s.reduce((sum, p) => sum + p.count, 0)).toBe(0)
  })
})

describe('activityLabel', () => {
  it('maps actions to human labels', () => {
    expect(activityLabel('insert', 'memberships')).toBe('Membership created')
    expect(activityLabel('delete', 'user_roles')).toBe('User role removed')
    expect(activityLabel('login', 'users')).toBe('Signed in')
    expect(activityLabel('permission_change', 'user_roles')).toBe('Permissions changed')
  })
})
