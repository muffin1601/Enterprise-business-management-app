# Watcon Business Management System — API & Server-Interaction Design

> **Status:** API design (Server Actions + Route Handlers + Webhooks). Specified, not yet implemented.
> **Date:** 2026-05-29
> **Companions:** [PROJECT_PLAN.md](PROJECT_PLAN.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [PERMISSIONS.md](PERMISSIONS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md)
> **Target platform:** Next.js 15 (App Router, RSC, Server Actions) · Supabase (Auth/Postgres/Storage/Edge Functions/Realtime) · Drizzle ORM · TanStack Query · Zod · Stripe · Resend · Sentry · PostHog.
> **Derives from:** the canonical entity/column/FK names in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) and the permission keys in [PERMISSIONS.md §2](PERMISSIONS.md). This document never invents columns or keys — it references them.

This document defines **how the client talks to the server** and **how the server talks to the database and external systems**. The database isolation contract (RLS) is authoritative ([PERMISSIONS.md §6](PERMISSIONS.md)); everything here is **layer 2** of defense-in-depth ([PERMISSIONS.md §7](PERMISSIONS.md)).

---

## 1. API Philosophy

The system is **server-first** ([ARCHITECTURE.md §2](ARCHITECTURE.md)). There is **no general-purpose internal REST API** for the app's own UI; instead the surface is split into three transport styles, chosen by *who calls* and *what is needed*.

```
                         ┌──────────────────────────────────────────────┐
   READS (queries)       │  React Server Components (RSC)                │
   ───────────────────►  │  Drizzle SELECT in features/*/server/queries │ ──► Postgres (RLS)
                         └──────────────────────────────────────────────┘
                         ┌──────────────────────────────────────────────┐
   MUTATIONS             │  Server Actions ('use server')                │
   ───────────────────►  │  features/*/server/actions.ts                │ ──► Postgres (RLS)
   (client → server)     │  Zod-validated · permission-checked · audited │ ──► services/* (pdf/email/stripe)
                         └──────────────────────────────────────────────┘
                         ┌──────────────────────────────────────────────┐
   NON-RPC / EXTERNAL    │  Route Handlers (app/api/**/route.ts)         │
   ───────────────────►  │  webhooks · file sign · PDF · export · email  │ ──► Stripe/Resend/Storage
                         └──────────────────────────────────────────────┘
```

### 1.1 Reads → React Server Components + Drizzle
- List/detail pages are **RSC**. They call typed query functions in `features/<feature>/server/queries.ts` (`import 'server-only'`) that run Drizzle `SELECT`s.
- RLS scopes every row to the caller's org and permission keys; queries also pass an explicit `.where(eq(table.orgId, ctx.orgId))` + `notDeleted()` as belt-and-suspenders.
- The browser never receives a query endpoint or a DB connection — it receives **rendered HTML/RSC payload**. Client interactivity that needs fresh reads uses **TanStack Query hooks that call read-only Server Actions** (§6).
- Derived reads (Running Bill, ageing) come from views/MVs: `customer_running_bill`, `v_sales_summary`, `v_receivables_ageing` ([DATABASE_SCHEMA.md §3.11, §8.4](DATABASE_SCHEMA.md)).

