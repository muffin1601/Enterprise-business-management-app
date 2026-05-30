import { pgEnum } from 'drizzle-orm/pg-core'

export const recordStatus = pgEnum('record_status', ['active', 'inactive'])

export const auditAction = pgEnum('audit_action', [
  'insert',
  'update',
  'delete',
  'restore',
  'login',
  'permission_change',
])

export const currencyCode = pgEnum('currency_code', ['INR', 'USD', 'EUR', 'CNY'])
export const transportType = pgEnum('transport_type', ['lumpsum', 'percent'])

// ── Customer enums ────────────────────────────────────────────────────────────
export const customerType = pgEnum('customer_type', [
  'retail',
  'wholesale',
  'distributor',
  'contractor',
  'architect',
  'government',
  'other',
])

export const customerStatus = pgEnum('customer_status', [
  'active',
  'inactive',
  'blocked',
])

export const paymentTerms = pgEnum('payment_terms', [
  'immediate',
  'net_7',
  'net_15',
  'net_30',
  'net_45',
  'net_60',
  'net_90',
])
