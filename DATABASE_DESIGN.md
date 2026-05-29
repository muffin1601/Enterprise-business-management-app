# Watcon Business Management System — Database Design

> **Status:** Schema design (no migrations written yet)
> **Date:** 2026-05-29
> **Companion to:** `PROJECT_PLAN.md`
> **Target platform:** Supabase (PostgreSQL 15+), Drizzle ORM, Row-Level Security
> **Scope:** Full relational schema for all modules — identity/access, inventory, customers/receivables, quotations, order-to-cash, tax invoicing, and back-office (HR/Finance/Logistics/Support) outlines.

---

## 1. Design Principles & Conventions

### 1.1 Universal column conventions
Every **business** table carries the following base columns (the "envelope"):

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` PK, default `gen_random_uuid()` | Surrogate primary key. |
| `org_id` | `uuid` FK → `organizations.id`, NOT NULL | **Multi-tenant** discriminator (see §2). |
| `created_at` | `timestamptz` NOT NULL default `now()` | Row creation. |
| `updated_at` | `timestamptz` NOT NULL default `now()` | Auto-bumped by trigger. |
| `created_by` | `uuid` FK → `users.id` (nullable) | Actor who created. |
| `updated_by` | `uuid` FK → `users.id` (nullable) | Actor of last update. |
| `deleted_at` | `timestamptz` NULL | **Soft delete** marker (see §3). |

> Lookup/junction tables (`role_permissions`, `user_roles`) and the append-only `audit_logs` omit parts of the envelope where noted.

### 1.2 Data-type rules (from PROJECT_PLAN §5.3, §7)
| Concept | Type | Notes |
|---------|------|-------|
| Money (INR) | `numeric(14,2)` | Never `float`/`double`. Stored in rupees. |
| Quantity / stock | `numeric(14,3)` | Supports fractional units (SQM, KG, MTR). |
| Percentage (discount, GST, duty, profit) | `numeric(6,3)` | e.g. `18.000`, `1.350` for multiplier use `numeric(8,4)`. |
| Exchange rate | `numeric(12,6)` | ₹ per foreign unit. |
| Codes / refs (ref_no, gstin, pan) | `text` (or `varchar(n)`) | With uniqueness constraints where needed. |
| Free text / addresses | `text` | Multiline addresses stored as text. |
| Flags | `boolean` | |
| Enumerations | `pgEnum` (Postgres `enum` type) | See §5. |
| Images / logos | `text` (URL) | Supabase Storage URL, **never base64** (NFR-DATA-2). |
| Structured snapshots | `jsonb` | Audit before/after, denormalised line snapshots. |

### 1.3 Naming
- Tables: `snake_case`, **plural** (`quotes`, `quote_items`).
- Columns: `snake_case`.
- FKs: `<referenced_singular>_id` (`customer_id`, `parent_id`).
- Enums (PG types): `<domain>_<thing>` (`quote_status`, `gst_mode`).
- Indexes: `idx_<table>_<cols>`; uniques: `uq_<table>_<cols>`; FKs: `fk_<table>_<ref>`.

---

## 2. Multi-Tenant Strategy

**Model: shared-database, shared-schema, row-level isolation by `org_id`.**

- A single `organizations` table is the tenant root. v1 runs **one org** (PROJECT_PLAN §9.2), but the schema is tenant-ready from day one — adding tenants later requires no migration.
- **Every business table has `org_id NOT NULL`** and an FK to `organizations`. This is the isolation axis for RLS.
- A user's tenant access is expressed through **`memberships`** (user ↔ org, many-to-many) so a user can belong to multiple orgs later (e.g. franchise/group accounts).
- **Roles are scoped per org** via `user_roles(user_id, org_id, role_id)` — the same person can be Admin in one org and Sales in another.
- Tenant resolution in the app: the active `org_id` is stored on the session / JWT custom claim (`app_metadata.org_id`) and validated server-side; RLS independently enforces that the row's `org_id` is one the user is a member of.

```
organizations (tenant root)
   └──< memberships >── users
   └──< user_roles >── roles
   └──< (every business table).org_id
