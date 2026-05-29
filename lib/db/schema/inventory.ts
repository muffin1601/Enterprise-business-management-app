import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { currencyCode, transportType } from './enums'
import { envelope, pkUuid } from './_shared'
import { organizations } from './identity'

/**
 * Inventory / Catalogue — DATABASE_SCHEMA.md §3.4 (catalogue subset).
 * Procurement + stock-ledger tables are deferred to their own module.
 */

export const itemFamilies = pgTable(
  'item_families',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    ...envelope,
  },
  (t) => ({
    uqName: uniqueIndex('uq_item_families_name')
      .on(t.orgId, t.name)
      .where(sql`${t.deletedAt} is null`),
    orgIdx: index('idx_item_families_org').on(t.orgId),
  }),
)

export const brands = pgTable(
  'brands',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    ...envelope,
  },
  (t) => ({
    uqName: uniqueIndex('uq_brands_name').on(t.orgId, t.name).where(sql`${t.deletedAt} is null`),
    orgIdx: index('idx_brands_org').on(t.orgId),
  }),
)

export const units = pgTable(
  'units',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name'),
    ...envelope,
  },
  (t) => ({
    uqCode: uniqueIndex('uq_units_code').on(t.orgId, t.code).where(sql`${t.deletedAt} is null`),
    orgIdx: index('idx_units_org').on(t.orgId),
  }),
)

export const items = pgTable(
  'items',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    parentId: uuid('parent_id'),
    familyId: uuid('family_id').references(() => itemFamilies.id, { onDelete: 'set null' }),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    sku: text('sku'),
    name: text('name').notNull(),
    variantLabel: text('variant_label'),
    imageUrl: text('image_url'),
    isImported: boolean('is_imported').notNull().default(false),
    isTemplate: boolean('is_template').notNull().default(false),
    deliveryDays: integer('delivery_days'),
    purchasePrice: numeric('purchase_price', { precision: 14, scale: 2 }),
    sellingPrice: numeric('selling_price', { precision: 14, scale: 2 }),
    stock: numeric('stock', { precision: 14, scale: 3 }).notNull().default('0'),
    lastPurchasePrice: numeric('last_purchase_price', { precision: 14, scale: 2 }),
    lastPurchaseDate: date('last_purchase_date'),
    lastSupplierId: uuid('last_supplier_id'),
    importCurrency: currencyCode('import_currency'),
    importPrice: numeric('import_price', { precision: 14, scale: 2 }),
    exchangeRate: numeric('exchange_rate', { precision: 12, scale: 6 }),
    importDiscountPct: numeric('import_discount_pct', { precision: 6, scale: 3 }),
    transportType: transportType('transport_type'),
    transportValue: numeric('transport_value', { precision: 14, scale: 2 }),
    customDutyPct: numeric('custom_duty_pct', { precision: 6, scale: 3 }),
    profitMultiplier: numeric('profit_multiplier', { precision: 8, scale: 4 }),
    ...envelope,
  },
  (t) => ({
    orgIdx: index('idx_items_org').on(t.orgId),
    familyIdx: index('idx_items_org_family').on(t.orgId, t.familyId),
    brandIdx: index('idx_items_org_brand').on(t.orgId, t.brandId),
    parentIdx: index('idx_items_parent').on(t.parentId),
    uqSku: uniqueIndex('uq_items_sku').on(t.orgId, t.sku).where(sql`${t.deletedAt} is null`),
  }),
)

export const itemVariations = pgTable(
  'item_variations',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    size: text('size'),
    make: text('make'),
    finish: text('finish'),
    brand: text('brand'),
    ...envelope,
  },
  (t) => ({
    itemIdx: index('idx_item_variations_item').on(t.itemId),
  }),
)

export const itemsRelations = relations(items, ({ one, many }) => ({
  family: one(itemFamilies, { fields: [items.familyId], references: [itemFamilies.id] }),
  brand: one(brands, { fields: [items.brandId], references: [brands.id] }),
  unit: one(units, { fields: [items.unitId], references: [units.id] }),
  variations: many(itemVariations),
}))

export const itemVariationsRelations = relations(itemVariations, ({ one }) => ({
  item: one(items, { fields: [itemVariations.itemId], references: [items.id] }),
}))
