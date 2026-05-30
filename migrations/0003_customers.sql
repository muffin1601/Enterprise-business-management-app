-- ================================================================
-- Migration 0003: Customer Management
-- Tables: customers, customer_contacts, customer_addresses,
--         customer_notes, customer_attachments
-- Includes: indexes, RLS policies, audit triggers, sequences
-- ================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE customer_type AS ENUM (
    'retail','wholesale','distributor','contractor','architect','government','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active','inactive','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_terms AS ENUM (
    'immediate','net_7','net_15','net_30','net_45','net_60','net_90'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  code               text        NOT NULL,
  name               text        NOT NULL,
  contact_person     text,
  phone              text,
  email              text,
  website            text,
  gstin              text,
  pan                text,
  industry           text,
  type               customer_type NOT NULL DEFAULT 'retail',
  status             customer_status NOT NULL DEFAULT 'active',

  credit_limit       numeric(14,2) NOT NULL DEFAULT 0,
  payment_terms      payment_terms NOT NULL DEFAULT 'net_30',
  post_sale_discount numeric(14,2) NOT NULL DEFAULT 0,

  billing_name       text,
  billing_address    text,
  delivery_name      text,
  delivery_address   text,
  same_as_billing    boolean NOT NULL DEFAULT false,

  notes              text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at         timestamptz,

  CONSTRAINT uq_customers_code UNIQUE (org_id, code)  -- enforced via partial unique index below
);

-- Partial unique: allow reuse after soft-delete
DROP INDEX IF EXISTS uq_customers_code_active;
CREATE UNIQUE INDEX uq_customers_code_active
  ON customers(org_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_org        ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org_active ON customers(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_status     ON customers(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm  ON customers USING gin(name gin_trgm_ops);

-- ── customer_contacts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_contacts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id   uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  name          text        NOT NULL,
  designation   text,
  email         text,
  phone         text,
  is_primary    boolean     NOT NULL DEFAULT false,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cc_customer ON customer_contacts(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cc_org      ON customer_contacts(org_id);

-- ── customer_addresses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_addresses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id    uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  label          text        NOT NULL DEFAULT 'office',
  address_line1  text        NOT NULL,
  address_line2  text,
  city           text,
  state          text,
  country        text        NOT NULL DEFAULT 'India',
  pincode        text,
  is_billing     boolean     NOT NULL DEFAULT false,
  is_shipping    boolean     NOT NULL DEFAULT false,
  is_default     boolean     NOT NULL DEFAULT false,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ca_customer ON customer_addresses(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ca_org      ON customer_addresses(org_id);

-- ── customer_notes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id  uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  content      text        NOT NULL,
  is_pinned    boolean     NOT NULL DEFAULT false,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cn_customer ON customer_notes(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cn_org      ON customer_notes(org_id);

-- ── customer_attachments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id  uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  name         text        NOT NULL,
  file_url     text        NOT NULL,
  file_size    integer,
  mime_type    text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cat_customer ON customer_attachments(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cat_org      ON customer_attachments(org_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_customer_contacts_updated_at
    BEFORE UPDATE ON customer_contacts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_customer_addresses_updated_at
    BEFORE UPDATE ON customer_addresses
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_customer_notes_updated_at
    BEFORE UPDATE ON customer_notes
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_attachments ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers           FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts   FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses  FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_notes      FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_attachments FORCE ROW LEVEL SECURITY;

-- customers
DROP POLICY IF EXISTS customers_select ON customers;
CREATE POLICY customers_select ON customers
  FOR SELECT USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS customers_insert ON customers;
CREATE POLICY customers_insert ON customers
  FOR INSERT WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.create', org_id));

DROP POLICY IF EXISTS customers_update ON customers;
CREATE POLICY customers_update ON customers
  FOR UPDATE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS customers_delete ON customers;
CREATE POLICY customers_delete ON customers
  FOR DELETE USING (app.is_member(org_id) AND app.has_permission('customers.delete', org_id));

-- customer_contacts (inherit customer permission)
DROP POLICY IF EXISTS cc_select ON customer_contacts;
CREATE POLICY cc_select ON customer_contacts
  FOR SELECT USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS cc_insert ON customer_contacts;
CREATE POLICY cc_insert ON customer_contacts
  FOR INSERT WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS cc_update ON customer_contacts;
CREATE POLICY cc_update ON customer_contacts
  FOR UPDATE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS cc_delete ON customer_contacts;
CREATE POLICY cc_delete ON customer_contacts
  FOR DELETE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- customer_addresses
DROP POLICY IF EXISTS ca_select ON customer_addresses;
CREATE POLICY ca_select ON customer_addresses
  FOR SELECT USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS ca_insert ON customer_addresses;
CREATE POLICY ca_insert ON customer_addresses
  FOR INSERT WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS ca_update ON customer_addresses;
CREATE POLICY ca_update ON customer_addresses
  FOR UPDATE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS ca_delete ON customer_addresses;
CREATE POLICY ca_delete ON customer_addresses
  FOR DELETE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- customer_notes
DROP POLICY IF EXISTS cn_select ON customer_notes;
CREATE POLICY cn_select ON customer_notes
  FOR SELECT USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS cn_insert ON customer_notes;
CREATE POLICY cn_insert ON customer_notes
  FOR INSERT WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS cn_update ON customer_notes;
CREATE POLICY cn_update ON customer_notes
  FOR UPDATE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS cn_delete ON customer_notes;
CREATE POLICY cn_delete ON customer_notes
  FOR DELETE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- customer_attachments
DROP POLICY IF EXISTS catt_select ON customer_attachments;
CREATE POLICY catt_select ON customer_attachments
  FOR SELECT USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS catt_insert ON customer_attachments;
CREATE POLICY catt_insert ON customer_attachments
  FOR INSERT WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS catt_delete ON customer_attachments;
CREATE POLICY catt_delete ON customer_attachments
  FOR DELETE USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- ── permissions catalog ───────────────────────────────────────────────────────
INSERT INTO permissions(key, description, module) VALUES
  ('customers.view',   'View customers and contacts',    'customers'),
  ('customers.create', 'Create new customers',           'customers'),
  ('customers.edit',   'Edit customers, contacts, notes','customers'),
  ('customers.delete', 'Delete / restore customers',     'customers'),
  ('customers.export', 'Export customer data to CSV',    'customers')
ON CONFLICT (key) DO NOTHING;

-- Grant to system roles (adjust role IDs as needed — seeded per org by onboarding)
-- company_owner, manager, employee roles: see PERMISSIONS.md §3
