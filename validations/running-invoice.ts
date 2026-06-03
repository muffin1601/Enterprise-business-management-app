import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const RI_PAGE_SIZE = 20

export const RI_STATUS_LABELS: Record<string, string> = {
  draft:     'Draft',
  validated: 'Validated',
  posted:    'Posted',
  sent:      'Sent',
  cancelled: 'Cancelled',
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export const RiStatus = z.enum(['draft','validated','posted','sent','cancelled'])

// ─── Create RI ────────────────────────────────────────────────────────────────

export const createRiSchema = z.object({
  soId:          z.string().uuid(),
  dcIds:         z.array(z.string().uuid()).min(1, 'Select at least one delivery challan'),
  date:          z.coerce.date().optional(),
  dueDate:       z.coerce.date().optional(),
  placeOfSupply: z.string().optional(),
  isIgst:        z.boolean().default(false),
  paymentTerms:  z.string().optional(),
  notes:         z.string().optional(),
  internalNotes: z.string().optional(),
})

// ─── Update RI (draft only) ───────────────────────────────────────────────────

export const updateRiSchema = z.object({
  dueDate:       z.coerce.date().optional().nullable(),
  placeOfSupply: z.string().optional(),
  isIgst:        z.boolean().optional(),
  paymentTerms:  z.string().optional(),
  notes:         z.string().optional(),
  internalNotes: z.string().optional(),
})

// ─── Add/Remove DC ────────────────────────────────────────────────────────────

export const addDcToRiSchema    = z.object({ riId: z.string().uuid(), dcId: z.string().uuid() })
export const removeDcFromRiSchema = z.object({ riId: z.string().uuid(), dcId: z.string().uuid() })

// ─── Status transition ────────────────────────────────────────────────────────

export const riStatusSchema = z.object({
  status: RiStatus,
  note:   z.string().optional(),
})

// ─── List filter ──────────────────────────────────────────────────────────────

export const riFilterSchema = z.object({
  q:          z.string().optional(),
  status:     z.enum(['all','draft','validated','posted','sent','cancelled']).default('all'),
  customerId: z.string().optional(),
  soId:       z.string().optional(),
  dateFrom:   z.coerce.date().optional(),
  dateTo:     z.coerce.date().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  sort:       z.enum(['date','due_date','grand_total','ri_no']).default('date'),
  order:      z.enum(['asc','desc']).default('desc'),
})

// ─── Exported Types ───────────────────────────────────────────────────────────

export type CreateRiInput    = z.infer<typeof createRiSchema>
export type UpdateRiInput    = z.infer<typeof updateRiSchema>
export type RiStatusInput    = z.infer<typeof riStatusSchema>
export type RiFilter         = z.infer<typeof riFilterSchema>
export type RiStatusType     = z.infer<typeof RiStatus>
