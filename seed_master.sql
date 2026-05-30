-- ================================================================
-- WATCON DEMO SEED DATA
-- Organization: Watcon Demo Company (Construction Materials Trading)
-- Mumbai, Maharashtra, India | FY 2025-26
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Create auth users first via Dashboard → Authentication → Users
--    Email/Password for all demo users: see Section 2 comments
-- 3. Paste and run this file (requires service_role or postgres role)
-- 4. All demo user passwords: Watcon@2024
--
-- UUID scheme (deterministic, human-readable):
--   Org      10000000-...
--   Users    20000000-... (01–14)
--   Roles    30000000-... (01–06)
--   Families 40000000-... (01–10)
--   Brands   50000000-... (01–25)
--   Units    60000000-... (01–09)
--   Suppliers 70000000-... (01–50)
--   Customers 80000000-... (01–99, a0–a9 for 100)
--   Items    90000000-... (0001–0500 in hex)
--   Quotes   a0000000-... (01–30)
--   SalesOrders b0000000-... (01–20)
--   Challans c0000000-... (01–15)
--   Invoices d0000000-... (01–20)
--   Payments e0000000-... (01–40)
--   Employees f0000000-... (01–14)
-- ================================================================

-- ================================================================
-- SECTION 0: HELPERS
-- ================================================================

-- Disable RLS for seed (re-enable after)
SET session_replication_role = replica;

-- ================================================================
-- SECTION 1: ORGANIZATION
-- ================================================================

INSERT INTO organizations (id, name, slug, legal_name, gstin, pan, address, currency, status, created_at, updated_at)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Watcon Demo Company',
  'watcon-demo',
  'Watcon Trading & Interiors Pvt Ltd',
  '27AABCW1234A1Z5',
  'AABCW1234A',
  'Unit 8, Laxmi Industrial Estate, New Link Road, Andheri West, Mumbai - 400053, Maharashtra',
  'INR',
  'active',
  '2024-04-01 09:00:00+05:30',
  '2026-05-01 10:00:00+05:30'
);

INSERT INTO organization_settings (org_id, financial_year_start, default_gst_pct, place_of_supply, approval_limits, feature_flags)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  4,
  18.000,
  '27',
  '{"discount": {"manager": 10, "owner": 100}, "expense": {"manager": 50000, "owner": 500000}}',
  '{"module.hr": true, "module.analytics": true, "whatsapp.send": false}'
);

INSERT INTO number_sequences (id, org_id, doc_type, mask, period_key, next_value, created_at, updated_at)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'quote',          'QT-{YYYY}-{SEQ:4}',  '2025', 31, now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'sales_order',    'SO-{YYYY}-{SEQ:4}',  '2025', 21, now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'challan',        'DC-{YYYY}-{SEQ:4}',  '2025', 16, now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'invoice',        'INV-{YYYY}-{SEQ:4}', '2025', 21, now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'purchase_order', 'PO-{YYYY}-{SEQ:4}',  '2025', 31, now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'goods_receipt',  'GRN-{YYYY}-{SEQ:4}', '2025', 21, now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'payment',        'PMT-{YYYY}-{SEQ:4}', '2025', 41, now(), now());

-- ================================================================
-- SECTION 2: USERS
-- (Create these in Supabase Dashboard > Auth > Users first with
--  email and password "Watcon@2024", then run this section)
-- ================================================================

-- u01: Sanjay Mehta (Owner)
-- u02: Priya Sharma (Manager)
-- u03: Vikram Nair (Manager)
-- u04: Ritu Gupta (Sales)
-- u05: Amit Patel (Sales)
-- u06: Kavita Desai (Accountant)
-- u07: Rohan Joshi (Accountant)
-- u08: Sunita Rao (HR)
-- u09: Anil Kulkarni (HR)
-- u10: Deepak Singh (Employee)
-- u11: Meera Shah (Employee)
-- u12: Rahul Verma (Employee)
-- u13: Pooja Iyer (Employee)
-- u14: Suresh Reddy (Employee)

INSERT INTO users (id, email, full_name, phone, status, created_at, updated_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'sanjay.mehta@watcon.demo',   'Sanjay Mehta',    '9820011001', 'active', '2024-04-01 09:00:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000002', 'priya.sharma@watcon.demo',   'Priya Sharma',    '9820011002', 'active', '2024-04-01 09:10:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000003', 'vikram.nair@watcon.demo',    'Vikram Nair',     '9820011003', 'active', '2024-04-01 09:15:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000004', 'ritu.gupta@watcon.demo',     'Ritu Gupta',      '9820011004', 'active', '2024-04-02 09:00:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000005', 'amit.patel@watcon.demo',     'Amit Patel',      '9820011005', 'active', '2024-04-02 09:10:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000006', 'kavita.desai@watcon.demo',   'Kavita Desai',    '9820011006', 'active', '2024-04-02 09:20:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000007', 'rohan.joshi@watcon.demo',    'Rohan Joshi',     '9820011007', 'active', '2024-04-03 09:00:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000008', 'sunita.rao@watcon.demo',     'Sunita Rao',      '9820011008', 'active', '2024-04-03 09:10:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000009', 'anil.kulkarni@watcon.demo',  'Anil Kulkarni',   '9820011009', 'active', '2024-04-03 09:20:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000010', 'deepak.singh@watcon.demo',   'Deepak Singh',    '9820011010', 'active', '2024-04-05 09:00:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000011', 'meera.shah@watcon.demo',     'Meera Shah',      '9820011011', 'active', '2024-04-05 09:10:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000012', 'rahul.verma@watcon.demo',    'Rahul Verma',     '9820011012', 'active', '2024-04-05 09:20:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000013', 'pooja.iyer@watcon.demo',     'Pooja Iyer',      '9820011013', 'active', '2024-04-07 09:00:00+05:30', now()),
  ('20000000-0000-0000-0000-000000000014', 'suresh.reddy@watcon.demo',   'Suresh Reddy',    '9820011014', 'active', '2024-04-07 09:10:00+05:30', now());

-- ================================================================
-- SECTION 3: ROLES, MEMBERSHIPS, USER ROLES
-- ================================================================

INSERT INTO roles (id, org_id, key, name, description, is_system, created_at, updated_at)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'company_owner', 'Company Owner',  'Full access to all modules and settings',                   true, now(), now()),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'manager',       'Manager',        'Operations lead — inventory, sales, logistics',              true, now(), now()),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'employee',      'Employee',       'Front-line — create quotes/orders, view items',             true, now(), now()),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'accountant',    'Accountant',     'Finance & receivables — invoices, payments, payroll view',  true, now(), now()),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'hr',            'HR',             'Human resources — employees, leave, appraisals',            true, now(), now()),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'sales',         'Sales',          'Sales team — quotes, customers, sales orders',              true, now(), now());

