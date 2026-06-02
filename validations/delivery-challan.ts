import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const DC_PAGE_SIZE = 20

export const DC_STATUS_LABELS: Record<string, string> = {
  draft:      'Draft',
  dispatched: 'Dispatched',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
}

export const DC_STATUS_COLORS: Record<string, string> = {
  draft:      'grey',
  dispatched: 'blue',
  delivered:  'green',
  cancelled:  'red',
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export const DcStatus = z.enum(['draft', 'dispatched', 'delivered', 'cancelled'])

// ─── DC Item (inline in create schema) ───────────────────────────────────────

export const dcItemSchema = z.object({
  invoiceItemId: z.string().uuid(),
  qtyDispatched: z.number().min(0),
})

// ─── Create DC ────────────────────────────────────────────────────────────────

export const deliveryChallanSchema = z.object({
  invoiceId:        z.string().uuid(),
  date:             z.coerce.date().optional(),
  dispatchDate:     z.coerce.date().optional(),
  expectedDelivery: z.coerce.date().optional(),
  vehicleNo:        z.string().optional(),
  driverName:       z.string().optional(),
  lrNo:             z.string().optional(),
  transporterName:  z.string().optional(),
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  notes:            z.string().optional(),
  internalNotes:    z.string().optional(),
  items:            z.array(dcItemSchema).min(1, 'At least one item must be included'),
})

// ─── Update DC (draft only) ───────────────────────────────────────────────────

export const updateDcSchema = z.object({
  dispatchDate:     z.coerce.date().optional().nullable(),
  expectedDelivery: z.coerce.date().optional().nullable(),
  vehicleNo:        z.string().optional(),
  driverName:       z.string().optional(),
  lrNo:             z.string().optional(),
  transporterName:  z.string().optional(),
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  notes:            z.string().optional(),
  internalNotes:    z.string().optional(),
})

// ─── Update DC Item qty (draft only) ─────────────────────────────────────────

export const dcItemUpdateSchema = z.object({
  qtyDispatched: z.number().min(0),
})

// ─── Status transition ────────────────────────────────────────────────────────

export const dcStatusSchema = z.object({
  status: DcStatus,
  note:   z.string().optional(),
})

// ─── List filter ──────────────────────────────────────────────────────────────

export const dcFilterSchema = z.object({
  q:          z.string().optional(),
  status:     z.enum(['all', 'draft', 'dispatched', 'delivered', 'cancelled']).default('all'),
  customerId: z.string().optional(),
  dateFrom:   z.coerce.date().optional(),
  dateTo:     z.coerce.date().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  sort:       z.enum(['date', 'dc_no', 'dispatch_date']).default('date'),
  order:      z.enum(['asc', 'desc']).default('desc'),
})

// ─── Exported Types ───────────────────────────────────────────────────────────

export type DeliveryChallanInput  = z.infer<typeof deliveryChallanSchema>
export type UpdateDcInput         = z.infer<typeof updateDcSchema>
export type DcItemUpdateInput     = z.infer<typeof dcItemUpdateSchema>
export type DcStatusInput         = z.infer<typeof dcStatusSchema>
export type DcFilter              = z.infer<typeof dcFilterSchema>
export type DcStatusType          = z.infer<typeof DcStatus>
