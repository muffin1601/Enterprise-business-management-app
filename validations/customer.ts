import { z } from 'zod'

const optText  = z.string().max(500).optional().nullable()
const optEmail = z.union([z.string().email('Invalid email'), z.literal('')]).optional().nullable()
const optPhone = z.string().max(20).optional().nullable()

export const CUSTOMER_TYPES = [
  'retail','wholesale','distributor','contractor','architect','government','other',
] as const

export const PAYMENT_TERMS = [
  'immediate','net_7','net_15','net_30','net_45','net_60','net_90',
] as const

export const CUSTOMER_STATUSES = ['active','inactive','blocked'] as const

export const PAYMENT_MODES = ['neft','rtgs','cheque','cash','upi','card','other'] as const

export const PAYMENT_TERMS_LABELS: Record<typeof PAYMENT_TERMS[number], string> = {
  immediate: 'Immediate', net_7: 'Net 7 days', net_15: 'Net 15 days',
  net_30: 'Net 30 days', net_45: 'Net 45 days', net_60: 'Net 60 days', net_90: 'Net 90 days',
}

export const PAYMENT_MODE_LABELS: Record<typeof PAYMENT_MODES[number], string> = {
  neft: 'NEFT', rtgs: 'RTGS', cheque: 'Cheque', cash: 'Cash',
  upi: 'UPI', card: 'Card', other: 'Other',
}

export const CUSTOMER_TYPE_LABELS: Record<typeof CUSTOMER_TYPES[number], string> = {
  retail: 'Retail', wholesale: 'Wholesale', distributor: 'Distributor',
  contractor: 'Contractor', architect: 'Architect', government: 'Government', other: 'Other',
}

export const DOC_CATEGORIES = [
  { value: 'gst_certificate', label: 'GST Certificate' },
  { value: 'pan',             label: 'PAN Card' },
  { value: 'contract',        label: 'Contract' },
  { value: 'purchase_order',  label: 'Purchase Order' },
  { value: 'other',           label: 'Other' },
]

export const customerSchema = z.object({
  name:             z.string().min(1, 'Company name is required').max(200),
  contactPerson:    optText,
  phone:            optPhone,
  email:            optEmail,
  website:          optText,
  gstin:            z.string().max(15).optional().nullable(),
  pan:              z.string().max(10).optional().nullable(),
  industry:         optText,
  type:             z.enum(CUSTOMER_TYPES).optional().default('retail'),
  status:           z.enum(CUSTOMER_STATUSES).optional().default('active'),
  creditLimit:      z.coerce.number().min(0).optional().default(0),
  paymentTerms:     z.enum(PAYMENT_TERMS).optional().default('net_30'),
  postSaleDiscount: z.coerce.number().min(0).max(100).optional().default(0),
  billingName:      optText,
  billingAddress:   optText,
  deliveryName:     optText,
  deliveryAddress:  optText,
  sameAsBilling:    z.boolean().optional().default(false),
  notes:            z.string().max(2000).optional().nullable(),
})
export type CustomerInput = z.infer<typeof customerSchema>

export const contactSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100),
  designation: optText,
  email:       optEmail,
  phone:       optPhone,
  isPrimary:   z.boolean().optional().default(false),
})
export type ContactInput = z.infer<typeof contactSchema>

export const addressSchema = z.object({
  label:        z.string().min(1).max(50).default('office'),
  addressLine1: z.string().min(1, 'Address is required').max(300),
  addressLine2: optText,
  city:         optText,
  state:        optText,
  country:      z.string().max(100).optional().default('India'),
  pincode:      z.string().max(10).optional().nullable(),
  isBilling:    z.boolean().optional().default(false),
  isShipping:   z.boolean().optional().default(false),
  isDefault:    z.boolean().optional().default(false),
})
export type AddressInput = z.infer<typeof addressSchema>

export const noteSchema = z.object({
  content:  z.string().min(1, 'Note cannot be empty').max(2000),
  isPinned: z.boolean().optional().default(false),
})
export type NoteInput = z.infer<typeof noteSchema>

export const paymentSchema = z.object({
  date:      z.string().min(1, 'Date is required'),
  amount:    z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  mode:      z.enum(PAYMENT_MODES, { required_error: 'Select a payment mode' }),
  reference: z.string().max(100).optional().nullable(),
  notes:     z.string().max(500).optional().nullable(),
})
export type PaymentInput = z.infer<typeof paymentSchema>

export const PAGE_SIZE = 25

export const customerFilterSchema = z.object({
  q:      z.string().optional(),
  status: z.enum(['all', ...CUSTOMER_STATUSES]).optional().default('all'),
  type:   z.enum(['all', ...CUSTOMER_TYPES]).optional().default('all'),
  page:   z.coerce.number().min(1).optional().default(1),
  sort:   z.enum(['name','code','status','created_at']).optional().default('name'),
  order:  z.enum(['asc','desc']).optional().default('asc'),
})
export type CustomerFilter = z.infer<typeof customerFilterSchema>
