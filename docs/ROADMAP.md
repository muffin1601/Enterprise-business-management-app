# Watcon Business Management System — Development Roadmap

> **Status:** Phased delivery plan
> **Date:** 2026-05-29
> **Companions:** `PROJECT_PLAN.md`, `DATABASE_DESIGN.md`, `PERMISSIONS.md`, `ARCHITECTURE.md`
> **Sequencing:** 6 functional phases on top of a Phase 0 foundation.

---

## 0. Reconciliation & Notes

This roadmap **supersedes the phase ordering** in `PROJECT_PLAN.md §11` with the 6-phase breakdown requested. Two things to note:

1. **New entities introduced here** (not yet in `DATABASE_DESIGN.md`): **Leads** + lead pipeline (Phase 2), **Purchase Orders** + goods receipt (Phase 3), **Attendance** + shifts (Phase 4), **Analytics** materialized views (Phase 6). These are additive — the existing schema is unchanged; each phase's "Database changes" lists the new objects.
2. **The prototyped Sales modules** (Quotes → Sales Orders → Delivery Challans → Running Bill) are **not named in the 6 phases** but are real, already-built capabilities. They are slotted as follows and flagged for confirmation (§8): **Quotes** with Phase 2 (needs Customers), **Sales Orders / Challans / Running Bill** with Phase 5 (feed invoices & receivables). A **Phase 2.5 "Sales & Quotations"** bridge is recommended.

### Phase summary

| Phase | Theme | Complexity | Est. effort* | Hard dependency |
|-------|-------|-----------|-------------|-----------------|
| **0** | Foundation (auth infra, DB, RBAC, shell) | High | 2–3 wk | — |
| **1** | Authentication · Company Setup · Dashboard | Medium | 1.5–2 wk | Phase 0 |
| **2** | CRM · Leads · Customers | Medium | 2–3 wk | Phase 1 |
| **2.5** | *(recommended)* Sales & Quotations | High | 2–3 wk | Phase 2 |
| **3** | Inventory · Purchase Orders · Suppliers | High | 3–4 wk | Phase 1 (Phase 2 for customer links) |
| **4** | HR · Attendance · Payroll | High | 3–4 wk | Phase 1 |
| **5** | Accounting · Invoices · Expenses | Very High | 4–5 wk | Phases 2, 3 (+2.5) |
| **6** | Reports · Analytics | Medium–High | 2–3 wk | Phases 2–5 |

*\*Indicative for a small team; refine after Phase 0.*

```
Phase 0 ──► Phase 1 ──┬─► Phase 2 ──► Phase 2.5 ──┐
                      ├─► Phase 3 ────────────────┼─► Phase 5 ──► Phase 6
                      └─► Phase 4 ────────────────┘
```

---

## Phase 0 — Foundation *(prerequisite)*

**Goal:** Stand up the skeleton everything else plugs into. Not in the requested list but required before Phase 1 delivers value.