INSERT INTO memberships (id, org_id, user_id, is_default, is_billable, joined_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '10000000-0000-0000-0000-000000000001',
  id,
  true,
  true,
  '2024-04-01 09:00:00+05:30',
  now(),
  now()
FROM users
WHERE id LIKE '20000000-0000-0000-0000-%';

INSERT INTO user_roles (id, org_id, user_id, role_id, created_at, created_by)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now(), '20000000-0000-0000-0000-000000000001'), -- Sanjay: Owner
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', now(), '20000000-0000-0000-0000-000000000001'), -- Priya: Manager
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', now(), '20000000-0000-0000-0000-000000000001'), -- Vikram: Manager
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000006', now(), '20000000-0000-0000-0000-000000000001'), -- Ritu: Sales
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006', now(), '20000000-0000-0000-0000-000000000001'), -- Amit: Sales
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000004', now(), '20000000-0000-0000-0000-000000000001'), -- Kavita: Accountant
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000004', now(), '20000000-0000-0000-0000-000000000001'), -- Rohan: Accountant
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000005', now(), '20000000-0000-0000-0000-000000000001'), -- Sunita: HR
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000005', now(), '20000000-0000-0000-0000-000000000001'), -- Anil: HR
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000003', now(), '20000000-0000-0000-0000-000000000001'), -- Deepak: Employee
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000003', now(), '20000000-0000-0000-0000-000000000001'), -- Meera: Employee
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000003', now(), '20000000-0000-0000-0000-000000000001'), -- Rahul: Employee
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000003', now(), '20000000-0000-0000-0000-000000000001'), -- Pooja: Employee
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000003', now(), '20000000-0000-0000-0000-000000000001'); -- Suresh: Employee

-- ================================================================
-- SECTION 4: LOOKUPS — ITEM FAMILIES, BRANDS, UNITS
-- ================================================================

INSERT INTO item_families (id, org_id, name, created_at, updated_at, created_by)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Floor Tiles',          now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Wall Tiles',           now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Marble & Stone',       now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Wood Flooring',        now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Pipes & Plumbing',     now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Sanitary Ware',        now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Hardware & Fittings',  now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Electrical',           now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'Paints & Coatings',    now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Doors & Windows',      now(), now(), '20000000-0000-0000-0000-000000000001');

INSERT INTO brands (id, org_id, name, created_at, updated_at, created_by)
VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Kajaria',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Somany',          now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Orientbell',      now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Asian Tiles',     now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Carrara Imports', now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Pokarna',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Pergo',           now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Quick-Step',      now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'Shaw Floors',     now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Tata Steel',      now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Jindal Steel',    now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'APL Apollo',      now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Astral',          now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Finolex',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'Jaquar',          now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'Kohler',          now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', 'Cera',            now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'Hindware',        now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000001', 'Godrej',          now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', 'Hettich',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', 'Philips',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', 'Havells',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000001', 'Asian Paints',    now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000001', 'Berger Paints',   now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000001', 'Fenesta',         now(), now(), '20000000-0000-0000-0000-000000000001');

INSERT INTO units (id, org_id, code, name, created_at, updated_at, created_by)
VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'SQM', 'Square Metre',  now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'SQF', 'Square Feet',   now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'MTR', 'Metre',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'NOS', 'Numbers',       now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'BOX', 'Box',           now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'KG',  'Kilogram',      now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'LTR', 'Litre',         now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'SET', 'Set',           now(), now(), '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'PCS', 'Pieces',        now(), now(), '20000000-0000-0000-0000-000000000001');

-- ================================================================
-- SECTION 5: SUPPLIERS (50)
-- ================================================================

