/**
 * Import landed-cost calculator (PROJECT_PLAN.md §7.1). Pure + unit-tested;
 * the single source of truth for item cost/price math, used by the item form
 * preview and the server action that persists purchase_price/selling_price.
 *
 *   base       = import_price × exchange_rate
 *   afterDisc  = base × (1 − import_discount_pct/100)
 *   transport  = lumpsum ? transport_value : afterDisc × transport_value/100
 *   withTrans  = afterDisc + transport
 *   costPrice  = withTrans × (1 + custom_duty_pct/100)   → purchase_price
 *   sellPrice  = costPrice × profit_multiplier            → selling_price
 */
export type TransportType = 'lumpsum' | 'percent'

export interface CostingInput {
  importPrice: number
  exchangeRate: number
  importDiscountPct?: number
  transportType?: TransportType
  transportValue?: number
  customDutyPct?: number
  profitMultiplier?: number
}

export interface CostingBreakdown {
  base: number
  afterDiscount: number
  transport: number
  withTransport: number
  costPrice: number
  sellingPrice: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const num = (n: number | undefined, fallback = 0) => (Number.isFinite(n) ? (n as number) : fallback)

export function computeLandedCost(input: CostingInput): CostingBreakdown {
  const importPrice = num(input.importPrice)
  const exchangeRate = num(input.exchangeRate)
  const discountPct = num(input.importDiscountPct)
  const transportValue = num(input.transportValue)
  const customDutyPct = num(input.customDutyPct)
  const profitMultiplier = num(input.profitMultiplier, 1)

  const base = importPrice * exchangeRate
  const afterDiscount = base * (1 - discountPct / 100)
  const transport =
    input.transportType === 'lumpsum' ? transportValue : afterDiscount * (transportValue / 100)
  const withTransport = afterDiscount + transport
  const costPrice = withTransport * (1 + customDutyPct / 100)
  const sellingPrice = costPrice * profitMultiplier

  return {
    base: round2(base),
    afterDiscount: round2(afterDiscount),
    transport: round2(transport),
    withTransport: round2(withTransport),
    costPrice: round2(costPrice),
    sellingPrice: round2(sellingPrice),
  }
}
