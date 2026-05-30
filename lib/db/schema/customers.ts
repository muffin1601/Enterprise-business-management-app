import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { customerStatus, customerType, paymentTerms } from './enums'
import { envelope, pkUuid } from './_shared'
import { organizations } from './identity'

// ── customers ─────────────────────────────────────────────────────────────────
export const customers = pgTable(
  'customers',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    code:          text('code').notNull(),
    name:          text('name').notNull(),
    contactPerson: text('contact_person'),
    phone:         text('phone'),
    email:         text('email'),
    website:       text('website'),
    gstin:         text('gstin'),
    pan:           text('pan'),
    industry:      text('industry'),
    type:          customerType('type').default('retail'),
    status:        customerStatus('status').notNull().default('active'),

    creditLimit:      numeric('credit_limit',       { precision: 14, scale: 2 }).default('0'),
    paymentTerms:     paymentTerms('payment_terms').default('net_30'),
    postSaleDiscount: numeric('post_sale_discount', { precision: 14, scale: 2 }).default('0'),

    billingName:    text('billing_name'),
    billingAddress: text('billing_address'),
    deliveryName:   text('delivery_name'),
    deliveryAddress:text('delivery_address'),
    sameAsBilling:  boolean('same_as_billing').default(false),

    notes: text('notes'),

    ...envelope,
  },
  (t) => ({
    orgIdx:    index('idx_customers_org').on(t.orgId),
    orgActive: index('idx_customers_org_active').on(t.orgId),
    codeUq:    uniqueIndex('uq_customers_code').on(t.orgId, t.code),
    statusIdx: index('idx_customers_status').on(t.orgId, t.status),
  }),
)

// ── customer_contacts ─────────────────────────────────────────────────────────
export const customerContacts = pgTable(
  'customer_contacts',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    name:        text('name').notNull(),
    designation: text('designation'),
    email:       text('email'),
    phone:       text('phone'),
    isPrimary:   boolean('is_primary').default(false),

    ...envelope,
  },
  (t) => ({
    customerIdx: index('idx_cc_customer').on(t.customerId),
    orgIdx:      index('idx_cc_org').on(t.orgId),
  }),
)

// ── customer_addresses ────────────────────────────────────────────────────────
export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    label:        text('label').notNull().default('office'),
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    city:         text('city'),
    state:        text('state'),
    country:      text('country').default('India'),
    pincode:      text('pincode'),
    isBilling:    boolean('is_billing').default(false),
    isShipping:   boolean('is_shipping').default(false),
    isDefault:    boolean('is_default').default(false),

    ...envelope,
  },
  (t) => ({
    customerIdx: index('idx_ca_customer').on(t.customerId),
    orgIdx:      index('idx_ca_org').on(t.orgId),
  }),
)

// ── customer_notes ────────────────────────────────────────────────────────────
export const customerNotes = pgTable(
  'customer_notes',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    content:  text('content').notNull(),
    isPinned: boolean('is_pinned').default(false),

    ...envelope,
  },
  (t) => ({
    customerIdx: index('idx_cn_customer').on(t.customerId),
    orgIdx:      index('idx_cn_org').on(t.orgId),
  }),
)

// ── customer_attachments ──────────────────────────────────────────────────────
export const customerAttachments = pgTable(
  'customer_attachments',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    name:     text('name').notNull(),
    fileUrl:  text('file_url').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),

    ...envelope,
  },
  (t) => ({
    customerIdx: index('idx_cat_customer').on(t.customerId),
    orgIdx:      index('idx_cat_org').on(t.orgId),
  }),
)
