-- 02_quotes_seed.sql
-- Run AFTER 0008_quotes.sql
-- Uses real customers and items from your DB (looked up by name).
-- Column names match 0008_quotes.sql exactly.
-- Terms stored in quotes.terms jsonb column.
-- Installation stored in quote_locations.installation_charge/note columns.

DO $$
DECLARE
  v_org_id       uuid;

  -- customers (real lookup by name)
  v_cust_rahul   uuid;
  v_cust_elite   uuid;

  -- quote UUIDs
  v_qt1          uuid := gen_random_uuid();
  v_qt2          uuid := gen_random_uuid();
  v_qt3          uuid := gen_random_uuid();

  -- location UUIDs
  v_loc1_gf      uuid := gen_random_uuid();
  v_loc1_ff      uuid := gen_random_uuid();
  v_loc2_liv     uuid := gen_random_uuid();
  v_loc2_bed     uuid := gen_random_uuid();
  v_loc3_main    uuid := gen_random_uuid();

  -- items (real lookup by name pattern)
  v_item_vitrified   uuid;
  v_item_marble      uuid;
  v_item_anti_skid   uuid;

  v_item_granite     uuid;
  v_item_calacatta   uuid;

  -- item snapshot details
  v_item_vitrified_name   text;
  v_item_vitrified_brand  text;
  v_item_vitrified_unit   text;
  v_item_marble_name      text;
  v_item_marble_brand     text;
  v_item_marble_unit      text;
  v_item_anti_name        text;
  v_item_anti_brand       text;
  v_item_anti_unit        text;

  v_item_granite_name     text;
  v_item_granite_brand    text;
  v_item_granite_unit     text;
  v_item_calacatta_name   text;
  v_item_calacatta_brand  text;
  v_item_calacatta_unit   text;