INSERT INTO suppliers (id, org_id, name, contact_person, phone, email, gstin, address, status, created_at, updated_at, created_by)
VALUES
  ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Kajaria Ceramics Ltd','Mahesh Kajaria','9820100101','supply@kajaria.com','08AAACK1234A1Z2','Kajaria House, DLF Cyber City, Gurugram - 122002','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Somany Ceramics Ltd','Rakesh Somany','9820100102','procurement@somany.in','27AAACS5678B1Z3','Somany House, Udyog Vihar, Gurugram - 122016','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Orientbell Limited','Madhur Dalmia','9820100103','orders@orientbell.com','07AAACO2345C1Z4','Orientbell Complex, Sikandrabad, UP - 203205','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Asian Granito India Ltd','Kamlesh Patel','9820100104','sales@asiangranito.com','24AAACA3456D1Z5','Asian Granito, GIDC Estate, Mehsana, Gujarat - 384002','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Carrara Marble Imports Pvt Ltd','Vivek Bhatia','9820100105','vivek@carraraimports.in','27AAACM9012E1Z8','Mumbai Port CFS, Nhava Sheva, Raigad - 400703','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Pokarna Engineered Stone Ltd','Gautam Chand','9820100106','orders@pokarna.com','36AAACP8901F1Z7','Pokarna House, Hyderabad - 500033','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Bhandari Marble Group','Suresh Bhandari','9820100107','supply@bhandarimarble.com','08AAACB7890G1Z6','Bhandari Marble, Kishangarh, Rajasthan - 305801','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','Pergo India Distributors','Rohit Kapoor','9820100108','rohit@pergo.in','27AAACP6789H1Z5','Pergo Dist Hub, Mahape, Navi Mumbai - 400710','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','Quick-Step Flooring India','Anand Mehta','9820100109','orders@quickstep.in','27AAACQ5678I1Z4','Quick-Step, Bhiwandi Warehouse, Thane - 421302','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','Tata Steel Limited','Rajiv Tata','9820100110','steelsales@tata.com','27AAACT4567J1Z3','Tata Centre, 43 JN Road, Kolkata - 700071','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','Jindal Steel & Power Ltd','Naveen Jindal','9820100111','pipes@jspl.com','07AAACJ3456K1Z2','Jindal Centre, Safdarjung Enclave, Delhi - 110029','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','APL Apollo Tubes Ltd','Sanjay Gupta','9820100112','supply@apollotubes.com','07AAACA2345L1Z1','Apollo House, Greater Noida - 201306','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','Astral Pipes Products','Sandeep Engineer','9820100113','orders@astralpipes.com','24AAACA1234M1Z9','Astral House, Memnagar, Ahmedabad - 380052','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','Finolex Industries Ltd','Pratap Doshi','9820100114','pipes@finolex.com','27AAACF9012N1Z8','Finolex House, Pimpri, Pune - 411018','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000001','Jaquar & Company Pvt Ltd','Rajesh Mehra','9820100115','supply@jaquar.com','06AAACJ8901O1Z7','Jaquar Tower, Manesar, Gurugram - 122050','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000001','Kohler India Pvt Ltd','Priya Kohler','9820100116','indiasales@kohler.com','27AAACK7890P1Z6','Kohler India, Bund Garden Road, Pune - 411001','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000017','10000000-0000-0000-0000-000000000001','Cera Sanitaryware Ltd','Vikram Somany','9820100117','orders@cera-india.com','24AAACS6789Q1Z5','Cera House, Kadi, Mehsana, Gujarat - 382715','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000018','10000000-0000-0000-0000-000000000001','HSIL Ltd (Hindware)','Sandip Somany','9820100118','supply@hindware.in','07AAACH5678R1Z4','HSIL Ltd, DLF City, Gurgaon - 122002','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000019','10000000-0000-0000-0000-000000000001','Godrej & Boyce Mfg Co','Adi Godrej Jr','9820100119','locks@godrej.com','27AAACG4567S1Z3','Godrej One, Pirojshanagar, Vikhroli, Mumbai - 400079','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000001','Hettich India Pvt Ltd','Thomas Hettich','9820100120','orders@hettich.in','29AAACH3456T1Z2','Hettich India, Electronic City, Bangalore - 560100','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000001','Philips India Limited','Mukesh Ambani Jr','9820100121','supply@philips.in','27AAACP2345U1Z1','Philips India, Godrej Complex, LBS Marg, Mumbai - 400086','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000001','Havells India Ltd','Anil Rai Gupta','9820100122','orders@havells.com','07AAACH1234V1Z9','Havells House, Okhla Industrial Area, Delhi - 110020','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000023','10000000-0000-0000-0000-000000000001','Asian Paints Limited','Manish Choksi','9820100123','supply@asianpaints.com','27AAACA9012W1Z8','Asian Paints House, Santacruz East, Mumbai - 400055','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000024','10000000-0000-0000-0000-000000000001','Berger Paints India Ltd','Kuldip Singh','9820100124','orders@bergerindia.com','19AAACB8901X1Z7','Berger House, Kolkata - 700017','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000025','10000000-0000-0000-0000-000000000001','Fenesta Building Systems','Anand Mahindra','9820100125','orders@fenesta.com','07AAACF7890Y1Z6','Fenesta, Okhla Industrial Estate, Delhi - 110020','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000026','10000000-0000-0000-0000-000000000001','Laticrete India Pvt Ltd','Suresh Patel','9820100126','india@laticrete.com','27AACL1234A1Z5','Laticrete, Taloja MIDC, Navi Mumbai - 410208','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000027','10000000-0000-0000-0000-000000000001','Mapei India Pvt Ltd','Marco Mapei','9820100127','india@mapei.com','27AACM5678B1Z3','Mapei India, Bhiwandi, Thane - 421302','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000028','10000000-0000-0000-0000-000000000001','Jaquar Luxury Bath Div','Deepak Mehra','9820100128','luxury@jaquar.com','06AACJ2345C1Z1','Jaquar Premium, Sector 59, Faridabad - 121004','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000029','10000000-0000-0000-0000-000000000001','Roca Bathroom Products','Carlos Roca','9820100129','india@roca.net','07AACR3456D1Z9','Roca India, MG Road, Gurugram - 122002','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000001','Grohe India Pvt Ltd','Klaus Grohe','9820100130','india@grohe.com','07AACG4567E1Z8','Grohe India, Sector 48, Gurugram - 122018','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000001','Dulux Paints (AkzoNobel)','Peter Dulux','9820100131','india@akzonobel.com','27AACD5678F1Z7','AkzoNobel, Saki Vihar Road, Powai, Mumbai - 400072','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000032','10000000-0000-0000-0000-000000000001','Pidilite Industries Ltd','Bharat Puri','9820100132','adhesives@pidilite.com','27AACP6789G1Z6','Pidilite House, Andheri East, Mumbai - 400093','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000033','10000000-0000-0000-0000-000000000001','Dorset Industries','Vijay Dorset','9820100133','orders@dorsetindia.com','24AACD7890H1Z5','Dorset, Kathwada, Ahmedabad - 382430','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000034','10000000-0000-0000-0000-000000000001','Ozone Overseas Pvt Ltd','Ajay Sethi','9820100134','orders@ozoneoverseas.com','27AACO8901I1Z4','Ozone, Turbhe, Navi Mumbai - 400705','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000035','10000000-0000-0000-0000-000000000001','Ebco Pvt Ltd','Raul Fernandes','9820100135','orders@ebco.in','27AACE9012J1Z3','Ebco House, Chakala, Andheri East, Mumbai - 400099','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000036','10000000-0000-0000-0000-000000000001','Legrand India Pvt Ltd','Frederic Legrand','9820100136','india@legrand.com','29AACL1234K1Z2','Legrand India, Baner, Pune - 411045','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000037','10000000-0000-0000-0000-000000000001','Anchor by Panasonic','Takaaki Panasonic','9820100137','india@anchor-ele.com','27AACP2345L1Z1','Anchor, Bhosari, Pune - 411026','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000038','10000000-0000-0000-0000-000000000001','Crompton Greaves Consumer','Shantanu Khosla','9820100138','orders@crompton.com','27AACC3456M1Z9','Crompton, CG House, Dr Annie Besant Rd, Mumbai - 400025','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000039','10000000-0000-0000-0000-000000000001','Usha International Ltd','Sanjay Mehra','9820100139','supply@usha.com','07AACU4567N1Z8','Usha House, DLF City, Gurugram - 122002','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000040','10000000-0000-0000-0000-000000000001','Supreme Industries Ltd','Bharat Patel','9820100140','pipes@supreme-ind.com','27AACS5678O1Z7','Supreme House, Khar West, Mumbai - 400052','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000001','Kalinga Stone Pvt Ltd','Ratan Kalinga','9820100141','orders@kalingastone.com','21AACK6789P1Z6','Kalinga Stone, Jajpur, Odisha - 755019','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000042','10000000-0000-0000-0000-000000000001','Regatta Universal Export','Kishor Shah','9820100142','sales@regattaexports.com','27AACR7890Q1Z5','Regatta, Nariman Point, Mumbai - 400021','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000043','10000000-0000-0000-0000-000000000001','Masonite India Pvt Ltd','David Masonite','9820100143','india@masonite.com','27AACM8901R1Z4','Masonite India, Wagle Estate, Thane - 400604','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000044','10000000-0000-0000-0000-000000000001','Century Plyboards India','Sajjan Bhajanka','9820100144','supply@centuryply.com','19AACC9012S1Z3','Century House, 14 India Exchange Place, Kolkata - 700001','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000045','10000000-0000-0000-0000-000000000001','Shalimar Paints Ltd','Ashok Choudhary','9820100145','orders@shalimarpaints.com','33AACS1234T1Z2','Shalimar Paints, Chennai - 600018','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000046','10000000-0000-0000-0000-000000000001','Nitco Limited','Vivek Talwar','9820100146','supply@nitco.in','27AACN2345U1Z1','Nitco House, Mira Road, Thane - 401104','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000047','10000000-0000-0000-0000-000000000001','Saint-Gobain India Pvt Ltd','Benoit SG','9820100147','india@saint-gobain.com','33AACS3456V1Z9','Saint-Gobain, Sriperumbudur, Chennai - 602105','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000048','10000000-0000-0000-0000-000000000001','Kajaria Wall Tiles Div','Ashok Kajaria Jr','9820100148','walltiles@kajaria.com','08AACK4567W1Z8','Kajaria Ceramics, Wall Tile Unit, Rajasthan - 302033','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000049','10000000-0000-0000-0000-000000000001','Saloni Ceramics Ltd','Himanshu Saloni','9820100149','orders@salonitiles.com','24AACS5678X1Z7','Saloni, Morbi, Gujarat - 363641','active',now(),now(),'20000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000050','10000000-0000-0000-0000-000000000001','Simpolo Ceramics Pvt Ltd','Manubhai Patel','9820100150','orders@simpolo.com','24AACS6789Y1Z6','Simpolo, Wankaner, Rajkot, Gujarat - 363621','active',now(),now(),'20000000-0000-0000-0000-000000000001');