```

---

## 3. Soft-Delete Strategy

- Business tables use **`deleted_at timestamptz NULL`**. A non-null value = logically deleted.
- **Application never issues hard `DELETE`** on business rows; it sets `deleted_at = now()`. Hard deletes reserved for GDPR-style purges via privileged maintenance jobs.
- **All reads filter `deleted_at IS NULL`.** Two enforcement layers:
  1. **RLS `USING (deleted_at IS NULL)`** on SELECT for normal roles (admins may have a policy to read deleted rows for restore/audit).
  2. **Drizzle query helpers** add `isNull(table.deleted_at)` by default (a `notDeleted()` helper).
- **Filtered indexes** use `WHERE deleted_at IS NULL` so active-row lookups stay fast and uniqueness applies only to live rows (e.g. a ref_no can be reused after a soft-deleted draft).
- Cascade semantics: soft-deleting a parent (e.g. a `quote`) soft-deletes children (`quote_locations`, `quote_items`, …) via application transaction (not DB cascade, which only fires on hard delete). FKs still declare `ON DELETE CASCADE` for the rare hard-delete/purge path.
- Junction/lookup/append-only tables (`role_permissions`, `audit_logs`, `stock_movements`) are **not** soft-deletable — movements/audit are immutable history.

---

## 4. Audit-Log Strategy

**Goal (NFR-SEC-2, NFR-AUDIT-1):** immutable who/when/what/old→new for all sensitive mutations — stock, pricing, discounts, payments, quote status, roles.

### 4.1 `audit_logs` table (append-only)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `org_id` | `uuid` NOT NULL | Tenant. |
| `actor_id` | `uuid` (nullable) | `auth.uid()` at time of change. |
| `entity_type` | `text` NOT NULL | e.g. `items`, `payments`, `quotes`. |
| `entity_id` | `uuid` NOT NULL | Affected row. |
| `action` | `audit_action` enum | `insert` / `update` / `delete` / `restore` / `login` / `permission_change`. |
| `before` | `jsonb` NULL | Row snapshot before (null on insert). |
| `after` | `jsonb` NULL | Row snapshot after (null on delete). |
| `changed_fields` | `text[]` NULL | Convenience diff of changed columns. |
| `ip` | `inet` NULL | Optional request IP. |
| `at` | `timestamptz` NOT NULL default `now()` | |

- **No `updated_at`/`deleted_at`** — rows are immutable. RLS allows INSERT + SELECT only (no UPDATE/DELETE for anyone except service role).

### 4.2 Capture mechanism (two complementary paths)
1. **Postgres triggers** (`AFTER INSERT/UPDATE/DELETE`) on audited tables → a generic `fn_audit()` that writes the snapshot. This guarantees capture even for direct DB writes. Actor read from `current_setting('request.jwt.claims', true)` (Supabase sets this).
2. **Drizzle mutation wrapper** (`withAudit()`) at the app layer for richer business context (e.g. "discount approved by X") where triggers lack intent.

**Audited tables (initial set):** `items`, `stock_adjustments`, `quotes`, `quote_items`, `customers` (discount fields), `payments`, `delivery_challans`, `sales_orders`, `user_roles`, `role_permissions`, `invoices`.

---

## 5. Enumerated Domain Types (`pgEnum`)

| Enum type | Values | Used by |
|-----------|--------|---------|
| `record_status` | `active`, `inactive` | users, customers, suppliers |
| `audit_action` | `insert`, `update`, `delete`, `restore`, `login`, `permission_change` | audit_logs |
| `currency_code` | `INR`, `USD`, `EUR`, `CNY` | items (import), invoices |
| `transport_type` | `lumpsum`, `percent` | items (import) |
| `stock_adj_type` | `add`, `sub` | stock_adjustments |
| `payment_mode` | `neft`, `rtgs`, `cheque`, `cash`, `upi`, `card`, `other` | payments |
| `quote_status` | `draft`, `sent`, `accepted`, `revised`, `cancelled` | quotes |
| `gst_mode` | `yes`, `incl`, `no` | quotes (Add / Included / None) |
| `quote_total_mode` | `grand`, `each`, `both` | quotes |
| `install_mode` | `lumpsum`, `percent`, `perunit` | quote_location_installation |
| `term_category` | `delivery`, `gst`, `payment`, `warranty`, `installation`, `exclusion`, `other` | quote_terms |
| `sales_order_status` | `open`, `partially_delivered`, `fulfilled`, `cancelled` | sales_orders |
| `invoice_status` | `draft`, `issued`, `paid`, `partially_paid`, `cancelled` | invoices |
| `ticket_status` | `open`, `in_progress`, `resolved`, `closed` | tickets |
| `leave_status` | `pending`, `approved`, `rejected`, `cancelled` | leave_requests |
| `expense_status` | `draft`, `submitted`, `approved`, `rejected`, `paid` | expenses |

> Trade-off note: PG enums are fast and type-safe but altering values requires `ALTER TYPE`. For volatile lists (payment modes, units) a lookup table is an alternative; `units` and `brands` are modeled as **lookup tables** (frequently extended by users), while truly fixed sets remain enums.

---

## 6. ER Diagram Description

### 6.1 Domain clusters
```
┌─ IDENTITY & ACCESS ──────────────────────────────────────────────┐
│ organizations ─1:N─ memberships ─N:1─ users                       │
│ users ─1:N─ user_roles ─N:1─ roles ─1:N─ role_permissions ─N:1─   │
│                                                       permissions  │
│ audit_logs (append-only, references org + actor)                  │
└───────────────────────────────────────────────────────────────────┘

┌─ INVENTORY / CATALOGUE ──────────────────────────────────────────┐
│ item_families ─1:N─ items                                         │
│ brands        ─1:N─ items                                         │
│ units         ─1:N─ items                                         │
│ suppliers     ─1:N─ items (last_supplier)                         │
│ items ─self 1:N─ items            (parent → variant items)        │
│ items ─1:N─ item_variations       (variation spec on parent)      │
│ items ─1:N─ stock_adjustments     (add/sub, reason, by whom)      │
│ items ─1:N─ stock_movements       (sales/issue history → customer)│
└───────────────────────────────────────────────────────────────────┘

┌─ CUSTOMERS & RECEIVABLES ────────────────────────────────────────┐
│ customers ─1:N─ payments                                          │
│ customers ─1:N─ quotes / sales_orders / delivery_challans /       │
│                  invoices                                         │
│ Running Bill (derived): challans − post_sale_discount − payments  │
└───────────────────────────────────────────────────────────────────┘

┌─ QUOTATIONS ─────────────────────────────────────────────────────┐
│ customers ─1:N─ quotes                                            │
│ quotes ─self N:1─ quotes              (revision chain via parent)  │
│ quotes ─1:N─ quote_locations ─1:1─ quote_location_installation    │
│ quote_locations ─1:N─ quote_items ─1:N─ quote_item_options        │
│ quotes ─1:N─ quote_terms                                          │
│ quote_items ─N:1─ items (optional catalogue link)                 │
└───────────────────────────────────────────────────────────────────┘

┌─ ORDER-TO-CASH ──────────────────────────────────────────────────┐
│ quotes ─1:N─ sales_orders ─1:N─ sales_order_items                 │
│ sales_orders ─1:N─ delivery_challans ─1:N─ delivery_challan_items  │
│ delivery_challans ─1:N─ stock_movements   (posting decrements stk) │
│ sales_orders/challans ─1:N─ invoices ─1:N─ invoice_items          │
│ invoices ─N:M─ payments (via payment_allocations)                 │
└───────────────────────────────────────────────────────────────────┘

