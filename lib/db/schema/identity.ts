import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  inet,
  integer,
  jsonb,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
  numeric,
  pgTable,
} from 'drizzle-orm/pg-core'
import { auditAction, currencyCode, recordStatus } from './enums'
import { actorCols, envelope, pkUuid, timestamps } from './_shared'

/**
 * Platform / Identity & Access tables — DATABASE_SCHEMA.md §3.1.
 * Columns, constraints, and ON DELETE rules follow the schema doc exactly.
 * No new tables are introduced.
 */

// ── organizations — tenant root (id IS the org_id; RLS keys on `id`) ──────────
export const organizations = pgTable('organizations', {
  id: pkUuid(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  legalName: text('legal_name'),
  gstin: text('gstin'),
  pan: text('pan'),
  address: text('address'),
  logoUrl: text('logo_url'),
  currency: currencyCode('currency').notNull().default('INR'),
  status: recordStatus('status').notNull().default('active'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  ...envelope,
})

// ── organization_settings — 1:1 with org (PK == org_id), no soft delete ──────
export const organizationSettings = pgTable('organization_settings', {
  orgId: uuid('org_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  financialYearStart: smallint('financial_year_start').notNull().default(4),
  defaultGstPct: numeric('default_gst_pct', { precision: 6, scale: 3 }).default('18'),
  placeOfSupply: text('place_of_supply'),
  approvalLimits: jsonb('approval_limits').notNull().default(sql`'{}'::jsonb`),
  theme: jsonb('theme'),
  featureFlags: jsonb('feature_flags').notNull().default(sql`'{}'::jsonb`),
  notificationDefaults: jsonb('notification_defaults'),
  ...timestamps,
  ...actorCols,
})

// ── users — profile mirror of auth.users (no org_id; platform) ───────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // = auth.users.id (no default)
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  status: recordStatus('status').notNull().default('active'),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...timestamps,
})

// ── memberships — user ↔ org (M:N), no soft delete ───────────────────────────
export const memberships = pgTable(
  'memberships',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isDefault: boolean('is_default').notNull().default(false),
    isBillable: boolean('is_billable').notNull().default(true),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
    ...actorCols,
  },
  (t) => ({
    uqOrgUser: uniqueIndex('uq_memberships_org_user').on(t.orgId, t.userId),
    userIdx: index('idx_memberships_user').on(t.userId),
  }),
)

// ── roles — system templates (org_id NULL) + org-scoped custom roles ─────────
export const roles = pgTable(
  'roles',
  {
    id: pkUuid(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'restrict' }),
    key: text('key').notNull(),
    name: text('name'),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    ...envelope,
  },
  (t) => ({
    uqOrgKey: uniqueIndex('uq_roles_org_key').on(t.orgId, t.key),
  }),
)

// ── permissions — global catalog (no org_id, no soft delete) ─────────────────
export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  description: text('description'),
  module: text('module'),
})

// ── role_permissions — junction (no envelope) ────────────────────────────────
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: uniqueIndex('pk_role_permissions').on(t.roleId, t.permissionKey),
  }),
)

// ── user_roles — per-org role assignment (no soft delete) ────────────────────
export const userRoles = pgTable(
  'user_roles',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
  },
  (t) => ({
    uq: uniqueIndex('uq_user_roles').on(t.orgId, t.userId, t.roleId),
  }),
)

// ── invitations — pending member invites ─────────────────────────────────────
export const invitations = pgTable(
  'invitations',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    email: text('email').notNull(),
    roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
    token: text('token').notNull().unique(),
    status: text('status').notNull().default('pending'),
    invitedBy: uuid('invited_by').references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...envelope,
  },
  (t) => ({
    uqPending: uniqueIndex('uq_invitations_org_email_pending')
      .on(t.orgId, sql`lower(${t.email})`)
      .where(sql`status = 'pending'`),
  }),
)

// ── number_sequences — document numbering masks + counters ───────────────────
export const numberSequences = pgTable(
  'number_sequences',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    docType: text('doc_type').notNull(),
    mask: text('mask').notNull(),
    periodKey: text('period_key').notNull(),
    nextValue: integer('next_value').notNull().default(1),
    ...envelope,
  },
  (t) => ({
    uq: uniqueIndex('uq_number_sequences').on(t.orgId, t.docType, t.periodKey),
  }),
)

// ── audit_logs — append-only (no soft delete, no updated_at) ─────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: pkUuid(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    actorId: uuid('actor_id'),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: auditAction('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    changedFields: text('changed_fields').array(),
    ip: inet('ip'),
    // Additive context columns (AUDIT_LOGS.md §2 / migration 0004).
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index('idx_audit_entity').on(t.orgId, t.entityType, t.entityId, t.at),
    actorIdx: index('idx_audit_actor').on(t.actorId, t.at),
  }),
)

// ── relations (for typed Drizzle joins) ──────────────────────────────────────
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.orgId],
  }),
  memberships: many(memberships),
}))

export const membershipsRelations = relations(memberships, ({ one }) => ({
  org: one(organizations, { fields: [memberships.orgId], references: [organizations.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  org: one(organizations, { fields: [userRoles.orgId], references: [organizations.id] }),
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionKey],
    references: [permissions.key],
  }),
}))
