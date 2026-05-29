# Watcon Business Management System — Production SaaS Development Roadmap

> **Status:** Production / SaaS-grade delivery plan (supersedes the functional plan in [ROADMAP.md](ROADMAP.md)).
> **Date:** 2026-05-29
> **Companions:** [PROJECT_PLAN.md](PROJECT_PLAN.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (canonical tables/columns) · [PERMISSIONS.md](PERMISSIONS.md) · [ARCHITECTURE.md](ARCHITECTURE.md)
> **Tech stack (locked):** Next.js 15 (App Router, RSC, Server Actions) · TypeScript strict · Supabase (Auth/Postgres/Storage/Edge/Realtime) · Drizzle ORM · TanStack Query · React Hook Form · Zod · **CSS Modules + SCSS** · **CSS-variable design tokens** (no Tailwind/shadcn — [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md)) · **Stripe** · **Resend** · **Sentry** · **PostHog**.
> **Tenancy:** shared-DB / shared-schema / row-level isolation; tenant = `organizations` row (`org_id`); users join many orgs via `memberships`; **billing is per organization**.

---

## 1. Reconciliation with [ROADMAP.md](ROADMAP.md)

This document is the **production, billed-SaaS** version of the prior phased plan. The functional intent of [ROADMAP.md](ROADMAP.md) is preserved; this roadmap **extends** it on four axes that the original plan deliberately left out (it was a single-tenant functional plan):

| Concern | [ROADMAP.md](ROADMAP.md) (functional) | This document (production SaaS) |
|---------|----------------------------------------|----------------------------------|
| **Tenancy** | `org_id` mentioned, single-pilot assumed | Multi-company memberships, org switcher, seat sync, per-org isolation tested every phase |
| **Billing** | Absent | **Stripe** customers/subscriptions/plans/usage + webhook idempotency (`stripe_events`), plan-gating from P1 onward |
| **Observability** | Absent | **Sentry** (errors + tracing) and **PostHog** (analytics + feature flags) wired from **P0**, not bolted on |
| **Cross-cutting subsystems** | Not designed | **Files**, **Notifications** (Resend), **Approvals** (generic engine), **Reporting** (materialized views + schedules) designed as first-class subsystems |
| **The 5 prototypes** | HTML/JSX prototypes | Promoted to production vertical slices with RLS, audit, validation, tests, PDF, comms |

### 1.1 Phase mapping (old → new)

| [ROADMAP.md](ROADMAP.md) phase | This roadmap |
|--------------------------------|--------------|
| Phase 0 Foundation | **P0** Foundation **+ Observability** |
| Phase 1 Auth · Company · Dashboard | **P1** Auth · Company Setup · **Billing/Stripe** · Dashboard |
| Phase 2 CRM · Leads · Customers | **P2** CRM (Leads, Customers, Running Bill) **+ Notifications** |
| Phase 2.5 Sales & Quotations | **P3** Sales & Quotations (production) **+ Files + PDF/Resend** |
| Phase 3 Inventory · PO · Suppliers | **P4** Inventory · Purchase Orders · Suppliers **+ Approvals engine** |
| Phase 5 Accounting | **P5** Accounting (Invoices/GST · Payments · Expenses) |
| Phase 4 HR · Attendance · Payroll | **P6** HR · Attendance · Payroll |
| Phase 6 Reports · Analytics | **P7** Reports + Analytics (MVs, schedules, PostHog) |
| *(implicit)* | **P8** Hardening · performance · security · launch |

> **Note on ordering.** Unlike [ROADMAP.md](ROADMAP.md) (which sequenced HR before Accounting), this plan runs **Accounting (P5) before HR (P6)** because order-to-cash (P3 Sales → P5 Invoicing) is the revenue spine of the product and the Approvals engine (P4) is needed before expense/payroll sign-off. HR/Payroll depends on the Approvals engine and the financial-record discipline established in P5. The two tracks remain independent enough to parallelize if staffing allows (see [ROADMAP.md §0](ROADMAP.md) dependency graph).

### 1.2 Open decisions from prior docs that gate this roadmap
The decisions in [ROADMAP.md §8](ROADMAP.md), [DATABASE_SCHEMA.md §10](DATABASE_SCHEMA.md), and [PERMISSIONS.md §8](PERMISSIONS.md) are carried into §6 below and tagged with the phase that must resolve them (e.g. accounting depth blocks P5, plan tiers block P1).

---

## 2. Guiding Principles

1. **Ship tenant-safe vertical slices.** Each deliverable is a complete slice — DB tables (per [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)) → RLS policies → Zod validation → server action → feature UI ([ARCHITECTURE.md §5](ARCHITECTURE.md)). No table reaches `main` without RLS enabled.
2. **RLS + audit + tests with every table.** Every new business table ships with `ENABLE` + `FORCE ROW LEVEL SECURITY` (default-deny), policies built on `app.is_member(org_id)` / `app.has_permission(key, org_id)` / `app.is_org_owner(org_id)` / `app.is_super_admin()` ([PERMISSIONS.md §6.1](PERMISSIONS.md)), an `fn_audit` trigger for sensitive mutations, and tests. A CI gate (`scripts/check-rls.ts`) fails the build if any tenant table lacks RLS.
3. **Observability from day one.** Sentry (`@sentry/nextjs`) and PostHog are initialized in **P0** so every later phase emits errors, traces, and product events from its first commit — never retrofitted. Server actions are wrapped to capture exceptions with `org_id`/`user_id` tags (PII-scrubbed).
4. **Billing is a gate, not a feature.** From P1 every module checks plan entitlement (`plan_features`) before rendering/executing. Gating logic lives in `lib/billing` and is mirrored to PostHog feature flags so UI and server agree.
5. **Calculations live in `lib/calc` (TypeScript), never in the DB** ([DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md), [PROJECT_PLAN §7](PROJECT_PLAN.md)) — one implementation powers live preview, server validation, and PDF.
6. **Snapshots over joins for documents.** Sales/financial line items store `name/rate/qty/...` inline ([DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md)) so historical documents never drift.
7. **Service-role webhooks bypass RLS by design.** Stripe and Resend webhooks run in Edge Functions under the service role and write billing/delivery tables that members cannot mutate directly ([DATABASE_SCHEMA.md §8.3](DATABASE_SCHEMA.md)).
8. **Don't regress the schema.** Every "Database changes" list below references tables already named in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); this roadmap introduces **no new table names**.

---

## 3. Phased Plan

Legend — **Complexity:** ★ low · ★★ medium · ★★★ high · ★★★★ very high. Each phase lists: **Goal · Complexity · Dependencies · Database changes · Integrations introduced · UI screens · Exit criteria.**

```
P0 ─► P1 ─┬─► P2 ─► P3 ─┐
          │              ├─► P5 ─► P6 ─► P7 ─► P8
          └─► P4 ────────┘
P0 Foundation+Obs │ P1 Auth+Company+Billing+Dash │ P2 CRM+Notify │ P3 Sales+Files+PDF
P4 Inventory+PO+Approvals │ P5 Accounting │ P6 HR+Payroll │ P7 Reports+Analytics │ P8 Launch
```

---

### P0 — Foundation + Observability

- **Goal:** Stand up the multi-tenant skeleton with isolation, RBAC, and full observability before any business feature exists.
- **Complexity:** ★★★ (every cross-cutting concern; mistakes are expensive downstream).
- **Dependencies:** none.
- **Database changes** (from [DATABASE_SCHEMA.md §3.1](DATABASE_SCHEMA.md)):
  - Extensions `pgcrypto`, `pg_trgm`; the `app` schema.
  - All carried-over `pgEnum` types ([DATABASE_SCHEMA.md §2.1](DATABASE_SCHEMA.md)) plus the **billing/cross-cutting enums** ([§2.2–2.4](DATABASE_SCHEMA.md)) so later phases add tables, not enums.
  - Identity/access tables: `organizations`, `organization_settings`, `users`, `memberships`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`.
  - RLS helper functions `app.is_member`, `app.has_permission`, `app.is_org_owner`, `app.is_super_admin` ([PERMISSIONS.md §6.1](PERMISSIONS.md)); default-deny base policies on every table above.
  - Generic triggers `fn_set_updated_at`, `fn_audit`.
  - Seed: permission catalog + 6 system roles (`super_admin` platform flag, `company_owner`, `manager`, `employee`, `accountant`, `hr`) + role→permission grants ([PERMISSIONS.md §6.5](PERMISSIONS.md)).
- **Integrations introduced:**
  - **Supabase** project, Drizzle config + first migration set, typed client (anon + service-role).
  - **Sentry** (`@sentry/nextjs`): client + server + edge configs, source maps, tracing sample rate, server-action wrapper that tags `org_id`/`user_id` and scrubs PII.
  - **PostHog** (`posthog-js` + `posthog-node`): provider in the app shell, server capture, feature-flag bootstrap helper in `lib/billing`/`lib/flags`.
- **UI screens:** App shell (sidebar/topbar/content) styled with CSS Modules; the **SCSS design-token foundation** — `styles/` (CSS-variable tokens, mixins, breakpoints, reset) + `app/globals.scss` — plus the base UI primitive set in `components/ui` (Button, Input, Dialog, Table, …) hand-built per [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md); TanStack Query + theme + PostHog providers, global error/loading boundaries, `permission-gate`. No business screens. (No Tailwind/shadcn install.)
- **Exit criteria:**
  - Two orgs created by raw seed; cross-org SELECT from a member of org A returns **zero** org-B rows (RLS proven by an isolation test).
  - `scripts/check-rls.ts` green in CI; every identity table has FORCE RLS.
  - A thrown server error surfaces in Sentry with `org_id` tag; a `app_loaded` event lands in PostHog.
  - `fn_audit` writes an `audit_logs` row on a role change.

---

### P1 — Auth · Company Setup · Billing (Stripe) · Dashboard

- **Goal:** A user signs up, creates/joins a company, the org is configured and **on a Stripe plan/trial**, and a role-aware, plan-gated dashboard greets them.
- **Complexity:** ★★★ (billing + webhook idempotency + seat sync raise this above the functional plan's "Medium").
- **Dependencies:** P0.
- **Database changes** (from [DATABASE_SCHEMA.md §3.1–3.2](DATABASE_SCHEMA.md)):
  - `invitations` (seat acquisition), `number_sequences` (masks/counters backing `services/numbering`).
  - **Billing:** `plans`, `plan_features`, `subscriptions`, `subscription_items`, `invoices_billing`, `payment_methods`, `usage_records`, `stripe_events`.
  - Populate `organizations.stripe_customer_id`; `organization_settings` (financial_year_start, default_gst_pct, place_of_supply, `approval_limits` jsonb, `theme`, `feature_flags`).
  - First-user → Company Owner bootstrap; `subscriptions` partial-unique "one live sub per org" index ([§6.2](DATABASE_SCHEMA.md)).
- **Integrations introduced:**
  - **Stripe** (the headline of this phase): Checkout / Billing Portal sessions, Customer creation on org create, subscription + trial, **webhook Edge Function** consuming `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` with **idempotency via `stripe_events.id`** ([§3.2](DATABASE_SCHEMA.md)); seat sync (`memberships.is_billable` count → `subscriptions.quantity` → Stripe).
  - **Resend:** transactional email for **invitations** and password reset (first templated emails; full notification subsystem lands in P2).
  - **PostHog:** plan entitlements mirrored to feature flags; signup/onboarding funnel events.
  - **Supabase Auth:** email/password + reset; JWT carries `app_metadata.is_super_admin`.
- **UI screens:**
  - **Login / Signup / Reset** (Supabase Auth).
  - **Onboarding wizard** — company profile, logo upload, tax & numbering config, **plan selection → Stripe Checkout**, invite first users.
  - **Dashboard** — greeting, KPI cards (quote value, receivables, pending), activity feed, role-gated + plan-gated sections.
  - **Org switcher / user menu**; **Admin → Users & Roles** (invite + role assign); **Settings → Billing** (current plan, seats, `hosted_invoice_url`, Manage in Stripe Portal).
- **Exit criteria:**
  - New org completes Checkout (test mode) → `subscriptions` row `trialing/active`; replaying the same webhook event is a no-op (idempotency proven).
  - Inviting + accepting a member increments seats and Stripe `quantity`; removing decrements.
  - A `past_due` simulated webhook flips org to read-only handling at the app layer; data still isolated.
  - Dashboard hides modules disabled by the org's `plan_features`.

---

### P2 — CRM (Leads · Customers · Running Bill) + Notifications

- **Goal:** Capture leads, move them through a pipeline, convert to customers; full customer master with the Running-Bill foundation; in-app + email notifications go live.
- **Complexity:** ★★ (Customers well-specified by prototype; Leads/kanban net-new; notification subsystem adds breadth).
- **Dependencies:** P1.
- **Database changes** (from [DATABASE_SCHEMA.md §3.3, §3.9](DATABASE_SCHEMA.md)):
  - `lead_stages` (configurable pipeline lookup), `leads`, `lead_activities`.
  - `customers` (billing/delivery split, `same_as_billing`, `post_sale_discount`), `payments`.
  - `customer_running_bill` view (derived; fully populated once challans exist in P3/P5) — formula in [DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md).
  - **Notifications:** `notification_templates`, `notifications`, `notification_preferences`, `notification_deliveries`.
  - Permission keys `leads.*`, `customers.*` added to catalog + role matrix.
- **Integrations introduced:**
  - **Resend** elevated to the full **notification engine** — `notification_deliveries` queue, Resend send + **webhook reconcile** (delivered/bounced) updating `delivery_status`; templated via `notification_templates`.
  - **PostHog:** lead-stage funnel, conversion-rate events; **WhatsApp** channel stubbed behind `whatsapp.send` plan feature.
- **UI screens:**
  - **Leads list** + **Pipeline (kanban)** by stage; **Lead detail** with activity timeline; **Lead → Customer conversion**.
  - **Customers list** (billed/received/outstanding cards, search, active/inactive filter).
  - **Customer detail** — metrics + tabs (Running Bill, Info).
  - **New/Edit Customer** form (billing vs delivery, "Same as Billing").
  - **Notification center** (in-app bell, unread badge) + **Notification preferences** screen.
- **Exit criteria:**
  - Lead → customer conversion sets `converted_customer_id` and writes an audit + notification.
  - Running Bill view renders correctly (zero challans yet → outstanding = −payments − discount).
  - Assigning a lead fires an in-app notification and a Resend email; bounce webhook flips `delivery_status` to `bounced`.
  - `notification_preferences` opt-out suppresses the email channel.

---

### P3 — Sales & Quotations (production) + Files + PDF/Resend

- **Goal:** Promote the flagship prototype — multi-location quotes with alternates, per-location installation, GST modes, per-area selection, BOQ, revisions — to production, with file storage and data-driven PDF/email/WhatsApp export.
- **Complexity:** ★★★ (nested form, live totals, multiple GST/installation/total modes, revisions, PDF parity).
- **Dependencies:** P2 (customers). Catalogue items optional — quotes accept free-text items until P4.
- **Database changes** (from [DATABASE_SCHEMA.md §3.5, §3.8](DATABASE_SCHEMA.md)):
  - `quotes`, `quote_locations`, `quote_location_installation`, `quote_items`, `quote_item_options`, `quote_terms` (with snapshot fields per [§9](DATABASE_SCHEMA.md)).
  - **Files:** `files` (Storage object metadata: bucket/path/owner/mime/size/checksum/status) — buckets `quote-assets`, `company-logos`.
  - `number_sequences` rows for `quote` (`QT-{YYYY}-{SEQ:4}`).
  - Permission keys `quotes.*` incl. `quotes.revise`.
- **Integrations introduced:**
  - **Supabase Storage** as the file backend; `files` metadata rows + `size_bytes` feeding the `storage_mb` usage metric ([§3.2](DATABASE_SCHEMA.md)).
  - **PDF** generation in `services/pdf` (data-driven, locked columns); **Resend** for "Email quote"; **WhatsApp** share gated by `whatsapp.send`.
  - **`lib/calc`** quote engine: `lineTotal = rate×qty×(1−disc%)`, installation (lumpsum|%|perunit), GST modes (yes/incl/no), totals over **selected** locations only, `total_mode` grand/each/both ([§9](DATABASE_SCHEMA.md)).
- **UI screens:**
  - **Quote list** (filters, status).
  - **Quote builder** — locations → line items → alternates, per-location installation, GST/total modes, per-area selection, terms; **live totals** panel.
  - **Preview** + **BOQ summary**; **revisions** chain; **export menu** (Print / PDF / Email / WhatsApp).
- **Exit criteria:**
  - A quote with 2 locations (one deselected), alternates, and `incl` GST renders identical totals in live preview and PDF, computed only over selected areas.
  - Revision creates a new `revision` row preserving the chain via `parent_quote_id`.
  - Uploaded quote asset creates a `files` row and increments `storage_mb` usage; download URL is org-scoped.
  - `quotes.revise` permission gates the revise action server-side.

---

### P4 — Inventory · Purchase Orders · Suppliers + Approvals Engine

- **Goal:** Full item catalogue with import landed-cost, supplier master, PO → goods-receipt → stock-in flow, and the **generic approval engine** driving PO approval (reused later for discount/expense/payroll).
- **Complexity:** ★★★ (import calculator, variations-as-items, stock-movement integrity, PO/GRN cycle, generic approval engine).
- **Dependencies:** P1 (can run parallel to P2/P3). P3 benefits from real items in quotes.
- **Database changes** (from [DATABASE_SCHEMA.md §3.4, §3.10](DATABASE_SCHEMA.md)):
  - Lookups `item_families`, `brands`, `units`, `suppliers`.
  - `items` (self-ref variants + import fields), `item_variations`, `stock_adjustments` (immutable, `stock.adjust`-gated), `stock_movements`.
  - `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items` — **GRN posting writes `stock_movements (in)` and updates `items.stock`, `last_purchase_price/date/supplier`**.
  - **Approvals (generic):** `approval_workflows`, `approval_steps`, `approval_requests`, `approval_actions`.
  - `number_sequences` for `purchase_order`/`goods_receipt`; permission keys `items.*`, `suppliers.*`, `purchase_orders.*`, `goods_receipt.post`, `stock.adjust`, `approvals.*`.
- **Integrations introduced:**
  - **`lib/calc`** import landed-cost: `base = import_price × exchange_rate → ×(1−disc%) → +transport(lumpsum|%) → ×(1+duty%) = purchase_price → ×profit_multiplier = selling_price` ([§9](DATABASE_SCHEMA.md)).
  - **PostHog:** catalogue-size and low-stock dashboards; **Approvals** emit notification (P2 subsystem) on each pending step.
- **UI screens:**
  - **Item catalogue** (card grid, search via `pg_trgm`, domestic/imported filter, low-stock flag).
  - **Item detail** (last purchase, stock, sales history, import breakdown); **New/Edit Item** + **Import landed-cost calculator**; **Variation builder** (spawns variant items).
  - **Stock adjustment dialog** (mandatory reason, `stock.adjust`-gated, audited).
  - **Suppliers** list/detail/form; **Purchase Orders** list + **PO builder**; **Goods Receipt** screen.
  - **Approvals inbox** (generic pending queue) + **Workflow definition** admin screen.
- **Exit criteria:**
  - Import item: entering currency/discount/transport/duty/multiplier yields a `purchase_price`/`selling_price` matching the `lib/calc` unit test fixtures.
  - Posting a GRN increments `items.stock`, writes an `in` `stock_movement`, and updates `last_purchase_*`; re-posting is blocked.
  - A PO over the workflow `min_amount` creates an `approval_request`; approving it advances `current_step` and logs `approval_actions`; rejection blocks send.
  - Stock adjustment without a reason is rejected (server + DB constraint).

---

### P5 — Accounting · Invoices/GST · Payments · Expenses

- **Goal:** Close order-to-cash and procure-to-pay — Sales Orders, Delivery Challans (stock-out), GST tax invoices, payment allocation, expenses with approvals.
- **Complexity:** ★★★★ (GST CGST/SGST/IGST + HSN, payment↔invoice M:N allocation, expense approvals, challan stock integrity).
- **Dependencies:** P2 (customers/payments), P3 (quotes), P4 (items + approval engine).
- **Database changes** (from [DATABASE_SCHEMA.md §3.5–3.6](DATABASE_SCHEMA.md)):
  - `sales_orders`, `sales_order_items`, `delivery_challans`, `delivery_challan_items` — **challan posting decrements stock + writes `stock_movements (out)`**; `delivery_challan_items.value` persists `qty×rate`.
  - `invoices` (place_of_supply → intra/inter-state split, `taxable_value/cgst/sgst/igst/total`), `invoice_items` (`hsn_code`, snapshot fields).
  - `payment_allocations` (payment ↔ invoice M:N); `expenses` (with `receipt_file_id` → `files`), `expense_approvals`, `budgets`.
  - `number_sequences` for `sales_order`/`challan`/`invoice`/`payment`; state-transition guards (invoice `issue`, challan `post`) per [PERMISSIONS.md §7](PERMISSIONS.md).
  - Permission keys `sales_orders.*`, `delivery_challans.*` incl. `delivery_challan.post`, `invoices.*` incl. `invoices.issue`, `payments.*`, `expenses.*`, `discount.approve`, `finance.view`.
- **Integrations introduced:**
  - **Approvals engine** (P4) reused for **discount approval** and **expense approval** (`approval_entity_type` `discount`/`expense`).
  - **`lib/calc`** GST split + Running Bill (`Σ challan_item.value − post_sale_discount − Σ payments`).
  - **Resend/PDF:** invoice PDF + email; **PostHog:** revenue + receivables events.
- **UI screens:**
  - **Sales Orders** (from accepted quote); **Delivery Challans** (create/post).
  - **Invoices** list / **invoice builder** (GST, HSN) / issue / PDF; optional credit/debit notes.
  - **Payments** — record receipt, **allocate to invoices** (`payment_allocations`), void/reverse.
  - **Running Bill / Receivables** (now fully populated); **Expenses** submit + approval queue; **Budgets**; **Finance dashboard** (P&L summary, cash position).
- **Exit criteria:**
  - Posting a challan decrements stock + writes an `out` movement; the Running Bill outstanding updates correctly.
  - An invoice with `place_of_supply` ≠ org state produces IGST only; intra-state produces CGST+SGST; totals match `lib/calc`.
  - A payment allocates across two invoices via `payment_allocations`; over-allocation is rejected.
  - A discount above the role's `approval_limits` routes through the approval engine before applying.
  - `invoices.issue` transitions `draft → issued` only with permission and a valid number from `number_sequences`.

---

### P6 — HR · Attendance · Payroll

- **Goal:** Employee lifecycle, attendance capture, leave, appraisals, and payroll processing with sign-off.
- **Complexity:** ★★★ (payroll math, attendance rules, salary-data sensitivity, HR/Accountant boundary, India statutory PF/ESI/TDS).
- **Dependencies:** P1 (users/roles), P4 (approval engine for payroll sign-off), P5 (financial-record discipline; payroll posting links to accounting).
- **Database changes** (from [DATABASE_SCHEMA.md §3.7](DATABASE_SCHEMA.md)):
  - `employees` (sensitive `ctc`/`salary`/bank fields), `attendance` (one row/day unique), `shifts`, `leave_requests`, `leave_balances`, `appraisals`, `payroll_runs`, `payroll_lines` (earnings/deductions jsonb).
  - Permission keys `hr.*`, `leave.approve`, `payroll.view` (HR) / `payroll.manage` (Accountant) — sign-off routed via the approval engine (`approval_entity_type = payroll_run`).
  - RLS tightened on salary fields ([PERMISSIONS.md §6.3, §8](PERMISSIONS.md)); audit on all payroll mutations.
- **Integrations introduced:**
  - **`lib/calc`** payroll engine (gross → earnings/deductions → net; statutory components configurable).
  - **Approvals engine** for payroll sign-off; **Resend** payslip email; **PostHog:** headcount/attrition events.
- **UI screens:**
  - **Employees** list/detail/form + onboarding checklist.
  - **Attendance** — daily/calendar view, mark/import, regularisation.
  - **Leave** — apply, approval queue, balances.
  - **Appraisals** — cycle, ratings, reviewer flow.
  - **Payroll** — run wizard (period → compute → review → **approve via sign-off** → finalise), payslip view/PDF.
- **Exit criteria:**
  - An Employee without `payroll.view` cannot read salary fields (RLS proven).
  - A payroll run computes per-employee `payroll_lines` matching `lib/calc` fixtures; finalisation requires approval sign-off.
  - Attendance enforces one row per employee/day; leave approval decrements `leave_balances`.

---

### P7 — Reports + Analytics (Materialized Views · Schedules · PostHog)

- **Goal:** Turn operational data into decisions — standard reports, scheduled delivery, and cross-module analytics dashboards.
- **Complexity:** ★★★ (report rendering moderate; performant MVs + concurrent refresh raise it).
- **Dependencies:** P2–P6 (data to report on). Stock Reports can preview from P4 data.
- **Database changes** (from [DATABASE_SCHEMA.md §3.11](DATABASE_SCHEMA.md)):
  - Materialized views `mv_sales_summary`, `mv_inventory_valuation`, `mv_receivables_ageing`, `mv_hr_headcount`, each with a **unique index** (required for `REFRESH ... CONCURRENTLY`) and exposed only via **security-barrier views** (`v_*` filtered by `app.is_member(org_id)` — MVs can't host RLS, [§8.4](DATABASE_SCHEMA.md)).
  - `saved_reports`, `report_schedules`; reporting indexes.
  - Permission keys `reports.*`, `analytics.view` (the latter gated by `module.analytics` plan feature).
- **Integrations introduced:**
  - **Supabase cron / Edge Functions** to `REFRESH MATERIALIZED VIEW CONCURRENTLY` per the freshness SLA (e.g. nightly valuation, hourly ageing) and to run `report_schedules`.
  - **Resend** for scheduled report delivery (`report_schedules.recipients`); **PostHog dashboards** for product analytics; **CSV/XLSX/PDF** export (`report_format`).
- **UI screens:**
  - **Stock Reports** (hierarchical family→variation→brand, date range, stock value, sales movement; export — the 5th prototype, production-grade).
  - **Sales reports** (customer/item/period), **Receivables ageing**, **GST reports**, **Inventory valuation**, **HR reports** (headcount/leave/attrition).
  - **Analytics dashboards** (revenue trend, top items/customers, margins) with date-range + drill-down; **saved reports** + **schedule** management.
- **Exit criteria:**
  - Each MV refreshes concurrently on schedule; querying `v_*` from org A never leaks org-B aggregates.
  - A saved report scheduled weekly delivers a PDF via Resend to the listed recipients.
  - `module.analytics`-disabled orgs see an upgrade prompt instead of dashboards.
  - Stock Report hierarchy + date-range filtering + export match the prototype spec.

---

### P8 — Hardening · Performance · Security Review · Launch

- **Goal:** Make it production-ready and commercially launchable.
- **Complexity:** ★★★ (breadth — touches every prior phase).
- **Dependencies:** P0–P7.
- **Database changes:** index review against real query plans; partial-index audit (`WHERE deleted_at IS NULL`); FK-index completeness check; MV refresh tuning; `usage_records` retention/aggregation.
- **Integrations introduced (hardened):**
  - **Sentry:** performance budgets, release health, alerting; **PostHog:** funnel/retention dashboards, feature-flag rollouts.
  - **Stripe:** dunning (`invoice.payment_failed` retries), proration on plan change, tax (Stripe Tax) decision, billing-portal polish.
  - **Resend:** domain auth (SPF/DKIM/DMARC), suppression handling.
- **UI screens / deliverables:**
  - **Public pricing page** (plan tiers), marketing-to-Checkout funnel.
  - **Onboarding polish** (empty states, sample data, guided tour via PostHog).
  - **Help/Docs**, status page, **legal** (ToS/Privacy/DPA), support workflow.
- **Exit criteria:**
  - **Security review** passed (see launch checklist §5): no RLS gaps, no service-role leakage to client, secrets in env, dependency audit clean.
  - **Load/perf:** key list pages p95 < target with realistic multi-tenant data volume; MV refresh within SLA.
  - **Billing E2E:** signup → trial → paid → upgrade → downgrade → cancel → resubscribe all correct, idempotent, and dunning verified.
  - DR: backup/restore rehearsed; runbooks for webhook replay and MV rebuild exist.

---

## 4. Cross-Cutting Workstreams (every phase)

Applied to **every** phase's new tables and screens. (Extends [ROADMAP.md §7](ROADMAP.md) with billing-gating + observability.)

| Stream | Activity per phase |
|--------|--------------------|
| **Security / RLS** | New table ships `ENABLE` + `FORCE ROW LEVEL SECURITY`, default-deny, policies built on `app.is_member` / `app.has_permission` / `app.is_org_owner` / `app.is_super_admin`. `scripts/check-rls.ts` CI gate. Cross-org isolation test per phase. |
| **Permissions** | New keys added to the catalog ([PERMISSIONS.md §2](PERMISSIONS.md)) + role-grant matrix; UI gated via `permission-gate`; server actions re-check (defense in depth). |
| **Validation** | One Zod schema per entity in `validations/`, shared by RHF and the server action ([ARCHITECTURE.md §10](ARCHITECTURE.md)). |
| **Testing** | Unit tests for `lib/calc` (import-cost, quote-totals, running-bill, GST split, payroll); integration test per server action; e2e for the phase's headline flow; one RLS isolation test. |
| **Audit** | Sensitive mutations (stock, pricing, discounts, payments, invoices, payroll, roles, billing) write `audit_logs` via `fn_audit`. |
| **Observability** | New flows emit PostHog events (named per a convention) and are wrapped for Sentry capture with `org_id`/`user_id` tags; performance-critical actions get a span. |
| **Billing-gating** | New module/feature checks `plan_features` (module access + usage caps) in `lib/billing`, mirrored to a PostHog flag; metered actions write `usage_records`; hard caps re-checked against `usage_records`. |
| **PDF / Comms** | Documents are data-driven (locked columns) via `services/pdf`; outbound through the notification subsystem (`notification_deliveries` → Resend/WhatsApp). |

---

## 5. Definition of Done & Launch Checklist

### 5.1 Definition of Done — a SaaS module
A module is "done" only when **all** hold:
- [ ] Tables match [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) exactly (names, types, FKs, envelope, soft-delete flags).
- [ ] RLS `ENABLE` + `FORCE`, default-deny, policies on the four `app.*` helpers; cross-org isolation test passes.
- [ ] Permission keys in catalog + role matrix; UI `permission-gate` + server-side re-check.
- [ ] Plan entitlement enforced (`plan_features`) in `lib/billing`; metered usage written to `usage_records` where applicable.
- [ ] Zod schema shared by form + server action; server action is the only write path.
- [ ] `lib/calc` (if monetary) has unit tests; integration test on the action; e2e on the headline flow.
- [ ] Sensitive mutations audited via `fn_audit`.
- [ ] Sentry-wrapped (tagged, PII-scrubbed) + PostHog events emitted.
- [ ] Documents data-driven; comms via `notification_deliveries`/Resend; files via `files` + Storage (never base64).
- [ ] Snapshot fields persisted on document line items per [§9](DATABASE_SCHEMA.md).
- [ ] Soft-delete honored; partial unique indexes `WHERE deleted_at IS NULL`.

### 5.2 Launch checklist (P8 gate)
- [ ] **Security review** complete: no RLS gaps (`check-rls.ts` green), no service-role key reachable from the client, all webhook endpoints verify signatures, secrets only in env, `npm audit`/Snyk clean, headers (CSP/HSTS) set.
- [ ] **Tenancy:** isolation tests across all domains green; org switcher + seat sync correct.
- [ ] **Billing:** full lifecycle (trial → paid → upgrade/downgrade → cancel → resubscribe) verified in Stripe test mode; webhook idempotency via `stripe_events`; dunning + proration confirmed; pricing page → Checkout funnel live.
- [ ] **Observability:** Sentry releases + alerts configured; PostHog funnels/flags live; error and perf budgets set.
- [ ] **Comms/Files:** Resend domain authenticated (SPF/DKIM/DMARC); Storage buckets RLS-scoped; `storage_mb` metering accurate.
- [ ] **Performance:** p95 targets met on list pages with realistic volume; MVs refresh within SLA via Supabase cron.
- [ ] **Data:** backup/restore rehearsed; migration ordering documented; soft-delete + audit verified.
- [ ] **Compliance/Docs:** ToS/Privacy/DPA published; onboarding + help docs; support + runbooks (webhook replay, MV rebuild).

---

## 6. Risks & Open Decisions

Carried from [ROADMAP.md §8](ROADMAP.md), [DATABASE_SCHEMA.md §10](DATABASE_SCHEMA.md), [PERMISSIONS.md §8](PERMISSIONS.md), tagged with the gating phase.

| # | Decision / Risk | Gates | Notes |
|---|-----------------|-------|-------|
| 1 | **GST scope** — full CGST/SGST/IGST + HSN + GSTR exports vs simplified single-GST for v1 | **P5** | Schema supports full ([§3.6](DATABASE_SCHEMA.md)); confirm export depth. |
| 2 | **Accounting depth** — document-level only vs full double-entry (`ledger_entries`/`journals` + `tax_rates`/HSN master) | **P5** | Drives schema size significantly; not in current schema — would be additive. |
| 3 | **Plan tiers & pricing** — `free/starter/growth/enterprise`, seat-based vs flat, trial length, which `plan_features` cap which metric | **P1** (blocks Checkout) | Sets `plans`/`plan_features` seed; pricing page in P8. |
| 4 | **Seat definition** — do invited-but-unaccepted `invitations` count toward billed seats? | **P1** | Affects `subscriptions.quantity` sync. |
| 5 | **Plan-limit enforcement** — hard-block at server (`usage_records`) vs soft (Stripe metered overage) per metric | **P1/P7** | Decide per `usage_metric`. |
| 6 | **Approvals: legacy vs generic** — retire `expense_approvals` in favor of the generic engine? | **P4/P5** | Both retained for compatibility ([§3.6/§3.10](DATABASE_SCHEMA.md)). |
| 7 | **Lead pipeline** — configurable `lead_stages` lookup vs fixed `lead_status` enum as primary | **P2** | Both present; pick primary. |
| 8 | **WhatsApp provider** — Twilio / Wati / Interakt; gated by `whatsapp.send` plan feature | **P2/P3** | Affects `notification_deliveries.provider`. |
| 9 | **Attendance source** — manual entry vs biometric/import integration | **P6** | Affects scope and `attendance` ingestion. |
| 10 | **Payroll statutory** — PF/ESI/TDS computed in-app vs export to provider | **P6** | `payroll_lines.deductions` jsonb supports either. |
| 11 | **MV refresh cadence / freshness SLA** per MV | **P7** | Supabase cron interval (nightly valuation, hourly ageing, …). |
| 12 | **Stripe Tax** — use Stripe Tax for subscription invoices vs flat pricing | **P1/P8** | Indian GST on the SaaS subscription itself (distinct from customer GST invoices). |
| 13 | **Data residency** — Supabase region (India vs other); affects compliance posture and latency | **P0** (region is set at project creation) | Decide before P0 provisioning; hard to change later. |
| 14 | **Multi-org launch** — onboard multiple orgs at v1 vs single pilot org | **P8** | Schema is multi-tenant-ready ([§8](DATABASE_SCHEMA.md)). |
| 15 | **Numbering masks** — exact `number_sequences.mask` + reset cadence per `doc_type` | **P1/P5** | Confirm yearly vs monthly reset. |

---

*End of DEVELOPMENT_ROADMAP.md — production SaaS planning artifact. All table/column references trace to [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); RLS helpers to [PERMISSIONS.md](PERMISSIONS.md); folder structure to [ARCHITECTURE.md](ARCHITECTURE.md). Resolve the phase-gating decisions in §6 before authoring each phase's migrations.*