┌─ BACK-OFFICE (outline) ──────────────────────────────────────────┐
│ employees ─1:N─ leave_requests / appraisals / payroll_runs        │
│ vendors ─1:N─ shipments                                           │
│ expenses ─1:N─ expense_approvals ; budgets                        │
│ customers ─1:N─ tickets ─1:N─ ticket_events                       │
└───────────────────────────────────────────────────────────────────┘
```

### 6.2 Cardinality highlights
- **items → items (self-referential):** `parent_id` null = standalone/parent; non-null = variant. One parent → many variants (PROJECT_PLAN: "variations spawn as separate items").
- **quotes → quotes (self-referential):** `parent_quote_id` chains revisions; `revision` integer increments.
- **quote_locations → quote_location_installation:** 1:1 (installation is optional, `enabled` flag).
- **quote_items → quote_item_options:** 1:N alternates, never counted in totals.
- **invoices ↔ payments:** M:N through `payment_allocations` (a payment may settle multiple invoices; an invoice may receive multiple payments). The prototype's simple `customer → payments` is preserved (`payments.customer_id`) while allocations add invoice-level precision.

---

## 7. Table Catalog (columns)

> All tables include the **envelope** (§1.1: `id, org_id, created_at, updated_at, created_by, updated_by, deleted_at`) unless stated "no soft delete" or "no envelope". Only domain-specific columns are listed below.

### 7.1 Identity & Access

**organizations** *(tenant root; org_id self = id)*
`name text NOT NULL`, `legal_name text`, `gstin text`, `pan text`, `address text`, `logo_url text`, `currency currency_code default 'INR'`, `status record_status default 'active'`.

**users** *(profile; mirrors `auth.users.id`)*
`id uuid PK = auth.users.id`, `email text UNIQUE NOT NULL`, `full_name text`, `phone text`, `avatar_url text`, `status record_status default 'active'`, `last_login_at timestamptz`. *(No `org_id` here — linkage via memberships.)*

**memberships** *(user ↔ org)*
`org_id`, `user_id uuid → users`, `is_default boolean default false`. Unique `(org_id, user_id)`. *(No soft delete; remove membership to revoke.)*

**roles**
`org_id` (nullable for global/system roles), `key text NOT NULL` (e.g. `admin`, `sales`), `name text`, `description text`, `is_system boolean default false`. Unique `(org_id, key)`.

**permissions** *(global catalog; no org_id, no soft delete)*
`key text PK-unique` (e.g. `stock.adjust`, `quote.revise`, `payment.record`), `description text`, `module text`.

**role_permissions** *(junction; no envelope beyond org)*
`role_id uuid → roles`, `permission_key text → permissions.key`. PK `(role_id, permission_key)`.

**user_roles** *(per-org role assignment)*
`org_id`, `user_id uuid → users`, `role_id uuid → roles`. Unique `(org_id, user_id, role_id)`.

**audit_logs** — see §4.1 (append-only).

### 7.2 Inventory / Catalogue

**item_families**
`org_id`, `name text NOT NULL`. Unique `(org_id, lower(name)) WHERE deleted_at IS NULL`.

**brands**
`org_id`, `name text NOT NULL`. Unique `(org_id, lower(name)) WHERE deleted_at IS NULL`.

**units**
`org_id`, `code text NOT NULL` (SQM, MTR, NOS, BOX, KG, SQF, LTR, SET, PCS), `name text`. Unique `(org_id, code) WHERE deleted_at IS NULL`.

**suppliers**
`org_id`, `name text NOT NULL`, `contact_person text`, `phone text`, `email text`, `gstin text`, `address text`, `status record_status default 'active'`.

**items** *(core)*
| Column | Type | Notes |
|--------|------|-------|
| `parent_id` | `uuid → items.id` (nullable) | Variant → parent link. |
| `family_id` | `uuid → item_families.id` (nullable) | |
| `brand_id` | `uuid → brands.id` (nullable) | |
| `unit_id` | `uuid → units.id` (nullable) | |
| `sku` | `text` | Display code e.g. `ITM-2026-V1`. Unique `(org_id, sku) WHERE deleted_at IS NULL`. |
| `name` | `text NOT NULL` | |
| `variant_label` | `text` | e.g. `600x600 · Matte`; empty for parents. |
| `image_url` | `text` | Supabase Storage. |
| `is_imported` | `boolean default false` | |
| `is_template` | `boolean default false` | Parent template carries no stock. |
| `delivery_days` | `integer` | Approx delivery time. |
| `purchase_price` | `numeric(14,2)` | Cost price (computed for imports — §7.1 calc). |
| `selling_price` | `numeric(14,2)` | |
| `stock` | `numeric(14,3) default 0` | Current on-hand. |
| `last_purchase_price` | `numeric(14,2)` | |
| `last_purchase_date` | `date` | |
| `last_supplier_id` | `uuid → suppliers.id` (nullable) | |
| **import fields:** | | (used when `is_imported`) |
| `import_currency` | `currency_code` | USD/EUR/CNY. |
| `import_price` | `numeric(14,2)` | Foreign price. |
| `exchange_rate` | `numeric(12,6)` | |
| `import_discount_pct` | `numeric(6,3)` | |
| `transport_type` | `transport_type` | lumpsum/percent. |
| `transport_value` | `numeric(14,2)` | ₹ or % per `transport_type`. |
| `custom_duty_pct` | `numeric(6,3)` | |
| `profit_multiplier` | `numeric(8,4)` | e.g. 1.35. |

**item_variations** *(variation spec stored on parent for re-spawning)*
`org_id`, `item_id uuid → items.id` (the parent), `size text`, `make text`, `finish text`, `brand text`. *(Distinct from the spawned variant rows in `items`.)*

**stock_adjustments** *(audited; no soft delete — immutable)*
`org_id`, `item_id uuid → items.id NOT NULL`, `type stock_adj_type NOT NULL`, `qty numeric(14,3) NOT NULL`, `reason text NOT NULL`, `adjusted_by uuid → users.id`, `at timestamptz default now()`. *(Admin-only per RBAC; reason mandatory.)*

**stock_movements** *(sales/issue history; append-only)*
`org_id`, `item_id uuid → items.id NOT NULL`, `date date NOT NULL`, `qty numeric(14,3) NOT NULL`, `value numeric(14,2) NOT NULL`, `customer_id uuid → customers.id` (nullable), `challan_id uuid → delivery_challans.id` (nullable), `direction text` (`out`/`in`). *(Feeds item sales report: "which customer took what qty/value".)*

### 7.3 Customers & Receivables

**customers**
| Column | Type | Notes |
|--------|------|-------|
| `name` | `text NOT NULL` | Customer/company name. |
| `status` | `record_status default 'active'` | |
| `contact_person` | `text` | |
| `phone` | `text` | |
| `email` | `text` | |
| `gstin` | `text` | |
| `pan` | `text` | |
| `billing_name` | `text` | May differ from `name`. |
| `billing_address` | `text` | Multiline. |
| `delivery_name` | `text` | Site name. |
| `delivery_address` | `text` | Multiline. |
| `same_as_billing` | `boolean default false` | |
| `notes` | `text` | |
| `post_sale_discount` | `numeric(14,2) default 0` | Subtracted in Running Bill. |

> Running Bill is **derived** (not stored): `Σ challan_item.value − post_sale_discount − Σ payments.amount`. Exposed via a SQL **view** `customer_running_bill` (or computed in queries) for the list cards & detail metrics.

**payments**
`org_id`, `customer_id uuid → customers.id NOT NULL`, `date date NOT NULL`, `amount numeric(14,2) NOT NULL`, `mode payment_mode NOT NULL`, `reference text`, `notes text`.

**payment_allocations** *(payment ↔ invoice M:N; no soft delete)*
`org_id`, `payment_id uuid → payments.id`, `invoice_id uuid → invoices.id`, `amount numeric(14,2) NOT NULL`. Unique `(payment_id, invoice_id)`.

### 7.4 Quotations

**quotes**
| Column | Type | Notes |
|--------|------|-------|
| `ref_no` | `text NOT NULL` | e.g. `QT-2026-001`. Unique `(org_id, ref_no, revision) WHERE deleted_at IS NULL`. |
| `revision` | `integer default 0` | |
| `parent_quote_id` | `uuid → quotes.id` (nullable) | Revision chain. |
| `status` | `quote_status default 'draft'` | |
| `date` | `date NOT NULL` | |
| `subject` | `text` | Project/subject. |
| `customer_id` | `uuid → customers.id NOT NULL` | |
| `company_logo_url` | `text` | |
| `gst_pct` | `numeric(6,3) default 18` | |
| `gst_mode` | `gst_mode default 'yes'` | yes/incl/no. |
| `transport` | `numeric(14,2) default 0` | |
| `transport_note` | `text` | |
| `total_mode` | `quote_total_mode default 'both'` | grand/each/both. |
| `show_boq` | `boolean default true` | |

**quote_locations**
`org_id`, `quote_id uuid → quotes.id NOT NULL`, `name text NOT NULL`, `sort_order integer default 0`, `selected boolean default true`.

**quote_location_installation** *(1:1 with location)*
`org_id`, `quote_location_id uuid → quote_locations.id UNIQUE NOT NULL`, `enabled boolean default false`, `mode install_mode`, `lumpsum numeric(14,2)`, `percent numeric(6,3)`, `perunit numeric(14,2)`, `note text`.

**quote_items**
`org_id`, `quote_location_id uuid → quote_locations.id NOT NULL`, `item_id uuid → items.id` (nullable catalogue link), `name text NOT NULL`, `brand text`, `unit text`, `rate numeric(14,2) NOT NULL`, `qty numeric(14,3) NOT NULL`, `discount_pct numeric(6,3) default 0`, `image_url text`, `sort_order integer default 0`.

**quote_item_options** *(alternates — excluded from totals)*
`org_id`, `quote_item_id uuid → quote_items.id NOT NULL`, `name text NOT NULL`, `brand text`, `unit text`, `rate numeric(14,2) NOT NULL`, `image_url text`, `sort_order integer default 0`.

**quote_terms**
`org_id`, `quote_id uuid → quotes.id NOT NULL`, `category term_category NOT NULL`, `text text NOT NULL`, `sort_order integer default 0`.

### 7.5 Order-to-Cash

**sales_orders**
`org_id`, `so_no text NOT NULL` (unique per org, live), `quote_id uuid → quotes.id` (nullable), `customer_id uuid → customers.id NOT NULL`, `date date NOT NULL`, `status sales_order_status default 'open'`, `notes text`.

**sales_order_items**
`org_id`, `sales_order_id uuid → sales_orders.id NOT NULL`, `item_id uuid → items.id` (nullable), `name text NOT NULL`, `unit text`, `rate numeric(14,2) NOT NULL`, `qty numeric(14,3) NOT NULL`, `discount_pct numeric(6,3) default 0`, `sort_order integer default 0`.

**delivery_challans**
`org_id`, `challan_no text NOT NULL` (unique per org, live), `customer_id uuid → customers.id NOT NULL`, `sales_order_id uuid → sales_orders.id` (nullable), `date date NOT NULL`, `delivery_address text`, `discount numeric(14,2) default 0`, `notes text`, `posted boolean default false` (posting decrements stock + writes stock_movements).

**delivery_challan_items**
`org_id`, `challan_id uuid → delivery_challans.id NOT NULL`, `item_id uuid → items.id` (nullable), `name text NOT NULL`, `qty numeric(14,3) NOT NULL`, `unit text`, `rate numeric(14,2) NOT NULL`, `value numeric(14,2) NOT NULL` (= qty × rate, persisted snapshot), `sort_order integer default 0`.

**invoices** *(GST Tax Invoice — flagged gap PROJECT_PLAN §9.1; included as planned)*
`org_id`, `invoice_no text NOT NULL` (unique per org, live), `customer_id uuid → customers.id NOT NULL`, `sales_order_id uuid` (nullable), `challan_id uuid → delivery_challans.id` (nullable), `date date NOT NULL`, `status invoice_status default 'draft'`, `place_of_supply text`, `cgst numeric(14,2) default 0`, `sgst numeric(14,2) default 0`, `igst numeric(14,2) default 0`, `taxable_value numeric(14,2)`, `total numeric(14,2)`, `notes text`.

**invoice_items**
`org_id`, `invoice_id uuid → invoices.id NOT NULL`, `item_id uuid → items.id` (nullable), `name text`, `hsn_code text`, `qty numeric(14,3)`, `unit text`, `rate numeric(14,2)`, `discount_pct numeric(6,3) default 0`, `taxable_value numeric(14,2)`, `gst_pct numeric(6,3)`, `sort_order integer default 0`.

### 7.6 Back-office (outline — columns to be finalised per §9 stakeholder review)

| Table | Key columns |
|-------|-------------|
| **employees** | `user_id?`, `code`, `name`, `department`, `designation`, `doj`, `salary`, `status` |
| **leave_requests** | `employee_id`, `from_date`, `to_date`, `type`, `status leave_status`, `approver_id` |
| **appraisals** | `employee_id`, `period`, `rating`, `notes`, `reviewer_id` |
| **payroll_runs** | `period`, `status`, `total_gross`, `total_net` (+ `payroll_lines`) |
| **expenses** | `category`, `amount`, `date`, `status expense_status`, `submitted_by` |
| **expense_approvals** | `expense_id`, `approver_id`, `decision`, `at`, `comment` |
| **budgets** | `period`, `category`, `amount` |
| **vendors** | `name`, `contact`, `phone`, `email`, `gstin`, `address` |
| **shipments** | `vendor_id?`, `reference`, `status`, `dispatch_date`, `eta` |
| **tickets** | `customer_id`, `subject`, `status ticket_status`, `priority`, `assignee_id`, `sla_due_at` |
| **ticket_events** | `ticket_id`, `event_type`, `body`, `actor_id`, `at` |

---

## 8. Indexes

### 8.1 Standard (applied to every business table)
- PK on `id` (implicit).
- `idx_<table>_org` on `(org_id)` — every tenant-scoped query filters by it.
- `idx_<table>_org_active` on `(org_id) WHERE deleted_at IS NULL` — partial, the hot path.
- FK columns each get a btree index (Postgres does **not** auto-index FKs): e.g. `idx_quote_items_location (quote_location_id)`.

### 8.2 Targeted indexes (by access pattern)
| Table | Index | Reason |
|-------|-------|--------|
| `items` | `idx_items_org_family (org_id, family_id)` | Stock report family filter. |
| `items` | `idx_items_org_brand (org_id, brand_id)` | Brand filter (family→variation→brand). |
| `items` | `idx_items_parent (parent_id)` | Variant lookup. |
| `items` | `uq_items_sku (org_id, sku) WHERE deleted_at IS NULL` | Unique live SKU. |
| `items` | GIN `idx_items_name_trgm` on `name` (`pg_trgm`) | Catalogue search by name. |
| `stock_movements` | `idx_sm_item_date (org_id, item_id, date)` | Per-item movement report by date range. |
| `stock_movements` | `idx_sm_customer (customer_id)` | "which customer took what". |
| `stock_adjustments` | `idx_sa_item_at (item_id, at)` | Adjustment history. |
| `customers` | `idx_customers_status (org_id, status)` | Active/Inactive filter. |
| `customers` | GIN `idx_customers_search_trgm` on `name, phone, email` | List search. |
| `payments` | `idx_payments_customer_date (org_id, customer_id, date)` | Running bill assembly. |
| `quotes` | `idx_quotes_customer (org_id, customer_id)` | Customer → quotes. |
| `quotes` | `idx_quotes_status (org_id, status)` | List filter. |
| `quotes` | `uq_quotes_ref (org_id, ref_no, revision) WHERE deleted_at IS NULL` | Ref uniqueness per revision. |
| `quotes` | `idx_quotes_parent (parent_quote_id)` | Revision chain. |
| `quote_locations` | `idx_ql_quote (quote_id, sort_order)` | Ordered render. |
| `quote_items` | `idx_qi_location (quote_location_id, sort_order)` | Ordered render. |
| `quote_item_options` | `idx_qio_item (quote_item_id)` | Alternates. |
| `delivery_challans` | `idx_dc_customer_date (org_id, customer_id, date)` | Running bill. |
| `delivery_challan_items` | `idx_dci_challan (challan_id)` | |
| `sales_orders` | `idx_so_customer (org_id, customer_id)`, `idx_so_status (org_id, status)` | |
| `invoices` | `idx_inv_customer (org_id, customer_id)`, `idx_inv_status (org_id, status)` | |
| `payment_allocations` | `idx_pa_invoice (invoice_id)`, `idx_pa_payment (payment_id)` | |
| `audit_logs` | `idx_audit_entity (org_id, entity_type, entity_id, at)` | Entity history. |
| `audit_logs` | `idx_audit_actor (actor_id, at)` | Actor activity. |
| `user_roles` | `uq_user_roles (org_id, user_id, role_id)` | |
| `memberships` | `uq_memberships (org_id, user_id)` | |

> `pg_trgm` extension enabled for fuzzy/contains search on names; `gen_random_uuid()` via `pgcrypto` (built-in on Supabase).

---

## 9. Foreign Keys & Referential Actions

| Child → Parent | On Delete | Rationale |
|----------------|-----------|-----------|
| `*.org_id → organizations.id` | `RESTRICT` | Never orphan tenant data; org removal is a deliberate purge. |
| `*.created_by/updated_by → users.id` | `SET NULL` | Keep history if a user is removed. |
| `memberships/user_roles.user_id → users.id` | `CASCADE` | Access rows die with the user. |
| `user_roles/role_permissions.role_id → roles.id` | `CASCADE` | |
| `role_permissions.permission_key → permissions.key` | `CASCADE` | |
| `items.parent_id → items.id` | `SET NULL` | Variant survives parent removal (becomes standalone). |
| `items.{family_id,brand_id,unit_id,last_supplier_id}` | `SET NULL` | Lookup removal shouldn't delete items. |
| `stock_adjustments/stock_movements.item_id → items.id` | `CASCADE` (hard-purge only) | History tied to item; normally soft-deleted together. |
| `quote_locations.quote_id → quotes.id` | `CASCADE` | |
| `quote_location_installation.quote_location_id` | `CASCADE` | |
| `quote_items.quote_location_id` | `CASCADE` | |
| `quote_item_options.quote_item_id` | `CASCADE` | |
| `quote_terms.quote_id` | `CASCADE` | |
| `quote_items.item_id → items.id` | `SET NULL` | Quote keeps snapshot name/rate even if catalogue item removed. |
| `quotes.customer_id → customers.id` | `RESTRICT` | Block customer delete with live quotes. |
| `quotes.parent_quote_id → quotes.id` | `SET NULL` | |
| `sales_orders.quote_id → quotes.id` | `SET NULL` | |
| `sales_order_items.sales_order_id` | `CASCADE` | |
| `delivery_challans.sales_order_id` | `SET NULL` | |
| `delivery_challan_items.challan_id` | `CASCADE` | |
| `payments.customer_id → customers.id` | `RESTRICT` | Protect financial history. |
| `payment_allocations.{payment_id,invoice_id}` | `CASCADE` | |
| `invoices.customer_id` | `RESTRICT` | |
| `invoice_items.invoice_id` | `CASCADE` | |

> **Principle:** financial/legal documents (quotes, payments, invoices, customers) use `RESTRICT` to prevent silent loss; structural children use `CASCADE`; snapshot links to catalogue use `SET NULL` so historical documents preserve the values captured at creation time (line items store `name/rate/unit` denormalised for exactly this reason).

---

## 10. Row-Level Security (RLS) Strategy

**Principle (NFR-SEC-1):** RLS is the **source of truth** for authorization. The Next.js layer never trusts the client; UI gating (PROJECT_PLAN §8) is UX only. Service-role key is used **only** in trusted server contexts (Edge Functions, migrations) and bypasses RLS by design.

### 10.1 Helper functions (SECURITY DEFINER, schema `app`)
```
app.current_orgs() returns setof uuid
  -- org_ids the JWT user is a member of (from memberships)

