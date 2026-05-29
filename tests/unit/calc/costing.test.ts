import { describe, it, expect } from 'vitest'
import { computeLandedCost } from '@/lib/calc/costing'

describe('computeLandedCost (PROJECT_PLAN §7.1)', () => {
  it('computes the full trail with percent transport', () => {
    // base=1000, afterDisc=900 (10%), transport=45 (5% of 900), withTrans=945,
    // cost=992.25 (5% duty), sell=1339.54 (×1.35)
    const r = computeLandedCost({
      importPrice: 100,
      exchangeRate: 10,
      importDiscountPct: 10,
      transportType: 'percent',
      transportValue: 5,
      customDutyPct: 5,
      profitMultiplier: 1.35,
    })
    expect(r.base).toBe(1000)
    expect(r.afterDiscount).toBe(900)
    expect(r.transport).toBe(45)
    expect(r.withTransport).toBe(945)
    expect(r.costPrice).toBe(992.25)
    expect(r.sellingPrice).toBe(1339.54)
  })

  it('uses a flat transport amount for lumpsum', () => {
    const r = computeLandedCost({
      importPrice: 100,
      exchangeRate: 10,
      transportType: 'lumpsum',
      transportValue: 250,
      profitMultiplier: 2,
    })
    expect(r.afterDiscount).toBe(1000)
    expect(r.transport).toBe(250)
    expect(r.costPrice).toBe(1250)
    expect(r.sellingPrice).toBe(2500)
  })

  it('defaults a missing profit multiplier to 1 (cost == sell)', () => {
    const r = computeLandedCost({ importPrice: 50, exchangeRate: 2 })
    expect(r.costPrice).toBe(100)
    expect(r.sellingPrice).toBe(100)
  })

  it('tolerates undefined optionals without NaN', () => {
    const r = computeLandedCost({ importPrice: 10, exchangeRate: 1 })
    expect(Number.isNaN(r.sellingPrice)).toBe(false)
  })
})
