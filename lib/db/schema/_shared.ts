import { sql } from 'drizzle-orm'
import { timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Shared column fragments (DATABASE_SCHEMA.md §1.3 "the envelope").
 * Spread into table definitions to keep them DRY and consistent.
 *
 * `org_id` is intentionally NOT part of these fragments: some tables omit it
 * (platform tables: users, permissions) and `organizations` uses `id` as its
 * own org id — so each table declares org_id explicitly where it applies.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const actorCols = {
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}

/** Full business-table envelope minus org_id (declared per-table). */
export const envelope = {
  ...timestamps,
  ...actorCols,
  ...softDelete,
}

export const pkUuid = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`)