app.is_member(org uuid) returns boolean
  -- EXISTS membership for auth.uid() in org

app.has_permission(perm text, org uuid) returns boolean
  -- joins user_roles → role_permissions for auth.uid() in org
  -- returns true if any assigned role grants `perm`

app.is_org_admin(org uuid) returns boolean
  -- shorthand: has_permission('admin.*') or role in (super_admin, admin)
```
These are `STABLE`, indexed-backed, and cached per statement. JWT claims read via `auth.uid()` and `current_setting('request.jwt.claims', true)`.

### 10.2 Standard policy template (applied to each business table)
For a table `T` with tenant column `org_id` and `deleted_at`:

| Command | Policy `USING` / `WITH CHECK` |
|---------|------------------------------|
| **SELECT** | `app.is_member(org_id) AND deleted_at IS NULL` (admins get a second policy without the `deleted_at` clause to view/restore). |
| **INSERT** | `WITH CHECK app.is_member(org_id) AND app.has_permission('<T>.create', org_id)` |
| **UPDATE** | `USING app.is_member(org_id) AND app.has_permission('<T>.edit', org_id)` + `WITH CHECK (org_id unchanged)` |
| **DELETE** (hard) | `USING app.is_org_admin(org_id)` — normal flow uses soft-delete UPDATE instead. |

Permission keys map to PROJECT_PLAN §8, e.g.:
- `items.create`, `items.edit`, `stock.adjust`, `pricing.override`
- `customers.create`, `running_bill.view`, `discount.post_sale`
- `quote.create`, `quote.revise`
- `sales_order.create`, `challan.create`, `payment.record`
- `finance.view`, `hr.manage`, `logistics.manage`, `support.manage`
- `admin.users`, `admin.audit`, `settings.manage`

### 10.3 Sensitive-table specifics
- **stock_adjustments:** INSERT requires `app.has_permission('stock.adjust', org_id)` → enforces "admin-only stock adjustment" (FR-ITEM-5) at the DB. No UPDATE/DELETE (immutable).
- **payments / payment_allocations:** INSERT requires `payment.record`; UPDATE restricted to `finance.*`; no hard delete (reverse via offsetting entry).
- **user_roles / role_permissions:** mutate only with `admin.users`; every change writes `audit_logs` (`permission_change`).
- **audit_logs:** SELECT requires `admin.audit` or `finance.view` (scoped); INSERT allowed to authenticated within own org; **no UPDATE/DELETE** for anyone (revoke even from service role via policy; purges done out-of-band).
- **organizations / users / memberships:** users may SELECT their own profile and orgs; org/membership mutations require `admin.users`.

### 10.4 Storage (Supabase Storage) RLS
- Buckets: `product-images`, `company-logos`, `quote-assets`, `documents`.
- Path convention `{{org_id}}/...`; storage policies check the leading path segment ∈ `app.current_orgs()` and the relevant permission for write.

### 10.5 Enable & default-deny
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` on every table.
- **No table is left without policies** → default-deny. A coverage test (Phase 6) asserts every table has RLS enabled and ≥1 policy.

