import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * pgEnum definitions. Only the enums needed by the identity domain are declared
 * here for the Authentication module (DATABASE_SCHEMA.md §2.1). Subsequent
 * modules add their enums to this file as they are implemented — the names and
 * value order MUST match the SQL migrations exactly.
 */
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

// Inventory / catalogue (DATABASE_SCHEMA.md §2.1).
export const transportType = pgEnum('transport_type', ['lumpsum', 'percent'])
