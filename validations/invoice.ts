import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

export const INV_PAGE_SIZE = 20

export const INV_STATUS_LABELS: Record<string, string> = {
  draft:         'Draft',
  issued:        'Issued',
  paid:          'Paid',
  partially_paid:'Partial',
  cancelled:     'Cancelled',
}

export const INV_STATUS_COLORS: Record<string, string> = {
  draft:         'grey',
  issued:        'blue',
  paid:          'green',
  partially_paid:'orange',
  cancelled:     'red',
}

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash:          'Cash',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
  upi:           'UPI',
  other:         'Other',
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export const InvoiceStatus = z.enum(['draft','issued','paid','partially_paid','cancelled'])

export const PaymentMode = z.enum(['cash','bank_transfer','cheque','upi','other'])

// ─── Create Invoice ───────────────────────────────────────────────────────────

export const invoiceSchema = z.object({
  soId:          z.string().uuid(),
  date:          z.coerce.date().optional(),
  dueDate:       z.coerce.date().optional(),
  placeOfSupply: z.string().optional(),
  isIgst:        z.boolean().default(false),
  paymentTerms:  z.string().optional(),
  notes:         z.string().optional(),
})

// ─── Update Invoice (draft only, editable fields) ─────────────────────────────

export const updateInvoiceSchema = z.object({
  dueDate:       z.coerce.date().optional().nullable(),
  placeOfSupply: z.string().optional(),
  isIgst:        z.boolean().optional(),
  paymentTerms:  z.string().optional(),
  notes:         z.string().optional(),
  terms:         z.array(z.object({ category: z.string(), text: z.string().min(1) })).optional(),
})

// ─── Update Invoice Item (draft only) ────────────────────────────────────────

export const updateInvoiceItemSchema = z.object({
  hsnCode:     z.string().optional(),
  qty:         z.number().positive().optional(),
  rate:        z.number().min(0).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  gstPct:      z.number().min(0).max(100).optional(),
})

// ─── Status Transition ────────────────────────────────────────────────────────

export const invoiceStatusSchema = z.object({
  status: InvoiceStatus,
  note:   z.string().optional(),
})

// ─── Record Payment ───────────────────────────────────────────────────────────

export const invoicePaymentSchema = z.object({
  amount:      z.number().positive({ message: 'Amount must be greater than 0' }),
  paymentDate: z.coerce.date(),
  paymentMode: PaymentMode.default('bank_transfer'),
  referenceNo: z.string().optional(),
  note:        z.string().optional(),
})

// ─── List Filter ──────────────────────────────────────────────────────────────

export const invoiceFilterSchema = z.object({
  q:          z.string().optional(),
  status:     z.enum(['all','draft','issued','paid','partially_paid','cancelled']).default('all'),
  customerId: z.string().optional(),
  overdue:    z.coerce.boolean().optional(),
  dateFrom:   z.coerce.date().optional(),
  dateTo:     z.coerce.date().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  sort:       z.enum(['date','due_date','grand_total','invoice_no']).default('date'),
  order:      z.enum(['asc','desc']).default('desc'),
})

// ─── Exported Types ───────────────────────────────────────────────────────────

export type InvoiceInput         = z.infer<typeof invoiceSchema>
export type UpdateInvoiceInput   = z.infer<typeof updateInvoiceSchema>
export type UpdateInvoiceItemInput = z.infer<typeof updateInvoiceItemSchema>
export type InvoiceStatusInput   = z.infer<typeof invoiceStatusSchema>
export type InvoicePaymentInput  = z.infer<typeof invoicePaymentSchema>
export type InvoiceFilter        = z.infer<typeof invoiceFilterSchema>
export type InvoiceStatusType    = z.infer<typeof InvoiceStatus>
export type PaymentModeType      = z.infer<typeof PaymentMode>