---

## 11. Drizzle Schema Structure

> This is the **schema definition layer** (TypeScript) — not migrations. `drizzle-kit` will later generate migration SQL from these definitions (deferred per instruction).

### 11.1 File organization
```
src/db/
  client.ts                  # postgres-js + drizzle() server client
  schema/
    index.ts                 # re-exports all tables + relations
    _shared.ts               # envelope helpers, enums, base columns
    enums.ts                 # pgEnum definitions (§5)
    identity.ts              # organizations, users, memberships, roles,
                             #   permissions, role_permissions, user_roles, audit_logs
    inventory.ts             # item_families, brands, units, suppliers,
                             #   items, item_variations, stock_adjustments, stock_movements
    customers.ts             # customers, payments, payment_allocations
    quotes.ts                # quotes, quote_locations, quote_location_installation,
                             #   quote_items, quote_item_options, quote_terms
    sales.ts                 # sales_orders, sales_order_items,
                             #   delivery_challans, delivery_challan_items,
                             #   invoices, invoice_items
    backoffice.ts            # employees, leave_requests, appraisals, payroll,
                             #   expenses, budgets, vendors, shipments, tickets
    relations.ts             # drizzle relations() for all tables
  queries/                   # typed, RLS-respecting query helpers (+ notDeleted())
```