-- ================================================================
-- SECTION 6: CUSTOMERS (100)
-- ================================================================

INSERT INTO customers (id, org_id, name, status, contact_person, phone, email, gstin, billing_name, billing_address, delivery_address, same_as_billing, notes, post_sale_discount, created_at, updated_at, created_by)
VALUES
-- Construction Companies (20)
('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Rahul Constructions Pvt Ltd','active','Rahul Mehta','9820012345','rahul@rahulconstructions.in','27AABCR1234A1Z5','Rahul Constructions Pvt Ltd','Plot 14, MIDC Industrial Area, Andheri East, Mumbai - 400093','Plot 14, MIDC Industrial Area, Andheri East, Mumbai - 400093',true,'Long-term client. Bulk tile orders. Net-30 payment.',5000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Patel Infrastructure Ltd','active','Ashok Patel','9879100202','ashok@patelinfra.com','24AABCP5678B1Z3','Patel Infrastructure Ltd','Survey No. 42, Odhav GIDC, Ahmedabad - 382415','Multiple sites - confirm before dispatch',false,'Gujarat-based. Prefers Orientbell. Advance payment.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Singh Builders Pvt Ltd','active','Gurpreet Singh','9822100303','gps@singhbuilders.com','27AABCS9012C1Z1','Singh Builders Pvt Ltd','Office No. 201, Shree Niwas Bldg, Deccan, Pune - 411004','As per project delivery schedule',false,'Pune-based mid-size builder. 3-5 projects running.',2000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Sharma Construction Co','active','Ramesh Sharma','9820100404','ramesh@sharmaconstruction.com','27AABCS7890D1Z9','Sharma Construction Co','302, Rustomjee Elements, Andheri West, Mumbai - 400058','302, Rustomjee Elements, Andheri West, Mumbai - 400058',true,'Premium residential projects. Marble + wood flooring preference.',10000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Kumar Infra Projects','active','Vijay Kumar','9960100505','vijay@kumarinfra.in','27AABCK6789E1Z8','Kumar Infra Projects','B-12, CIDCO Colony, Nashik - 422009','Multiple project sites, Nashik district',false,'Large highway contractor. Pipes and sanitary ware.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Desai Construction Corp','active','Manohar Desai','9712100606','manohar@desaiconstruction.com','24AABCD5678F1Z7','Desai Construction Corp','Ring Road, Udhna, Surat - 394210','Ring Road, Udhna, Surat - 394210',true,'Surat-based. Commercial construction focus.',3000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','Joshi Projects Pvt Ltd','active','Anil Joshi','9324100707','anil@joshiprojects.in','27AABCJ4567G1Z6','Joshi Projects Pvt Ltd','Shop 5, Param Plaza, Ghodbunder Rd, Thane West - 400615','As per delivery challan',false,'Thane-based. Residential housing. Regular piping orders.',1500.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','Modi Build Works','active','Harish Modi','9099100808','harish@modibuilds.com','24AABCM3456H1Z5','Modi Build Works','G-4, Swagat Complex, Race Course, Vadodara - 390007','G-4, Swagat Complex, Race Course, Vadodara - 390007',true,'Baroda-based. All categories.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','Kapoor Construction Ltd','active','Sunil Kapoor','9810100909','sunil@kapoorconstruction.com','07AABCK2345I1Z4','Kapoor Construction Ltd','J-8, Connaught Place, New Delhi - 110001','Project sites across NCR',false,'Delhi NCR. Large commercial construction. 45-day credit.',8000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','Verma Infra Group','active','Sanjay Verma','9422101010','sanjay@vermainfra.com','27AABCV1234J1Z3','Verma Infra Group','Plot 22, Hingna MIDC, Nagpur - 440016','Multiple Nagpur sites',false,'Nagpur-based infrastructure developer.',2500.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','Agarwal Builders','active','Rakesh Agarwal','9826101111','rakesh@agarwalbuilders.in','23AABCA9012K1Z2','Agarwal Builders','12, MG Road, Indore - 452001','12, MG Road, Indore - 452001',true,'MP-based. Growing client. Prefers Kajaria.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','Gupta Constructions','active','Pawan Gupta','9977101212','pawan@guptaconstruction.in','23AABCG8901L1Z1','Gupta Constructions','14 Hamidia Road, Bhopal - 462001','As per site',false,'Bhopal-based. Medium-scale residential.',1000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','Malhotra Infrastructure','active','Deepak Malhotra','9818101313','deepak@malhotrainfra.com','07AABCM7890M1Z9','Malhotra Infrastructure','B-44, Sector 57, Gurugram - 122003','Project sites Gurugram / Noida',false,'NCR developer. Premium projects. Net-45.',12000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','Yadav Builders Pvt Ltd','active','Ramakant Yadav','9415101414','ramakant@yadavbuilders.com','09AABCY6789N1Z8','Yadav Builders Pvt Ltd','Hazratganj, Lucknow - 226001','UP project sites',false,'UP-based. Tiles and sanitary only.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000001','Trivedi Projects','active','Mahesh Trivedi','9714101515','mahesh@trivediprojects.com','24AABCT5678O1Z7','Trivedi Projects','Katargam, Surat - 395004','Surat project sites',false,'Surat builder. Tiles specialty.',1500.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000001','Khanna Construction','active','Ajay Khanna','9815101616','ajay@khannaconstruction.com','03AABCK4567P1Z6','Khanna Construction','SCO 145, Sector 17, Chandigarh - 160017','Punjab project sites',false,'North India builder.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000017','10000000-0000-0000-0000-000000000001','Bose Infra Ltd','active','Siddharth Bose','9830101717','siddharth@boseinfra.com','19AABCB3456Q1Z5','Bose Infra Ltd','4 BBD Bag, Kolkata - 700001','WB project sites',false,'Kolkata-based. Mixed use projects.',2000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000018','10000000-0000-0000-0000-000000000001','Nair Constructions','active','Thomas Nair','9847101818','thomas@nairconstructions.com','32AABCN2345R1Z4','Nair Constructions','MG Road, Ernakulam, Kochi - 682035','Kerala project sites',false,'Kerala builder. Quality conscious.',3000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000019','10000000-0000-0000-0000-000000000001','Reddy Builders Ltd','active','Venkat Reddy','9848101919','venkat@reddybuilders.com','36AABCR1234S1Z3','Reddy Builders Ltd','Banjara Hills, Hyderabad - 500034','Hyderabad project sites',false,'Hyderabad developer. Tile + sanitary focus.',5000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000001','Iyer Construction Co','active','Suresh Iyer','9444102020','suresh@iyerconstruction.com','33AABCI9012T1Z2','Iyer Construction Co','Anna Salai, Chennai - 600002','Tamil Nadu project sites',false,'Chennai-based. Institutional projects.',4000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),

-- Developers (20)
('80000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000001','Greenscape Developers Pvt Ltd','active','Rohit Lodha','9820102121','rohit@greenscapedev.com','27AABCG8901U1Z1','Greenscape Developers Pvt Ltd','Lodha Park, Worli, Mumbai - 400018','As per project specifications',false,'Premium residential. High-end marble and wood.',25000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000001','Skyline Properties Ltd','active','Karan Shah','9920102222','karan@skylineproperties.in','27AABCS7890V1Z9','Skyline Properties Ltd','1202, Skyline House, Malad West, Mumbai - 400064','Project sites across Mumbai',false,'Mumbai developer. Volume buyer.',10000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000023','10000000-0000-0000-0000-000000000001','Pinnacle Realty Pvt Ltd','active','Arjun Mehta','9022102323','arjun@pinnaclerealty.com','27AABCP6789W1Z8','Pinnacle Realty Pvt Ltd','Peninsula Corporate Park, Lower Parel, Mumbai - 400013','Confirmed project-wise',false,'High-rise residential. Net-30.',15000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000024','10000000-0000-0000-0000-000000000001','Prestige Urban Homes Ltd','active','Irfan Khan','9886102424','irfan@prestigeurban.com','29AABCP5678X1Z7','Prestige Urban Homes Ltd','Residency Road, Bangalore - 560025','Bangalore project sites',false,'Bangalore developer. Quality preference.',8000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000025','10000000-0000-0000-0000-000000000001','Brigade Lifestyle Pvt Ltd','active','Ravi Menon','9845102525','ravi@brigadeli.com','29AABCB4567Y1Z6','Brigade Lifestyle Pvt Ltd','Brigade Gateway, Rajajinagar, Bangalore - 560055','Bangalore & Chennai sites',false,'Multi-city developer.',12000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000026','10000000-0000-0000-0000-000000000001','Harmony Housing Pvt Ltd','active','Pradeep Gupta','9810102626','pradeep@harmonyhousing.com','07AABCH3456Z1Z5','Harmony Housing Pvt Ltd','Vasant Kunj, New Delhi - 110070','NCR project sites',false,'Delhi NCR residential.',6000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000027','10000000-0000-0000-0000-000000000001','Mahadev Real Estate','active','Sameer Desai','9825102727','sameer@mahadevrealty.com','27AABCM2345A2Z4','Mahadev Real Estate','Tardeo, Mumbai - 400034','Mumbai and Pune projects',false,'Mixed use developments.',7000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000028','10000000-0000-0000-0000-000000000001','Kalpataru Heights Ltd','active','Shiv Kumar','9820102828','shiv@kalpataruheights.com','27AABCK1234B2Z3','Kalpataru Heights Ltd','Kalpataru Synergy, Santacruz East, Mumbai - 400055','Mumbai premium sites',false,'Premium developer. Luxury finishes.',20000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000029','10000000-0000-0000-0000-000000000001','Mahavir Builders','active','Anand Jain','9820102929','anand@mahavirbuilders.in','27AABCM9012C2Z2','Mahavir Builders','Borivali West, Mumbai - 400092','Western suburb sites',false,'Affordable housing. Volume tiles.',3000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000001','Omkar Realtors Ltd','active','Devashish Kumar','9820103030','devashish@omkarrealty.com','27AABCO8901D2Z1','Omkar Realtors Ltd','Omkar House, Prabhadevi, Mumbai - 400025','Premium project sites',false,'Slum rehab + premium developer.',9000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000001','Sobha Heritage Homes','active','Krishna Raj','9886103131','krishna@sobhaheritage.com','29AABCS7890E2Z9','Sobha Heritage Homes','Sobha HQ, EPIP Zone, Whitefield, Bangalore - 560066','Bangalore premium sites',false,'High-end residential. Marble focus.',18000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000032','10000000-0000-0000-0000-000000000001','Puravankara Lifestyle','active','Ashish Sharma','9886103232','ashish@puravankarali.com','29AABCP6789F2Z8','Puravankara Lifestyle','Ulsoor Lake, Bangalore - 560042','Multiple Bangalore sites',false,'Premium residential developer.',11000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000033','10000000-0000-0000-0000-000000000001','Raymond Realty Div','active','Vikrant Parekh','9820103333','vikrant@raymondrealty.com','27AABCR5678G2Z7','Raymond Realty Div','Raymond House, Thane West - 400604','Thane project sites',false,'New developer. Growing.',5000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000034','10000000-0000-0000-0000-000000000001','Sunteck City Projects','active','Kamal Seth','9820103434','kamal@sunteckcity.com','27AABCS4567H2Z6','Sunteck City Projects','Sunteck BKC, Bandra East, Mumbai - 400051','BKC and Goregaon sites',false,'Premium commercial + residential.',22000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000035','10000000-0000-0000-0000-000000000001','Hiranandani Properties','active','Niranjan Shah','9820103535','niranjan@hiranandaniprop.com','27AABCH3456I2Z5','Hiranandani Properties','Hiranandani Gardens, Powai, Mumbai - 400076','Powai and Thane sites',false,'Integrated township developer.',30000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),

-- Interior Designers & Architects (20)
('80000000-0000-0000-0000-000000000036','10000000-0000-0000-0000-000000000001','The Arch Studio Pvt Ltd','active','Neha Patel','9823103636','neha@thearchstudio.in','27AABCT2345J2Z4','The Arch Studio Pvt Ltd','301, Maker Chambers V, Nariman Point, Mumbai - 400021','Client project sites',false,'Premium interior design. Per-project buying.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000037','10000000-0000-0000-0000-000000000001','Design Republic Studio','active','Ananya Singh','9811103737','ananya@designrepublic.in','07AABCD1234K2Z3','Design Republic Studio','A-45, Defence Colony, New Delhi - 110024','Pan-India project sites',false,'High-end residential interiors. Marble specialist.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000038','10000000-0000-0000-0000-000000000001','Space Craft Design Lab','active','Priya Desai','9886103838','priya@spacecraftlab.com','29AABCS9012L2Z2','Space Craft Design Lab','Indiranagar, Bangalore - 560038','Bangalore client sites',false,'Commercial interior fit-outs.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000039','10000000-0000-0000-0000-000000000001','Studio Forma Pvt Ltd','active','Shruti Mehta','9822103939','shruti@studioforma.in','27AABCS8901M2Z1','Studio Forma Pvt Ltd','Koregaon Park, Pune - 411001','Pune client sites',false,'Residential + commercial design.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000040','10000000-0000-0000-0000-000000000001','Aesthetic Living Studio','active','Kavita Joshi','9820104040','kavita@aestheticliving.in','27AABCA7890N2Z9','Aesthetic Living Studio','Versova, Andheri West, Mumbai - 400061','Mumbai client projects',false,'Residential interior specialist.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000001','Creative Spaces India','active','Pooja Agarwal','9849104141','pooja@creativespacesindia.com','36AABCC6789O2Z8','Creative Spaces India','Jubilee Hills, Hyderabad - 500033','Hyderabad client sites',false,'Office interiors specialist.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000042','10000000-0000-0000-0000-000000000001','Luxe Interior Studio','active','Rekha Trivedi','9820104242','rekha@luxeinterior.in','27AABCL5678P2Z7','Luxe Interior Studio','Juhu, Mumbai - 400049','Mumbai premium residences',false,'Ultra-premium. Italian marble required.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000043','10000000-0000-0000-0000-000000000001','Urban Living Designs','active','Sonia Shah','9820104343','sonia@urbanlivingdesigns.com','27AABCU4567Q2Z6','Urban Living Designs','Bandra West, Mumbai - 400050','South Mumbai and Bandra sites',false,'Trendy urban residential.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000044','10000000-0000-0000-0000-000000000001','Arka Architects Studio','active','Deepak Arora','9810104444','deepak@arkaarchitects.com','07AABCA3456R2Z5','Arka Architects Studio','GK-2, New Delhi - 110048','NCR client projects',false,'Architecture + interiors. Specialty tiles.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000045','10000000-0000-0000-0000-000000000001','Morphogenesis Design Pvt','active','Nandita Roy','9811104545','nandita@morphogenesis.in','07AABCM2345S2Z4','Morphogenesis Design Pvt','Okhla Industrial Area, Delhi - 110020','Pan-India projects',false,'Award-winning architecture firm.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000046','10000000-0000-0000-0000-000000000001','Future Home Designers','active','Ankit Gupta','9825104646','ankit@futurehome.in','24AABCF1234T2Z3','Future Home Designers','CG Road, Ahmedabad - 380006','Gujarat client sites',false,'Residential. Budget to premium range.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000047','10000000-0000-0000-0000-000000000001','Sanjay Puri Associates','active','Sanjay Puri','9820104747','sanjay@sanjaypuri.com','27AABCS9012U2Z2','Sanjay Puri Associates','Khar West, Mumbai - 400052','Pan-India client sites',false,'National-award architect.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000048','10000000-0000-0000-0000-000000000001','Interior Concepts Pvt Ltd','active','Rohan Kapoor','9820104848','rohan@interiorconcepts.in','27AABCI8901V2Z1','Interior Concepts Pvt Ltd','Powai, Mumbai - 400076','Mumbai client projects',false,'Corporate and hospitality interiors.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000049','10000000-0000-0000-0000-000000000001','Vastu Design Works','active','Vivek Sharma','9810104949','vivek@vastudesign.in','07AABCV7890W2Z9','Vastu Design Works','Lajpat Nagar, Delhi - 110024','Delhi NCR projects',false,'Vastu-compliant residential design.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000050','10000000-0000-0000-0000-000000000001','Biome Environmental Design','active','Girish Nair','9886105050','girish@biomeenvironmental.com','29AABCB6789X2Z8','Biome Environmental Design','Indiranagar, Bangalore - 560008','Bangalore sustainable projects',false,'Sustainable architecture firm.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),

-- Hospitality (15)
('80000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000001','Taj Hotels Renovation Div','active','Arif Baig','9820105151','arif.baig@tajhotels.com','27AABCT5678Y2Z7','Indian Hotels Co Ltd','Mandlik Road, Colaba, Mumbai - 400001','Hotel properties as specified',false,'Premium renovation. Marble floors + luxury bath.',50000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000052','10000000-0000-0000-0000-000000000001','Marriott Projects India','active','Sam Mendes','9820105252','sam.mendes@marriott.com','07AABCM4567Z2Z6','Marriott International India','JW Marriott, Aerocity, Delhi - 110037','Pan-India hotel properties',false,'International chain renovation.',35000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000053','10000000-0000-0000-0000-000000000001','ITC Hotels Projects Div','active','Nikhil Chadha','9886105353','nikhil.chadha@itchotels.in','29AABCI3456A3Z5','ITC Limited - Hotels','ITC Centre, Residency Road, Bangalore - 560025','Hotel sites across India',false,'Premium hospitality. Luxury stone + wood.',40000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000054','10000000-0000-0000-0000-000000000001','Hyatt India Projects','active','Manisha Patel','9820105454','manisha.patel@hyatt.com','07AABCH2345B3Z4','Hyatt Hotels India Pvt Ltd','The Grand Hyatt, Santacruz East, Mumbai - 400099','Multiple hotel properties',false,'International hotel renovation.',28000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000055','10000000-0000-0000-0000-000000000001','Radisson Renovation India','active','Sanjay Agarwal','9822105555','sanjay.agarwal@radisson.com','27AABCR1234C3Z3','Radisson Hotel Group India','Airport Road, Pune - 411032','Pune and Maharashtra hotels',false,'Mid-luxury hotel renovation.',15000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000056','10000000-0000-0000-0000-000000000001','Lemon Tree Hotels Ltd','active','Manav Thadani','9820105656','manav@lemontreehotels.com','07AABCL9012D3Z2','Lemon Tree Hotels Ltd','Asset No. 6, Aerocity, Delhi - 110037','Budget hotel portfolio',false,'Budget hotel chain. Tiles focus.',5000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000057','10000000-0000-0000-0000-000000000001','Accor Hotels India Pvt','active','Pierre Dupont','9820105757','pierre.dupont@accor.com','27AABCA8901E3Z1','Accor Hotels India Pvt Ltd','Sofitel BKC, Bandra East, Mumbai - 400051','Multi-brand hotel portfolio',false,'French chain. Multiple brands.',20000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000058','10000000-0000-0000-0000-000000000001','Peninsula Hotels Pvt Ltd','active','Alex Fernandes','9820105858','alex@peninsulahotels.in','27AABCP7890F3Z9','Peninsula Hotels Pvt Ltd','Peninsula Business Park, Lower Parel, Mumbai - 400013','Mumbai luxury properties',false,'Boutique luxury hotels.',25000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000059','10000000-0000-0000-0000-000000000001','Holiday Inn Projects India','active','Henry D''Souza','9820105959','henry@hiindia.com','27AABCH6789G3Z8','InterContinental Hotels India','Sahar Road, Andheri East, Mumbai - 400099','Mumbai hotel properties',false,'Mid-scale brand.',10000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000060','10000000-0000-0000-0000-000000000001','Novotel Projects Pvt Ltd','active','Frank Martin','9820106060','frank.martin@novotel.in','27AABCN5678H3Z7','Accor - Novotel India','Juhu Beach Road, Juhu, Mumbai - 400049','Mumbai and Pune',false,'Mid-premium chain.',12000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000061','10000000-0000-0000-0000-000000000001','Westin Renovation Div','active','Wilson D''Costa','9820106161','wilson@westin.in','27AABCW4567I3Z6','Starwood Hotels India','Westin Mumbai Garden City, Mumbai - 400063','Mumbai premium',false,'Luxury chain renovation.',30000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000062','10000000-0000-0000-0000-000000000001','Treebo Hotels Projects','active','Sidharth Gupta','9820106262','sidharth@treebo.com','29AABCT3456J3Z5','Treebo Hotels Pvt Ltd','Koramangala, Bangalore - 560034','Budget hotel portfolio India',false,'Startup hotel chain. Budget tiles.',2000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000063','10000000-0000-0000-0000-000000000001','Ginger Hotels Renovation','active','Manish Rathi','9820106363','manish@gingerhotels.com','27AABCG2345K3Z4','Tata-Ginger Hotels Ltd','Church Gate, Mumbai - 400020','Budget chain renovation',false,'Tata budget hotel brand.',4000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000064','10000000-0000-0000-0000-000000000001','Fortune Hotels Group','active','Anand Batra','9820106464','anand@fortunehotels.in','27AABCF1234L3Z3','Fortune Hotels - ITC Group','Fortune Select Excalibur, Gurugram - 122001','Pan-India Fortune properties',false,'Mid-scale chain. Regular renovation.',8000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000065','10000000-0000-0000-0000-000000000001','Royal Orchid Hotels Ltd','active','Chander Baljee','9820106565','chander@royalorchid.com','29AABCR9012M3Z2','Royal Orchid Hotels Ltd','MG Road, Bangalore - 560025','South India hotel portfolio',false,'South India hotel chain.',7000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),

-- Hospitals & Healthcare (10)
('80000000-0000-0000-0000-000000000066','10000000-0000-0000-0000-000000000001','Kokilaben Hospital Projects','active','Dr Anand Nair','9820106666','projects@kokilabenhospital.com','27AABCK8901N3Z1','Kokilaben Dhirubhai Ambani Hospital','Rao Saheb Achutrao Patwardhan Marg, Four Bungalows, Mumbai - 400053','Hospital campus',false,'Premium hospital renovation. Hygienic tiles only.',20000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000067','10000000-0000-0000-0000-000000000001','Fortis Healthcare Projects','active','Dr Shivam Bhatt','9810106767','projects@fortishealthcare.com','07AABCF7890O3Z9','Fortis Healthcare Ltd','Escorts Heart Institute, Delhi - 110025','Pan-India hospital renovation',false,'Multi-hospital renovation.',15000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000068','10000000-0000-0000-0000-000000000001','Apollo Hospitals Renovation','active','Dr Radha Krishna','9848106868','projects@apollohospitals.com','36AABCA6789P3Z8','Apollo Hospitals Enterprise','Jubilee Hills, Hyderabad - 500033','Apollo network renovation',false,'Hospital chain. Hygienic solutions focus.',25000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000069','10000000-0000-0000-0000-000000000001','Nanavati Hospital Projects','active','Dr Mukesh Shah','9820106969','projects@nanavatihospital.org','27AABCN5678Q3Z7','Nanavati Super Speciality Hospital','SV Road, Vile Parle West, Mumbai - 400056','Hospital campus',false,'South Mumbai premium hospital.',10000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000070','10000000-0000-0000-0000-000000000001','Lilavati Hospital Projects','active','Dr Jayesh Mehta','9820107070','projects@lilavatihospital.com','27AABCL4567R3Z6','Lilavati Hospital & Research','Bandra Reclamation, Bandra West, Mumbai - 400050','Hospital campus',false,'Bandra premium hospital.',12000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000001','Jupiter Hospital Renovation','active','Dr Anupam Singh','9022107171','projects@jupiterhospital.com','27AABCJ3456S3Z5','Jupiter Hospital Pvt Ltd','Eastern Express Highway, Thane - 400601','Thane hospital',false,'New-age hospital.',8000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000072','10000000-0000-0000-0000-000000000001','Wockhardt Hospital Projects','active','Dr Sanjay Mehta','9820107272','projects@wockhardt.com','27AABCW2345T3Z4','Wockhardt Ltd','Wockhardt Towers, BKC, Mumbai - 400051','Wockhardt hospital network',false,'Multi-city hospital chain.',9000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000073','10000000-0000-0000-0000-000000000001','Breach Candy Hospital','active','Dr Sumit Kapoor','9820107373','projects@breachcandyhospital.com','27AABCB1234U3Z3','Breach Candy Hospital Trust','60 Bhulabhai Desai Road, Mumbai - 400026','Hospital campus',false,'Historical Mumbai hospital.',7000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000074','10000000-0000-0000-0000-000000000001','Hiranandani Hospital','active','Dr Priya Patel','9022107474','projects@hiranandanihospital.com','27AABCH9012V3Z2','Hiranandani Hospital','Hiranandani Gardens, Powai, Mumbai - 400076','Powai campus',false,'Integrated hospital campus.',11000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000075','10000000-0000-0000-0000-000000000001','Aster DM Healthcare Proj','active','Dr John Thomas','9847107575','projects@asterdm.com','32AABCA8901W3Z1','Aster DM Healthcare Ltd','Kochi - 682026','Kerala hospital network',false,'South India hospital chain.',13000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),

-- Corporate / IT / Institutional (25)
('80000000-0000-0000-0000-000000000076','10000000-0000-0000-0000-000000000001','Infosys Campus Projects','active','Ramesh Krishnamurthy','9886107676','campusproj@infosys.com','29AABCI7890X3Z9','Infosys Ltd','Electronics City, Bangalore - 560100','Infosys campus sites',false,'IT campus renovation. Large tile orders.',30000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000077','10000000-0000-0000-0000-000000000001','TCS Facilities Division','active','Sanjay Nair','9020107777','facilities@tcs.com','27AABCT6789Y3Z8','Tata Consultancy Services','TCS Banyan Park, Worli, Mumbai - 400018','Mumbai and Pune TCS campuses',false,'IT company. Large volume. Net-45.',25000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000078','10000000-0000-0000-0000-000000000001','Wipro Facilities Mgmt','active','Arjun Rao','9886107878','facilitiesmgmt@wipro.com','29AABCW5678Z3Z7','Wipro Ltd','Sarjapur Road, Bangalore - 560035','Wipro campus sites',false,'Bangalore IT campus.',15000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000079','10000000-0000-0000-0000-000000000001','HCL Technologies Campus','active','Vineet Mehta','9810107979','campus@hcltech.com','09AABCH4567A4Z6','HCL Technologies Ltd','A-10, Sector 3, Noida - 201301','NCR IT campuses',false,'IT campus. Flooring + sanitary.',18000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000080','10000000-0000-0000-0000-000000000001','Tech Mahindra Campus','active','Manoj Bhat','9822108080','campus@techmahindra.com','27AABCT3456B4Z5','Tech Mahindra Ltd','Sharda Centre, Pune - 411028','Pune IT campus',false,'IT company. Regular maintenance orders.',10000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000081','10000000-0000-0000-0000-000000000001','Reliance Industries Proj','active','Ritesh Shah','9820108181','projects@ril.com','27AABCR2345C4Z4','Reliance Industries Ltd','Maker Chambers IV, Nariman Point, Mumbai - 400021','Multiple RIL sites',false,'Conglomerate. Diverse material needs.',40000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000082','10000000-0000-0000-0000-000000000001','HDFC Bank Projects Div','active','Rahul Khanna','9820108282','projects@hdfcbank.com','27AABCH1234D4Z3','HDFC Bank Ltd','HDFC House, Backbay Reclamation, Mumbai - 400020','Bank branch renovations',false,'Retail bank branch renovation.',5000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000083','10000000-0000-0000-0000-000000000001','ICICI Bank Facilities','active','Priya Ramani','9820108383','facilities@icicibank.com','27AABCI9012E4Z2','ICICI Bank Ltd','ICICI Bank Towers, BKC, Mumbai - 400051','Branch network renovation',false,'Large banking chain.',8000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000084','10000000-0000-0000-0000-000000000001','Bajaj Finserv Projects','active','Sanjay Khatri','9822108484','projects@bajajfinserv.com','27AABCB8901F4Z1','Bajaj Finserv Ltd','Bajaj Finserv Corp Park, Viman Nagar, Pune - 411014','Pune and Mumbai offices',false,'Financial services. Office renovation.',6000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000085','10000000-0000-0000-0000-000000000001','Godrej Properties Projects','active','Pirojsha Godrej','9820108585','projects@godrejproperties.com','27AABCG7890G4Z9','Godrej Properties Ltd','Godrej One, Pirojshanagar, Mumbai - 400079','Premium residential projects',false,'Quality-focused developer.',20000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000086','10000000-0000-0000-0000-000000000001','Cognizant India Campus','active','Rajesh Kumar','9444108686','campus@cognizant.com','33AABCC6789H4Z8','Cognizant Technology Solutions','Old Mahabalipuram Road, Chennai - 600119','Chennai and Pune campuses',false,'IT campus renovation.',12000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000087','10000000-0000-0000-0000-000000000001','DLF Commercial Projects','active','Pradeep Jain','9810108787','commercial@dlf.in','07AABCD5678I4Z7','DLF Ltd','DLF Centre, Parliament Street, Delhi - 110001','Commercial real estate portfolio',false,'Largest commercial developer.',35000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000088','10000000-0000-0000-0000-000000000001','Oberoi Mall Projects','active','Vikram Oberoi','9820108888','projects@oberoirealty.com','27AABCO4567J4Z6','Oberoi Realty Ltd','Commerz, Off Western Expy, Goregaon E, Mumbai - 400063','Mumbai luxury projects',false,'Luxury real estate.',28000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000089','10000000-0000-0000-0000-000000000001','Embassy Office Parks','active','Mike Holland','9886108989','projects@embassyoffice.com','29AABCE3456K4Z5','Embassy Office Parks REIT','Embassy Golf Links, Bangalore - 560071','Bangalore business parks',false,'Office park development.',22000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000090','10000000-0000-0000-0000-000000000001','Phoenix Mall Projects','active','Atul Ruia','9820109090','projects@phoenixmalls.com','27AABCP2345L4Z4','Phoenix Mills Ltd','High Street Phoenix, Lower Parel, Mumbai - 400013','Mall renovation projects',false,'Retail mall chain.',40000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),

-- Residential High-Value (10)
('80000000-0000-0000-0000-000000000091','10000000-0000-0000-0000-000000000001','Elite Residences','active','Priya Shah','9867109191','priya.shah@eliteresidences.com','27AABCE1234M4Z3','Elite Residences Ltd','1201, Lotus Business Park, Malad West, Mumbai - 400064','Premium Malad project',false,'Premium developer. Italian marble specialist.',22000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000092','10000000-0000-0000-0000-000000000001','Metro Interiors Pvt Ltd','active','Rajan Chopra','9820109292','rajan@metrointeriors.in','27AABCM9012N4Z2','Metro Interiors Pvt Ltd','Andheri West, Mumbai - 400058','Mumbai premium residential',false,'High-end residential fit-out firm.',5000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000093','10000000-0000-0000-0000-000000000001','GreenBuild Pvt Ltd','active','Ashish Kamath','9820109393','ashish@greenbuildpvt.com','27AABCG8901O4Z1','GreenBuild Pvt Ltd','Vikhroli West, Mumbai - 400083','Sustainable building projects',false,'Eco-friendly construction focus.',3000.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000094','10000000-0000-0000-0000-000000000001','Skyline Developers Mumbai','active','Nilesh Shah','9820109494','nilesh@skylinedevelopers.com','27AABCS7890P4Z9','Skyline Developers','Vashi, Navi Mumbai - 400703','Navi Mumbai projects',false,'Mid-range residential. Volume.',4000.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000095','10000000-0000-0000-0000-000000000001','Rahul Mehta Residences','active','Rahul Mehta','9820109595','rahul.mehta@gmail.com',NULL,'Rahul Mehta','Flat 1402, Ocean Park, Worli, Mumbai - 400018','Same',true,'Individual HNI client. Luxury apartment renovation.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000096','10000000-0000-0000-0000-000000000001','Sunil Kapoor Bungalow','active','Sunil Kapoor','9810109696','sunil.kapoor@gmail.com',NULL,'Sunil Kapoor','Bungalow 7, Juhu Scheme, Juhu, Mumbai - 400049','Same',true,'HNI bungalow renovation. Top budget.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000097','10000000-0000-0000-0000-000000000001','Agarwal Family Residence','active','Dinesh Agarwal','9826109797','dinesh.agarwal@gmail.com',NULL,'Dinesh Agarwal','Villa 3, Lavasa Hill City, Pune - 412112','Same',true,'Lavasa villa renovation.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000001','Trivedi Villa Projects','active','Nisha Trivedi','9714109898','nisha.trivedi@gmail.com',NULL,'Nisha Trivedi','Sea Face, Marine Lines, Mumbai - 400002','Same',true,'Sea-facing apartment. Premium finishes.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005'),
('80000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000001','Sharma Family Bungalow','active','Deepa Sharma','9820109999','deepa.sharma@gmail.com',NULL,'Deepa Sharma','Plot 42, Golden Estate, Lonavala - 410401','Same',true,'Weekend home renovation.',0.00,now(),now(),'20000000-0000-0000-0000-000000000004'),
('80000000-0000-0000-0000-000000000100','10000000-0000-0000-0000-000000000001','Mehta Heritage Residence','active','Kavita Mehta','9820100100','kavita.mehta@gmail.com',NULL,'Kavita Mehta','Heritage Bungalow, Cuffe Parade, Mumbai - 400005','Same',true,'Historic property restoration. Special materials.',0.00,now(),now(),'20000000-0000-0000-0000-000000000005');