- **Estimated complexity:** **High** — touches every cross-cutting concern; mistakes here are expensive later.
- **Dependencies:** None.
- **Database changes:**
  - Extensions (`pgcrypto`, `pg_trgm`), `app` schema.
  - All `pgEnum` types (`DATABASE_DESIGN.md §5`).
  - Identity/access tables: `organizations`, `users`, `memberships`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`.
  - RLS helper functions (`app.has_permission`, `is_member`, `is_org_owner`, `is_super_admin`) + base policies + default-deny.
  - Generic triggers: `fn_set_updated_at`, `fn_audit`.
  - Seed: permission catalog + 6 system roles + role grants (`PERMISSIONS.md §6.5`).
- **UI screens:** App shell (sidebar/topbar/content), theme/design tokens (Japanese-minimal monochrome), providers, error/loading boundaries, `permission-gate` component. No business screens yet.

---

## Phase 1 — Authentication · Company Setup · Dashboard

**Goal:** A user can log in, the company is configured, and a role-aware dashboard greets them.

- **Estimated complexity:** **Medium.** Auth and dashboard are well-trodden; Company Setup (numbering, tax config) carries a little hidden complexity.
- **Dependencies:** Phase 0 (identity tables, RBAC, shell).
- **Database changes:**
  - `organization_settings` (or extend `organizations`): logo URL, GSTIN/PAN, address, default currency, financial-year start, theme.
  - `number_sequences` — masks + counters for `ref_no` / `so_no` / `challan_no` / `invoice_no` (per-org, yearly reset) → backs `services/numbering`.
  - `settings.approval_limits` (discount/expense ceilings — `PERMISSIONS.md §8`).
  - First-user-as-Company-Owner bootstrap.
- **UI screens:**
  - **Login** (Supabase Auth; ID/email + password, reset flow).
  - **Onboarding / Company Setup wizard** — company profile, logo upload, tax & numbering config, invite first users.
  - **Dashboard** — time-of-day greeting, KPI cards (quote value, outstanding receivables, pending items), activity feed, module status, role-gated sections (`PROJECT_PLAN.md §M1`).
  - **User menu / org switcher**; **Admin → Users & Roles** (basic invite + role assign).

---

## Phase 2 — CRM · Leads · Customers

**Goal:** Capture leads, move them through a pipeline, convert to customers; full customer master with the Running-Bill foundation.

- **Estimated complexity:** **Medium.** Customers are well-specified by the prototype; **Leads/pipeline are net-new** and add kanban/stage logic.
- **Dependencies:** Phase 1 (auth, company, dashboard).
- **Database changes:**
  - **NEW** `leads` — `org_id, name, company, contact, phone, email, source, stage, owner_id (assigned), estimated_value, status, converted_customer_id, notes`.
  - **NEW** `lead_stages` (configurable pipeline) and/or `lead_status` enum (`new, contacted, qualified, proposal, won, lost`).
  - **NEW** `lead_activities` — `lead_id, type (call/email/meeting/note), body, due_at, done, actor_id`.
  - `customers` table (full spec from `DATABASE_DESIGN.md §7.3` — billing/delivery split, GSTIN/PAN, `post_sale_discount`).
  - `payments` table (so Running Bill can be assembled).
  - `customer_running_bill` view.
  - RLS policies + audit for the above; permission keys `customers.*`, plus **NEW** `leads.*` (add to catalog & matrix).
- **UI screens:**
  - **Leads list** + **Pipeline (kanban)** by stage; **Lead detail** with activity timeline; **Lead → Customer conversion**.
  - **Customers list** (cards: billed/received/outstanding; search; active/inactive filter).
  - **Customer detail** — metrics, tabs (Running Bill, Info), linked-module quick actions.
  - **New/Edit Customer** form (billing vs delivery, "Same as Billing").
  - **Running Bill** ledger view (derived; will populate fully once challans exist in Phase 2.5/5).

---

## Phase 2.5 — Sales & Quotations *(recommended bridge)*

**Goal:** The flagship prototyped capability — multi-location quotes — needs Customers (Phase 2) and feeds Accounting (Phase 5).

- **Estimated complexity:** **High.** Nested form (locations → items → options), live totals, GST/installation/per-area modes, data-driven PDF/BOQ.
- **Dependencies:** Phase 2 (customers), Phase 3 partial (catalogue items — quotes can use free-text items if Phase 3 not done).
- **Database changes:** `quotes`, `quote_locations`, `quote_location_installation`, `quote_items`, `quote_item_options`, `quote_terms` (`DATABASE_DESIGN.md §7.4`); `quote.*` permissions.
- **UI screens:** Quote list; **Quote builder** (locations, line items, alternates, installation, GST modes, per-area selection, total-display modes, terms); preview; **BOQ summary**; revisions; export menu (Print/PDF/Email/WhatsApp).

> If the 6-phase scope is firm, fold this into the **tail of Phase 2** (quotes as a CRM output) or the **head of Phase 5** (quotes as the start of order-to-cash). Decision in §8.

---

## Phase 3 — Inventory · Purchase Orders · Suppliers

**Goal:** Full item catalogue with import costing, supplier master, and purchase-order → goods-receipt → stock-in flow.

- **Estimated complexity:** **High.** Import landed-cost calculator, variations-as-items, stock movement integrity, and the PO/GRN cycle are all substantial.
- **Dependencies:** Phase 1. (Phase 2 optional — supplier-as-customer links, customer in stock movements.)
- **Database changes:**
  - Lookups: `item_families`, `brands`, `units`, `suppliers` (`DATABASE_DESIGN.md §7.2`).
  - `items` (self-referential variants, import fields), `item_variations`, `stock_adjustments` (immutable, `stock.adjust`-gated), `stock_movements`.
  - **NEW** `purchase_orders` — `org_id, po_no, supplier_id, date, status (draft/sent/partially_received/received/cancelled), currency, subtotal, notes`.
  - **NEW** `purchase_order_items` — `po_id, item_id, name, qty, unit, rate, discount_pct`.
  - **NEW** `goods_receipts` + `goods_receipt_items` — receiving against a PO; **posting writes `stock_movements` (in) and updates `items.stock`, `last_purchase_price/date/supplier`**.
  - **NEW** enums `purchase_order_status`; permission keys **NEW** `purchase_orders.*`, `suppliers.*`, `goods_receipt.post`.
  - Triggers to keep `items.stock` consistent; `stock_value` view.
- **UI screens:**
  - **Item catalogue** (card grid, search, domestic/imported filter, low-stock flag).
  - **Item detail** (last purchase, stock, sales history, import breakdown).
  - **New/Edit Item** + **Import landed-cost calculator** (currency → discount → transport → duty → multiplier).
  - **Variation builder** (spawns variant items).
  - **Stock adjustment dialog** (admin/manager, mandatory reason, log).
  - **Suppliers list / detail / form.**
  - **Purchase Orders** list + **PO builder**; **Goods Receipt** (receive against PO) screen.

---

## Phase 4 — HR · Attendance · Payroll

**Goal:** Employee lifecycle, attendance capture, and payroll processing.

- **Estimated complexity:** **High.** Payroll math, attendance rules, and the HR/Accountant boundary (`PERMISSIONS.md §8`) add real complexity; statutory rules (PF/ESI/TDS) are India-specific.
- **Dependencies:** Phase 1 (users/roles). Payroll *processing* links to Phase 5 (Accounting), but HR can ship independently.
- **Database changes:**
  - `employees` — `org_id, user_id?, code, name, department, designation, doj, ctc/salary, bank details, status`.
  - **NEW** `attendance` — `employee_id, date, status (present/absent/half/leave/holiday), check_in, check_out, hours`.
  - **NEW** `shifts` / `work_calendars` (optional) — shift definitions, weekly-offs, holidays.
  - `leave_requests` (`leave_status`), `leave_balances`, `appraisals`.
  - `payroll_runs` + **NEW** `payroll_lines` (per-employee earnings/deductions/net), statutory components.
  - Permission keys `hr.*`, `leave.approve`, `payroll.view` (HR) / `payroll.manage` (Accountant); RLS + audit (salary data sensitivity).
- **UI screens:**
  - **Employees** list / detail / form; **Onboarding** checklist.
  - **Attendance** — daily/calendar view, mark/import attendance, regularisation.
  - **Leave** — apply, approval queue, balances.
  - **Appraisals** — cycle, ratings, reviewer flow.
  - **Payroll** — run wizard (period → compute → review → finalise), payslip view/PDF.

---

## Phase 5 — Accounting · Invoices · Expenses

**Goal:** Close the order-to-cash and procure-to-pay loops — tax invoices, payments/receivables, expenses, and the financial backbone.

- **Estimated complexity:** **Very High.** GST tax invoicing (CGST/SGST/IGST, HSN), payment allocation, expense approvals, and tying challans/POs into ledgers is the most intricate phase.
- **Dependencies:** Phase 2 (customers/payments), Phase 3 (items/POs), Phase 2.5 (quotes/SO/challans feeding invoices).
- **Database changes:**
  - **Sales docs** (if not done in 2.5): `sales_orders`, `sales_order_items`, `delivery_challans`, `delivery_challan_items` (challan **posting decrements stock** + `stock_movements` out).
  - `invoices`, `invoice_items` (GST split, HSN — `DATABASE_DESIGN.md §7.5`), `payment_allocations` (payment ↔ invoice M:N).
  - `expenses` (`expense_status`), `expense_approvals`, `budgets`.
  - **NEW (optional)** `ledger_entries` / `journal` for double-entry if full accounting is required; **NEW** `tax_rates` / HSN master.
  - Views: receivables ageing, P&L inputs; permission keys `invoices.*`, `payments.*`, `expenses.*`, `finance.*`, `discount.approve`.
  - State-transition guards (invoice `issue`, challan `post`) at the server layer (`PERMISSIONS.md §7`).
- **UI screens:**
  - **Sales Orders** (from accepted quote); **Delivery Challans** (create/post).
  - **Invoices** list / **invoice builder** (GST, HSN) / issue / PDF; **credit/debit notes** (optional).
  - **Payments** — record receipt, **allocate to invoices**, void/reverse.
  - **Running Bill / Receivables** (now fully populated).
  - **Expenses** — submit, approval queue; **Budgets** screen.
  - **Finance dashboard** — P&L summary, cash position.

---

## Phase 6 — Reports · Analytics

**Goal:** Turn operational data into decisions — standard reports plus cross-module analytics dashboards.

- **Estimated complexity:** **Medium–High.** Report rendering is moderate; performant analytics over large datasets (materialized views, aggregation) raises it.
- **Dependencies:** Phases 2–5 (data to report on). Some reports (Stock) can ship with Phase 3.
- **Database changes:**
  - **NEW** materialized views: `mv_sales_summary`, `mv_inventory_valuation`, `mv_receivables_ageing`, `mv_hr_headcount`, refreshed on schedule (Supabase cron / Edge Function).
  - Reporting indexes; optional `report_definitions` / `saved_reports` table for user-saved filters.
  - `reports.*` permission keys (already in `PERMISSIONS.md §2`).
- **UI screens:**
  - **Stock Reports** (hierarchical family→variation→brand, date range, stock value, sales movement; export) — *may land in Phase 3.*
  - **Sales reports** (by customer/item/period), **Receivables ageing**, **GST reports**.
  - **Inventory valuation** report.
  - **HR reports** (headcount, leave, attendance, attrition).
  - **Analytics dashboards** — charts (revenue trend, top items/customers, margins), date-range and drill-down; **export** (PDF/CSV).

---

## 7. Cross-Cutting Workstreams (every phase)

| Stream | Activity |
|--------|----------|
| **Security** | New tables ship with RLS enabled + policies; `scripts/check-rls.ts` gate in CI. |
| **Permissions** | New permission keys added to catalog (`PERMISSIONS.md §2`) and the role-grant matrix; UI gating via `permission-gate`. |
| **Validation** | One Zod schema per entity in `validations/`, shared by RHF + server actions. |
| **Testing** | Unit tests for `lib/calc` (import-cost, quote-totals, running-bill, payroll); integration tests per server action; e2e for the phase's headline flow. |
| **Audit** | Sensitive mutations (stock, pricing, discounts, payments, payroll, roles) write `audit_logs`. |
| **PDF/Comms** | Documents are data-driven (locked columns); export via `services/pdf` + `email`/`whatsapp`. |

---

## 8. Open Decisions
1. **Sales & Quotations placement** — confirm Phase 2.5 (recommended) vs folding into Phase 2 tail or Phase 5 head.
2. **Depth of accounting (Phase 5)** — document-level only, or full double-entry `ledger_entries`? Drives schema size significantly.
3. **GST compliance scope** — full CGST/SGST/IGST + HSN + GSTR exports, or simplified single-GST quotes/invoices for v1.
4. **Attendance source** — manual entry vs biometric/import integration (affects Phase 4 scope).
5. **Payroll statutory** — PF/ESI/TDS computation in-app vs export to a payroll provider.
6. **Leads source integrations** — web-form/WhatsApp/import capture in Phase 2, or manual-only initially.
7. **Phase parallelism** — Phases 3 and 4 are independent of Phase 2 and can run in parallel with a second track if staffing allows (see dependency graph §0).

---

*End of ROADMAP.md — planning artifact. New entities flagged per phase are additive to `DATABASE_DESIGN.md`; confirm §8 decisions before authoring Phase 1 migrations.*
