/** Shared display formatters. */

export function formatMoney(value: number | null | undefined, currency = 'INR'): string {
  if (value == null) return '—'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

export function formatQty(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(value)
}