### 11.2 Shared envelope & enums (`_shared.ts`, `enums.ts`)
```ts
// enums.ts
export const recordStatus   = pgEnum('record_status', ['active','inactive']);
export const quoteStatus    = pgEnum('quote_status', ['draft','sent','accepted','revised','cancelled']);
export const gstMode        = pgEnum('gst_mode', ['yes','incl','no']);
export const quoteTotalMode = pgEnum('quote_total_mode', ['grand','each','both']);
export const installMode    = pgEnum('install_mode', ['lumpsum','percent','perunit']);
export const transportType  = pgEnum('transport_type', ['lumpsum','percent']);
export const stockAdjType   = pgEnum('stock_adj_type', ['add','sub']);
export const paymentMode    = pgEnum('payment_mode', ['neft','rtgs','cheque','cash','upi','card','other']);
export const currencyCode   = pgEnum('currency_code', ['INR','USD','EUR','CNY']);
export const termCategory   = pgEnum('term_category',
  ['delivery','gst','payment','warranty','installation','exclusion','other']);
export const salesOrderStatus = pgEnum('sales_order_status',
  ['open','partially_delivered','fulfilled','cancelled']);
export const invoiceStatus  = pgEnum('invoice_status',
  ['draft','issued','paid','partially_paid','cancelled']);
export const auditAction    = pgEnum('audit_action',
  ['insert','update','delete','restore','login','permission_change']);

// _shared.ts — spread into every business table
export const envelope = {
  id:        uuid('id').primaryKey().defaultRandom(),
  orgId:     uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete
};
export const money = (n: string) => numeric(n, { precision: 14, scale: 2 });
export const qty   = (n: string) => numeric(n, { precision: 14, scale: 3 });
export const pct   = (n: string) => numeric(n, { precision: 6,  scale: 3 });
```

