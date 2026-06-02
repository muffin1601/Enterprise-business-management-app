import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PO_PAGE_SIZE = 20

export const PO_STATUS_LABELS: Record<string, string> = {
  draft:               'Draft',
  pending_approval:    'Pending Approval',
  approved:            'Approved',
  sent:                'Sent to Vendor',
  partially_received:  'Partial GRN',
  received:            'Received',
  closed:              'Closed',
  cancelled:           'Cancelled',
}

export const PO_STATUS_COLORS: Record<string, string> = {
  draft:               'grey',
  pending_approval:    'orange',
  approved:            'blue',
  sent:                'purple',
  partially_received:  'amber',
  received:            'teal',
  closed:              'green',
  cancelled:           'red',
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PoStatus = z.enum([
  'draft','pending_approval','approved','sent',
  'partially_received','received','closed','cancelled',
])

// ─── Create PO ────────────────────────────────────────────────────────────────

export const purchaseOrderSchema = z.object({
  invoiceId:        z.string().uuid(),
  vendorId:         z.string().uuid(),
  date:             z.coerce.date().optional(),
  expectedDelivery: z.coerce.date().optional(),
  paymentTerms:     z.string().optional(),
  isIgst:           z.boolean().default(false),
  transport:        z.number().min(0).default(0),
  transportNote:    z.string().optional(),
  notes:            z.string().optional(),
  internalNotes:    z.string().optional(),
})

// ─── Update PO (draft only) ───────────────────────────────────────────────────

export const updatePurchaseOrderSchema = z.object({
  vendorId:         z.string().uuid().optional(),
  expectedDelivery: z.coerce.date().optional().nullable(),
  paymentTerms:     z.string().optional(),
  isIgst:           z.boolean().optional(),
  transport:        z.number().min(0).optional(),
  transportNote:    z.string().optional(),
  notes:            z.string().optional(),
  internalNotes:    z.string().optional(),
  terms:            z.array(z.object({ category: z.string(), text: z.string().min(1) })).optional(),
})

// ─── Update PO Item (draft only) ─────────────────────────────────────────────

export const poItemUpdateSchema = z.object({
  qtyOrdered:  z.number().min(0),
  rate:        z.number().min(0),
  discountPct: z.number().min(0).max(100).default(0),
  hsnCode:     z.string().optional(),
  gstPct:      z.number().min(0).max(100).default(18),
})

// ─── Status Transition ────────────────────────────────────────────────────────

export const poStatusSchema = z.object({
  status: PoStatus,
  note:   z.string().optional(),
})

// ─── GRN ─────────────────────────────────────────────────────────────────────

export const grnItemSchema = z.object({
  poItemId:    z.string().uuid(),
  qtyReceived: z.number().positive(),
  batchNo:     z.string().optional(),
})

export const grnSchema = z.object({
  date:         z.coerce.date(),
  deliveryNote: z.string().optional(),
  notes:        z.string().optional(),
  items:        z.array(grnItemSchema).min(1, 'At least one item must be received'),
})

// ─── List Filter ──────────────────────────────────────────────────────────────

export const poFilterSchema = z.object({
  q:        z.string().optional(),
  status:   z.enum(['all','draft','pending_approval','approved','sent','partially_received','received','closed','cancelled']).default('all'),
  vendorId: z.string().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  sort:     z.enum(['date','grand_total','po_no','expected_delivery']).default('date'),
  order:    z.enum(['asc','desc']).default('desc'),
})

// ─── Exported Types ───────────────────────────────────────────────────────────

export type PurchaseOrderInput      = z.infer<typeof purchaseOrderSchema>
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>
export type PoItemUpdateInput        = z.infer<typeof poItemUpdateSchema>
export type PoStatusInput            = z.infer<typeof poStatusSchema>
export type GrnInput                 = z.infer<typeof grnSchema>
export type PoFilter                 = z.infer<typeof poFilterSchema>
export type PoStatusType             = z.infer<typeof PoStatus>
