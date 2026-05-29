# Watcon SaaS — MVP Implementation Plan

> **Status:** Build order & per-module work breakdown (no application code yet)
> **Date:** 2026-05-29
> **Source of truth:** [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [API_DESIGN.md](API_DESIGN.md) · [RLS_POLICIES.md](RLS_POLICIES.md) · [PERMISSIONS.md](PERMISSIONS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [AUDIT_LOGS.md](AUDIT_LOGS.md)
> **Paths** follow the feature-sliced layout in `ARCHITECTURE.md` (`features/<m>/{components,hooks,server,api}`, `validations/`, `lib/`, `app/`).

---

## 1. MVP Scope

**In scope (the 10 prioritised modules):** Authentication → Company → Users → Items → Customers → Quotes → Inventory → Purchase Orders → Sales Orders → Reports. This delivers the complete **catalogue → quote → order → fulfilment → receivables → reporting** loop for a single trading company, multi-tenant-ready.

**Deferred to post-MVP** (designed, not built now): Stripe **billing/subscriptions**, **HR/Attendance/Payroll**, full **GST tax-invoicing & double-entry accounting**, **Leads/CRM pipeline**, the **generic approval engine**, **notifications**, and **analytics/materialized views**. The schema and RLS for these already exist in the architecture docs; MVP simply doesn't surface them. Tenancy, RBAC, audit, Sentry, and PostHog are **not** deferred — they are foundational (Module 0).

### 1.1 Build-order rationale (dependency graph)
```
0 Foundation ─► 1 Auth ─► 2 Company ─► 3 Users ─┐
                                                 ▼
                          4 Items ──────────────┬──► 6 Quotes ──► 9 Sales Orders ──► 10 Reports
                            │                    │        ▲             ▲                 ▲
                            ├──► 7 Inventory ────┤        │             │                 │
                            └──► 8 Purchase Ord ─┘   5 Customers ───────┴─────────────────┘
```
- **Items (4)** is the keystone — Quotes, Inventory, POs, and SOs all reference it. Build it before anything that lists products.
- **Customers (5)** is required by Quotes and Sales Orders.
- **Quotes (6)** feeds **Sales Orders (9)**; SO challans drive **Inventory (7)** stock-out and the Running Bill.
- **Reports (10)** consumes data from all prior modules — built last.

### 1.2 Effort summary

| # | Module | Complexity | Effort (dev-days) | Cumulative |
|---|--------|-----------|:-----:|:-----:|
| 0 | Foundation & Observability | High | 6 | 6 |
| 1 | Authentication | Medium | 4 | 10 |
| 2 | Company Management | Medium | 5 | 15 |
| 3 | User Management | Medium | 6 | 21 |
| 4 | Item Management | High | 8 | 29 |
| 5 | Customer Management | Medium | 6 | 35 |
| 6 | Quote Management | **Very High** | 12 | 47 |
| 7 | Inventory | Medium | 6 | 53 |
| 8 | Purchase Orders | High | 8 | 61 |
| 9 | Sales Orders | High | 8 | 69 |
| 10 | Reports | Medium–High | 7 | 76 |

**≈ 76 dev-days.** Solo ≈ 15–16 weeks. A 2–3 dev team can parallelise the independent branches (Items/Inventory/PO vs Customers vs Users) to ≈ **7–9 weeks**. Estimates assume each module ships production-ready (RLS + audit + tests, see §13).

---

## Module 0 — Foundation & Observability *(prerequisite)*

Not one of the 10, but nothing ships without it.

- **Database tables:** `extensions` (pgcrypto, pg_trgm), `app` schema; all `pgEnum` types; `organizations`, `users`, `memberships`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`, `number_sequences`. RLS helper fns (`app.is_member`, `app.has_permission`, `app.is_org_owner`, `app.is_super_admin`); `fn_audit()`, `fn_set_updated_at()` triggers; seed of permission catalog + 6 roles.
- **API routes:** none (infra). `middleware.ts` (Supabase session refresh + route protection); `lib/supabase/{server,client}.ts`; `lib/db` Drizzle client + schema; `lib/auth/rbac.ts`.
- **React pages:** `app/(app)/layout.tsx` shell, providers, error/loading boundaries.
- **Components:** `components/layout/{app-shell,sidebar,topbar}`, `components/shared/{permission-gate,data-table,empty-state}`, `providers/{query,theme,supabase}`.
- **Validation schemas:** `validations/common.ts` (money, percentage, gstin, pan, phone, isoDate); `lib/env.ts`.
- **Permissions:** establishes the key model; no module keys yet.
- **Integrations:** **Sentry** (init, source maps, release tracking), **PostHog** (init, identify), and the **SCSS design-token system** — `styles/` (CSS-variable tokens, mixins, reset) + `app/globals.scss`, plus the base UI primitives in `components/ui` (CSS Modules). No Tailwind / no shadcn/ui — see [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md).
- **Effort:** 6 days (+~1 day for hand-built primitives vs. generated shadcn).

---

## Module 1 — Authentication

- **Database tables:** `auth.users` (Supabase-managed), `public.users` (profile mirror), reads `memberships` to resolve active org. Sets JWT claims `org_id`, `is_super_admin`.
- **API routes:**
  - Server actions (`features/auth/server/actions.ts`): `signIn`, `signOut`, `requestPasswordReset`, `resetPassword`, `getCurrentSession`.
  - Route handler: `app/api/auth/callback/route.ts` (OAuth/email confirm).
- **React pages:** `app/(auth)/login`, `app/(auth)/forgot-password`, `app/(auth)/reset-password`, `app/(auth)/layout.tsx`.
- **Components:** `auth-card`, `login-form`, `forgot-password-form`, `reset-password-form`.
- **Validation schemas:** `validations/auth.ts` → `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`.
- **Permissions:** none (pre-auth); on success establishes session + permission claims.
- **Effort:** 4 days.

---

## Module 2 — Company Management

- **Database tables:** `organizations`, `organization_settings` (logo, GSTIN/PAN, address, FY start, currency, theme), `number_sequences` (ref/so/challan/invoice masks), `memberships` (creator → Company Owner). *(Stripe `subscriptions`/`plans` exist in schema but billing UI deferred.)*
- **API routes:** `features/company/server/actions.ts` → `createOrganization` (+owner membership +seed sequences), `updateOrganizationSettings`, `configureNumberSequence`, `switchOrganization`.
- **React pages:** `app/(app)/onboarding/company-setup` (wizard), `app/(app)/settings/company`, `app/(app)/settings/general`.
- **Components:** `company-setup-wizard`, `company-profile-form`, `logo-upload` (→ Storage `company-logos/{org_id}/`), `numbering-config`, `tax-config`, `org-switcher` (topbar).
- **Validation schemas:** `validations/company.ts` → `organizationSchema`, `organizationSettingsSchema`, `numberSequenceSchema`.
- **Permissions:** `settings.manage` (Company Owner). Org creation by any authenticated user → becomes Owner.
- **Effort:** 5 days.

---

## Module 3 — User Management

- **Database tables:** `invitations` (token, email, role, status, expires_at), `memberships`, `user_roles`, reads `roles`/`role_permissions`/`permissions`.
- **API routes:** `features/admin/server/actions.ts` → `inviteUser`, `resendInvitation`, `revokeInvitation`, `acceptInvitation`, `assignRole`, `revokeRole`, `removeMember`, `listMembers`. Route handler `app/api/auth/accept-invitation/route.ts`. **Resend** sends invite emails (transactional).
- **React pages:** `app/(app)/admin/users`, `app/(app)/admin/users/invite`, `app/(app)/admin/roles`, `app/(accept)/accept-invitation/[token]`.
- **Components:** `user-table`, `invite-user-dialog`, `member-card`, `role-assignment-select`, `role-permission-matrix` (read-only view of `PERMISSIONS.md §3`), `pending-invites-list`.
- **Validation schemas:** `validations/user.ts` → `inviteUserSchema`, `assignRoleSchema`, `acceptInvitationSchema`.
- **Permissions:** `admin.users`, `admin.roles`; `admin.audit` (read audit) optional in this module.
- **Effort:** 6 days.

---

## Module 4 — Item Management

- **Database tables:** `items` (self-ref `parent_id` variants + import fields), `item_families`, `brands`, `units`, `item_variations`, references `suppliers` (`last_supplier_id`).
- **API routes:** `features/items/server/` → `createItem`, `updateItem`, `softDeleteItem`, `createVariations` (spawns child items per variation), `listItems` (search/filter), `getItem`. Uses `lib/calc/import-cost.ts` (pure, tested). Lookups: `createBrand`/`createFamily`/`createUnit`.
- **React pages:** `app/(app)/items`, `app/(app)/items/new`, `app/(app)/items/[id]`, `app/(app)/items/[id]/edit`.
- **Components:** `item-list`, `item-card` (low-stock flag), `item-detail` (last purchase, stock, history), `item-form`, **`import-calculator`** (currency→discount→transport→duty→multiplier trail), `variation-builder`, `item-image-upload` (→ `product-images/{org_id}/`), `domestic-imported-toggle`.
- **Validation schemas:** `validations/item.ts` → `itemSchema`, `importPricingSchema`, `variationSchema`.
- **Permissions:** `items.view`, `items.create`, `items.edit`, `items.delete`, `pricing.override`.
- **Effort:** 8 days *(import calculator + variation-spawn logic are the cost drivers).*

---

## Module 5 — Customer Management

- **Database tables:** `customers` (billing/delivery split, GSTIN/PAN, `post_sale_discount`), `payments`; view `customer_running_bill`.
- **API routes:** `features/customers/server/` → `createCustomer`, `updateCustomer`, `softDeleteCustomer`, `listCustomers` (search by name/phone/email), `getCustomer`, `getRunningBill`, `recordPayment` (basic; full allocation deferred). Inline `createCustomer` reused by Quotes.
- **React pages:** `app/(app)/customers`, `app/(app)/customers/new`, `app/(app)/customers/[id]`, `app/(app)/customers/[id]/edit`.
- **Components:** `customer-list`, `customer-card` (billed/received/outstanding), `customer-form` (billing vs delivery, "Same as Billing"), `running-bill` (uses `lib/calc/running-bill.ts`), `payment-list`, `record-payment-dialog`.
- **Validation schemas:** `validations/customer.ts` → `customerSchema`, `paymentSchema`.
- **Permissions:** `customers.view`, `customers.create`, `customers.edit`, `customers.delete`, `running_bill.view`, `payments.view`, `payments.record`.
- **Effort:** 6 days.

---

## Module 6 — Quote Management  *(flagship / most complex)*

- **Database tables:** `quotes`, `quote_locations`, `quote_location_installation`, `quote_items`, `quote_item_options`, `quote_terms`. References `customers`, `items`.
- **API routes:** `features/quotes/server/` → `createQuote`, `updateQuote`, `reviseQuote` (increments revision, chains `parent_quote_id`), `listQuotes` (status filter), `getQuote`, `changeQuoteStatus`. Route handlers `app/api/pdf/quote/route.ts`, `app/api/pdf/boq/route.ts` (data-driven, locked columns). Uses `lib/calc/quote-totals.ts`.
- **React pages:** `app/(app)/quotes`, `app/(app)/quotes/new`, `app/(app)/quotes/[id]`, `app/(app)/quotes/[id]/edit`.
- **Components:** `quote-list`, **`quote-builder`** (RHF `useFieldArray` nested), `location-section`, `line-item-row`, `alternate-item-row` (excluded from total), `installation-block` (lumpsum/%/perunit), `totals-panel` (live), `per-area-selection`, `total-mode-selector` (grand/each/both), `gst-mode-selector`, `terms-editor`, `boq-preview`, `quote-preview`, `export-menu` (Print/PDF/Email/WhatsApp).
- **Validation schemas:** `validations/quote.ts` → `quoteSchema`, `locationSchema`, `lineItemSchema`, `optionSchema`, `installationSchema`, `termSchema`.
- **Permissions:** `quotes.view`, `quotes.create`, `quotes.edit`, `quotes.revise`, `quotes.delete`, `quotes.export`.
- **Effort:** 12 days *(deepest nested form; the calc + PDF parity is the risk — covered by `lib/calc` unit tests so preview == PDF).*

---

## Module 7 — Inventory

- **Database tables:** `stock_adjustments` (immutable, mandatory reason), `stock_movements` (in/out history with customer/challan link). `items.stock` maintained via these.
- **API routes:** `features/inventory/server/` → `adjustStock` (gated `stock.adjust`, writes adjustment + movement + audit), `listStockMovements` (item + date range), `getStockLevels`, `getStockValuation`, `getLowStock`.
- **React pages:** `app/(app)/inventory` (stock overview + valuation), `app/(app)/inventory/movements`; stock panel embedded in `items/[id]`.
- **Components:** `stock-overview`, `stock-adjust-dialog` (admin/manager only, reason required, log), `stock-movement-table`, `stock-level-badge`, `low-stock-list`, `valuation-summary`.
- **Validation schemas:** `validations/inventory.ts` → `stockAdjustSchema`.
- **Permissions:** `stock.adjust`, `items.view`, `reports.inventory.view`.
- **Effort:** 6 days.

---

## Module 8 — Purchase Orders

- **Database tables:** `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`. Posting a GRN → `stock_movements` (in), updates `items.stock`, `last_purchase_price/date/supplier`.
- **API routes:** `features/procurement/server/` → supplier CRUD (`createSupplier`, `updateSupplier`, `listSuppliers`), `createPurchaseOrder`, `updatePurchaseOrder`, `sendPurchaseOrder`, `listPurchaseOrders`, `getPurchaseOrder`, `receiveGoods` (creates GRN, posts stock, gated `goods_receipt.post`). PDF: `app/api/pdf/purchase-order/route.ts`.
- **React pages:** `app/(app)/purchase-orders`, `.../new`, `.../[id]`, `app/(app)/suppliers`, `.../new`, `.../[id]`, `app/(app)/purchase-orders/[id]/receive`.
- **Components:** `po-list`, `po-builder`, `po-item-row`, `supplier-list`, `supplier-form`, `goods-receipt-form`, `receive-goods-dialog`, `po-status-badge`.
- **Validation schemas:** `validations/procurement.ts` → `supplierSchema`, `purchaseOrderSchema`, `poItemSchema`, `goodsReceiptSchema`.
- **Permissions:** `suppliers.view/create/edit`, `purchase_orders.view/create/edit/delete`, `goods_receipt.post`.
- **Effort:** 8 days.

---

## Module 9 — Sales Orders

- **Database tables:** `sales_orders`, `sales_order_items`, `delivery_challans`, `delivery_challan_items`. Posting a challan → `stock_movements` (out), decrements `items.stock`, feeds `customer_running_bill`.
- **API routes:** `features/sales-orders/server/` → `createSalesOrder` (from accepted quote — copies snapshot lines), `updateSalesOrder`, `listSalesOrders`, `getSalesOrder`, `changeSOStatus`, `createChallan`, `postChallan` (gated `challans.post`, one-way stock-out + audit), `listChallans`. PDF: `app/api/pdf/challan/route.ts`.
- **React pages:** `app/(app)/sales-orders`, `.../new`, `.../[id]`, `app/(app)/challans`, `.../new`, `.../[id]`.
- **Components:** `so-list`, `so-builder` (+ "create from quote" picker), `so-item-row`, `so-status-badge`, `challan-list`, `challan-form`, `post-challan-dialog`.
- **Validation schemas:** `validations/sales.ts` → `salesOrderSchema`, `salesOrderItemSchema`, `challanSchema`, `challanItemSchema`.
- **Permissions:** `sales_orders.view/create/edit/delete`, `challans.view/create/edit/post/delete`.
- **Effort:** 8 days.

---

## Module 10 — Reports

- **Database tables:** read-only views — `customer_running_bill`, `v_sales_summary`, `v_inventory_valuation`, `v_receivables_ageing`; optional `saved_reports`. *(Materialized views & scheduled email reports deferred to post-MVP.)*
- **API routes:** `features/reports/server/` → `getStockReport` (hierarchical filter), `getSalesReport`, `getReceivablesAgeing`, `getInventoryValuation`. Route handlers `app/api/pdf/stock-report/route.ts`, `app/api/reports/export/route.ts` (CSV/PDF). **Resend** for email-report; WhatsApp deep-link export.
- **React pages:** `app/(app)/reports`, `app/(app)/stock-reports`, `app/(app)/reports/sales`, `app/(app)/reports/receivables`.
- **Components:** `report-filters` (family→variation→brand cascade), `date-range-picker`, `stock-report-table`, `stock-movement-report`, `sales-report-table`, `receivables-ageing-table`, `valuation-report`, `export-menu`.
- **Validation schemas:** `validations/report.ts` → `reportFilterSchema`, `dateRangeSchema`.
- **Permissions:** `stock_report.view`, `stock_report.export`, `reports.sales.view`, `reports.inventory.view`, `reports.financial.view`, `reports.export`.
- **Effort:** 7 days.

---

## 12. Critical Path & Parallelisation

- **Critical path:** `0 → 1 → 2 → 3 → 4 → 6 → 9 → 10`. Quotes (6) and the SO/challan chain (9) are the long poles.
- **Parallel tracks** (with a 2–3 dev team after Module 3):
  - Track A: **Items (4) → Inventory (7) → Purchase Orders (8)**
  - Track B: **Customers (5) → Quotes (6)**
  - Converge at **Sales Orders (9)**, then **Reports (10)**.
- **Shared prerequisites:** `lib/calc/` (import-cost, quote-totals, running-bill) should be built and unit-tested early — Items, Quotes, Customers, and Reports all depend on it.

---

## 13. Definition of Done (every module)

A module is "done" only when all of the following ship with it:

1. **Drizzle schema** for its tables (matches `DATABASE_SCHEMA.md`) + migration applied.
2. **RLS policies** enabled + FORCE on every new table, mapped to permission keys (`RLS_POLICIES.md`); `check-rls` CI passes.
3. **Zod schemas** in `validations/`, reused by RHF form **and** server action (one schema, two enforcement points).
4. **Permission gating** in UI (`permission-gate`) + server (`requirePermission`) — defense in depth.
5. **Audit logging** on sensitive mutations (`fn_audit` / `withAudit` per `AUDIT_LOGS.md §4`).
6. **Tests:** unit (`lib/calc` where relevant), integration (server actions vs test DB), one e2e for the headline flow.
7. **Observability:** Sentry capture on action errors; PostHog event on key user actions.
8. **Empty/loading/error states** and mobile-responsive layout, styled **only** with CSS Modules (`.module.scss`) consuming design tokens — no inline styles, no hard-coded colours/spacing (see [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md)).

---

## 14. Risks & Notes
1. **Quote builder (M6)** is the schedule risk — nested `useFieldArray`, live totals, and PDF parity. Mitigate by building `lib/calc/quote-totals.ts` + tests first, then UI.
2. **Stock integrity (M7/M8/M9)** — stock-in (GRN) and stock-out (challan) must be transactional with `stock_movements`; never mutate `items.stock` directly. Consider a DB trigger or a single guarded service.
3. **Inline customer creation** during quoting (M6 depends on M5) — ship `createCustomer` action before the quote builder needs it.
4. **Deferred-but-wired:** billing (Stripe) gating hooks (`has_active_subscription`) exist in RLS; MVP runs all orgs as if on a default plan — confirm before public launch.
5. **MVP exit:** a tenant can sign up → set up company → invite users → build catalogue → quote a customer → convert to order → deliver (stock-out) → see the running bill → export reports. That full loop is the launch gate.

---

*End of IMPLEMENTATION_PLAN.md — build-order artifact. No application code written. Recommended start: Module 0 (Foundation) + `lib/calc` test harness, then proceed down the critical path.*