BEGIN

  -- ── 1. Resolve org ────────────────────────────────────────────────────────
  SELECT id INTO v_org_id
  FROM   public.organizations
  WHERE  deleted_at IS NULL
  ORDER  BY created_at
  LIMIT  1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organisation found – skipping quotes seed.';
    RETURN;
  END IF;

  -- ── 2. Resolve customers ──────────────────────────────────────────────────
  SELECT id INTO v_cust_rahul
  FROM   public.customers
  WHERE  org_id = v_org_id AND lower(name) LIKE '%rahul%' AND deleted_at IS NULL
  LIMIT  1;

  IF v_cust_rahul IS NULL THEN
    -- fallback: pick any active customer
    SELECT id INTO v_cust_rahul FROM public.customers
    WHERE org_id = v_org_id AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
    RAISE NOTICE 'Rahul Constructions not found; using first available customer.';
  END IF;

  SELECT id INTO v_cust_elite
  FROM   public.customers
  WHERE  org_id = v_org_id AND lower(name) LIKE '%elite%' AND deleted_at IS NULL
  LIMIT  1;

  IF v_cust_elite IS NULL THEN
    -- fallback: pick the second active customer
    SELECT id INTO v_cust_elite FROM public.customers
    WHERE org_id = v_org_id AND deleted_at IS NULL ORDER BY created_at LIMIT 1 OFFSET 1;
    IF v_cust_elite IS NULL THEN v_cust_elite := v_cust_rahul; END IF;
    RAISE NOTICE 'Elite Residences not found; using fallback customer.';
  END IF;

  -- ── 3. Resolve items (one statement per field) ────────────────────────────
  SELECT id   INTO v_item_vitrified       FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%vitrified%' AND deleted_at IS NULL LIMIT 1;
  SELECT name INTO v_item_vitrified_name  FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%vitrified%' AND deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT b.name FROM public.brands b WHERE b.id=i.brand_id),'Somany')  INTO v_item_vitrified_brand FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%vitrified%' AND i.deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT u.code FROM public.units  u WHERE u.id=i.unit_id), 'SQM')    INTO v_item_vitrified_unit  FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%vitrified%' AND i.deleted_at IS NULL LIMIT 1;

  SELECT id   INTO v_item_marble          FROM public.items WHERE org_id=v_org_id AND (lower(name) LIKE '%marble%' OR lower(name) LIKE '%italian%') AND deleted_at IS NULL LIMIT 1;
  SELECT name INTO v_item_marble_name     FROM public.items WHERE org_id=v_org_id AND (lower(name) LIKE '%marble%' OR lower(name) LIKE '%italian%') AND deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT b.name FROM public.brands b WHERE b.id=i.brand_id),'Carrara') INTO v_item_marble_brand FROM public.items i WHERE i.org_id=v_org_id AND (lower(i.name) LIKE '%marble%' OR lower(i.name) LIKE '%italian%') AND i.deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT u.code FROM public.units  u WHERE u.id=i.unit_id), 'SQM')    INTO v_item_marble_unit  FROM public.items i WHERE i.org_id=v_org_id AND (lower(i.name) LIKE '%marble%' OR lower(i.name) LIKE '%italian%') AND i.deleted_at IS NULL LIMIT 1;

  SELECT id   INTO v_item_anti_skid       FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%anti%' AND deleted_at IS NULL LIMIT 1;
  SELECT name INTO v_item_anti_name       FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%anti%' AND deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT b.name FROM public.brands b WHERE b.id=i.brand_id),'Somany') INTO v_item_anti_brand FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%anti%' AND i.deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT u.code FROM public.units  u WHERE u.id=i.unit_id), 'SQM')   INTO v_item_anti_unit  FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%anti%' AND i.deleted_at IS NULL LIMIT 1;

  SELECT id   INTO v_item_granite         FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%granite%' AND deleted_at IS NULL LIMIT 1;
  SELECT name INTO v_item_granite_name    FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%granite%' AND deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT b.name FROM public.brands b WHERE b.id=i.brand_id),'—')   INTO v_item_granite_brand FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%granite%' AND i.deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT u.code FROM public.units  u WHERE u.id=i.unit_id), 'SQM') INTO v_item_granite_unit  FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%granite%' AND i.deleted_at IS NULL LIMIT 1;

  SELECT id   INTO v_item_calacatta       FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%calacatta%' AND deleted_at IS NULL LIMIT 1;
  SELECT name INTO v_item_calacatta_name  FROM public.items WHERE org_id=v_org_id AND lower(name) LIKE '%calacatta%' AND deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT b.name FROM public.brands b WHERE b.id=i.brand_id),'Carrara') INTO v_item_calacatta_brand FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%calacatta%' AND i.deleted_at IS NULL LIMIT 1;
  SELECT COALESCE((SELECT u.code FROM public.units  u WHERE u.id=i.unit_id), 'SQM')    INTO v_item_calacatta_unit  FROM public.items i WHERE i.org_id=v_org_id AND lower(i.name) LIKE '%calacatta%' AND i.deleted_at IS NULL LIMIT 1;

  -- Fallback names for any items not found
  IF v_item_vitrified_name IS NULL THEN v_item_vitrified_name := 'Vitrified Floor Tile 600×600'; END IF;
  IF v_item_marble_name    IS NULL THEN v_item_marble_name    := 'Italian Marble Slab'; END IF;
  IF v_item_anti_name      IS NULL THEN v_item_anti_name      := 'Anti-Skid Floor Tile 300×300'; END IF;
  IF v_item_granite_name   IS NULL THEN v_item_granite_name   := 'Black Galaxy Granite Slab'; END IF;
  IF v_item_calacatta_name IS NULL THEN v_item_calacatta_name := 'Calacatta Gold Marble 600×600'; END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- QT-2026-001  Rahul Constructions – Supply of Flooring Material
  --              SENT | GST add 18% | 2 locations | 3 items | with installation
  --              Material: ₹5,09,175 | GST: ₹91,651.50 | Transport: ₹5,000
  --              Grand Total: ≈ ₹6,05,826 + installation charges
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO public.quotes (
    id, org_id, quote_no, revision, status, date, valid_until,
    subject, customer_id, gst_mode, gst_pct,
    transport, transport_note, include_boq_summary,
    material_subtotal, gst_amount, grand_total,
    terms, created_at, updated_at
  ) VALUES (
    v_qt1, v_org_id, 'QT-2026-001', 0, 'sent',
    '2026-05-10', '2026-06-10',
    'Supply of Flooring Material',
    v_cust_rahul, 'add', 18,
    5000.00, 'Door delivery included', true,
    509175.00, 91651.50, 644021.92,
    '[
      {"category":"delivery","text":"Delivery within 7–10 working days from order confirmation."},
      {"category":"gst","text":"GST @ 18% will be charged additionally on the above rates as applicable."},
      {"category":"payment","text":"50% advance on order confirmation; balance before dispatch."},
      {"category":"warranty","text":"1-year warranty against manufacturing defects on all tiles and flooring material."},
      {"category":"exclusion","text":"Civil/masonry work, waterproofing, and demolition of existing flooring are excluded."}
    ]',
    '2026-05-10 09:00:00+05:30',
    '2026-05-10 09:00:00+05:30'
  );

  -- Location: Ground Floor
  INSERT INTO public.quote_locations (
    id, org_id, quote_id, name, sort_order, is_included,
    installation_charge, installation_note,
    material_subtotal, location_total, created_at, updated_at
  ) VALUES (
    v_loc1_gf, v_org_id, v_qt1, 'Ground Floor', 1, true,
    18000.00, 'Labour + adhesive + levelling compound',
    285750.00, 303750.00,
    '2026-05-10 09:00:00+05:30', '2026-05-10 09:00:00+05:30'
  );

  -- Item 1: Vitrified Tile 600×600 – 450 SQM @ ₹480 (0% disc) = ₹2,16,000
  INSERT INTO public.quote_items (
    id, org_id, quote_id, location_id, item_id,
    name, brand, unit, rate, qty, discount_pct, taxable_value, total, sort_order,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_org_id, v_qt1, v_loc1_gf, v_item_vitrified,
    v_item_vitrified_name,
    COALESCE(v_item_vitrified_brand, 'Somany'),
    COALESCE(v_item_vitrified_unit, 'SQM'),
    480.00, 450.000, 0.00, 216000.00, 216000.00, 1,
    '2026-05-10 09:00:00+05:30', '2026-05-10 09:00:00+05:30'
  );

  -- Item 2: Anti-Skid Floor Tile 300×300 – 820 SQM @ ₹ 85.00 (0% disc) = ₹69,750
  INSERT INTO public.quote_items (
    id, org_id, quote_id, location_id, item_id,
    name, brand, unit, rate, qty, discount_pct, taxable_value, total, sort_order,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_org_id, v_qt1, v_loc1_gf, v_item_anti_skid,
    COALESCE(v_item_anti_name, 'Anti-Skid Floor Tile 300×300'),
    COALESCE(v_item_anti_brand, 'Somany'),
    COALESCE(v_item_anti_unit, 'SQM'),
    280.00, 250.000, 5.00, 66500.00, 66500.00, 2,
    '2026-05-10 09:00:00+05:30', '2026-05-10 09:00:00+05:30'
  );

  -- Location: First Floor
  INSERT INTO public.quote_locations (
    id, org_id, quote_id, name, sort_order, is_included,
    installation_charge, installation_note,
    material_subtotal, location_total, created_at, updated_at
  ) VALUES (
    v_loc1_ff, v_org_id, v_qt1, 'First Floor', 2, true,
    15000.00, 'Labour + adhesive; staircase area charged separately',
    223425.00, 238425.00,
    '2026-05-10 09:00:00+05:30', '2026-05-10 09:00:00+05:30'
  );

  -- Item 3: Italian Marble Slab 2400×1200 – 185 SQM @ ₹1,600 (10% disc) = ₹2,66,400 → after disc ₹2,39,760
  INSERT INTO public.quote_items (
    id, org_id, quote_id, location_id, item_id,
    name, brand, unit, rate, qty, discount_pct, taxable_value, total, sort_order,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_org_id, v_qt1, v_loc1_ff, v_item_marble,
    COALESCE(v_item_marble_name, 'Italian Marble Slab 2400×1200'),
    COALESCE(v_item_marble_brand, 'Carrara'),
    COALESCE(v_item_marble_unit, 'SQM'),
    1600.00, 148.000, 5.00, 223600.00, 223600.00, 1,
    '2026-05-10 09:00:00+05:30', '2026-05-10 09:00:00+05:30'
  );

  -- ────────────────────────────────────────────────────────────────────────────
  -- QT-2026-002  Elite Residences – Fireplace Supply — Bungalow Project
  --              ACCEPTED | No GST | 2 locations | 2 items | with installation
  --              Grand Total: ₹2,64,900
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO public.quotes (
    id, org_id, quote_no, revision, status, date, valid_until,
    subject, customer_id, gst_mode, gst_pct,
    transport, transport_note, include_boq_summary,
    material_subtotal, gst_amount, grand_total,
    terms, created_at, updated_at
  ) VALUES (
    v_qt2, v_org_id, 'QT-2026-002', 1, 'accepted',
    '2026-04-22', '2026-05-22',
    'Fireplace Supply — Bungalow Project',
    v_cust_elite, 'none', 18,
    0.00, 'Transport via insured carrier', true,
    244000.00, 0.00, 264900.00,
    '[
      {"category":"delivery","text":"Lead time 15–20 working days; custom stone fabrication required."},
      {"category":"gst","text":"Prices are inclusive of all taxes as mutually agreed (No GST mode)."},
      {"category":"payment","text":"40% advance on acceptance; 40% on dispatch; 20% on completion of installation."},
      {"category":"warranty","text":"2-year structural warranty. Natural stone variation in colour/veining is not a defect."},
      {"category":"exclusion","text":"Gas/electric fitting, flue system beyond supplied liner, and plastering are excluded."}
    ]',
    '2026-04-22 10:30:00+05:30',
    '2026-04-22 10:30:00+05:30'
  );

  -- Location: Living Room
  INSERT INTO public.quote_locations (
    id, org_id, quote_id, name, sort_order, is_included,
    installation_charge, installation_note,
    material_subtotal, location_total, created_at, updated_at
  ) VALUES (
    v_loc2_liv, v_org_id, v_qt2, 'Living Room', 1, true,
    8500.00, 'Fireplace installation & commissioning',
    166500.00, 175000.00,
    '2026-04-22 10:30:00+05:30', '2026-04-22 10:30:00+05:30'
  );

  -- Item 4: Black Galaxy Granite Slab – 1 NOS @ ₹1,85,000 (10% disc) = ₹1,66,500
  INSERT INTO public.quote_items (
    id, org_id, quote_id, location_id, item_id,
    name, brand, unit, rate, qty, discount_pct, taxable_value, total, sort_order,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_org_id, v_qt2, v_loc2_liv, v_item_granite,
    COALESCE(v_item_granite_name, 'Black Galaxy Granite 600×600 Polished'),
    COALESCE(v_item_granite_brand, '—'),
    COALESCE(v_item_granite_unit, 'NOS'),
    185000.00, 1.000, 10.00, 166500.00, 166500.00, 1,
    '2026-04-22 10:30:00+05:30', '2026-04-22 10:30:00+05:30'
  );

  -- Location: Master Bedroom
  INSERT INTO public.quote_locations (
    id, org_id, quote_id, name, sort_order, is_included,
    installation_charge, installation_note,
    material_subtotal, location_total, created_at, updated_at
  ) VALUES (
    v_loc2_bed, v_org_id, v_qt2, 'Master Bedroom', 2, true,
    7600.00, 'Installation includes flue liner and fascia panel',
    87400.00, 89900.00,
    '2026-04-22 10:30:00+05:30', '2026-04-22 10:30:00+05:30'
  );

  -- Item 5: Calacatta Gold Marble – 1 NOS @ ₹95,000 (8% disc) = ₹87,400
  INSERT INTO public.quote_items (
    id, org_id, quote_id, location_id, item_id,
    name, brand, unit, rate, qty, discount_pct, taxable_value, total, sort_order,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_org_id, v_qt2, v_loc2_bed, v_item_calacatta,
    COALESCE(v_item_calacatta_name, 'Calacatta Gold Marble 600×600 Polished'),
    COALESCE(v_item_calacatta_brand, 'Carrara'),
    COALESCE(v_item_calacatta_unit, 'NOS'),
    95000.00, 1.000, 8.00, 87400.00, 87400.00, 1,
    '2026-04-22 10:30:00+05:30', '2026-04-22 10:30:00+05:30'
  );

  -- ────────────────────────────────────────────────────────────────────────────
  -- QT-2026-003  Draft – no customer – 1 empty location – ₹0
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO public.quotes (
    id, org_id, quote_no, revision, status, date, valid_until,
    subject, customer_id, gst_mode, gst_pct,
    transport, include_boq_summary,
    material_subtotal, gst_amount, grand_total,
    terms, created_at, updated_at
  ) VALUES (
    v_qt3, v_org_id, 'QT-2026-003', 0, 'draft',
    '2026-06-01', NULL,
    NULL, NULL, 'add', 18,
    0.00, true,
    0.00, 0.00, 0.00,
    '[
      {"category":"delivery","text":"Delivery schedule to be confirmed on order."},
      {"category":"gst","text":"GST @ 18% applicable as per prevailing government regulations."},
      {"category":"payment","text":"Payment terms to be mutually agreed on order confirmation."},
      {"category":"warranty","text":"Standard manufacturer warranty applies."},
      {"category":"exclusion","text":"Scope of work to be finalised; exclusions listed after site visit."}
    ]',
    '2026-06-01 09:00:00+05:30',
    '2026-06-01 09:00:00+05:30'
  );

  INSERT INTO public.quote_locations (
    id, org_id, quote_id, name, sort_order, is_included,
    material_subtotal, location_total, created_at, updated_at
  ) VALUES (
    v_loc3_main, v_org_id, v_qt3, 'Location 1', 1, true,
    0.00, 0.00,
    '2026-06-01 09:00:00+05:30', '2026-06-01 09:00:00+05:30'
  );

  RAISE NOTICE 'Quotes seed complete. QT-2026-001=%, QT-2026-002=%, QT-2026-003=%', v_qt1, v_qt2, v_qt3;

END $$;

SELECT 'Quotes seed complete.' AS status;
