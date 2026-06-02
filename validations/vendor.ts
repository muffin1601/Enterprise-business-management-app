import { z } from 'zod'

const optText  = z.string().max(500).optional().nullable()
const optEmail = z.union([z.string().email('Invalid email'), z.literal('')]).optional().nullable()
const optPhone = z.string().max(20).optional().nullable()

export const VENDOR_TYPES = [
  'supplier','manufacturer','trader','service_provider','contractor','importer','other',
] as const

export const VENDOR_STATUSES = ['active','inactive','blacklisted'] as const

export const PAYMENT_TERMS = [
  'immediate','net_7','net_15','net_30','net_45','net_60','net_90','advance',
] as const

export const ACCOUNT_TYPES = ['savings','current','cc','od'] as const

export const VENDOR_TYPE_LABELS: Record<typeof VENDOR_TYPES[number], string> = {
  supplier:         'Supplier',
  manufacturer:     'Manufacturer',
  trader:           'Trader',
  service_provider: 'Service Provider',
  contractor:       'Contractor',
  importer:         'Importer',
  other:            'Other',
}

export const VENDOR_STATUS_LABELS: Record<typeof VENDOR_STATUSES[number], string> = {
  active:      'Active',
  inactive:    'Inactive',
  blacklisted: 'Blacklisted',
}

export const PAYMENT_TERMS_LABELS: Record<typeof PAYMENT_TERMS[number], string> = {
  immediate: 'Immediate', net_7: 'Net 7 days', net_15: 'Net 15 days',
  net_30: 'Net 30 days', net_45: 'Net 45 days', net_60: 'Net 60 days',
  net_90: 'Net 90 days', advance: 'Advance Payment',
}

export const ACCOUNT_TYPE_LABELS: Record<typeof ACCOUNT_TYPES[number], string> = {
  savings: 'Savings', current: 'Current', cc: 'Cash Credit', od: 'Overdraft',
}

export const VENDOR_DOC_CATEGORIES = [
  { value: 'gst_certificate',  label: 'GST Certificate' },
  { value: 'pan_card',         label: 'PAN Card' },
  { value: 'msme_certificate', label: 'MSME Certificate' },
  { value: 'trade_license',    label: 'Trade License' },
  { value: 'contract',         label: 'Contract' },
  { value: 'nda',              label: 'NDA' },
  { value: 'bank_details',     label: 'Bank Details' },
  { value: 'other',            label: 'Other' },
]

export const VENDOR_PAGE_SIZE = 25

// ── Main vendor schema ────────────────────────────────────────────────────────
export const vendorSchema = z.object({
  name:            z.string().min(1, 'Vendor name is required').max(200),
  type:            z.enum(VENDOR_TYPES).optional().default('supplier'),
  status:          z.enum(VENDOR_STATUSES).optional().default('active'),
  contactPerson:   optText,
  phone:           optPhone,
  email:           optEmail,
  website:         optText,
  gstin:           z.string().max(15).optional().nullable(),
  pan:             z.string().max(10).optional().nullable(),
  msmeNo:          optText,
  billingAddress:  optText,
  shippingAddress: optText,
  city:            optText,
  state:           optText,
  pincode:         z.string().max(10).optional().nullable(),
  country:         z.string().max(100).optional().default('India'),
  paymentTerms:    z.enum(PAYMENT_TERMS).optional().default('net_30'),
  creditLimit:     z.coerce.number().min(0).optional().default(0),
  currency:        z.string().max(10).optional().default('INR'),
  industry:        optText,
  notes:           z.string().max(2000).optional().nullable(),
})
export type VendorInput = z.infer<typeof vendorSchema>

// ── Contact schema ────────────────────────────────────────────────────────────
export const vendorContactSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100),
  designation: optText,
  email:       optEmail,
  phone:       optPhone,
  department:  optText,
  isPrimary:   z.boolean().optional().default(false),
})
export type VendorContactInput = z.infer<typeof vendorContactSchema>

// ── Bank account schema ───────────────────────────────────────────────────────
export const vendorBankAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required').max(200),
  accountNo:   z.string().min(1, 'Account number is required').max(30),
  bankName:    z.string().min(1, 'Bank name is required').max(100),
  branch:      optText,
  ifscCode:    z.string().min(1, 'IFSC code is required').max(15),
  accountType: z.enum(ACCOUNT_TYPES).default('current'),
  isPrimary:   z.boolean().optional().default(false),
})
export type VendorBankAccountInput = z.infer<typeof vendorBankAccountSchema>

// ── Note schema ───────────────────────────────────────────────────────────────
export const vendorNoteSchema = z.object({
  content:  z.string().min(1, 'Note cannot be empty').max(2000),
  isPinned: z.boolean().optional().default(false),
})
export type VendorNoteInput = z.infer<typeof vendorNoteSchema>

// ── List filter schema ────────────────────────────────────────────────────────
export const vendorFilterSchema = z.object({
  q:      z.string().optional(),
  status: z.enum(['all', ...VENDOR_STATUSES]).optional().default('all'),
  type:   z.enum(['all', ...VENDOR_TYPES]).optional().default('all'),
  page:   z.coerce.number().min(1).optional().default(1),
  sort:   z.enum(['name','code','status','created_at']).optional().default('name'),
  order:  z.enum(['asc','desc']).optional().default('asc'),
})
export type VendorFilter = z.infer<typeof vendorFilterSchema>
