-- ================================================================
-- Migration 0005: Inventory Extended
-- Adds production fields to items, creates stock ledger,
-- inventory permissions, and supplier extensions.
-- ================================================================

-- ── New permissions ───────────────────────────────────────────────────────────
INSERT INTO permissions(key, description, module) VALUES
  ('inventory.view',   'View inventory items and stock',        'inventory'),
  ('inventory.create', 'Create new inventory items',            'inventory'),
  ('inventory.edit',   'Edit inventory items and pricing',      'inventory'),
  ('inventory.delete', 'Delete / archive inventory items',      'inventory'),
  ('inventory.adjust', 'Adjust stock quantities',               'inventory'),
  ('inventory.export', 'Export inventory data',                 'inventory')
ON CONFLICT (key) DO NOTHING;

-- ── Extend items table with production fields ─────────────────────────────────
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS description       text,
  ADD COLUMN IF NOT EXISTS hsn_code          text,
  ADD COLUMN IF NOT EXISTS gst_rate          numeric(6,3) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS min_stock         numeric(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level     numeric(14,3) DEFAULT 0,

  
  ADD COLUMN IF NOT EXISTS max_stock         numeric(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_time_days    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight_kg         numeric(10,3),
  ADD COLUMN IF NOT EXISTS dimensions        jsonb,           -- {l, w, h, unit}
  ADD COLUMN IF NOT EXISTS tags              text[],
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS barcode           text,
  ADD COLUMN IF NOT EXISTS cost_price        numeric(14,2);  -- landed cost, overrides purchase_price

-- ── Indexes on new columns ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_items_active       ON items(org_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_low_stock    ON items(org_id) WHERE deleted_at IS NULL AND stock > 0;
CREATE INDEX IF NOT EXISTS idx_items_sku          ON items(org_id, sku) WHERE deleted_at IS NULL AND sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_hsn          ON items(org_id, hsn_code) WHERE deleted_at IS NULL AND hsn_code IS NOT NULL;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_items_name_trgm    ON items USING gin(name gin_trgm_ops);

-- ── stock_movements extended ──────────────────────────────────────────────────
-- Ensure required columns exist (complete_database may not have them)
DO $$ BEGIN
  CREATE TYPE movement_type AS ENUM
    ('receipt','issue','transfer','adjustment','opening','return');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stock_movements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  item_id         uuid        NOT NULL REFERENCES items(id),
  date            date        NOT NULL,
  qty             numeric(14,3) NOT NULL,
  value           numeric(14,2) NOT NULL DEFAULT 0,
  direction       text        NOT NULL CHECK (direction IN ('in','out')),
  movement_type   movement_type NOT NULL DEFAULT 'adjustment',
  reference       text,
  notes           text,
  customer_id     uuid        REFERENCES customers(id) ON DELETE SET NULL,
  challan_id      uuid,
  goods_receipt_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sm_org_item ON stock_movements(org_id, item_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sm_org_date ON stock_movements(org_id, date DESC);

-- ── stock_adjustments extended ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  item_id      uuid        NOT NULL REFERENCES items(id),
  type         text        NOT NULL CHECK (type IN ('add','sub')),
  qty          numeric(14,3) NOT NULL,
  reason       text        NOT NULL,
  ref_no       text,
  adjusted_by  uuid        REFERENCES auth.users(id),
  at           timestamptz NOT NULL DEFAULT now(),
  org_id_dup   uuid,       -- for RLS join
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sa_org_item ON stock_adjustments(org_id, item_id, at DESC);

-- ── RLS for new tables ─────────────────────────────────────────────────────────
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sm_select ON stock_movements;
CREATE POLICY sm_select ON stock_movements FOR SELECT
  USING (app.is_member(org_id) AND app.has_permission('inventory.view', org_id));

DROP POLICY IF EXISTS sm_insert ON stock_movements;
CREATE POLICY sm_insert ON stock_movements FOR INSERT
  WITH CHECK (app.is_member(org_id) AND app.has_permission('inventory.adjust', org_id));

DROP POLICY IF EXISTS sa_select ON stock_adjustments;
CREATE POLICY sa_select ON stock_adjustments FOR SELECT
  USING (app.is_member(org_id) AND app.has_permission('inventory.view', org_id));

DROP POLICY IF EXISTS sa_insert ON stock_adjustments;
CREATE POLICY sa_insert ON stock_adjustments FOR INSERT
  WITH CHECK (app.is_member(org_id) AND app.has_permission('inventory.adjust', org_id));

-- ── Updated-at triggers ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_sm_updated_at
    BEFORE UPDATE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