### 1.2 Mutations → Server Actions
- Every create/update/soft-delete/state-transition is a **Server Action** in `features/<feature>/server/actions.ts`. This is the default and covers ~95% of writes.
- Each action: (1) resolves auth/org context, (2) Zod-validates input at the trust boundary, (3) checks the required permission key with `requirePermission()`, (4) enforces business rules / state transitions (things RLS can't express — invoice `issue`, challan `post`, approval thresholds), (5) runs the Drizzle write (often in a transaction), (6) writes `audit_logs` for sensitive entities, (7) returns a typed `ActionResult<T>`, (8) calls `revalidatePath`/`revalidateTag` or returns invalidation hints.
- Actions orchestrate **services** for side-effects: `createInvoice` (action) → `pdf.service` + `email.service`; `acceptInvitation` (action) → seat sync → `stripe.service`.

### 1.3 Route Handlers → webhooks, files, PDF, export, external
Use a Route Handler (`app/api/**/route.ts`) **only** when a Server Action cannot serve the need:

| Use case | Why not a Server Action |
|----------|-------------------------|
| **Inbound webhooks** (Stripe, Resend, Supabase Auth) | External POST with signature header; no Next.js action invocation context. |
| **Binary responses** (PDF download/stream) | Server Actions return serializable JSON, not a streamed `application/pdf` body. |
| **File upload signing** | Returns a short-lived signed URL/policy; called by upload widget; also usable by future API clients. |
| **Report export** (CSV/XLSX/PDF as attachment) | Streamed file download with `Content-Disposition`. |
| **Outbound email/WhatsApp dispatch endpoint** | Invoked by schedulers/Edge Functions, not just the UI. |
| **Future public/partner REST API** | Versioned, API-key-authenticated; consumed by non-browser clients (§4.5). |

> **Rule of thumb:** *browser form/button → Server Action. Machine, binary, or external → Route Handler.*

### 1.4 Edge Functions (Supabase) vs Route Handlers
- **Stripe webhook processing** runs as a **Supabase Edge Function** so it can use the **service role** (bypassing RLS by design — [DATABASE_SCHEMA.md §8.3](DATABASE_SCHEMA.md)) and stay close to the DB. A thin Next.js Route Handler (`/api/webhooks/stripe`) is an acceptable alternative when co-locating with the app; both verify signatures and write `stripe_events` for idempotency (§5).
- **Scheduled work** (MV refresh, `report_schedules`, invitation expiry, seat reconcile) runs on **Supabase cron → Edge Functions** ([DATABASE_SCHEMA.md §3.11](DATABASE_SCHEMA.md)), not on the request path.

---

## 2. Conventions

### 2.1 `ActionResult<T>` — the uniform return contract
Every Server Action returns a discriminated union (no thrown errors across the client boundary):

```ts
// types/action.ts (illustrative shape — defined once, used everywhere)
type ActionOk<T>  = { ok: true;  data: T };
type ActionErr    = { ok: false; error: ActionError };
type ActionResult<T> = ActionOk<T> | ActionErr;

type ActionError = {
  code:
    | 'unauthenticated' | 'forbidden'        // auth / permission
    | 'validation'                            // Zod failed
    | 'not_found' | 'conflict'                // optimistic-concurrency / unique
    | 'state_transition'                      // illegal status change
    | 'plan_limit' | 'seat_limit'             // billing gate
    | 'rate_limited' | 'idempotent_replay'
    | 'internal';
  message: string;                            // user-safe
  fieldErrors?: Record<string, string[]>;     // mirrors Zod flatten() for RHF
  details?: Record<string, unknown>;          // e.g. { limit: 50, used: 50 }
};
```

- Client (TanStack Query mutation) branches on `ok`; `fieldErrors` map straight onto React Hook Form `setError`.
- `internal` errors are captured by Sentry with the original cause; the client sees a generic message (§7).

### 2.2 Zod validation at the boundary
- Schemas live in `validations/<entity>.ts` and are imported by **both** the RHF resolver and the Server Action ([ARCHITECTURE.md §10](ARCHITECTURE.md)). One schema, two enforcement points.
- The action re-validates server-side **always** (never trust the client). Referenced below as e.g. `createQuoteSchema`, `recordPaymentSchema`.
- Money/qty/pct coerce to the schema's `numeric` strings/decimals matching [DATABASE_SCHEMA.md §1.4](DATABASE_SCHEMA.md) (`numeric(14,2)` etc.); no floats cross the boundary.

### 2.3 Server context (`getActionContext()`)
Resolved once per action from the Supabase server client + cookies ([ARCHITECTURE.md §6 `lib/supabase/server.ts`](ARCHITECTURE.md)):

```ts
type ActionContext = {
  userId: string;            // auth.uid()
  orgId: string;             // active org from membership (header/cookie `x-org-id`, validated against memberships)
  isSuperAdmin: boolean;     // JWT app_metadata.is_super_admin
  has: (key: string) => boolean;   // backed by app.has_permission cache for this org
};
```
`requirePermission(ctx, 'quotes.create')` throws `forbidden` (mapped to `ActionErr`) if the key is absent. The **active org** is never taken from the request body — it's bound server-side from the validated membership, so a user can't write into an org they don't belong to. RLS is the final backstop.

### 2.4 Pagination
Two modes, both org-scoped:
- **Cursor (default for infinite lists / large tables):** keyset on `(created_at, id)` or a domain sort key. Input `{ cursor?: string; limit: number (≤100) }`; output `{ items: T[]; nextCursor: string | null }`. Used for `items`, `leads`, `stock_movements`, `audit_logs`, `notifications`.
- **Offset (for jump-to-page admin grids):** `{ page: number; pageSize: number }` → `{ items, total, page, pageSize }`. Used where a total count is cheap and pagination UI needs page numbers.

### 2.5 Filtering & sorting
- Filters passed as a typed, Zod-validated object (never raw SQL): e.g. `listItemsSchema { familyId?, brandId?, parentId?, q?, isImported?, sort?: 'name'|'sku'|'stock', dir?: 'asc'|'desc' }`.
- Text search uses `pg_trgm` GIN indexes ([DATABASE_SCHEMA.md §6.2](DATABASE_SCHEMA.md)) via Drizzle `ilike`/`%` operators on `items.name`, `customers.(name,phone,email)`.
- Sort whitelisted to indexed columns; arbitrary column sorting is rejected (`validation`).

### 2.6 Idempotency keys
- **External-effect actions** (anything that charges/emails/posts stock/issues a number) accept an `idempotencyKey: string (uuid)` from the client.
- Stripe calls pass it through as Stripe's `Idempotency-Key`.
- Document-number issuance is naturally idempotent via `number_sequences` row lock (`SELECT … FOR UPDATE`, [DATABASE_SCHEMA.md §3.1](DATABASE_SCHEMA.md)) inside the same transaction as the insert.
- Webhooks are idempotent via `stripe_events.id` PK and `notification_deliveries.provider_message_id` (§5).

### 2.7 Optimistic concurrency
- Mutable business rows are versioned by `updated_at`. Update actions accept `expectedUpdatedAt`; the Drizzle `UPDATE … WHERE id = ? AND updated_at = ?` affecting 0 rows returns `conflict` so the client can reload and merge.
- Append-only/immutable tables (`stock_movements`, `stock_adjustments`, `audit_logs`, `payment_allocations`, `approval_actions`) have no update path.

### 2.8 Auditing
Sensitive mutations write an `audit_logs` row (`entity_type`, `entity_id`, `action` from the `audit_action` enum, `before`, `after`, `changed_fields`, `ip`) in the same transaction ([DATABASE_SCHEMA.md §3.1](DATABASE_SCHEMA.md), [PERMISSIONS.md §7 layer 4](PERMISSIONS.md)). Marked **audit** in the catalogs below.

---

## 3. Server Action Catalog (per module)

> Notation: **Perm** = permission key from [PERMISSIONS.md §2](PERMISSIONS.md) required at layer 2 (RLS re-checks). **Schema** = Zod schema in `validations/`. **Returns** = the `data` payload of `ActionResult<T>`. Side-effects note transactions, services, and audit. All actions are org-scoped via `ActionContext`; `*` = also enforced by RLS row filter.

### 3.1 Customers — `features/customers/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createCustomer` | `createCustomerSchema` | `customers.create` | `Customer` | Splits billing/delivery (`same_as_billing`); audit. |
| `updateCustomer` | `updateCustomerSchema` | `customers.edit` | `Customer` | Accountant restricted to billing/GST cols (app-layer, [PERMISSIONS.md §8.3](PERMISSIONS.md)); optimistic `expectedUpdatedAt`; audit. |
| `softDeleteCustomer` | `idSchema` | `customers.delete` | `{ id }` | Sets `deleted_at`; blocked by `RESTRICT` FKs if live docs; audit. |
| `setPostSaleDiscount` | `postSaleDiscountSchema` | `discount.post_sale` | `Customer` | Writes `customers.post_sale_discount`; feeds Running Bill; audit. |
| `getRunningBill` *(read)* | `customerIdSchema` | `running_bill.view` | `RunningBill` | Reads `customer_running_bill` view; `Σ challan value − post_sale_discount − Σ payments` ([DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md)). |

### 3.2 Items / Inventory catalogue — `features/items/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createItem` | `createItemSchema` | `items.create` | `Item` | Generates `sku` via `number_sequences`; audit. |
| `createVariations` | `variationsSchema` | `items.create` | `Item[]` | Spawns variant `items` (self-ref `parent_id`) from `item_variations` spec. |
| `updateItem` | `updateItemSchema` | `items.edit` | `Item` | Recomputes landed cost via `lib/calc/import-cost` when import fields change; audit. |
| `overridePricing` | `pricingOverrideSchema` | `pricing.override` | `Item` | Sets `purchase_price`/`selling_price` manually; audit. |
| `adjustStock` | `stockAdjustSchema` | `stock.adjust` | `StockAdjustment` | Inserts immutable `stock_adjustments` (`reason` required, `adjusted_by = uid` per RLS), updates `items.stock` in one tx; audit. |
| `softDeleteItem` | `idSchema` | `items.delete` | `{ id }` | Soft-delete; audit. |
| `importLandedCostPreview` *(read)* | `importCostSchema` | `items.view` | `{ purchasePrice, sellingPrice, breakdown }` | Pure `lib/calc/import-cost`; no DB write. |
| `listItems` *(read)* | `listItemsSchema` | `items.view` | `Page<Item>` | Cursor; family/brand/parent filter + trigram search. |

### 3.3 Quotes — `features/quotes/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createQuote` | `createQuoteSchema` | `quotes.create` | `Quote` | Nested tx: `quotes` + `quote_locations` + `quote_location_installation` + `quote_items` + `quote_item_options` + `quote_terms`; `ref_no` via `number_sequences`; snapshot item fields ([DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md)). |
| `updateQuote` | `updateQuoteSchema` | `quotes.edit` | `Quote` | Full diff of children; optimistic concurrency; audit. |
| `reviseQuote` | `reviseQuoteSchema` | `quotes.revise` | `Quote` | Clones to new row, `revision+1`, links `parent_quote_id`, status `revised`; audit. |
| `sendQuote` | `sendQuoteSchema` | `quotes.edit` | `Quote` | Status `draft→sent`; triggers `quote.sent` notification + optional email (§5/§4.2). |
| `acceptQuote` | `idSchema` | `quotes.edit` | `Quote` | Status→`accepted`; emits `quote.accepted`. |
| `requestDiscountApproval` | `discountApprovalSchema` | `quotes.edit` | `ApprovalRequest` | Opens generic `approval_requests` (`entity_type='discount'`) when discount > `settings.approval_limits` (§3.10). |
| `softDeleteQuote` | `idSchema` | `quotes.delete` | `{ id }` | Soft-delete cascade to children in app tx; audit. |
| `recomputeTotals` *(read)* | `quoteCalcSchema` | `quotes.view` | `QuoteTotals` | Pure `lib/calc/quote-totals` over **selected** locations; `total_mode` grand/each/both. |

### 3.4 Stock Reports — `features/stock-reports/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `getStockReport` *(read)* | `stockReportSchema` | `stock_report.view` | `StockReportTree` | Hierarchical family→variation→brand, date-range over `stock_movements`; reads `v_inventory_valuation`. |
| `exportStockReport` | `exportStockSchema` | `stock_report.export` | `{ url }` | Builds payload, delegates to `/api/reports/export` (PDF/CSV/XLSX) (§4.3); audit on email/WhatsApp send. |
| `emailStockReport` | `emailReportSchema` | `stock_report.export` | `{ deliveryId }` | Renders PDF (`services/pdf`) → `services/email` (Resend) → `notification_deliveries`. |
| `whatsappStockReport` | `whatsappReportSchema` | `stock_report.export` | `{ deliveryId }` | Plan-gated `whatsapp.send` feature; `services/whatsapp`; `notification_deliveries`. |

### 3.5 Leads (CRM) — `features/leads/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createLead` | `createLeadSchema` | `customers.create` | `Lead` | Default `stage_id`/`status='new'`; emits `lead.assigned` to `owner_id`. |
| `updateLead` | `updateLeadSchema` | `customers.edit` | `Lead` | Optimistic concurrency. |
| `moveLeadStage` | `moveStageSchema` | `customers.edit` | `Lead` | Kanban move; sets `stage_id`/terminal `won`/`lost`. |
| `logLeadActivity` | `leadActivitySchema` | `customers.edit` | `LeadActivity` | Inserts `lead_activities` (`call/email/meeting/note/task/whatsapp`); optional `due_at` task. |
| `convertLead` | `convertLeadSchema` | `customers.create` | `Customer` | Tx: creates `customers`, sets `leads.converted_customer_id`, stage→won; audit. |
| `softDeleteLead` | `idSchema` | `customers.delete` | `{ id }` | Soft-delete; audit. |

### 3.6 Inventory / Procurement (PO + GRN) — `features/procurement/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createPurchaseOrder` | `createPOSchema` | `items.edit` | `PurchaseOrder` | Header + `purchase_order_items` (snapshot); `po_no` via `number_sequences`; audit. |
| `updatePurchaseOrder` | `updatePOSchema` | `items.edit` | `PurchaseOrder` | Draft-only edit; optimistic. |
| `sendPurchaseOrder` | `idSchema` | `items.edit` | `PurchaseOrder` | `draft→sent`; may open PO `approval_requests` if configured (§3.10). |
| `createGoodsReceipt` | `createGRNSchema` | `items.edit` | `GoodsReceipt` | Header + `goods_receipt_items` (draft). |
| `postGoodsReceipt` | `postGRNSchema` | `items.edit` | `GoodsReceipt` | **Tx:** `grn.status→posted`, write `stock_movements(in)`, bump `items.stock` + `last_purchase_price/date/supplier`, advance `purchase_order_items.received_qty`/PO status; audit. State-transition guarded. |
| `cancelGoodsReceipt` | `idSchema` | `items.edit` | `GoodsReceipt` | Owner-guarded reversal; audit. |

### 3.7 Sales Orders & Challans — `features/sales-orders/`, `features/challans/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createSalesOrder` | `createSOSchema` | `sales_orders.create` | `SalesOrder` | From `quote_id`; snapshot items; `so_no` sequence. |
| `updateSalesOrder` | `updateSOSchema` | `sales_orders.edit` | `SalesOrder` | Optimistic. |
| `createChallan` | `createChallanSchema` | `challans.create` | `DeliveryChallan` | Draft; `challan_no` sequence; `delivery_challan_items.value = qty×rate` persisted ([DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md)). |
| `postChallan` | `postChallanSchema` | `challans.post` | `DeliveryChallan` | **Tx, one-way:** `posted=true`, decrement `items.stock`, write `stock_movements(out)`; feeds Running Bill; audit. Reversal = Owner + audit ([PERMISSIONS.md §7](PERMISSIONS.md)). |
| `softDeleteChallan` | `idSchema` | `challans.delete` | `{ id }` | Blocked if posted (state rule); audit. |

### 3.8 Invoices & Payments (Accounting) — `features/invoices/`, `features/payments/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createInvoice` | `createInvoiceSchema` | `invoices.create` | `Invoice` | Header + `invoice_items` (HSN, snapshot); CGST/SGST/IGST split by `place_of_supply` (`lib/calc`); `invoice_no` sequence; audit. |
| `updateInvoice` | `updateInvoiceSchema` | `invoices.edit` | `Invoice` | **Draft-only**; optimistic; audit. |
| `issueInvoice` | `idSchema` | `invoices.issue` | `Invoice` | **State transition** `draft→issued` (guarded layer-2, [PERMISSIONS.md §7](PERMISSIONS.md)); generates PDF (`services/pdf`), emails customer (Resend), emits `invoice.issued`; audit. |
| `voidInvoice` | `voidSchema` | `invoices.delete` ⚙ | `Invoice` | Reverse-only (never hard delete); status→`cancelled`; audit (mandatory). |
| `recordPayment` | `recordPaymentSchema` | `payments.record` | `Payment` | Tx: `payments` + `payment_allocations` against invoices; updates derived outstanding; audit. |
| `voidPayment` | `voidSchema` | `payments.delete` ⚙ | `Payment` | Offsetting/soft-void; audited; no hard delete. |
| `listReceivablesAgeing` *(read)* | `ageingFilterSchema` | `reports.financial.view` | `AgeingBuckets` | Reads `v_receivables_ageing`. |

### 3.9 Expenses & Budgets — `features/expenses/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `submitExpense` | `submitExpenseSchema` | `expenses.create` | `Expense` | `created_by=uid` (RLS `with check`); attaches `receipt_file_id`; status→`submitted`; opens `approval_requests` (`entity_type='expense'`) if > threshold. |
| `approveExpense` | `approveExpenseSchema` | `expenses.approve` ⚙ | `Expense` | Routes through generic engine (§3.10) or legacy `expense_approvals`; threshold escalation to Accountant/Owner; audit. |
| `rejectExpense` | `rejectExpenseSchema` | `expenses.approve` | `Expense` | status→`rejected`; audit. |
| `markExpensePaid` | `idSchema` | `finance.manage` | `Expense` | status→`paid`; audit. |
| `upsertBudget` | `budgetSchema` | `finance.manage` | `Budget` | UNIQUE `(org_id, period_key, category)`; audit. |

### 3.10 HR & Payroll — `features/hr/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `upsertEmployee` | `employeeSchema` | `hr.manage` | `Employee` | `code` unique per org; sensitive salary cols RLS-gated; audit. |
| `recordAttendance` | `attendanceSchema` | `hr.manage` | `Attendance` | UNIQUE `(org,employee,date)`; computes `hours` from check-in/out vs `shifts`. |
| `requestLeave` | `leaveRequestSchema` | `expenses.create`† | `LeaveRequest` | Employee self-service (own record); status `pending`. (†own-record scope; HR/Manager approve.) |
| `approveLeave` | `approveLeaveSchema` | `leave.approve` | `LeaveRequest` | status→`approved/rejected`; decrements `leave_balances`; audit. |
| `upsertAppraisal` | `appraisalSchema` | `hr.manage` | `Appraisal` | Lifecycle `draft→submitted→acknowledged→closed`. |
| `createPayrollRun` | `payrollRunSchema` | `payroll.manage` | `PayrollRun` | UNIQUE `(org,period)`; status `draft`. |
| `computePayroll` | `idSchema` | `payroll.manage` | `PayrollRun` | Tx: generate `payroll_lines` (gross/earnings/deductions/net jsonb), roll up run totals; status→`computed`. |
| `submitPayrollForApproval` | `idSchema` | `payroll.manage` | `ApprovalRequest` | Opens `approval_requests` (`entity_type='payroll_run'`) — sign-off (§3.10/engine). |
| `markPayrollPaid` | `idSchema` | `payroll.manage` | `PayrollRun` | status→`paid`, `paid_at`; audit. |

### 3.11 Approvals (generic engine) — `features/approvals/server/actions.ts`
> One engine drives discount / expense / PO / payroll sign-off ([DATABASE_SCHEMA.md §3.10](DATABASE_SCHEMA.md)).

| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `defineWorkflow` | `workflowSchema` | `settings.manage` | `ApprovalWorkflow` | Definition + ordered `approval_steps`; UNIQUE `(org,entity_type,name)`. |
| `openApprovalRequest` | `openRequestSchema` | *(entity perm)* | `ApprovalRequest` | Internal: called by `submitExpense`/`sendPurchaseOrder`/`requestDiscountApproval`/`submitPayrollForApproval`; resolves workflow by `entity_type` + `min_amount`. |
| `decideApproval` | `decideSchema` | *(step perm, e.g. `expenses.approve`)* | `ApprovalRequest` | Appends `approval_actions` (`approved/rejected/delegated/commented`), advances `current_step` or resolves; on terminal approve, applies effect to target entity in tx; escalates above threshold; audit. |
| `cancelApprovalRequest` | `idSchema` | `settings.manage` | `ApprovalRequest` | status→`cancelled`; audit. |
| `listMyApprovals` *(read)* | `approvalQueueSchema` | *(any step perm)* | `Page<ApprovalRequest>` | Pending queue for the caller's roles. |

### 3.12 Notifications — `features/notifications/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `listNotifications` *(read)* | `notifListSchema` | *(member)* | `Page<Notification>` | Own `user_id` rows; cursor; unread filter. |
| `markRead` | `idsSchema` | *(member)* | `{ updated: number }` | Sets `status='read'`, `read_at`; realtime broadcast (§8). |
| `markAllRead` | `{}` | *(member)* | `{ updated }` | Bulk. |
| `archiveNotification` | `idSchema` | *(member)* | `{ id }` | `status='archived'`. |
| `updatePreferences` | `notifPrefsSchema` | *(member)* | `NotificationPreference[]` | Per-category/channel opt-in/out. |
| `enqueueNotification` *(internal)* | `enqueueSchema` | *(server-only)* | `Notification` | Fan-out: in-app row + per-channel `notification_deliveries` (email via Resend, WhatsApp if plan-gated) honoring `notification_preferences`. |

### 3.13 Billing (Stripe) — `features/billing/server/actions.ts`
> Billing is **per organization** ([DATABASE_SCHEMA.md §3.2, §8.2](DATABASE_SCHEMA.md)). Mutations here call Stripe; the **webhook** (§5) is the source of truth that reconciles `subscriptions`/`invoices_billing`. Most rows are written by the webhook (service role), not these actions.

| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `createCheckoutSession` | `checkoutSchema` | `settings.manage` | `{ url }` | Ensures `organizations.stripe_customer_id`; Stripe Checkout for a `plans.stripe_price_id`; idempotency key. |
| `createBillingPortalSession` | `{}` | `settings.manage` | `{ url }` | Stripe Billing Portal for plan/payment-method/invoice self-serve. |
| `changePlan` | `changePlanSchema` | `settings.manage` | `Subscription` | Updates Stripe subscription item; webhook reconciles `subscriptions.plan_id`; audit. |
| `cancelSubscription` | `cancelSubSchema` | `settings.manage` | `Subscription` | `cancel_at_period_end=true`; webhook confirms; audit. |
| `syncSeats` *(internal)* | `{}` | *(server-only)* | `{ quantity }` | Recount billable `memberships`, update Stripe quantity + `subscriptions.quantity` ([DATABASE_SCHEMA.md §8.2](DATABASE_SCHEMA.md)); called on invite-accept / member-remove. |
| `checkPlanLimit` *(internal/read)* | `limitCheckSchema` | *(server-only)* | `{ allowed, limit, used }` | Reads `plan_features` + aggregates `usage_records`; returns `plan_limit`/`seat_limit` error upstream. |
| `recordUsage` *(internal)* | `usageSchema` | *(server-only)* | `UsageRecord` | Append `usage_records` for metered metrics. |
| `getSubscriptionStatus` *(read)* | `{}` | `settings.manage` | `BillingOverview` | Plan, status, period end, seats, invoices_billing list. |

### 3.14 Platform / Org admin — `features/admin/server/actions.ts`
| Action | Schema | Perm | Returns | Side-effects / audit |
|--------|--------|------|---------|----------------------|
| `inviteMember` | `inviteSchema` | `admin.users` | `Invitation` | Creates `invitations` (signed `token`, `expires_at`), emails via Resend; audit. |
| `acceptInvitation` | `acceptInviteSchema` | *(token)* | `Membership` | Tx: `memberships` + `user_roles`; then `syncSeats` (§3.13); audit. |
| `revokeMembership` | `idSchema` | `admin.users` | `{ id }` | Delete membership row; `syncSeats`; audit. |
| `assignRole` / `revokeRole` | `userRoleSchema` | `admin.users` | `UserRole` | `user_roles` upsert/delete; audit (`permission_change`). |
| `defineRole` | `roleSchema` | `admin.roles` | `Role` | Custom org role + `role_permissions`; audit. |
| `updateSettings` | `settingsSchema` | `settings.manage` | `OrgSettings` | `organization_settings` incl. `approval_limits`, numbering masks; audit. |
| `listAuditLogs` *(read)* | `auditFilterSchema` | `admin.audit` | `Page<AuditLog>` | Cursor over `audit_logs`. |

---

## 4. Route Handlers / REST Endpoints

All under `app/api/**/route.ts` ([ARCHITECTURE.md §4](ARCHITECTURE.md)). Each verifies session (or signature/API key), resolves org context, checks the permission key, then streams the response. Sentry wraps each handler.

### 4.1 PDF generation — `GET /api/pdf/[doc]`
- `[doc]` ∈ `quote | boq | invoice | challan | stock-report | po`.
- Query: `?id=<uuid>&orgId=<uuid>` (org validated against membership); optional `&download=1`.
- Flow: auth + perm (`quotes.export` / `invoices.view` / `stock_report.export` …) → `features/*/server/queries` fetch → `services/pdf` renders `lib/pdf/templates/*` **from data with locked columns** ([ARCHITECTURE.md §12 step 5](ARCHITECTURE.md)) → returns `application/pdf` stream with `Content-Disposition`.
- Numbers come from `lib/calc` so PDF == on-screen preview (the recurring prototype bug, [DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md)).

### 4.2 Email dispatch — `POST /api/email`
- Body: `{ template, to[], orgId, entityRef, attachments?: [{ doc, id }] }`, Zod-validated.
- Auth: session (UI) **or** internal service token (schedulers).
- Flow: perm check → optionally call `/api/pdf` internally for attachments → **Resend** send → write `notification_deliveries` (`provider='resend'`, `provider_message_id`, `status='sent'`). Delivery/bounce reconciled by the Resend webhook (§5.2).

### 4.3 Report export — `POST /api/reports/export`
- Body: `{ reportType, filters, format: 'pdf'|'csv'|'xlsx', delivery?: 'download'|'email'|'whatsapp', recipients? }`.
- Perm: `reports.export` (or report-specific `*.view`). Reads `v_sales_summary` / `v_inventory_valuation` / `v_receivables_ageing` / `v_hr_headcount` (security-barrier views, [DATABASE_SCHEMA.md §8.4](DATABASE_SCHEMA.md)).
- `download` → streamed file; `email`/`whatsapp` → hands to `services/email` / `services/whatsapp` (plan-gated `whatsapp.send`). Backing `saved_reports`/`report_schedules` are driven by Supabase cron Edge Functions, which call this same endpoint with an internal token.

### 4.4 File upload & signing — `POST /api/files/sign`, `POST /api/files/commit`
- `sign`: body `{ bucket, ownerEntityType, ownerEntityId?, mime, sizeBytes }` → perm check (e.g. `items.edit` for `product-images`) → returns a **Supabase Storage signed upload URL** with the enforced path `{org_id}/...` ([DATABASE_SCHEMA.md §3.8](DATABASE_SCHEMA.md); Storage RLS [PERMISSIONS.md §6.4](PERMISSIONS.md)). Size validated against the `storage_mb` plan limit (`checkPlanLimit`).
- `commit`: after client uploads, body `{ bucket, path, checksum, mime, sizeBytes }` → inserts the `files` metadata row (`status='pending'`→`clean` after AV scan), wires `owner_entity_*`. Never base64; only Storage URLs ([DATABASE_SCHEMA.md §1.4](DATABASE_SCHEMA.md)).

### 4.5 Future public / partner REST API — `/api/v1/**`
- **Versioned** (`/v1`), **API-key** authenticated (per-org keys stored hashed; key → `org_id` + a scoped service role). Not used by the first-party UI.
- Read-first: `GET /v1/items`, `/v1/customers`, `/v1/invoices`, `/v1/quotes`; later `POST` for lead intake (`/v1/leads`) and webhook subscriptions.
- Same conventions: cursor pagination, Zod-validated query, RLS still enforced via the key's org scope, rate-limited per key (§7.2). OpenAPI spec generated from the Zod schemas. Out of scope for v1 launch (ROADMAP later phase) — the surface is reserved here so the action layer stays the single internal contract.

---

## 5. Webhooks (inbound)

All webhook handlers: **verify signature first**, return `2xx` fast (ack), process idempotently, never trust payload for authorization, run under the **service role** (RLS bypass by design — [DATABASE_SCHEMA.md §8.3](DATABASE_SCHEMA.md)). Sentry captures failures; non-2xx triggers provider retry.

### 5.1 Stripe — `POST /api/webhooks/stripe` (or Supabase Edge Function)
1. **Verify** `Stripe-Signature` with the endpoint secret (raw body; Next.js route disables body parsing).
2. **Idempotency:** `INSERT INTO stripe_events (id, type, payload, status='received')`; if PK conflict → already handled → ack `200` ([DATABASE_SCHEMA.md §3.2](DATABASE_SCHEMA.md)).
3. **Dispatch** by `event.type`, then mark `processed`/`failed` with `processed_at`/`error`.

| Stripe event | Effect (tables) |
|--------------|-----------------|
| `checkout.session.completed` | Set/confirm `organizations.stripe_customer_id`; create/activate `subscriptions`. |
| `customer.subscription.created` / `.updated` | Upsert `subscriptions` (`status`, `quantity`, `current_period_*`, `cancel_at_period_end`, `trial_ends_at`); upsert `subscription_items`. |
| `customer.subscription.deleted` | `subscriptions.status='canceled'`, `canceled_at`; flip org access (app layer). |
| `customer.subscription.paused` / `resumed` | Update `subscription_status`. |
| `invoice.created` / `.finalized` | Upsert `invoices_billing` (status, amounts as `bigint` minor units, `hosted_invoice_url`, `invoice_pdf`). |
| `invoice.paid` | `invoices_billing.status='paid'`, `paid_at`; clear past-due gating. |
| `invoice.payment_failed` | `invoices_billing` + `subscriptions.status='past_due'`; trigger dunning notification. |
| `payment_method.attached` / `.detached` | Upsert/remove `payment_methods` (display fields only — no PCI, [DATABASE_SCHEMA.md §3.2](DATABASE_SCHEMA.md)). |
| `customer.subscription.trial_will_end` | Notify org owner (`enqueueNotification`). |

- **Retry handling:** Stripe retries on non-2xx for up to ~72h; idempotency via `stripe_events.id` makes replays safe. A failed event is left `status='failed'` for a reconcile job.
- **Outbound calls** (Checkout, Portal, plan change, seat sync) all pass an `Idempotency-Key` (§2.6).

### 5.2 Resend — `POST /api/webhooks/resend`
- Verify signing secret. Match `provider_message_id` → update `notification_deliveries.status`:
  `email.sent → sent`, `email.delivered → delivered`, `email.bounced/complained → bounced`, `email.delivery_delayed → queued`. Sets `delivered_at`/`error`. Idempotent on `(provider_message_id, status)`.
- Hard bounces flip the user's email channel off in `notification_preferences` (suppression) and alert via in-app notification.

### 5.3 Supabase Auth — `POST /api/webhooks/supabase`
- Verify webhook secret. Events:
  - **user.created / signup** → upsert `public.users` mirror row (id = `auth.users.id`); if signup carried an invite `token`, run `acceptInvitation`.
  - **user.updated** → sync `email`/`full_name`/`avatar_url`.
  - **user.deleted** → cascade via FK (`memberships`/`user_roles` `ON DELETE CASCADE`, [DATABASE_SCHEMA.md §5](DATABASE_SCHEMA.md)); `created_by`/`updated_by` → `SET NULL`.
- Also handles Storage object events to flip `files.status` (`pending→clean`) post AV scan.

---

## 6. TanStack Query Patterns

Client components reach the server through `features/<feature>/api/use-*.ts` hooks ([ARCHITECTURE.md §5](ARCHITECTURE.md)). Reads in RSC; client interactivity (filters, infinite scroll, mutations) via TanStack Query calling **read-only or write Server Actions**.

### 6.1 Org-scoped query keys
Every key is prefixed with the active `orgId` so caches never leak across companies (defense-in-depth alongside RLS):
```ts
['org', orgId, 'quotes', 'list', filters]        // list
['org', orgId, 'quotes', 'detail', quoteId]      // detail
['org', orgId, 'items', 'list', { cursor, ...f }] // infinite (useInfiniteQuery)
['org', orgId, 'running-bill', customerId]
['org', orgId, 'notifications', 'unread-count']
```
On org switch, the whole `['org', oldOrgId]` subtree is removed.

### 6.2 Invalidation
- Mutations call `queryClient.invalidateQueries({ queryKey: ['org', orgId, 'quotes'] })` on success.
- Cross-entity effects invalidate siblings: `postChallan` invalidates `['org',orgId,'items']` (stock changed), `['org',orgId,'running-bill', customerId]`, and `['org',orgId,'stock-reports']`.
- Server Actions additionally call `revalidatePath`/`revalidateTag` for RSC-rendered routes so server and client caches agree.

### 6.3 Mutation + optimistic update
```ts
useMutation({
  mutationFn: (input) => markRead(input),                       // Server Action
  onMutate: async (input) => {
    await qc.cancelQueries({ queryKey: ['org', orgId, 'notifications'] });
    const prev = qc.getQueryData(notifKey);
    qc.setQueryData(notifKey, optimisticallyMarkRead(prev, input.ids)); // instant UI
    return { prev };
  },
  onError: (_e, _input, ctx) => qc.setQueryData(notifKey, ctx.prev),     // rollback
  onSettled: () => qc.invalidateQueries({ queryKey: notifKey }),         // reconcile
});
```
For entity edits, optimistic updates carry `expectedUpdatedAt`; a `conflict` `ActionErr` rolls back and surfaces a "reload" prompt (§2.7).

### 6.4 Prefetch in RSC + hydration
- The RSC page creates a `QueryClient`, `prefetchQuery`/`prefetchInfiniteQuery` the same keys, and wraps children in `<HydrationBoundary state={dehydrate(qc)}>`. The first paint is server-rendered; subsequent interactions are instant from cache.
- Detail pages prefetch the detail key; list pages prefetch page 1 of the cursor list.

---

## 7. Error Handling, Rate Limiting, Auth Enforcement

### 7.1 Error handling & Sentry
- Server Actions and Route Handlers run inside a `withErrorHandling` wrapper: known errors map to typed `ActionError` codes (§2.1); unknown errors are **captured by Sentry** (`Sentry.captureException`) with org/user/action tags and a scrubbed payload (no PII/secrets), then returned as a generic `internal` error.
- Client: a global error boundary + TanStack Query `onError` report client exceptions to Sentry. PostHog records the failed action as a product event for funnel analysis.
- **Performance:** Sentry tracing spans wrap each action/handler and the Drizzle calls and Stripe/Resend calls within them, so slow tenants/queries are attributable.

### 7.2 Rate limiting
- Per-org + per-user sliding window (Upstash/Redis or Supabase-backed counter) applied at the action/handler entry:
  - Mutations: generous default (e.g. 60/min/user); export & email/WhatsApp send tightly limited (e.g. 10/min/org) to protect Resend/WhatsApp quotas and reflect plan tier.
  - `/api/v1/**` public API: per-API-key quotas tied to plan (§4.5).
- Webhook endpoints are **not** user-rate-limited (provider-controlled) but are signature-gated and idempotent.
- Over-limit → `rate_limited` `ActionErr` / HTTP `429` with `Retry-After`.

### 7.3 Auth & permission enforcement (defense-in-depth with RLS)
```
Layer 3  UI gating (hide/disable)         ── UX only, never trusted
Layer 2  Server Action / Route Handler    ── getActionContext + requirePermission(key)
                                              + business rules (state transitions, thresholds, plan limits)
Layer 1  Postgres RLS                      ── app.has_permission / app.is_member / app.is_org_owner / app.is_super_admin
Layer 4  audit_logs                        ── immutable trail on sensitive mutations
```
- The active **org is bound server-side** from validated `memberships`, never from the request body (§2.3).
- Plan/seat gates (`checkPlanLimit`, `syncSeats`) run at layer 2 **before** the write; RLS still isolates data even if a gate is bypassed.
- Service-role paths (webhooks, cron) explicitly bypass RLS and therefore carry **no** user permission context — they must set `org_id` correctly themselves and are the most carefully audited code paths ([DATABASE_SCHEMA.md §8.3](DATABASE_SCHEMA.md)).

---

## 8. Realtime Channels (Supabase Realtime)

Realtime is **opt-in per feature** and always **org-scoped + RLS-authorized** — Supabase Realtime honors the same RLS policies on the underlying tables, so a client can only subscribe to rows it could already `SELECT`.

| Channel | Source | Purpose | Auth |
|---------|--------|---------|------|
| `org:{orgId}:notifications:{userId}` | Postgres changes on `notifications` | Live unread badge + toast; drives `markRead` optimistic cache (§6.3). | RLS: `notifications.user_id = auth.uid()` and org membership. |
| `org:{orgId}:approvals` | Postgres changes on `approval_requests` | Live approval queue updates for approvers. | RLS: member + step permission (e.g. `expenses.approve`). |
| `org:{orgId}:quote:{quoteId}` | Realtime **Presence** (broadcast) | Collaborative editing presence ("Asha is editing") + soft-lock hints on the quote builder. | Channel join authorized by `quotes.edit` on the org; presence payload carries only `userId`/cursor, no row data. |
| `org:{orgId}:deliveries` | Postgres changes on `notification_deliveries` | Live email/WhatsApp delivery status in send dialogs. | RLS: `stock_report.export`/sender scope. |
| `org:{orgId}:billing` | Postgres changes on `subscriptions` | Reflect Stripe webhook reconciliation (plan/seat/status) in the billing page without refresh. | RLS: `settings.manage`. |

- **Channel naming** always embeds `orgId` so a subscription can't span tenants; the server-issued Realtime token carries the user's claims, and RLS rejects out-of-scope rows even if a client crafts a channel name.
- **Presence** (collaborative) uses Realtime broadcast (no DB rows); join is gated by a Server Action that verifies the edit permission before handing back the channel token, and presence state is ephemeral (cleared on disconnect). Actual edits still go through `updateQuote` with optimistic concurrency (§2.7) — presence is advisory, not a lock.

---

*End of API_DESIGN.md — server-interaction contract. Reads = RSC + Drizzle; mutations = Server Actions returning `ActionResult<T>`; webhooks/files/PDF/export = Route Handlers; Stripe/Resend/Supabase webhooks are idempotent and signature-verified. All layers sit atop the authoritative RLS in [PERMISSIONS.md §6](PERMISSIONS.md) over the schema in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). No application code or migrations are produced here.*
