import { z } from 'zod'

// ── Lookup constants ───────────────────────────────────────────────────────────
export const GST_RATES = [0, 5, 12, 18, 28] as const
export const MOVEMENT_TYPES = ['receipt','issue','transfer','adjustment','opening','return'] as const
export const ADJUSTMENT_TYPES = ['add','sub'] as const

export const ITEM_STATUSES = ['active','inactive','archived'] as const
export const ITEM_STATUS_LABELS: Record<string, string> = {
  active:   'Active',
  inactive: 'Inactive',
  archived: 'Archived',
}

// ── Item schema ────────────────────────────────────────────────────────────────
export const itemSchema = z.object({
  name:         z.string().min(1, 'Item name is required').max(300),
  sku:          z.string().max(100).optional().nullable(),
  barcode:      z.string().max(100).optional().nullable(),
  description:  z.string().max(2000).optional().nullable(),
  familyId:     z.string().uuid().optional().nullable(),
  brandId:      z.string().uuid().optional().nullable(),
  unitId:       z.string().uuid().optional().nullable(),
  hsnCode:      z.string().max(20).optional().nullable(),
  gstRate:      z.coerce.number().min(0).max(100).optional().default(18),
  purchasePrice:z.coerce.number().min(0).optional().nullable(),
  sellingPrice: z.coerce.number().min(0).optional().nullable(),
  costPrice:    z.coerce.number().min(0).optional().nullable(),
  stock:        z.coerce.number().min(0).optional().default(0),
  minStock:     z.coerce.number().min(0).optional().default(0),
  reorderLevel: z.coerce.number().min(0).optional().default(0),
  maxStock:     z.coerce.number().min(0).optional().default(0),
  leadTimeDays: z.coerce.number().min(0).optional().default(0),
  weightKg:     z.coerce.number().min(0).optional().nullable(),
  dimensions:   z.object({
    l: z.coerce.number().optional(),
    w: z.coerce.number().optional(),
    h: z.coerce.number().optional(),
    unit: z.enum(['cm','mm','inch','m']).optional().default('cm'),
  }).optional().nullable(),
  tags:         z.array(z.string().max(50)).optional().default([]),
  notes:        z.string().max(2000).optional().nullable(),
  isActive:     z.boolean().optional().default(true),
  isImported:   z.boolean().optional().default(false),
  deliveryDays: z.coerce.number().min(0).optional().nullable(),
  // Import fields
  importCurrency:    z.enum(['INR','USD','EUR','CNY']).optional().nullable(),
  importPrice:       z.coerce.number().min(0).optional().nullable(),
  exchangeRate:      z.coerce.number().min(0).optional().nullable(),
  importDiscountPct: z.coerce.number().min(0).max(100).optional().nullable(),
  transportType:     z.enum(['lumpsum','percent']).optional().nullable(),
  transportValue:    z.coerce.number().min(0).optional().nullable(),
  customDutyPct:     z.coerce.number().min(0).optional().nullable(),
  profitMultiplier:  z.coerce.number().min(0).optional().nullable(),
  variantLabel:      z.string().max(200).optional().nullable(),
})
export type ItemInput = z.infer<typeof itemSchema>

// ── Lookup schemas ─────────────────────────────────────────────────────────────
export const familySchema = z.object({ name: z.string().min(1).max(100) })
export const brandSchema  = z.object({ name: z.string().min(1).max(100) })
export const unitSchema   = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100).optional(),
})

// ── Stock adjustment schema ────────────────────────────────────────────────────
export const adjustmentSchema = z.object({
  type:   z.enum(ADJUSTMENT_TYPES),
  qty:    z.coerce.number().min(0.001, 'Quantity must be greater than 0'),
  reason: z.string().min(1, 'Reason is required').max(500),
  refNo:  z.string().max(100).optional().nullable(),
})
export type AdjustmentInput = z.infer<typeof adjustmentSchema>

// ── Filter schema ──────────────────────────────────────────────────────────────
export const INVENTORY_PAGE_SIZE = 30

export const inventoryFilterSchema = z.object({
  q:        z.string().optional(),
  familyId: z.string().optional(),
  brandId:  z.string().optional(),
  status:   z.enum(['all','active','inactive','archived','low_stock','out_of_stock']).optional().default('all'),
  imported: z.enum(['all','imported','domestic']).optional().default('all'),
  page:     z.coerce.number().min(1).optional().default(1),
  sort:     z.enum(['name','sku','stock','purchase_price','selling_price','created_at']).optional().default('name'),
  order:    z.enum(['asc','desc']).optional().default('asc'),
})
export type InventoryFilter = z.infer<typeof inventoryFilterSchema>
