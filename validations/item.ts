import { z } from 'zod'
import { nonEmpty, uuid } from './common'

/** Optional uuid coming from a <select> ('' = none). */
const optionalUuid = z.string().uuid().optional().or(z.literal(''))

/** Optional numeric from a text input: '' / null → undefined, else coerce. */
const optionalNumber = (max?: number) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    (max == null ? z.coerce.number().min(0) : z.coerce.number().min(0).max(max)).optional(),
  )

export const CURRENCIES = ['INR', 'USD', 'EUR', 'CNY'] as const

/**
 * Item create/edit. Domestic items take purchase/selling price directly;
 * imported items derive them from the landed-cost fields (lib/calc/costing),
 * which is why import price + exchange rate are required when isImported.
 */
export const itemSchema = z
  .object({
    name: nonEmpty('Item name').max(200),
    sku: z.string().trim().max(60).optional().or(z.literal('')),
    familyId: optionalUuid,
    brandId: optionalUuid,
    unitId: optionalUuid,
    variantLabel: z.string().trim().max(120).optional().or(z.literal('')),
    imageUrl: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
    isImported: z.boolean().default(false),
    deliveryDays: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce.number().int().min(0).optional(),
    ),
    stock: optionalNumber(),
    purchasePrice: optionalNumber(),
    sellingPrice: optionalNumber(),
    // Import (landed-cost) fields
    importCurrency: z.enum(CURRENCIES).optional(),
    importPrice: optionalNumber(),
    exchangeRate: optionalNumber(),
    importDiscountPct: optionalNumber(100),
    transportType: z.enum(['lumpsum', 'percent']).optional(),
    transportValue: optionalNumber(),
    customDutyPct: optionalNumber(100),
    profitMultiplier: optionalNumber(),
  })
  .refine((d) => !d.isImported || (d.importPrice != null && d.exchangeRate != null), {
    message: 'Import price and exchange rate are required for imported items',
    path: ['importPrice'],
  })
export type ItemInput = z.infer<typeof itemSchema>

export const familySchema = z.object({ name: nonEmpty('Name').max(80) })
export type FamilyInput = z.infer<typeof familySchema>

export const brandSchema = z.object({ name: nonEmpty('Name').max(80) })
export type BrandInput = z.infer<typeof brandSchema>

export const unitSchema = z.object({
  code: nonEmpty('Code').max(12),
  name: z.string().trim().max(40).optional().or(z.literal('')),
})
export type UnitInput = z.infer<typeof unitSchema>

export const deleteItemSchema = z.object({ id: uuid })

/** List query params (parsed from the URL) — drives search/filter/pagination. */
export const itemFilterSchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  familyId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  imported: z.enum(['all', 'imported', 'domestic']).default('all'),
  lowStock: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional()
    .default(false),
  page: z.coerce.number().int().min(1).default(1),
})
export type ItemFilter = z.infer<typeof itemFilterSchema>

export const PAGE_SIZE = 20
/** Low-stock threshold (PROJECT_PLAN: <100 units flagged). */
export const LOW_STOCK_THRESHOLD = 100
