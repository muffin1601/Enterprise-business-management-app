-- ================================================================
-- Migration 0004: Customer Financials
-- Tables: invoices, invoice_items, payments, payment_allocations,
--         customer_documents
-- Enums:  payment_mode, invoice_status
-- ================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_mode AS ENUM
    ('neft','rtgs','cheque','cash','upi','card','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM
    ('draft','issued','paid','partially_paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid          NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  invoice_no       text          NOT NULL,
  customer_id      uuid          NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  date             date          NOT NULL,
  due_date         date,
  status           invoice_status NOT NULL DEFAULT 'draft',
  place_of_supply  text,
  taxable_value    numeric(14,2) NOT NULL DEFAULT 0,
  cgst             numeric(14,2) NOT NULL DEFAULT 0,
  sgst             numeric(14,2) NOT NULL DEFAULT 0,
  igst             numeric(14,2) NOT NULL DEFAULT 0,
  total            numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid      numeric(14,2) NOT NULL DEFAULT 0,
  balance          numeric(14,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  created_by       uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at       timestamptz,
  CONSTRAINT uq_invoices_no UNIQUE (org_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_org        ON invoices(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_customer   ON invoices(org_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_status     ON invoices(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_due        ON invoices(org_id, due_date) WHERE deleted_at IS NULL;

-- ── invoice_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid          NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  invoice_id   uuid          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id      uuid          REFERENCES items(id) ON DELETE SET NULL,
  name         text          NOT NULL,
  hsn_code     text,
  qty          numeric(14,3) NOT NULL DEFAULT 1,
  unit         text,
  rate         numeric(14,2) NOT NULL,
  discount_pct numeric(6,3)  NOT NULL DEFAULT 0,
  taxable_value numeric(14,2) NOT NULL DEFAULT 0,
  gst_pct      numeric(6,3)  NOT NULL DEFAULT 18,
  sort_order   integer       NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  created_by   uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invitems_invoice ON invoice_items(invoice_id);

-- ── payments ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid          NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id  uuid          NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  date         date          NOT NULL,
  amount       numeric(14,2) NOT NULL,
  mode         payment_mode  NOT NULL,
  reference    text,
  notes        text,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  created_by   uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   uuid          REFERENCES auth.users(id) ON DELETE SET NULL
  -- no soft delete — payments are immutable (void via offsetting entry)
);

CREATE INDEX IF NOT EXISTS idx_pmt_org      ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_pmt_customer ON payments(org_id, customer_id, date);

-- ── payment_allocations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_allocations (
  payment_id   uuid          NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id   uuid          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount       numeric(14,2) NOT NULL,
  org_id       uuid          NOT NULL,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  created_by   uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_pa_invoice ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pa_payment ON payment_allocations(payment_id);

-- ── customer_documents ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id  uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  category     text        NOT NULL DEFAULT 'other',  -- gst_certificate, pan, contract, po, other
  file_url     text        NOT NULL,
  file_path    text        NOT NULL,
  file_size    bigint,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cdoc_customer ON customer_documents(customer_id) WHERE deleted_at IS NULL;

-- ── updated_at triggers ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;

-- invoices
DROP POLICY IF EXISTS inv_select ON invoices;
CREATE POLICY inv_select ON invoices FOR SELECT
  USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS inv_insert ON invoices;
CREATE POLICY inv_insert ON invoices FOR INSERT
  WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.create', org_id));

DROP POLICY IF EXISTS inv_update ON invoices;
CREATE POLICY inv_update ON invoices FOR UPDATE
  USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- invoice_items (inherit invoice permission)
DROP POLICY IF EXISTS invitem_select ON invoice_items;
CREATE POLICY invitem_select ON invoice_items FOR SELECT
  USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS invitem_insert ON invoice_items;
CREATE POLICY invitem_insert ON invoice_items FOR INSERT
  WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- payments
DROP POLICY IF EXISTS pmt_select ON payments;
CREATE POLICY pmt_select ON payments FOR SELECT
  USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS pmt_insert ON payments;
CREATE POLICY pmt_insert ON payments FOR INSERT
  WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- payment_allocations
DROP POLICY IF EXISTS pa_select ON payment_allocations;
CREATE POLICY pa_select ON payment_allocations FOR SELECT
  USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS pa_insert ON payment_allocations;
CREATE POLICY pa_insert ON payment_allocations FOR INSERT
  WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- customer_documents
DROP POLICY IF EXISTS cdoc_select ON customer_documents;
CREATE POLICY cdoc_select ON customer_documents FOR SELECT
  USING (app.is_member(org_id) AND app.has_permission('customers.view', org_id));

DROP POLICY IF EXISTS cdoc_insert ON customer_documents;
CREATE POLICY cdoc_insert ON customer_documents FOR INSERT
  WITH CHECK (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

DROP POLICY IF EXISTS cdoc_delete ON customer_documents;
CREATE POLICY cdoc_delete ON customer_documents FOR DELETE
  USING (app.is_member(org_id) AND app.has_permission('customers.edit', org_id));

-- ── Supabase Storage bucket (run once via dashboard or this SQL) ───────────────
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('customer-docs', 'customer-docs', false, 52428800,
--   ARRAY['application/pdf','image/jpeg','image/png','image/webp',
--         'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
-- ON CONFLICT (id) DO NOTHING;
