import { z } from 'zod'

// ─── Report view types ────────────────────────────────────────────────────────

export const REPORT_VIEWS = {
  current:        'Current Stock',
  low_stock:      'Low Stock Alert',
  valuation:      'Stock Valuation',
  movements:      'Movement Ledger',
  item_movements: 'Item-wise Summary',
  dispatches:     'Dispatch Summary',
} as const

export type ReportView = keyof typeof REPORT_VIEWS

export const stockReportViewSchema = z.enum([
  'current', 'low_stock', 'valuation',
  'movements', 'item_movements', 'dispatches',
])

// ─── Stock status ─────────────────────────────────────────────────────────────

export type StockStatus = 'out' | 'low' | 'ok' | 'over'

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out:  'Out of Stock',
  low:  'Low Stock',
  ok:   'In Stock',
  over: 'Overstock',
}

export function getStockStatus(stock: number, reorderLevel: number, minStock: number, maxStock?: number | null): StockStatus {
  if (stock === 0)                                  return 'out'
  if (stock <= (reorderLevel || minStock || 0))     return 'low'
  if (maxStock && maxStock > 0 && stock > maxStock) return 'over'
  return 'ok'
}

// ─── Filter schema ────────────────────────────────────────────────────────────

export const REPORT_PAGE_SIZE = 50

export const stockReportFilterSchema = z.object({
  view:      stockReportViewSchema.default('current'),
  search:    z.string().optional(),
  familyId:  z.string().uuid().optional(),
  brandId:   z.string().uuid().optional(),
  status:    z.enum(['all','ok','low','out','over']).default('all'),
  dateFrom:  z.coerce.date().optional(),
  dateTo:    z.coerce.date().optional(),
  sort:      z.enum(['name','stock','value','date','dc_no']).default('name'),
  order:     z.enum(['asc','desc']).default('asc'),
  page:      z.coerce.number().int().min(1).default(1),
})

export type StockReportFilter = z.infer<typeof stockReportFilterSchema>