### 11.3 Representative table definitions
```ts
// inventory.ts (core item)
export const items = pgTable('items', {
  ...envelope,
  parentId:          uuid('parent_id').references((): AnyPgColumn => items.id, { onDelete: 'set null' }),
  familyId:          uuid('family_id').references(() => itemFamilies.id, { onDelete: 'set null' }),
  brandId:           uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  unitId:            uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
  sku:               text('sku'),
  name:              text('name').notNull(),
  variantLabel:      text('variant_label'),
  imageUrl:          text('image_url'),
  isImported:        boolean('is_imported').default(false).notNull(),
  isTemplate:        boolean('is_template').default(false).notNull(),
  deliveryDays:      integer('delivery_days'),
  purchasePrice:     money('purchase_price'),
  sellingPrice:      money('selling_price'),
  stock:             qty('stock').default('0').notNull(),
  lastPurchasePrice: money('last_purchase_price'),
  lastPurchaseDate:  date('last_purchase_date'),
  lastSupplierId:    uuid('last_supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  importCurrency:    currencyCode('import_currency'),
  importPrice:       money('import_price'),
  exchangeRate:      numeric('exchange_rate', { precision: 12, scale: 6 }),
  importDiscountPct: pct('import_discount_pct'),
  transportType:     transportType('transport_type'),
  transportValue:    money('transport_value'),
  customDutyPct:     pct('custom_duty_pct'),
  profitMultiplier:  numeric('profit_multiplier', { precision: 8, scale: 4 }),
}, (t) => ({
  orgActive:  index('idx_items_org_active').on(t.orgId).where(sql`${t.deletedAt} is null`),
  orgFamily:  index('idx_items_org_family').on(t.orgId, t.familyId),
  orgBrand:   index('idx_items_org_brand').on(t.orgId, t.brandId),
  parentIdx:  index('idx_items_parent').on(t.parentId),
  skuUnique:  uniqueIndex('uq_items_sku').on(t.orgId, t.sku).where(sql`${t.deletedAt} is null`),
}));

// quotes.ts (header)
export const quotes = pgTable('quotes', {
  ...envelope,
  refNo:         text('ref_no').notNull(),
  revision:      integer('revision').default(0).notNull(),
  parentQuoteId: uuid('parent_quote_id').references((): AnyPgColumn => quotes.id, { onDelete: 'set null' }),
  status:        quoteStatus('status').default('draft').notNull(),
  date:          date('date').notNull(),
  subject:       text('subject'),
  customerId:    uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  companyLogoUrl:text('company_logo_url'),
  gstPct:        pct('gst_pct').default('18'),
  gstMode:       gstMode('gst_mode').default('yes').notNull(),
  transport:     money('transport').default('0'),
  transportNote: text('transport_note'),
  totalMode:     quoteTotalMode('total_mode').default('both').notNull(),
  showBoq:       boolean('show_boq').default(true).notNull(),
}, (t) => ({
  refUnique:   uniqueIndex('uq_quotes_ref').on(t.orgId, t.refNo, t.revision).where(sql`${t.deletedAt} is null`),
  customerIdx: index('idx_quotes_customer').on(t.orgId, t.customerId),
  statusIdx:   index('idx_quotes_status').on(t.orgId, t.status),
  parentIdx:   index('idx_quotes_parent').on(t.parentQuoteId),
}));
```
> The remaining ~35 tables follow the identical pattern: `...envelope`, typed columns mirroring §7, an index callback mirroring §8. `pgEnum`s from §5.2. Self-references use the `(): AnyPgColumn =>` forward-ref idiom.

