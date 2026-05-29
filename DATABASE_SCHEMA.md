# Watcon Business Management System — Production Database Schema

> **Status:** Canonical schema reference (production SaaS). Source of truth for table/column names.
> **Date:** 2026-05-29
> **Companions:** [PROJECT_PLAN.md](PROJECT_PLAN.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [PERMISSIONS.md](PERMISSIONS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md)
> **Target platform:** Supabase (PostgreSQL 15+), Drizzle ORM, Row-Level Security.
> **Scope:** The **complete** production schema for the multi-tenant B2B SaaS — platform/identity, **Stripe billing**, CRM, inventory + procurement, sales, GST accounting, HR + payroll, and the cross-cutting **Files / Notifications / Approvals / Reporting** subsystems.

> **This document is the LINCHPIN.** The RLS doc, API doc, and Audit doc are written purely from the table list, columns, FKs, and conventions defined here. Every table name, column name, and enum value below is authoritative. Where this file extends [DATABASE_DESIGN.md](DATABASE_DESIGN.md) for SaaS, the additions are marked **`NEW (SaaS)`** and never contradict the prior design.

---

## 1. Overview & Conventions

### 1.1 What carries over from `DATABASE_DESIGN.md`
The envelope, money/qty/pct types, snake_case-plural naming, multi-tenant `org_id`, soft-delete, and RLS-as-source-of-truth are **unchanged**. This document is a strict superset.

### 1.2 What is NEW for SaaS (delta over `DATABASE_DESIGN.md`)
| Area | New objects |
|------|-------------|
| **Platform** | `organization_settings`, `invitations`, `number_sequences` (promoted from "may add"), per-org seeded roles. |
| **Billing (Stripe)** | `plans`, `plan_features`, `subscriptions`, `subscription_items`, `invoices_billing`, `payment_methods`, `usage_records`, `stripe_events`. |
| **CRM** | `leads`, `lead_stages`, `lead_activities` (Roadmap Phase 2). |
| **Procurement** | `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items` (Roadmap Phase 3). |
| **HR** | `attendance`, `shifts`, `leave_balances`, `payroll_lines` (Roadmap Phase 4). |
| **Files** | `files` (Storage object metadata). |
| **Notifications** | `notifications`, `notification_preferences`, `notification_templates`, `notification_deliveries`. |
| **Approvals** | `approval_workflows`, `approval_steps`, `approval_requests`, `approval_actions` (generic engine). |
| **Reporting** | `saved_reports`, `report_schedules`, materialized views `mv_*`. |

### 1.3 The envelope (every **business** table)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK default `gen_random_uuid()` | Surrogate key. |
| `org_id` | `uuid` NOT NULL → `organizations.id` | Tenant discriminator. Present on EVERY tenant-scoped row, including children (denormalised so RLS checks need no join). |
| `created_at` | `timestamptz` NOT NULL default `now()` | |
| `updated_at` | `timestamptz` NOT NULL default `now()` | Bumped by `fn_set_updated_at` trigger. |
| `created_by` | `uuid` → `users.id` (nullable, `ON DELETE SET NULL`) | Actor. |
| `updated_by` | `uuid` → `users.id` (nullable, `ON DELETE SET NULL`) | Actor. |
| `deleted_at` | `timestamptz` NULL | Soft-delete marker (§7). |

Tables that **omit parts** of the envelope are explicitly flagged:
- **`no soft delete`** — junction / immutable history / append-only (`role_permissions`, `user_roles`, `memberships`, `stock_movements`, `stock_adjustments`, `audit_logs`, `payment_allocations`, `usage_records`, `stripe_events`, `approval_actions`, `notification_deliveries`).
- **`platform (no org_id)`** — cross-tenant catalogs (`users`, `permissions`, `plans`, `plan_features`, `stripe_events`).

### 1.4 Data-type rules
| Concept | Type |
|---------|------|
| Money (INR & Stripe minor unit handling — see §3.2) | `numeric(14,2)` for app money; Stripe amounts stored as `bigint` cents in billing tables. |
| Quantity / stock | `numeric(14,3)` |
| Percentage (discount, GST, duty, profit) | `numeric(6,3)`; multipliers `numeric(8,4)` |
| Exchange rate | `numeric(12,6)` |
| Codes / GSTIN / PAN / HSN / refs | `text` (uniqueness constraints where needed) |
| Enumerations (fixed sets) | `pgEnum` (§2) |
| User-extensible sets | lookup tables (`units`, `brands`, `item_families`, `lead_stages`) |
| Structured snapshots / metadata / payloads | `jsonb` |
| Images / files | `text` Storage URL + a `files` metadata row; **never base64** |
| Email / IP | `text` / `inet` |

### 1.5 Naming
Tables `snake_case` plural · columns `snake_case` · FK `<ref_singular>_id` · enums `<domain>_<thing>` · indexes `idx_<table>_<cols>` · uniques `uq_<table>_<cols>` · FKs `fk_<table>_<ref>` · materialized views `mv_<subject>`.

---

## 2. Enumerated Types (`pgEnum`)

> Carried-over enums (from `DATABASE_DESIGN.md §5`) are listed first; **`NEW (SaaS)`** enums follow. Volatile sets remain **lookup tables**, not enums (`units`, `brands`, `item_families`, `lead_stages`).

### 2.1 Core / carried over
| Enum type | Values | Used by |
|-----------|--------|---------|
| `record_status` | `active`, `inactive` | users, customers, suppliers, employees, organizations |
| `audit_action` | `insert`, `update`, `delete`, `restore`, `login`, `permission_change` | audit_logs |
| `currency_code` | `INR`, `USD`, `EUR`, `CNY` | items (import), purchase_orders |
| `transport_type` | `lumpsum`, `percent` | items (import) |
| `stock_adj_type` | `add`, `sub` | stock_adjustments |
| `stock_direction` | `in`, `out` | stock_movements |
| `payment_mode` | `neft`, `rtgs`, `cheque`, `cash`, `upi`, `card`, `other` | payments |
| `quote_status` | `draft`, `sent`, `accepted`, `revised`, `cancelled` | quotes |
| `gst_mode` | `yes`, `incl`, `no` | quotes |
| `quote_total_mode` | `grand`, `each`, `both` | quotes |
| `install_mode` | `lumpsum`, `percent`, `perunit` | quote_location_installation |
| `term_category` | `delivery`, `gst`, `payment`, `warranty`, `installation`, `exclusion`, `other` | quote_terms |
| `sales_order_status` | `open`, `partially_delivered`, `fulfilled`, `cancelled` | sales_orders |
| `invoice_status` | `draft`, `issued`, `paid`, `partially_paid`, `cancelled` | invoices |
| `leave_status` | `pending`, `approved`, `rejected`, `cancelled` | leave_requests |
| `expense_status` | `draft`, `submitted`, `approved`, `rejected`, `paid` | expenses |

### 2.2 NEW (SaaS) — billing
| Enum type | Values | Used by |
|-----------|--------|---------|
| `billing_interval` | `month`, `year` | plans, subscriptions |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` | subscriptions (mirrors Stripe) |
| `billing_invoice_status` | `draft`, `open`, `paid`, `uncollectible`, `void` | invoices_billing (mirrors Stripe) |
| `payment_method_type` | `card`, `upi`, `netbanking`, `bank_transfer`, `other` | payment_methods |
| `usage_metric` | `seats`, `active_users`, `quotes`, `invoices`, `storage_mb`, `api_calls` | usage_records, plan_features |
| `plan_feature_type` | `boolean`, `limit`, `quota` | plan_features |
| `stripe_event_status` | `received`, `processed`, `failed`, `skipped` | stripe_events |

### 2.3 NEW (SaaS) — CRM / procurement / HR
| Enum type | Values | Used by |
|-----------|--------|---------|
| `lead_status` | `new`, `contacted`, `qualified`, `proposal`, `won`, `lost` | leads (fallback when not using `lead_stages` lookup) |
| `lead_activity_type` | `call`, `email`, `meeting`, `note`, `task`, `whatsapp` | lead_activities |
| `purchase_order_status` | `draft`, `sent`, `partially_received`, `received`, `cancelled` | purchase_orders |
| `goods_receipt_status` | `draft`, `posted`, `cancelled` | goods_receipts |
| `attendance_status` | `present`, `absent`, `half`, `leave`, `holiday`, `week_off` | attendance |
| `leave_type` | `casual`, `sick`, `earned`, `unpaid`, `comp_off`, `other` | leave_requests, leave_balances |
| `payroll_run_status` | `draft`, `computed`, `approved`, `paid`, `cancelled` | payroll_runs |
| `appraisal_status` | `draft`, `submitted`, `acknowledged`, `closed` | appraisals |
| `budget_period_type` | `monthly`, `quarterly`, `annual` | budgets |

### 2.4 NEW (SaaS) — cross-cutting (files / notifications / approvals / reporting)
| Enum type | Values | Used by |
|-----------|--------|---------|
| `file_status` | `pending`, `clean`, `quarantined`, `deleted` | files |
| `notification_channel` | `in_app`, `email`, `whatsapp`, `webhook` | notification_preferences, notification_deliveries, notification_templates |
| `notification_status` | `unread`, `read`, `archived` | notifications |
| `delivery_status` | `queued`, `sent`, `delivered`, `bounced`, `failed`, `skipped` | notification_deliveries |
| `approval_entity_type` | `discount`, `expense`, `purchase_order`, `payroll_run`, `quote`, `invoice` | approval_workflows, approval_requests |
| `approval_request_status` | `pending`, `approved`, `rejected`, `cancelled`, `escalated` | approval_requests |
| `approval_step_type` | `role`, `user`, `amount_threshold` | approval_steps |
| `approval_decision` | `approved`, `rejected`, `delegated`, `commented` | approval_actions |
| `report_format` | `pdf`, `csv`, `xlsx` | saved_reports, report_schedules |
| `schedule_frequency` | `daily`, `weekly`, `monthly`, `quarterly` | report_schedules |

---

## 3. Tables by Domain

> Convention for each table: **purpose**, then a column table (`name · type · constraints · notes`), then the envelope it uses. Unless stated, the table carries the **full envelope** (§1.3). `org_id` is always `NOT NULL → organizations.id ON DELETE RESTRICT` and is omitted from the per-table column list for brevity (shown only where its presence/absence is notable).

### 3.0 Domain map
```
PLATFORM  → organizations · organization_settings · users · memberships · roles ·
            permissions · role_permissions · user_roles · invitations · audit_logs · number_sequences
BILLING   → plans · plan_features · subscriptions · subscription_items · invoices_billing ·
            payment_methods · usage_records · stripe_events
CRM       → leads · lead_stages · lead_activities · customers · payments
INVENTORY → item_families · brands · units · suppliers · items · item_variations ·
            stock_adjustments · stock_movements · purchase_orders · purchase_order_items ·
            goods_receipts · goods_receipt_items
SALES     → quotes · quote_locations · quote_location_installation · quote_items ·
            quote_item_options · quote_terms · sales_orders · sales_order_items ·
            delivery_challans · delivery_challan_items
ACCOUNTING→ invoices · invoice_items · payment_allocations · expenses · expense_approvals · budgets
HR        → employees · attendance · shifts · leave_requests · leave_balances ·
            appraisals · payroll_runs · payroll_lines
FILES     → files
NOTIFY    → notifications · notification_preferences · notification_templates · notification_deliveries
APPROVALS → approval_workflows · approval_steps · approval_requests · approval_actions
REPORTING → saved_reports · report_schedules · (mv_sales_summary, mv_inventory_valuation,
            mv_receivables_ageing, mv_hr_headcount)
```

---

### 3.1 Platform / Identity & Access

#### `organizations` — tenant root
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | The `org_id` everything references; `org_id = id` for this row. |
| `name` | `text` | NOT NULL | Display name. |
| `slug` | `text` | UNIQUE | URL/sub-domain handle. |
| `legal_name` | `text` | | |
| `gstin` | `text` | | India GST number. |
| `pan` | `text` | | |
| `address` | `text` | | |
| `logo_url` | `text` | | Storage URL (+`files` row). |
| `currency` | `currency_code` | default `'INR'` | |
| `status` | `record_status` | default `'active'` | Suspend via `inactive` (also driven by billing). |
| `stripe_customer_id` | `text` | UNIQUE | **NEW (SaaS)** Stripe `Customer` id; one per org. |
| envelope | | | full envelope. |

#### `organization_settings` — **NEW (SaaS)** per-org configuration (1:1 with org)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `org_id` | `uuid` | PK, → organizations.id | 1:1 (PK == FK). |
| `financial_year_start` | `smallint` | default `4` | Month (4 = April, India FY). |
| `default_gst_pct` | `numeric(6,3)` | default `18` | |
| `place_of_supply` | `text` | | Default state code. |
| `approval_limits` | `jsonb` | default `'{}'` | Discount/expense ceilings per role (`PERMISSIONS.md §8`). |
| `theme` | `jsonb` | | UI tokens overrides. |
| `feature_flags` | `jsonb` | default `'{}'` | PostHog flag cache / overrides. |
| `notification_defaults` | `jsonb` | | Org-level channel defaults. |
| envelope (no soft delete) | | | Settings are not deletable; cascade with org. |

#### `users` — profile mirror of `auth.users` · **platform (no org_id)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK = `auth.users.id` | No default; equals Supabase auth id. |
| `email` | `text` | UNIQUE NOT NULL | |
| `full_name` | `text` | | |
| `phone` | `text` | | |
| `avatar_url` | `text` | | Storage URL. |
| `status` | `record_status` | default `'active'` | |
| `is_super_admin` | `boolean` | default `false` | **NEW (SaaS)** platform operator flag (mirrors JWT `app_metadata.is_super_admin`). |
| `last_login_at` | `timestamptz` | | |
| `created_at`/`updated_at` | `timestamptz` | | No `org_id`; linkage via `memberships`. |

#### `memberships` — user ↔ org (M:N) · **no soft delete**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL → organizations.id | |
| `user_id` | `uuid` | NOT NULL → users.id ON DELETE CASCADE | |
| `is_default` | `boolean` | default `false` | Default org for the user's session. |
| `is_billable` | `boolean` | default `true` | **NEW (SaaS)** counts toward seats (§3.2). |
| `joined_at` | `timestamptz` | default `now()` | |
| `created_at`/`updated_at` | | | UNIQUE `(org_id, user_id)`. Revoke = delete row. |

#### `roles`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NULL for system templates; set for org-scoped rows | |
| `key` | `text` | NOT NULL | `company_owner, manager, employee, accountant, hr` (PERMISSIONS.md). |
| `name` | `text` | | |
| `description` | `text` | | |
| `is_system` | `boolean` | default `false` | Seeded roles; not deletable. |
| envelope | | | UNIQUE `(org_id, key)`. |

#### `permissions` — global catalog · **platform (no org_id, no soft delete)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `key` | `text` | PK | e.g. `stock.adjust`, `quotes.revise`, `org.manage` (full list in PERMISSIONS.md §2). |
| `description` | `text` | | |
| `module` | `text` | | Grouping for UI. |

#### `role_permissions` — junction · **no envelope (org-free), no soft delete**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `role_id` | `uuid` | → roles.id ON DELETE CASCADE | |
| `permission_key` | `text` | → permissions.key ON DELETE CASCADE | PK `(role_id, permission_key)`. |

#### `user_roles` — per-org assignment · **no soft delete**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL → organizations.id | |
| `user_id` | `uuid` | NOT NULL → users.id ON DELETE CASCADE | |
| `role_id` | `uuid` | NOT NULL → roles.id ON DELETE CASCADE | |
| `created_at`/`created_by` | | | UNIQUE `(org_id, user_id, role_id)`. |

#### `invitations` — **NEW (SaaS)** pending member invites (seat acquisition)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL | |
| `email` | `text` | NOT NULL | Invitee. |
| `role_id` | `uuid` | → roles.id ON DELETE SET NULL | Role to grant on accept. |
| `token` | `text` | UNIQUE NOT NULL | Signed accept token. |
| `status` | `text` | default `'pending'` | `pending, accepted, revoked, expired`. |
| `invited_by` | `uuid` | → users.id | |
| `expires_at` | `timestamptz` | NOT NULL | |
| `accepted_at` | `timestamptz` | | |
| envelope | | | UNIQUE `(org_id, lower(email)) WHERE status='pending'`. |

#### `number_sequences` — **NEW (SaaS)** document numbering masks + counters
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL | |
| `doc_type` | `text` | NOT NULL | `quote, sales_order, challan, invoice, payment, purchase_order, goods_receipt`. |
| `mask` | `text` | NOT NULL | e.g. `QT-{YYYY}-{SEQ:4}`. |
| `period_key` | `text` | NOT NULL | Reset bucket, e.g. `2026` or `2026-04`. |
| `next_value` | `integer` | NOT NULL default `1` | Incremented atomically (`SELECT ... FOR UPDATE`). |
| envelope | | | UNIQUE `(org_id, doc_type, period_key)`. |

#### `audit_logs` — append-only · **no soft delete, no updated_at**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL | |
| `actor_id` | `uuid` | NULL | `auth.uid()` at change time. |
| `entity_type` | `text` | NOT NULL | e.g. `payments`. |
| `entity_id` | `uuid` | NOT NULL | |
| `action` | `audit_action` | NOT NULL | |
| `before` | `jsonb` | NULL | |
| `after` | `jsonb` | NULL | |
| `changed_fields` | `text[]` | NULL | |
| `ip` | `inet` | NULL | |
| `at` | `timestamptz` | NOT NULL default `now()` | INSERT+SELECT only; immutable. |

---

### 3.2 Billing (Stripe) — **NEW (SaaS)**

> **Billing is per organization.** Each `organizations` row owns exactly one `stripe_customer_id` and (normally) one active `subscriptions` row on a `plans` row. **Seats = count of `memberships` where `is_billable = true` and the member is active.** `plan_features` gate feature access and usage limits; `usage_records` track metered usage; `stripe_events` give webhook idempotency. Stripe monetary amounts are stored as **`bigint` minor units (paise/cents)** with a `currency` column, exactly as Stripe sends them — distinct from app money (`numeric(14,2)`).

#### `plans` — catalog of subscription plans · **platform (no org_id)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `stripe_product_id` | `text` | UNIQUE | Stripe `Product`. |
| `stripe_price_id` | `text` | UNIQUE NOT NULL | Stripe `Price` (the billable handle). |
| `code` | `text` | UNIQUE NOT NULL | `free, starter, growth, enterprise`. |
| `name` | `text` | NOT NULL | |
| `description` | `text` | | |
| `interval` | `billing_interval` | NOT NULL | month/year. |
| `amount` | `bigint` | NOT NULL | Minor units. |
| `currency` | `text` | default `'inr'` | |
| `seat_based` | `boolean` | default `true` | Per-seat vs flat. |
| `included_seats` | `integer` | default `1` | |
| `trial_days` | `integer` | default `14` | |
| `is_active` | `boolean` | default `true` | Hide retired plans. |
| `sort_order` | `integer` | default `0` | |
| `created_at`/`updated_at` | | | Platform catalog; managed by Super Admin. |

#### `plan_features` — feature gates & limits per plan · **platform (no org_id)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `plan_id` | `uuid` | NOT NULL → plans.id ON DELETE CASCADE | |
| `feature_key` | `text` | NOT NULL | e.g. `module.hr`, `module.analytics`, `whatsapp.send`. |
| `feature_type` | `plan_feature_type` | NOT NULL | boolean/limit/quota. |
| `metric` | `usage_metric` | NULL | For limit/quota gates. |
| `bool_value` | `boolean` | | When `feature_type='boolean'`. |
| `limit_value` | `numeric(14,3)` | | Cap for limit/quota (e.g. max seats, storage_mb). |
| `created_at`/`updated_at` | | | UNIQUE `(plan_id, feature_key)`. |

#### `subscriptions` — one active per org
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL → organizations.id | |
| `plan_id` | `uuid` | NOT NULL → plans.id ON DELETE RESTRICT | |
| `stripe_subscription_id` | `text` | UNIQUE NOT NULL | |
| `status` | `subscription_status` | NOT NULL | Mirrors Stripe. |
| `quantity` | `integer` | default `1` | Seat count synced to billable memberships. |
| `current_period_start` | `timestamptz` | | |
| `current_period_end` | `timestamptz` | | Access gate boundary. |
| `cancel_at_period_end` | `boolean` | default `false` | |
| `trial_ends_at` | `timestamptz` | | |
| `canceled_at` | `timestamptz` | | |
| envelope | | | UNIQUE `(org_id) WHERE status IN ('trialing','active','past_due') AND deleted_at IS NULL` (one live sub per org). |

#### `subscription_items` — line items of a subscription
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL | |
| `subscription_id` | `uuid` | NOT NULL → subscriptions.id ON DELETE CASCADE | |
| `stripe_subscription_item_id` | `text` | UNIQUE | |
| `stripe_price_id` | `text` | NOT NULL | |
| `quantity` | `integer` | default `1` | |
| `metric` | `usage_metric` | NULL | For metered items. |
| envelope (no soft delete) | | | |

#### `invoices_billing` — Stripe invoices (**distinct from sales `invoices`**)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL | |
| `subscription_id` | `uuid` | → subscriptions.id ON DELETE SET NULL | |
| `stripe_invoice_id` | `text` | UNIQUE NOT NULL | |
| `number` | `text` | | Stripe-assigned. |
| `status` | `billing_invoice_status` | NOT NULL | |
| `amount_due` | `bigint` | | Minor units. |
| `amount_paid` | `bigint` | | |
| `currency` | `text` | default `'inr'` | |
| `hosted_invoice_url` | `text` | | Stripe-hosted page. |
| `invoice_pdf` | `text` | | Stripe PDF link. |
| `period_start` | `timestamptz` | | |
| `period_end` | `timestamptz` | | |
| `due_date` | `timestamptz` | | |
| `paid_at` | `timestamptz` | | |
| envelope (no soft delete) | | | Financial record; never deleted. |

#### `payment_methods` — saved Stripe payment methods
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL | |
| `stripe_payment_method_id` | `text` | UNIQUE NOT NULL | |
| `type` | `payment_method_type` | NOT NULL | |
| `brand` | `text` | | e.g. `visa`. |
| `last4` | `text` | | |
| `exp_month` | `smallint` | | |
| `exp_year` | `smallint` | | |
| `is_default` | `boolean` | default `false` | |
| envelope | | | No PCI data stored — only Stripe references + display fields. |

#### `usage_records` — metered usage for billing/limits · **no soft delete**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `org_id` | `uuid` | NOT NULL | |
| `metric` | `usage_metric` | NOT NULL | |
| `quantity` | `numeric(14,3)` | NOT NULL | |
| `recorded_at` | `timestamptz` | NOT NULL default `now()` | |
| `period_key` | `text` | NOT NULL | Billing bucket. |
| `stripe_usage_record_id` | `text` | | If reported to Stripe metered billing. |
| `created_at` | | | Append-only; aggregated for plan-limit enforcement. |

#### `stripe_events` — webhook idempotency · **platform (no org_id, no soft delete)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PK | Stripe `event.id` (idempotency key). |
| `type` | `text` | NOT NULL | e.g. `invoice.paid`, `customer.subscription.updated`. |
| `status` | `stripe_event_status` | NOT NULL default `'received'` | |
| `payload` | `jsonb` | NOT NULL | Raw event. |
| `error` | `text` | | On failed processing. |
| `received_at` | `timestamptz` | NOT NULL default `now()` | |
| `processed_at` | `timestamptz` | | The Edge Function checks PK existence before handling. |

---

### 3.3 CRM

#### `lead_stages` — **NEW (SaaS)** configurable pipeline (lookup)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `name` | `text` | NOT NULL | e.g. `Qualified`. |
| `sort_order` | `integer` | default `0` | Kanban column order. |
| `is_won` | `boolean` | default `false` | Terminal-won marker. |
| `is_lost` | `boolean` | default `false` | Terminal-lost marker. |
| envelope | | | UNIQUE `(org_id, lower(name)) WHERE deleted_at IS NULL`. |

#### `leads` — **NEW (SaaS)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `name` | `text` | NOT NULL | Contact/lead name. |
| `company` | `text` | | |
| `contact_person` | `text` | | |
| `phone` | `text` | | |
| `email` | `text` | | |
| `source` | `text` | | web/whatsapp/referral/import. |
| `stage_id` | `uuid` | → lead_stages.id ON DELETE SET NULL | |
| `status` | `lead_status` | default `'new'` | Fallback if stages unused. |
| `owner_id` | `uuid` | → users.id ON DELETE SET NULL | Assigned rep. |
| `estimated_value` | `numeric(14,2)` | | |
| `converted_customer_id` | `uuid` | → customers.id ON DELETE SET NULL | Set on conversion. |
| `notes` | `text` | | |
| envelope | | | |

#### `lead_activities` — **NEW (SaaS)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `lead_id` | `uuid` | NOT NULL → leads.id ON DELETE CASCADE | |
| `type` | `lead_activity_type` | NOT NULL | |
| `body` | `text` | | |
| `due_at` | `timestamptz` | | For tasks/follow-ups. |
| `done` | `boolean` | default `false` | |
| `actor_id` | `uuid` | → users.id ON DELETE SET NULL | |
| envelope | | | |

#### `customers`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `name` | `text` | NOT NULL | Customer/site name. |
| `status` | `record_status` | default `'active'` | |
| `contact_person` | `text` | | |
| `phone` | `text` | | |
| `email` | `text` | | |
| `gstin` | `text` | | |
| `pan` | `text` | | |
| `billing_name` | `text` | | May differ from `name`. |
| `billing_address` | `text` | | |
| `delivery_name` | `text` | | |
| `delivery_address` | `text` | | |
| `same_as_billing` | `boolean` | default `false` | |
| `notes` | `text` | | |
| `post_sale_discount` | `numeric(14,2)` | default `0` | Subtracted in Running Bill (§9). |
| envelope | | | Running Bill is **derived**, not stored — see `customer_running_bill` view (§3.13). |

#### `payments`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `customer_id` | `uuid` | NOT NULL → customers.id ON DELETE RESTRICT | |
| `date` | `date` | NOT NULL | |
| `amount` | `numeric(14,2)` | NOT NULL | |
| `mode` | `payment_mode` | NOT NULL | |
| `reference` | `text` | | UTR/cheque no. |
| `notes` | `text` | | |
| envelope | | | Void via offsetting entry / `deleted_at` (audited); allocations in §3.9. |

---

### 3.4 Inventory / Catalogue

#### `item_families` (lookup) · #### `brands` (lookup)
Both: `name text NOT NULL` + full envelope. UNIQUE `(org_id, lower(name)) WHERE deleted_at IS NULL`.

#### `units` (lookup)
`code text NOT NULL` (SQM, MTR, NOS, BOX, KG, SQF, LTR, SET, PCS), `name text`. UNIQUE `(org_id, code) WHERE deleted_at IS NULL`. Full envelope.

#### `suppliers`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `name` | `text` | NOT NULL | |
| `contact_person` | `text` | | |
| `phone` | `text` | | |
| `email` | `text` | | |
| `gstin` | `text` | | |
| `address` | `text` | | |
| `status` | `record_status` | default `'active'` | |
| envelope | | | |

#### `items` — core catalogue (self-referential variants + import fields)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `parent_id` | `uuid` | → items.id ON DELETE SET NULL | Variant→parent; null = standalone/parent. |
| `family_id` | `uuid` | → item_families.id ON DELETE SET NULL | |
| `brand_id` | `uuid` | → brands.id ON DELETE SET NULL | |
| `unit_id` | `uuid` | → units.id ON DELETE SET NULL | |
| `sku` | `text` | UNIQUE `(org_id, sku) WHERE deleted_at IS NULL` | e.g. `ITM-2026-V1`. |
| `name` | `text` | NOT NULL | |
| `variant_label` | `text` | | e.g. `600x600 · Matte`. |
| `image_url` | `text` | | Storage URL. |
| `is_imported` | `boolean` | default `false` | |
| `is_template` | `boolean` | default `false` | Parent template; carries no stock. |
| `delivery_days` | `integer` | | |
| `purchase_price` | `numeric(14,2)` | | Cost (computed for imports — §9). |
| `selling_price` | `numeric(14,2)` | | |
| `stock` | `numeric(14,3)` | default `0` | On-hand. |
| `last_purchase_price` | `numeric(14,2)` | | Updated by goods receipt. |
| `last_purchase_date` | `date` | | |
| `last_supplier_id` | `uuid` | → suppliers.id ON DELETE SET NULL | |
| `import_currency` | `currency_code` | | (import) |
| `import_price` | `numeric(14,2)` | | (import) |
| `exchange_rate` | `numeric(12,6)` | | (import) |
| `import_discount_pct` | `numeric(6,3)` | | (import) |
| `transport_type` | `transport_type` | | (import) |
| `transport_value` | `numeric(14,2)` | | ₹ or % per `transport_type`. |
| `custom_duty_pct` | `numeric(6,3)` | | (import) |
| `profit_multiplier` | `numeric(8,4)` | | e.g. `1.35`. |
| envelope | | | |

#### `item_variations` — variation spec stored on parent (re-spawn source)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `item_id` | `uuid` | NOT NULL → items.id ON DELETE CASCADE | The parent. |
| `size` | `text` | | |
| `make` | `text` | | |
| `finish` | `text` | | |
| `brand` | `text` | | |
| envelope | | | Distinct from spawned variant rows in `items`. |

#### `stock_adjustments` — immutable · **no soft delete**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `item_id` | `uuid` | NOT NULL → items.id | |
| `type` | `stock_adj_type` | NOT NULL | add/sub. |
| `qty` | `numeric(14,3)` | NOT NULL | |
| `reason` | `text` | NOT NULL | Mandatory (FR-ITEM-5). |
| `adjusted_by` | `uuid` | → users.id | Must equal `auth.uid()` per RLS. |
| `at` | `timestamptz` | default `now()` | INSERT only; gated by `stock.adjust`. |
| `org_id, created_at, created_by` | | | (no `updated_at`/`deleted_at`). |

#### `stock_movements` — sales/issue/receipt history · **no soft delete (append-only)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `item_id` | `uuid` | NOT NULL → items.id | |
| `date` | `date` | NOT NULL | |
| `qty` | `numeric(14,3)` | NOT NULL | |
| `value` | `numeric(14,2)` | NOT NULL | |
| `direction` | `stock_direction` | NOT NULL | in (receipt) / out (challan). |
| `customer_id` | `uuid` | → customers.id ON DELETE SET NULL | For out movements. |
| `challan_id` | `uuid` | → delivery_challans.id ON DELETE SET NULL | |
| `goods_receipt_id` | `uuid` | → goods_receipts.id ON DELETE SET NULL | **NEW (SaaS)** for in movements. |
| `org_id, created_at, created_by` | | | Immutable ledger. |

#### `purchase_orders` — **NEW (SaaS)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `po_no` | `text` | NOT NULL; UNIQUE `(org_id, po_no) WHERE deleted_at IS NULL` | From `number_sequences`. |
| `supplier_id` | `uuid` | NOT NULL → suppliers.id ON DELETE RESTRICT | |
| `date` | `date` | NOT NULL | |
| `status` | `purchase_order_status` | default `'draft'` | |
| `currency` | `currency_code` | default `'INR'` | |
| `subtotal` | `numeric(14,2)` | default `0` | |
| `notes` | `text` | | |
| `expected_at` | `date` | | |
| envelope | | | Drives stock-in via goods receipts; may route through approvals (§3.11). |

#### `purchase_order_items` — **NEW (SaaS)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `po_id` | `uuid` | NOT NULL → purchase_orders.id ON DELETE CASCADE | |
| `item_id` | `uuid` | → items.id ON DELETE SET NULL | Snapshot link. |
| `name` | `text` | NOT NULL | Denormalised snapshot (§9). |
| `unit` | `text` | | |
| `rate` | `numeric(14,2)` | NOT NULL | |
| `qty` | `numeric(14,3)` | NOT NULL | |
| `discount_pct` | `numeric(6,3)` | default `0` | |
| `received_qty` | `numeric(14,3)` | default `0` | Running fulfilment. |
| `sort_order` | `integer` | default `0` | |
| envelope | | | |

#### `goods_receipts` — **NEW (SaaS)** receiving against a PO
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `grn_no` | `text` | NOT NULL; UNIQUE `(org_id, grn_no) WHERE deleted_at IS NULL` | |
| `po_id` | `uuid` | → purchase_orders.id ON DELETE SET NULL | |
| `supplier_id` | `uuid` | NOT NULL → suppliers.id ON DELETE RESTRICT | |
| `date` | `date` | NOT NULL | |
| `status` | `goods_receipt_status` | default `'draft'` | |
| `notes` | `text` | | |
| envelope | | | **Posting** writes `stock_movements (in)` + updates `items.stock`, `last_purchase_price/date/supplier`. |

#### `goods_receipt_items` — **NEW (SaaS)**
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `grn_id` | `uuid` | NOT NULL → goods_receipts.id ON DELETE CASCADE | |
| `po_item_id` | `uuid` | → purchase_order_items.id ON DELETE SET NULL | |
| `item_id` | `uuid` | → items.id ON DELETE SET NULL | |
| `name` | `text` | NOT NULL | Snapshot. |
| `qty` | `numeric(14,3)` | NOT NULL | Received. |
| `unit` | `text` | | |
| `rate` | `numeric(14,2)` | NOT NULL | Landed cost in. |
| `sort_order` | `integer` | default `0` | |
| envelope | | | |

---

### 3.5 Sales

#### `quotes`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `ref_no` | `text` | NOT NULL; UNIQUE `(org_id, ref_no, revision) WHERE deleted_at IS NULL` | `QT-2026-001`. |
| `revision` | `integer` | default `0` | |
| `parent_quote_id` | `uuid` | → quotes.id ON DELETE SET NULL | Revision chain. |
| `status` | `quote_status` | default `'draft'` | |
| `date` | `date` | NOT NULL | |
| `subject` | `text` | | |
| `customer_id` | `uuid` | NOT NULL → customers.id ON DELETE RESTRICT | |
| `company_logo_url` | `text` | | |
| `gst_pct` | `numeric(6,3)` | default `18` | |
| `gst_mode` | `gst_mode` | default `'yes'` | |
| `transport` | `numeric(14,2)` | default `0` | |
| `transport_note` | `text` | | |
| `total_mode` | `quote_total_mode` | default `'both'` | |
| `show_boq` | `boolean` | default `true` | |
| envelope | | | |

#### `quote_locations`
`quote_id uuid NOT NULL → quotes.id ON DELETE CASCADE`, `name text NOT NULL`, `sort_order integer default 0`, `selected boolean default true`. Envelope.

#### `quote_location_installation` (1:1 with location)
`quote_location_id uuid UNIQUE NOT NULL → quote_locations.id ON DELETE CASCADE`, `enabled boolean default false`, `mode install_mode`, `lumpsum numeric(14,2)`, `percent numeric(6,3)`, `perunit numeric(14,2)`, `note text`. Envelope.

#### `quote_items`
`quote_location_id uuid NOT NULL → quote_locations.id ON DELETE CASCADE`, `item_id uuid → items.id ON DELETE SET NULL`, `name text NOT NULL`, `brand text`, `unit text`, `rate numeric(14,2) NOT NULL`, `qty numeric(14,3) NOT NULL`, `discount_pct numeric(6,3) default 0`, `image_url text`, `sort_order integer default 0`. Envelope. **Snapshot fields** (name/brand/unit/rate) preserved per §9.

#### `quote_item_options` (alternates — excluded from totals)
`quote_item_id uuid NOT NULL → quote_items.id ON DELETE CASCADE`, `name text NOT NULL`, `brand text`, `unit text`, `rate numeric(14,2) NOT NULL`, `image_url text`, `sort_order integer default 0`. Envelope.

#### `quote_terms`
`quote_id uuid NOT NULL → quotes.id ON DELETE CASCADE`, `category term_category NOT NULL`, `text text NOT NULL`, `sort_order integer default 0`. Envelope.

#### `sales_orders`
`so_no text NOT NULL` (UNIQUE `(org_id, so_no) WHERE deleted_at IS NULL`), `quote_id uuid → quotes.id ON DELETE SET NULL`, `customer_id uuid NOT NULL → customers.id ON DELETE RESTRICT`, `date date NOT NULL`, `status sales_order_status default 'open'`, `notes text`. Envelope.

#### `sales_order_items`
`sales_order_id uuid NOT NULL → sales_orders.id ON DELETE CASCADE`, `item_id uuid → items.id ON DELETE SET NULL`, `name text NOT NULL`, `unit text`, `rate numeric(14,2) NOT NULL`, `qty numeric(14,3) NOT NULL`, `discount_pct numeric(6,3) default 0`, `sort_order integer default 0`. Envelope. Snapshot fields (§9).

#### `delivery_challans`
`challan_no text NOT NULL` (UNIQUE `(org_id, challan_no) WHERE deleted_at IS NULL`), `customer_id uuid NOT NULL → customers.id ON DELETE RESTRICT`, `sales_order_id uuid → sales_orders.id ON DELETE SET NULL`, `date date NOT NULL`, `delivery_address text`, `discount numeric(14,2) default 0`, `notes text`, `posted boolean default false`. Envelope. **Posting** decrements stock + writes `stock_movements (out)`.

#### `delivery_challan_items`
`challan_id uuid NOT NULL → delivery_challans.id ON DELETE CASCADE`, `item_id uuid → items.id ON DELETE SET NULL`, `name text NOT NULL`, `qty numeric(14,3) NOT NULL`, `unit text`, `rate numeric(14,2) NOT NULL`, `value numeric(14,2) NOT NULL` (= qty×rate persisted snapshot), `sort_order integer default 0`. Envelope. Drives Running Bill (§9).

---

### 3.6 Accounting (GST)

#### `invoices` — GST tax invoice (CGST/SGST/IGST, HSN)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `invoice_no` | `text` | NOT NULL; UNIQUE `(org_id, invoice_no) WHERE deleted_at IS NULL` | |
| `customer_id` | `uuid` | NOT NULL → customers.id ON DELETE RESTRICT | |
| `sales_order_id` | `uuid` | → sales_orders.id ON DELETE SET NULL | |
| `challan_id` | `uuid` | → delivery_challans.id ON DELETE SET NULL | |
| `date` | `date` | NOT NULL | |
| `status` | `invoice_status` | default `'draft'` | `issue` is a guarded transition (PERMISSIONS §7). |
| `place_of_supply` | `text` | | Drives intra vs inter-state split. |
| `taxable_value` | `numeric(14,2)` | | |
| `cgst` | `numeric(14,2)` | default `0` | |
| `sgst` | `numeric(14,2)` | default `0` | |
| `igst` | `numeric(14,2)` | default `0` | |
| `total` | `numeric(14,2)` | | |
| `notes` | `text` | | |
| envelope | | | |

#### `invoice_items`
`invoice_id uuid NOT NULL → invoices.id ON DELETE CASCADE`, `item_id uuid → items.id ON DELETE SET NULL`, `name text`, `hsn_code text`, `qty numeric(14,3)`, `unit text`, `rate numeric(14,2)`, `discount_pct numeric(6,3) default 0`, `taxable_value numeric(14,2)`, `gst_pct numeric(6,3)`, `sort_order integer default 0`. Envelope. Snapshot fields (§9).

#### `payment_allocations` — payment ↔ invoice (M:N) · **no soft delete**
`payment_id uuid NOT NULL → payments.id ON DELETE CASCADE`, `invoice_id uuid NOT NULL → invoices.id ON DELETE CASCADE`, `amount numeric(14,2) NOT NULL`, `org_id`, `created_at`, `created_by`. UNIQUE `(payment_id, invoice_id)`.

#### `expenses`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `category` | `text` | NOT NULL | |
| `amount` | `numeric(14,2)` | NOT NULL | |
| `date` | `date` | NOT NULL | |
| `status` | `expense_status` | default `'draft'` | Routed through approvals (§3.11). |
| `description` | `text` | | |
| `vendor_name` | `text` | | |
| `receipt_file_id` | `uuid` | → files.id ON DELETE SET NULL | Attachment. |
| `submitted_by` | `uuid` | → users.id ON DELETE SET NULL | = `created_by` typically. |
| envelope | | | RLS: submitters see own, approvers see all (PERMISSIONS §6.3). |

#### `expense_approvals`
`expense_id uuid NOT NULL → expenses.id ON DELETE CASCADE`, `approver_id uuid → users.id ON DELETE SET NULL`, `decision text` (`approved`/`rejected`), `comment text`, `at timestamptz default now()`. Envelope. *(Legacy direct-approval table; the generic engine in §3.11 supersedes it for new workflows — both retained for compatibility.)*

#### `budgets`
`period_type budget_period_type NOT NULL`, `period_key text NOT NULL` (e.g. `2026-Q1`), `category text NOT NULL`, `amount numeric(14,2) NOT NULL`, `notes text`. Envelope. UNIQUE `(org_id, period_key, category) WHERE deleted_at IS NULL`.

---

### 3.7 HR

#### `employees`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `user_id` | `uuid` | → users.id ON DELETE SET NULL | Optional link to login. |
| `code` | `text` | NOT NULL; UNIQUE `(org_id, code) WHERE deleted_at IS NULL` | |
| `name` | `text` | NOT NULL | |
| `department` | `text` | | |
| `designation` | `text` | | |
| `doj` | `date` | | Date of joining. |
| `ctc` | `numeric(14,2)` | | Annual cost-to-company. |
| `salary` | `numeric(14,2)` | | Monthly gross. |
| `bank_account` | `text` | | |
| `ifsc` | `text` | | |
| `pan` | `text` | | |
| `status` | `record_status` | default `'active'` | |
| envelope | | | Salary fields sensitive — RLS `hr.*`/`payroll.*`. |

#### `attendance` — **NEW (SaaS)**
`employee_id uuid NOT NULL → employees.id ON DELETE CASCADE`, `date date NOT NULL`, `status attendance_status NOT NULL`, `shift_id uuid → shifts.id ON DELETE SET NULL`, `check_in timestamptz`, `check_out timestamptz`, `hours numeric(6,2)`. Envelope. UNIQUE `(org_id, employee_id, date) WHERE deleted_at IS NULL`.

#### `shifts` — **NEW (SaaS)**
`name text NOT NULL`, `start_time time`, `end_time time`, `weekly_offs integer[]` (0–6), `grace_minutes integer default 0`. Envelope.

#### `leave_requests`
`employee_id uuid NOT NULL → employees.id ON DELETE CASCADE`, `type leave_type NOT NULL`, `from_date date NOT NULL`, `to_date date NOT NULL`, `days numeric(5,1)`, `reason text`, `status leave_status default 'pending'`, `approver_id uuid → users.id ON DELETE SET NULL`. Envelope.

#### `leave_balances` — **NEW (SaaS)**
`employee_id uuid NOT NULL → employees.id ON DELETE CASCADE`, `type leave_type NOT NULL`, `year integer NOT NULL`, `entitled numeric(5,1) default 0`, `used numeric(5,1) default 0`, `balance numeric(5,1) GENERATED` (or app-maintained). Envelope. UNIQUE `(org_id, employee_id, type, year)`.

#### `appraisals`
`employee_id uuid NOT NULL → employees.id ON DELETE CASCADE`, `period text NOT NULL`, `rating numeric(4,2)`, `notes text`, `reviewer_id uuid → users.id ON DELETE SET NULL`, `status appraisal_status default 'draft'`. Envelope.

#### `payroll_runs`
`period text NOT NULL` (e.g. `2026-05`), `status payroll_run_status default 'draft'`, `total_gross numeric(14,2) default 0`, `total_deductions numeric(14,2) default 0`, `total_net numeric(14,2) default 0`, `approved_by uuid → users.id ON DELETE SET NULL`, `paid_at timestamptz`. Envelope. UNIQUE `(org_id, period) WHERE deleted_at IS NULL`. May require sign-off via approvals (§3.11).

#### `payroll_lines` — **NEW (SaaS)** per-employee earnings/deductions
`payroll_run_id uuid NOT NULL → payroll_runs.id ON DELETE CASCADE`, `employee_id uuid NOT NULL → employees.id ON DELETE RESTRICT`, `gross numeric(14,2) NOT NULL`, `earnings jsonb` (component breakdown), `deductions jsonb` (PF/ESI/TDS), `net numeric(14,2) NOT NULL`, `sort_order integer default 0`. Envelope.

---

### 3.8 Files — **NEW (SaaS)** Storage object metadata

#### `files`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `bucket` | `text` | NOT NULL | `product-images`, `company-logos`, `quote-assets`, `documents`. |
| `path` | `text` | NOT NULL | Object path; convention `{org_id}/...`. UNIQUE `(bucket, path)`. |
| `owner_entity_type` | `text` | | e.g. `items`, `expenses`, `quotes`. |
| `owner_entity_id` | `uuid` | | Polymorphic owner (no FK — many targets). |
| `mime` | `text` | | |
| `size_bytes` | `bigint` | | For `storage_mb` usage metering. |
| `checksum` | `text` | | sha256; dedupe/integrity. |
| `status` | `file_status` | default `'pending'` | AV/scan lifecycle. |
| `uploaded_by` | `uuid` | → users.id ON DELETE SET NULL | |
| envelope | | | Soft-delete row when Storage object removed. |

---

### 3.9 Notifications — **NEW (SaaS)**

#### `notification_templates`
`key text NOT NULL` (e.g. `invoice.issued`, `quote.accepted`, `lead.assigned`), `channel notification_channel NOT NULL`, `subject text`, `body text NOT NULL` (Handlebars/MJML), `is_active boolean default true`. Envelope. UNIQUE `(org_id, key, channel) WHERE deleted_at IS NULL`. *(System templates may have `org_id` null for platform defaults.)*

#### `notifications` — in-app
`user_id uuid NOT NULL → users.id ON DELETE CASCADE`, `type text NOT NULL` (template key), `title text NOT NULL`, `body text`, `entity_type text`, `entity_id uuid`, `status notification_status default 'unread'`, `read_at timestamptz`, `data jsonb`. Envelope (no soft delete; archive via status).

#### `notification_preferences` — per-user per-channel opt-in
`user_id uuid NOT NULL → users.id ON DELETE CASCADE`, `category text NOT NULL` (e.g. `billing`, `sales`, `hr`), `channel notification_channel NOT NULL`, `enabled boolean default true`. Envelope. UNIQUE `(org_id, user_id, category, channel)`.

#### `notification_deliveries` — outbound (Resend/WhatsApp) · **no soft delete (append-only)**
`notification_id uuid → notifications.id ON DELETE SET NULL`, `channel notification_channel NOT NULL`, `recipient text NOT NULL` (email/phone), `provider text` (`resend`/`whatsapp`), `provider_message_id text`, `status delivery_status default 'queued'`, `error text`, `sent_at timestamptz`, `delivered_at timestamptz`. `org_id, created_at`. Webhook updates from Resend bump status.

---

### 3.10 Approval Workflows — **NEW (SaaS)** generic engine

> One engine drives **discount approval, expense approval, PO approval, payroll sign-off**. A `approval_workflows` definition has ordered `approval_steps`; a runtime `approval_requests` row references the target entity and accumulates `approval_actions`.

#### `approval_workflows` — definition
`entity_type approval_entity_type NOT NULL`, `name text NOT NULL`, `is_active boolean default true`, `min_amount numeric(14,2)` (threshold to trigger), `config jsonb`. Envelope. UNIQUE `(org_id, entity_type, name) WHERE deleted_at IS NULL`.

#### `approval_steps` — ordered steps of a workflow
`workflow_id uuid NOT NULL → approval_workflows.id ON DELETE CASCADE`, `step_order integer NOT NULL`, `step_type approval_step_type NOT NULL` (`role`/`user`/`amount_threshold`), `role_key text` (when role), `approver_id uuid → users.id ON DELETE SET NULL` (when user), `threshold_amount numeric(14,2)`, `is_required boolean default true`. Envelope. UNIQUE `(workflow_id, step_order)`.

#### `approval_requests` — runtime instance
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `workflow_id` | `uuid` | → approval_workflows.id ON DELETE SET NULL | |
| `entity_type` | `approval_entity_type` | NOT NULL | |
| `entity_id` | `uuid` | NOT NULL | Polymorphic target (expense/PO/etc). |
| `amount` | `numeric(14,2)` | | Triggers threshold logic. |
| `current_step` | `integer` | default `1` | |
| `status` | `approval_request_status` | default `'pending'` | |
| `requested_by` | `uuid` | → users.id ON DELETE SET NULL | |
| `resolved_at` | `timestamptz` | | |
| envelope | | | INDEX `(org_id, entity_type, entity_id)`. |

#### `approval_actions` — decision log · **no soft delete (append-only)**
`request_id uuid NOT NULL → approval_requests.id ON DELETE CASCADE`, `step_order integer NOT NULL`, `actor_id uuid → users.id ON DELETE SET NULL`, `decision approval_decision NOT NULL`, `comment text`, `at timestamptz default now()`. `org_id, created_at`.

---

### 3.11 Reporting / Analytics — **NEW (SaaS)**

#### `saved_reports` — user-saved report definitions
`name text NOT NULL`, `report_type text NOT NULL` (`sales`/`inventory_valuation`/`receivables_ageing`/`hr_headcount`/...), `filters jsonb default '{}'`, `format report_format default 'pdf'`, `is_shared boolean default false`, `owner_id uuid → users.id ON DELETE SET NULL`. Envelope.

#### `report_schedules` — scheduled delivery
`saved_report_id uuid NOT NULL → saved_reports.id ON DELETE CASCADE`, `frequency schedule_frequency NOT NULL`, `next_run_at timestamptz NOT NULL`, `recipients text[]` (emails), `channel notification_channel default 'email'`, `is_active boolean default true`, `last_run_at timestamptz`. Envelope. Driven by Supabase cron / Edge Function.

#### Materialized views (read models — refreshed on schedule)
| View | Grain | Sources | Key columns |
|------|-------|---------|-------------|
| `mv_sales_summary` | org × month × customer/item | invoices, invoice_items, delivery_challan_items | `org_id, period, customer_id, item_id, qty, revenue, margin` |
| `mv_inventory_valuation` | org × item | items, stock_movements | `org_id, item_id, stock, purchase_price, stock_value` |
| `mv_receivables_ageing` | org × customer × bucket | invoices, payments, payment_allocations, delivery_challan_items | `org_id, customer_id, bucket(0-30/31-60/61-90/90+), outstanding` |
| `mv_hr_headcount` | org × month × department | employees, attendance | `org_id, period, department, headcount, present_days, leave_days` |

> MVs carry `org_id` and are filtered by `app.is_member(org_id)` in the **wrapping security-barrier view** the API queries (Postgres MVs don't support RLS directly — see §8.4). `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index on each MV.

---

## 4. Relationships & Cardinalities

### 4.1 Textual summary (selected)
- `organizations 1—1 organization_settings`; `1—N memberships`, `user_roles`, and `org_id` on every business table.
- `organizations 1—1 subscriptions (live)`; `subscriptions 1—N subscription_items`, `1—N invoices_billing`; `plans 1—N plan_features`, `plans 1—N subscriptions`.
- `leads N—1 lead_stages`; `leads 1—N lead_activities`; `leads 0..1—1 customers` (`converted_customer_id`).
- `items 1—N items` (self, parent→variants); `items 1—N item_variations / stock_adjustments / stock_movements`.
- `purchase_orders 1—N purchase_order_items`; `purchase_orders 1—N goods_receipts 1—N goods_receipt_items`; receipt posting → `stock_movements (in)`.
- `quotes 1—N quote_locations 1—1 quote_location_installation`; `quote_locations 1—N quote_items 1—N quote_item_options`; `quotes 1—N quote_terms`; `quotes N—1 quotes` (revision).
- `quotes 1—N sales_orders 1—N delivery_challans`; challan posting → `stock_movements (out)`.
- `invoices N—M payments` via `payment_allocations`.
- `employees 1—N attendance / leave_requests / leave_balances / appraisals / payroll_lines`.
- `approval_workflows 1—N approval_steps`; `approval_requests 1—N approval_actions`; request points polymorphically at expense/PO/payroll/etc.
- `notifications N—1 users`; `notifications 1—N notification_deliveries`.

### 4.2 ASCII ER — per cluster
```
PLATFORM
organizations ─1:1─ organization_settings
organizations ─1:N─ memberships ─N:1─ users (platform)
organizations ─1:N─ user_roles ─N:1─ roles ─1:N─ role_permissions ─N:1─ permissions(platform)
organizations ─1:N─ invitations / number_sequences / audit_logs

BILLING (per org)
plans ─1:N─ plan_features
plans ─1:N─ subscriptions ─N:1─ organizations
subscriptions ─1:N─ subscription_items
subscriptions ─1:N─ invoices_billing
organizations ─1:N─ payment_methods / usage_records
stripe_events (platform, idempotency)

CRM
lead_stages ─1:N─ leads ─1:N─ lead_activities
leads ─0..1:1─ customers ─1:N─ payments
customers ─1:N─ quotes / sales_orders / delivery_challans / invoices

INVENTORY / PROCUREMENT
item_families/brands/units/suppliers ─1:N─ items
items ─self 1:N─ items ; items ─1:N─ item_variations/stock_adjustments/stock_movements
suppliers ─1:N─ purchase_orders ─1:N─ purchase_order_items
purchase_orders ─1:N─ goods_receipts ─1:N─ goods_receipt_items ─(post)─► stock_movements(in)

SALES (order-to-cash)
quotes ─1:N─ quote_locations ─1:1─ quote_location_installation
quote_locations ─1:N─ quote_items ─1:N─ quote_item_options
quotes ─1:N─ quote_terms ; quotes ─self N:1─ quotes (revision)
quotes ─1:N─ sales_orders ─1:N─ sales_order_items
sales_orders ─1:N─ delivery_challans ─1:N─ delivery_challan_items ─(post)─► stock_movements(out)

ACCOUNTING
delivery_challans/sales_orders ─1:N─ invoices ─1:N─ invoice_items
invoices ─N:M─ payments  (payment_allocations)
expenses ─1:N─ expense_approvals ; budgets

HR
employees ─1:N─ attendance ─N:1─ shifts
employees ─1:N─ leave_requests / leave_balances / appraisals
payroll_runs ─1:N─ payroll_lines ─N:1─ employees

CROSS-CUTTING
files (polymorphic owner_entity_*)
notification_templates ─ notifications ─1:N─ notification_deliveries ; notification_preferences
approval_workflows ─1:N─ approval_steps ; approval_requests ─1:N─ approval_actions (→ polymorphic entity)
saved_reports ─1:N─ report_schedules ; mv_* read models
```

---

## 5. Foreign Keys & Referential Actions

| Child → Parent | ON DELETE | Rationale |
|----------------|-----------|-----------|
| `*.org_id → organizations.id` | `RESTRICT` | Never orphan tenant data; org removal is a deliberate purge. |
| `organization_settings.org_id → organizations.id` | `CASCADE` | 1:1 lifecycle bound to org. |
| `*.created_by/updated_by → users.id` | `SET NULL` | Preserve history if user removed. |
| `memberships/user_roles.user_id → users.id` | `CASCADE` | Access dies with the user. |
| `user_roles/role_permissions.role_id → roles.id` | `CASCADE` | |
| `role_permissions.permission_key → permissions.key` | `CASCADE` | |
| `subscriptions.plan_id → plans.id` | `RESTRICT` | A plan in use can't vanish; retire via `is_active`. |
| `subscription_items.subscription_id` | `CASCADE` | |
| `invoices_billing.subscription_id` | `SET NULL` | Keep billing history after sub change. |
| `plan_features.plan_id → plans.id` | `CASCADE` | |
| `leads.stage_id → lead_stages.id` | `SET NULL` | Stage delete shouldn't drop leads. |
| `leads.converted_customer_id → customers.id` | `SET NULL` | |
| `lead_activities.lead_id` | `CASCADE` | |
| `items.parent_id → items.id` | `SET NULL` | Variant survives parent removal. |
| `items.{family_id,brand_id,unit_id,last_supplier_id}` | `SET NULL` | Lookup removal keeps items. |
| `item_variations.item_id`, `purchase_order_items.po_id`, `goods_receipt_items.grn_id` | `CASCADE` | Structural children. |
| `purchase_orders.supplier_id`, `goods_receipts.supplier_id` | `RESTRICT` | Protect procurement history. |
| `stock_*.item_id → items.id` | `CASCADE` (hard-purge only) | History tied to item; normally soft-deleted together. |
| `stock_movements.{customer_id,challan_id,goods_receipt_id}` | `SET NULL` | Ledger survives source doc removal. |
| `quote_locations.quote_id`, `quote_location_installation.quote_location_id`, `quote_items.quote_location_id`, `quote_item_options.quote_item_id`, `quote_terms.quote_id` | `CASCADE` | Structural children. |
| `quote_items.item_id`, `sales_order_items.item_id`, `delivery_challan_items.item_id`, `invoice_items.item_id` | `SET NULL` | Snapshot preserved (§9) even if catalogue item removed. |
| `quotes.customer_id`, `sales_orders.customer_id`, `delivery_challans.customer_id`, `invoices.customer_id`, `payments.customer_id` | `RESTRICT` | Block customer delete with live financial/legal docs. |
| `quotes.parent_quote_id` | `SET NULL` | |
| `sales_orders.quote_id`, `delivery_challans.sales_order_id`, `invoices.{sales_order_id,challan_id}` | `SET NULL` | Downstream docs survive upstream removal. |
| `sales_order_items.sales_order_id`, `delivery_challan_items.challan_id`, `invoice_items.invoice_id`, `payment_allocations.{payment_id,invoice_id}` | `CASCADE` | Structural children. |
| `expenses.receipt_file_id → files.id` | `SET NULL` | |
| `expense_approvals.expense_id`, `payroll_lines.payroll_run_id` | `CASCADE` | |
| `payroll_lines.employee_id → employees.id` | `RESTRICT` | Protect processed payroll. |
| `attendance/leave_*/appraisals.employee_id → employees.id` | `CASCADE` | |
| `notifications.user_id`, `notification_preferences.user_id` | `CASCADE` | |
| `notification_deliveries.notification_id` | `SET NULL` | Delivery log outlives in-app notification. |
| `approval_steps.workflow_id`, `approval_actions.request_id` | `CASCADE` | |
| `report_schedules.saved_report_id` | `CASCADE` | |

> **Principle (unchanged from `DATABASE_DESIGN.md §9`):** financial/legal documents use `RESTRICT`; structural children use `CASCADE`; snapshot links to catalogue/lookups use `SET NULL` so historical documents preserve captured values (§9). Stripe-history tables (`invoices_billing`, `usage_records`) are never deleted.

---

## 6. Indexes

### 6.1 Standard (every business table)
- PK on `id` (implicit).
- `idx_<table>_org` on `(org_id)`.
- `idx_<table>_org_active` partial on `(org_id) WHERE deleted_at IS NULL` — the hot path.
- A btree index on every FK column (Postgres does not auto-index FKs).

### 6.2 Targeted (by access pattern)
| Table | Index | Reason |
|-------|-------|--------|
| `items` | `idx_items_org_family (org_id, family_id)`, `idx_items_org_brand (org_id, brand_id)`, `idx_items_parent (parent_id)` | Stock-report hierarchy + variants. |
| `items` | `uq_items_sku (org_id, sku) WHERE deleted_at IS NULL` | Unique live SKU. |
| `items` | GIN `idx_items_name_trgm` on `name` (`pg_trgm`) | Catalogue search. |
| `customers` | `idx_customers_status (org_id, status)`; GIN `idx_customers_search_trgm` on `(name, phone, email)` | Filter + search. |
| `leads` | `idx_leads_stage (org_id, stage_id)`, `idx_leads_owner (org_id, owner_id)` | Kanban + my-leads. |
| `payments` | `idx_payments_customer_date (org_id, customer_id, date)` | Running bill assembly. |
| `stock_movements` | `idx_sm_item_date (org_id, item_id, date)`, `idx_sm_customer (customer_id)` | Per-item / per-customer movement. |
| `stock_adjustments` | `idx_sa_item_at (item_id, at)` | Adjustment history. |
| `quotes` | `uq_quotes_ref (org_id, ref_no, revision) WHERE deleted_at IS NULL`, `idx_quotes_customer`, `idx_quotes_status`, `idx_quotes_parent` | Ref uniqueness, list filters, revision chain. |
| `quote_locations`/`quote_items`/`quote_item_options` | `(quote_id, sort_order)` / `(quote_location_id, sort_order)` / `(quote_item_id)` | Ordered render. |
| `delivery_challans` | `idx_dc_customer_date (org_id, customer_id, date)` | Running bill. |
| `invoices` | `idx_inv_customer (org_id, customer_id)`, `idx_inv_status (org_id, status)` | |
| `payment_allocations` | `idx_pa_invoice (invoice_id)`, `idx_pa_payment (payment_id)` | |
| `purchase_orders`/`goods_receipts` | `(org_id, supplier_id)`, `(org_id, status)` | |
| `subscriptions` | `uq_sub_live (org_id) WHERE status IN ('trialing','active','past_due') AND deleted_at IS NULL`; `idx_sub_stripe (stripe_subscription_id)` | One live sub; webhook lookup. |
| `invoices_billing` | `uq_invb_stripe (stripe_invoice_id)`, `idx_invb_org_status (org_id, status)` | Webhook idempotency + listing. |
| `usage_records` | `idx_usage_org_metric_period (org_id, metric, period_key)` | Limit enforcement. |
| `stripe_events` | PK on `id` | Idempotency. |
| `attendance` | `uq_att (org_id, employee_id, date) WHERE deleted_at IS NULL` | One row/day. |
| `payroll_lines` | `idx_pl_run (payroll_run_id)`, `idx_pl_emp (employee_id)` | |
| `notifications` | `idx_notif_user_status (org_id, user_id, status)` | Unread badge. |
| `notification_deliveries` | `idx_nd_status (org_id, status)`, `idx_nd_provider_msg (provider_message_id)` | Resend webhook reconcile. |
| `approval_requests` | `idx_ar_entity (org_id, entity_type, entity_id)`, `idx_ar_status (org_id, status)` | Pending queue. |
| `files` | `uq_files_bucket_path (bucket, path)`, `idx_files_owner (org_id, owner_entity_type, owner_entity_id)` | Dedup + lookup. |
| `audit_logs` | `idx_audit_entity (org_id, entity_type, entity_id, at)`, `idx_audit_actor (actor_id, at)` | History/activity. |
| `mv_*` | unique index per MV (e.g. `mv_sales_summary (org_id, period, customer_id, item_id)`) | Required for `REFRESH ... CONCURRENTLY`. |

> Extensions: `pg_trgm` (fuzzy/contains search), `pgcrypto` (`gen_random_uuid()`), both available on Supabase.

---

## 7. Soft-Delete Strategy

Unchanged from `DATABASE_DESIGN.md §3`, extended for SaaS:
- Business tables use `deleted_at timestamptz NULL`; the app **never hard-deletes** business rows — it sets `deleted_at = now()`.
- All reads filter `deleted_at IS NULL` (RLS `USING` clause + Drizzle `notDeleted()` helper).
- Partial unique indexes `WHERE deleted_at IS NULL` so a ref/SKU/number can be reused after a soft-deleted draft.
- Soft-deleting a parent soft-deletes children in the **same application transaction** (DB `CASCADE` only fires on hard delete / purge).
- **Not soft-deletable** (immutable history / junctions / append-only): `role_permissions`, `user_roles`, `memberships`, `stock_movements`, `stock_adjustments`, `audit_logs`, `payment_allocations`, `usage_records`, `stripe_events`, `approval_actions`, `notification_deliveries`, `notifications` (archive via status).
- **Billing financial records** (`invoices_billing`) are never deleted (legal/audit); subscriptions soft-delete only after Stripe cancellation.

---

## 8. Multi-Tenant Enforcement at the Schema Level

### 8.1 `org_id` everywhere
Every tenant-scoped table — including **all child tables** (`quote_items`, `invoice_items`, `payroll_lines`, `approval_actions`, …) — carries `org_id NOT NULL`, **denormalised** onto children so RLS policies check membership without a join (`PERMISSIONS.md §6.3` relies on this). Platform-only tables (`users`, `permissions`, `plans`, `plan_features`, `stripe_events`) deliberately omit `org_id`.

### 8.2 Billing is per org
- One `organizations.stripe_customer_id`; at most one **live** `subscriptions` row per org (enforced by partial unique index, §6.2).
- **Seat count** = `COUNT(*) FROM memberships WHERE org_id = :org AND is_billable AND <user active>`; synced to `subscriptions.quantity` and Stripe on membership change (`invitations` accept / member removal).
- **Plan gating:** `plan_features` for the org's plan determine module access (`module.hr`, `module.analytics`, `whatsapp.send`) and usage caps (`seats`, `storage_mb`, `quotes`); enforced at the server layer and surfaced via PostHog feature flags. Hard caps double-checked against `usage_records`.
- Suspension: a `past_due`/`unpaid`/`canceled` subscription flips `organizations.status` handling at the app layer (read-only / blocked) — RLS still isolates data.

### 8.3 RLS as source of truth
All tables run `ENABLE` + `FORCE ROW LEVEL SECURITY` (default-deny). Helpers `app.is_member(org)`, `app.has_permission(key, org)`, `app.is_org_owner(org)`, `app.is_super_admin()` (defined in `PERMISSIONS.md §6.1`) back every policy. Billing tables: members read (`payments.view`/`finance.view`), only Owner/Super Admin mutate (most writes flow from Stripe webhooks via service role, bypassing RLS by design).

### 8.4 Materialized views & RLS
MVs cannot host RLS. Each MV carries `org_id` and is exposed only through a **security-barrier view** (`CREATE VIEW v_sales_summary WITH (security_barrier) AS SELECT * FROM mv_sales_summary WHERE app.is_member(org_id)`); the API never selects MVs directly.

---

## 9. Denormalized Snapshot Pattern (sales documents)

Sales/financial documents must reproduce **what was quoted/sold at the time**, even if the catalogue later changes. Therefore line-item tables store a **snapshot** of catalogue values, not just an FK:

- `quote_items`, `sales_order_items`, `delivery_challan_items`, `invoice_items`, `purchase_order_items`, `goods_receipt_items` each store `name`, and (where applicable) `brand`, `unit`, `rate`, `qty`, `discount_pct`, `image_url`, `hsn_code` **inline**.
- The `item_id` FK is **nullable** with `ON DELETE SET NULL` — if the catalogue item is removed/renamed, the document still renders its original text and price.
- `delivery_challan_items.value` persists `qty × rate` so the Running Bill total never drifts when rates change.
- Computed monetary results stored on document headers (`invoices.taxable_value/cgst/sgst/igst/total`, `quotes` totals are recomputed by `lib/calc`) match the snapshot rows.

**Calculations remain in `lib/calc` (TypeScript), not the DB** (per `PROJECT_PLAN §7` / `ARCHITECTURE`), so live preview and PDF share one implementation:
- Import landed-cost: `base = import_price × exchange_rate → afterDisc = base×(1−disc%) → +transport(lumpsum|%) → ×(1+duty%) = purchase_price → ×profit_multiplier = selling_price`.
- Quote: `lineTotal = rate×qty×(1−disc%)`; installation per location (lumpsum|%|perunit); GST modes (yes/incl/no); totals over SELECTED locations only; `total_mode` grand/each/both.
- Running bill (derived, `customer_running_bill` view): `Σ delivery_challan_items.value − customers.post_sale_discount − Σ payments.amount = outstanding`.

---

## 10. Open Questions / Decisions

Carried from prior docs (`DATABASE_DESIGN §13`, `PERMISSIONS §8`, `ROADMAP §8`), plus SaaS-specific:

1. **GST depth** — `invoices` models CGST/SGST/IGST + HSN; confirm whether v1 needs full tax-invoice compliance + GSTR exports or simplified single-GST. *(Schema supports full.)*
2. **Accounting depth** — document-level only vs full double-entry `ledger_entries` (ROADMAP §8.2). If chosen, add `ledger_entries`/`journals` + `tax_rates`/HSN master.
3. **Stripe money representation** — billing tables use `bigint` minor units (Stripe-native); app money stays `numeric(14,2)`. Confirm no cross-mixing in reports.
4. **Seat definition** — seats = billable active memberships; confirm whether invited-but-unaccepted invitations count toward seat billing.
5. **Plan-limit enforcement point** — hard-blocked at server (with `usage_records`) vs soft (overage billed via Stripe metered). Decide per metric.
6. **Approvals: legacy vs generic** — `expense_approvals` (direct) retained alongside the generic `approval_*` engine; confirm migration to engine-only.
7. **Lead pipeline** — `lead_stages` lookup (configurable) vs fixed `lead_status` enum; both present, pick the primary.
8. **Notification fan-out** — in-app always; email/WhatsApp gated by plan (`whatsapp.send` feature) + `notification_preferences`. Confirm WhatsApp provider (Twilio/Wati/Interakt).
9. **MV refresh cadence** — Supabase cron interval per MV (e.g. nightly valuation, hourly ageing); confirm freshness SLAs.
10. **Numbering** — `number_sequences` masks + yearly/monthly reset cadence per `doc_type`; confirm exact masks.
11. **Multi-org launch** — schema is multi-tenant-ready and billing-per-org; confirm whether v1 onboards multiple orgs or a single pilot org.

---

*End of DATABASE_SCHEMA.md — the canonical table catalog. RLS (`PERMISSIONS.md`), API, and Audit docs derive their entity/column/FK references from this file. No migration SQL or Drizzle migration files are generated here; see `DATABASE_DESIGN.md §12` for migration ordering (extended with billing/cross-cutting groups).*
