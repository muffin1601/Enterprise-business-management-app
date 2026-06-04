import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SO_PAGE_SIZE = 20

export const SO_STATUS_LABELS: Record<string, string> = {
  draft:     'Draft',
  sent:      'Sent',
  accepted:  'Accepted',
  revised:   'Revised',
  cancelled: 'Cancelled',
}

export const SO_PRIORITY_LABELS: Record<string, string> = {
  low:    'Low',
  normal: 'Normal',
  high:   'High',
  urgent: 'Urgent',
}

export const SO_STATUS_COLORS: Record<string, string> = {
  draft:     'grey',
  sent:      'blue',
  accepted:  'green',
  revised:   'orange',
  cancelled: 'red',
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export const SoStatus = z.enum([
  'draft',
  'sent',
  'accepted',
  'revised',
  'cancelled',
])

export const SoPriority = z.enum(['low', 'normal', 'high', 'urgent'])

// ─── Create Sales Order ───────────────────────────────────────────────────────
// Called when converting an accepted quote to a sales order.

export const salesOrderSchema = z.object({
  quoteId:          z.string().uuid(),
  expectedDelivery: z.coerce.date().optional(),
  priority:         SoPriority.default('normal'),
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  // Bill To snapshot — optional overrides; defaults seeded from the customer master.
  billToName:       z.string().optional(),
  billToAddress:    z.string().optional(),
  billToPhone:      z.string().optional(),
  billToEmail:      z.string().email('Enter a valid email.').optional().or(z.literal('')),
  billToGstin:      z.string().optional(),
  notes:            z.string().optional(),
  internalNotes:    z.string().optional(),
})

// ─── Update Sales Order (editable fields only) ────────────────────────────────

export const updateSalesOrderSchema = z.object({
  expectedDelivery: z.coerce.date().optional().nullable(),
  priority:         SoPriority,
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  notes:            z.string().optional(),
  internalNotes:    z.string().optional(),
  terms:            z.array(z.object({ category: z.string(), text: z.string().min(1) })).optional(),
})

// ─── Status Transition ────────────────────────────────────────────────────────

export const soStatusUpdateSchema = z.object({
  status: SoStatus,
  note:   z.string().optional(),
})

// ─── Advance Payment ─────────────────────────────────────────────────────────

export const soAdvanceSchema = z.object({
  advanceAmount:   z.number().min(0),
  advanceReceived: z.boolean().default(false),
  advanceDate:     z.coerce.date().optional(),
  advanceNote:     z.string().optional(),
})

// ─── Delivery Details ─────────────────────────────────────────────────────────

export const soDeliverySchema = z.object({
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  expectedDelivery: z.coerce.date().optional().nullable(),
})

// ─── Billing / Bill To Details ────────────────────────────────────────────────

export const soBillingSchema = z.object({
  billToName:    z.string().optional(),
  billToAddress: z.string().optional(),
  billToPhone:   z.string().optional(),
  billToEmail:   z.string().email('Enter a valid email.').optional().or(z.literal('')),
  billToGstin:   z.string().optional(),
})

// ─── Item Qty Delivered ───────────────────────────────────────────────────────

export const soItemDeliverySchema = z.object({
  items: z.array(
    z.object({
      id:           z.string().uuid(),
      qty:          z.number().positive(),
      qtyDelivered: z.number().min(0),
    }).refine(d => d.qtyDelivered <= d.qty, {
      message: 'Delivered quantity cannot exceed ordered quantity',
    }),
  ),
})

// ─── List Filter ──────────────────────────────────────────────────────────────

export const soFilterSchema = z.object({
  q:          z.string().optional(),
  status:     z.enum(['all','draft','sent','accepted','revised','cancelled']).default('all'),
  priority:   z.enum(['all','low','normal','high','urgent']).default('all'),
  customerId: z.string().optional(),
  dateFrom:   z.coerce.date().optional(),
  dateTo:     z.coerce.date().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  sort:       z.enum(['date','grand_total','so_no','expected_delivery']).default('date'),
  order:      z.enum(['asc','desc']).default('desc'),
})

// ─── Exported Types ───────────────────────────────────────────────────────────

export type SalesOrderInput       = z.infer<typeof salesOrderSchema>
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>
export type SoStatusUpdate        = z.infer<typeof soStatusUpdateSchema>
export type SoAdvanceInput        = z.infer<typeof soAdvanceSchema>
export type SoDeliveryInput       = z.infer<typeof soDeliverySchema>
export type SoBillingInput        = z.infer<typeof soBillingSchema>
export type SoItemDeliveryInput   = z.infer<typeof soItemDeliverySchema>
export type SoFilter              = z.infer<typeof soFilterSchema>
export type SoStatusType          = z.infer<typeof SoStatus>
export type SoPriorityType        = z.infer<typeof SoPriority>