### 11.4 Relations (`relations.ts`)
```ts
export const quotesRelations = relations(quotes, ({ one, many }) => ({
  org:       one(organizations, { fields: [quotes.orgId], references: [organizations.id] }),
  customer:  one(customers,     { fields: [quotes.customerId], references: [customers.id] }),
  parent:    one(quotes,        { fields: [quotes.parentQuoteId], references: [quotes.id], relationName: 'revision' }),
  locations: many(quoteLocations),
  terms:     many(quoteTerms),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  parent:      one(items, { fields: [items.parentId], references: [items.id], relationName: 'variants' }),
  variants:    many(items, { relationName: 'variants' }),
  family:      one(itemFamilies, { fields: [items.familyId], references: [itemFamilies.id] }),
  brand:       one(brands, { fields: [items.brandId], references: [brands.id] }),
  unit:        one(units,  { fields: [items.unitId], references: [units.id] }),
  adjustments: many(stockAdjustments),
  movements:   many(stockMovements),
}));
```

### 11.5 RLS in Drizzle
Drizzle defines tables; **RLS policies and SECURITY DEFINER helpers live in raw SQL migrations** (Phase 0), since drizzle-kit does not yet model policies natively. The plan: keep a hand-authored `rls/` SQL set (one file per table group) applied after the generated table migrations. Calc functions (§7 of PROJECT_PLAN) live in `lib/calc/` (TypeScript, pure) — **not** in the DB — so preview and PDF share one implementation.

---

## 12. Supabase Migration Plan (sequence — not yet authored)

> Ordering matters: extensions → enums → tenant root → identity → lookups → core → dependent → audit/triggers → RLS → seed. Each numbered step becomes one migration file when we proceed.

| # | Migration | Contents | Depends on |
|---|-----------|----------|-----------|
| 0 | `00_extensions` | `pgcrypto`, `pg_trgm`; `app` schema for helpers. | — |
| 1 | `01_enums` | All `pgEnum` types (§5). | 0 |
| 2 | `02_organizations` | `organizations` (tenant root). | 1 |
| 3 | `03_identity` | `users` (FK auth.users), `memberships`, `roles`, `permissions`, `role_permissions`, `user_roles`. | 2 |
| 4 | `04_audit` | `audit_logs` table + `fn_audit()` + `fn_set_updated_at()` generic triggers. | 3 |
| 5 | `05_lookups` | `item_families`, `brands`, `units`, `suppliers`, `vendors`. | 2 |
| 6 | `06_inventory` | `items` (self-FK), `item_variations`, `stock_adjustments`, `stock_movements`. | 5 |
| 7 | `07_customers` | `customers`, `payments`. | 2 |
| 8 | `08_quotes` | `quotes` (self-FK), `quote_locations`, `quote_location_installation`, `quote_items`, `quote_item_options`, `quote_terms`. | 6,7 |
| 9 | `09_orders` | `sales_orders`, `sales_order_items`, `delivery_challans`, `delivery_challan_items`. | 8 |
| 10 | `10_invoicing` | `invoices`, `invoice_items`, `payment_allocations`. | 9 |
| 11 | `11_backoffice` | employees/leave/appraisals/payroll, expenses/budgets, shipments, tickets/ticket_events. | 3 |
| 12 | `12_indexes` | All targeted/partial/GIN indexes (§8) not inlined with tables. | 6–11 |
| 13 | `13_triggers` | Attach `fn_set_updated_at` + `fn_audit` to audited tables (§4.2). | 4,6–11 |
| 14 | `14_views` | `customer_running_bill`, item stock-value views, receivables ageing. | 6–10 |
| 15 | `15_rls_helpers` | `app.current_orgs`, `app.is_member`, `app.has_permission`, `app.is_org_admin`. | 3 |
| 16 | `16_rls_policies` | Enable + FORCE RLS and policies on every table (§10). | 15, all tables |
| 17 | `17_storage` | Buckets + storage RLS policies (§10.4). | 15 |
| 18 | `18_seed` | System roles, permission catalog, default org, units/brands seed, admin user grant. | 16 |

### 12.1 Migration tooling & workflow
- **drizzle-kit** generates table DDL from `src/db/schema/*` (steps 1–12 largely auto-generated). **RLS, triggers, views, helpers, seed (steps 13–18)** are hand-authored SQL placed in `supabase/migrations/` and applied in order.
- Local dev: `supabase start` (local stack) → apply migrations → `drizzle-kit` introspect check for drift.
- CI: migrations run forward-only against a shadow DB; an **RLS-coverage test** (every table `rowsecurity = true` and has ≥1 policy) and a **referential-integrity test** gate merges.
- Rollback: forward-fix migrations (no destructive down-migrations in shared envs); local dev may reset.

### 12.2 Seed data (step 18)
- Permission catalog (all keys from §10.2).
- System roles: `super_admin, admin, sales, inventory, finance, hr, logistics, support, viewer` with `role_permissions` per PROJECT_PLAN §8 matrix.
- One default `organizations` row; bootstrap the first user → `super_admin` membership.
- Reference `units` (SQM, MTR, NOS, BOX, KG, SQF, LTR, SET, PCS) and starter `brands`/`item_families`.

---

## 13. Open Items / Decisions to Confirm (from PROJECT_PLAN §9)
1. **GST split** — `invoices` models CGST/SGST/IGST + HSN; confirm whether v1 needs full tax-invoice compliance or quotes/challans suffice.
2. **Stock decrement trigger** — assumed on challan `posted = true`; confirm reservation-on-SO is *not* required for v1.
3. **Numbering masks** — `ref_no` / `so_no` / `challan_no` / `invoice_no` formats and yearly reset; modeled as text + unique, generation logic in app/service (a `number_sequences` table may be added).
4. **Multi-org** — schema is ready; confirm single-org launch so seed creates exactly one org.
5. **Payment ↔ invoice allocation** — `payment_allocations` included for precision; if v1 stays customer-level only, the table can ship unused.
6. **Rounding** — per-line vs invoice-level; to be encoded in `lib/calc` and reflected in stored snapshot values.

---

*End of DATABASE_DESIGN.md — design artifact only. No migration SQL or Drizzle migration files have been generated. Next step: confirm §13 open items, then author migrations in the order of §12.*
