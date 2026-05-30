# Watcon SaaS — Build Sequence (Junior-Developer Playbook)

> **Status:** Authoritative build order. No guessing required.
> **Date:** 2026-05-29
> **Read with:** [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (tables/enums), [RLS_POLICIES.md](RLS_POLICIES.md) (policies/helpers), [PERMISSIONS.md](PERMISSIONS.md) (keys/roles), [API_DESIGN.md](API_DESIGN.md) (actions/contracts), [ARCHITECTURE.md](ARCHITECTURE.md) (folders), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (scope), [CRITICAL_GAPS.md](CRITICAL_GAPS.md) (must-fix gaps).

## 0. How to use this document

Build modules **strictly top-to-bottom**. A module may only depend on modules above it. Each module lists, in order: **(1) Tables · (2) Enums · (3) Permissions · (4) RLS policies · (5) Pages · (6) Components · (7) Hooks · (8) Server actions · (9) Tests.**

- **Names are exact.** Table/column names come from `DATABASE_SCHEMA.md`; permission keys from `PERMISSIONS.md §2`; action names from `API_DESIGN.md §3` / `IMPLEMENTATION_PLAN.md`. Use them verbatim.
- **⚠ GAP** callouts point to a `CRITICAL_GAPS.md` finding you must handle while building that module (e.g. a missing table, a missing permission key, a locking requirement). Do not skip them.
- **Module 0–3 already exist** (the Authentication implementation). They are summarized for completeness; start net-new work at Module 4.

### Conventions (apply to EVERY module — don't repeat per module)

- **Folder layout** (`ARCHITECTURE.md`): routes in `app/`, vertical slices in `features/<m>/{components,hooks,server,api}`, Drizzle tables in `lib/db/schema/<m>.ts` (add to `schema/index.ts`), Zod in `validations/<m>.ts`, pure math in `lib/calc/`, infra in `services/`.
- **Envelope** (`DATABASE_SCHEMA §1.3`): every business table has `id uuid pk`, `org_id uuid not null → organizations.id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` (soft delete). Money `numeric(14,2)`, qty `numeric(14,3)`, pct `numeric(6,3)`. Append-only/junction tables omit parts as noted in the schema.
- **RLS standard template** (`RLS_POLICIES §4 / §1.3`): `enable` + `force` RLS; four policies — `T_select` (`is_member(org_id) AND deleted_at IS NULL AND has_permission('<p>.view', org_id)`), `T_insert` (`WITH CHECK has_permission('<p>.create')`), `T_update` (`has_permission('<p>.edit')`, soft-delete is an UPDATE of `deleted_at`), `T_delete` (hard delete = `is_org_owner` only). Wrap helper calls as `(select app.has_permission(...))` ⚠ **GAP G-35** (InitPlan perf).
- **Child-table rule** ⚠ **GAP G-14**: every child table carries its own `org_id`; add a composite FK `(org_id, parent_id) → parent(org_id, id)` + `UNIQUE(org_id, id)` on the parent so a child can never point at another tenant's parent.
- **Server actions** return `ActionResult<T>` (`types/action.ts`), validate input with the module's Zod schema, resolve `getActionContext()` + `requirePermission(ctx, key)`, then write via the **JWT-carrying Supabase client** (RLS-enforced) — Drizzle only for system/service paths (`CRITICAL_GAPS G-31`). Sensitive mutations write `audit_logs`.
- **Definition of Done** (per `IMPLEMENTATION_PLAN §13`): schema + migration applied; RLS enabled+forced with ≥1 policy (CI `check-rls`); Zod shared client+server; UI permission-gated AND server `requirePermission`; audit on sensitive writes; unit + integration + 1 e2e test; Sentry capture + PostHog event; empty/loading/error states.
- **Cross-cutting per module:** add new permission keys to `permissions` catalog + seed (`migrations/0003`), add new enums to `lib/db/schema/enums.ts` AND a SQL migration (names/order must match), register new query keys in TanStack Query as `[orgId, '<entity>', …]`.

---

## 1. Dependency order (the DAG)

```
M0 Foundation ─► M1 Auth ─► M2 Company ─► M3 Users ─► M4 Billing
                                   │
        ┌──────────────────────────┼───────────────────────────────┐
        ▼                          ▼                                ▼
  M5 Files            M6 Notifications                       M7 Approvals engine
        └───────────────┬──────────┴───────────────┬────────────────┘
                        ▼                           ▼
                  M8 Customers ─► M9 Leads     M10 Items ─► M11 Stock ─► M12 Procurement(PO/GRN)
                        │                                                   │
                        └───────────────┬───────────────────────┬─────────┘
                                        ▼                        ▼
                                 M13 Quotes ─► M14 Sales Orders & Challans
                                        │                        │
                                        ▼                        ▼
                                 M15 Invoices ─► M16 Payments ─► M17 Expenses & Budgets
                                                                 │
                  M18 Employees ─► M19 Attendance/Leave/Appraisals ─► M20 Payroll
                                        │
                                        ▼
                                 M21 Reporting & Analytics ─► M22 Dashboard
```

**Build order (numbered):** 0→1→2→3→4→5→6→7→8→9→10→11→12→13→14→15→16→17→18→19→20→21→22.

> M5–M7 (cross-cutting services) are built early because later modules consume them (Items needs Files for images; everything emits Notifications; discounts/expenses/PO/payroll use Approvals). The Approvals **engine** is built at M7; its **wiring** into each money flow happens in that flow's module.

---

# PHASE A — Platform foundation

## M0 — Foundation & Observability  ✅ (built)
1. **Tables:** none (infra).  2. **Enums:** `record_status`, `audit_action`, `currency_code`.  3. **Permissions:** establishes the key model + full catalog seed.  4. **RLS:** helper fns `app.current_orgs/is_member/is_super_admin/is_org_owner/has_permission` + billing stubs `has_active_subscription/within_plan_limit` (⚠ **G-19** fail-open until M4).  5. **Pages:** `app/(app)/layout` shell, providers, error/loading.  6. **Components:** `components/layout/{app-shell,sidebar,topbar}`, `components/shared/{permission-gate,data-table,empty-state}`, `providers/*`.  7. **Hooks:** `use-permissions`, `use-org`, `use-toast`.  8. **Server actions:** none.  9. **Tests:** `check-rls` CI script; `lib/env` parse test.
> Integrations: Sentry init + source maps; PostHog init; Tailwind tokens; shadcn/ui. (Tailwind/shadcn/Sentry/PostHog config still TODO from the scaffold.)

## M1 — Authentication  ✅ (built)
1. **Tables:** `users` (profile mirror), reads `memberships`.  2. **Enums:** —.  3. **Permissions:** none (pre-auth).  4. **RLS:** `users_select`, `users_update_self`; trigger `handle_new_user` (profile create), `block_super_admin_change`.  5. **Pages:** `(auth)/login`, `(auth)/forgot-password`, `(auth)/reset-password`, `auth/callback/route.ts`, `(app)/layout` guard.  6. **Components:** `login-form`, `forgot-password-form`, `reset-password-form`.  7. **Hooks:** form hooks inline (RHF).  8. **Actions:** `signIn`, `signInWithMagicLink`, `requestPasswordReset`, `resetPassword`, `signOut`.  9. **Tests:** `validations/auth` unit (done); integration: signup→profile mirror, recovery flow.

## M2 — Company Management  ✅ (built)
1. **Tables:** `organizations`, `organization_settings`, `number_sequences`.  2. **Enums:** —.  3. **Permissions:** `settings.manage`.  4. **RLS:** `org_select/org_update` (no insert — provisioning RPC), `os_select/os_write`, `nseq_select/nseq_write`; function `public.create_organization` (SECURITY DEFINER).  5. **Pages:** `onboarding/company-setup`, later `settings/company`.  6. **Components:** `company-setup-form` (+ later `company-profile-form`, `logo-upload`, `numbering-config`, `org-switcher`).  7. **Hooks:** `use-org`.  8. **Actions:** `createOrganization`, `switchOrganization` (+ later `updateSettings`, `configureNumberSequence`).  9. **Tests:** `validations/company` unit (done); integration: provisioning atomicity, org isolation.

## M3 — User Management  (partly modeled; finish the UI/actions)
1. **Tables:** `invitations`, `memberships`, `user_roles`, `roles`, `role_permissions` (reads `permissions`).  2. **Enums:** —.  3. **Permissions:** `admin.users`, `admin.roles`, `admin.audit`.  4. **RLS:** `mem_*`, `ur_*`, `roles_*`, `rp_*`, `inv_*`, `audit_select/audit_insert`. ⚠ **G-16**: invitation-accept (service role) must bind token (hashed, single-use, email-match, expiry) — implement in the accept Edge Function/RPC.  5. **Pages:** `admin/users`, `admin/users/invite`, `admin/roles`, `accept-invitation/[token]`, `admin/audit`.  6. **Components:** `user-table`, `invite-user-dialog`, `member-card`, `role-assignment-select`, `role-permission-matrix`, `pending-invites-list`, `audit-log-table`.  7. **Hooks:** `use-members`, `use-roles`, `use-invitations` (TanStack Query).  8. **Actions:** `inviteMember`, `acceptInvitation`, `revokeMembership`, `assignRole`, `revokeRole`, `defineRole`, `updateSettings`, `listAuditLogs`.  9. **Tests:** invite/accept flow; role assignment writes `permission_change` audit; ⚠ **G-27** separation-of-duties (`requested_by <> actor_id`) once approvals exist.

## M4 — Billing (Stripe)
1. **Tables:** `plans`, `plan_features`, `subscriptions`, `subscription_items`, `invoices_billing`, `payment_methods`, `usage_records`, `stripe_events`.  2. **Enums:** `billing_interval`, `subscription_status`, `billing_invoice_status`, `payment_method_type`, `usage_metric`, `plan_feature_type`, `stripe_event_status`.  3. **Permissions:** `settings.manage` (mutations), reads via member; platform `org.manage`/`system.config`.  4. **RLS:** `plans`/`plan_features` read-all + super-admin write; `subscriptions`/`subscription_items`/`invoices_billing`/`payment_methods`/`usage_records` **member-read, service-role-only write**; `stripe_events` service-role only (`RLS_POLICIES §4.2`). ⚠ **G-19**: now REPLACE the M0 fail-open `has_active_subscription`/`within_plan_limit` stubs with the real `RLS_POLICIES §2.2` bodies, and seed a default plan + auto-create a trialing subscription on org creation. ⚠ **G-16e**: decide GST-on-SaaS-fee columns on `invoices_billing`.  5. **Pages:** `settings/billing` (plan, seats, invoices), pricing/upgrade.  6. **Components:** `plan-card`, `subscription-status`, `seat-usage`, `billing-invoice-list`, `upgrade-dialog`.  7. **Hooks:** `use-subscription`, `use-plan-limits`.  8. **Actions:** `createCheckoutSession`, `createBillingPortalSession`, `changePlan`, `cancelSubscription`, `syncSeats`*, `checkPlanLimit`*, `recordUsage`*, `getSubscriptionStatus`.  Route handler `api/webhooks/stripe` (idempotent via `stripe_events.id`; ⚠ **G-16g** upsert on `stripe_subscription_id`; ⚠ **G-16c** advisory-lock seat sync).  9. **Tests:** webhook idempotency/ordering; seat-count drift; plan-limit gate; past-due grace (⚠ **G-16d** reconcile cron).
> May be deferred for MVP; until then M0 stubs keep writes open.

---

# PHASE B — Cross-cutting services

## M5 — Files & Storage
1. **Tables:** `files`.  2. **Enums:** `file_status`.  3. **Permissions:** scoped by the owning entity's key (e.g. uploading a product image needs `items.edit`); no standalone `files.*`.  4. **RLS:** `files` standard (member read, owning-permission write); Storage bucket policies keyed on `{org_id}/...` path. ⚠ **G-17**: add `WITH CHECK` to the storage UPDATE policy and a `files.path` ↔ `org_id` invariant.  5. **Pages:** none (used inline).  6. **Components:** `components/shared/file-upload`, `image-thumb`, `file-list`.  7. **Hooks:** `use-file-upload` (sign → PUT → commit).  8. **Actions / routes:** `api/files/sign` (presigned URL), `api/files/commit` (insert `files` row); AV-scan callback updates `files.status`.  9. **Tests:** path-forgery denial; cross-org object access denial; signed-URL membership check.

## M6 — Notifications
1. **Tables:** `notifications`, `notification_preferences`, `notification_templates`, `notification_deliveries`.  2. **Enums:** `notification_channel`, `notification_status`, `delivery_status`.  3. **Permissions:** none new (self-scoped); fan-out is server-only.  4. **RLS:** `notifications` self-scoped (`user_id = auth.uid()` for select); ⚠ **G-20** tighten `notif_insert WITH CHECK` so a member can only target themselves unless a server fan-out role; `notification_deliveries` service-role write (provider webhooks).  5. **Pages:** `notifications` inbox; `settings/notifications` (preferences).  6. **Components:** `notification-bell`, `notification-list`, `notification-item`, `preference-toggles`.  7. **Hooks:** `use-notifications` (TanStack Query + Supabase Realtime), `use-notification-preferences`.  8. **Actions:** `markRead`, `markAllRead`, `archiveNotification`, `updatePreferences`; server `emitNotification(event)` (fan-out → in_app + Resend email). Route handler `api/webhooks/resend` (delivery/bounce → `notification_deliveries`).  9. **Tests:** fan-out routing by preference; Realtime auth; delivery idempotency (`provider_message_id`).

## M7 — Approvals engine (generic)
1. **Tables:** `approval_workflows`, `approval_steps`, `approval_requests`, `approval_actions`.  2. **Enums:** `approval_entity_type`, `approval_request_status`, `approval_step_type`, `approval_decision`.  3. **Permissions:** approvers gated by the **domain** key (e.g. `discount.approve`, `expenses.approve`); engine config under `settings.manage`.  4. **RLS:** `approval_requests`/`approval_actions` standard, scoped by `org_id`; `approval_actions` append-only. ⚠ **G-27**: `WITH CHECK requested_by <> actor_id` so no self-approval.  5. **Pages:** `approvals` queue; `settings/approvals` (workflow config); approval widget embedded in domain pages.  6. **Components:** `approval-queue`, `approval-request-card`, `approve-reject-dialog`, `workflow-editor`, `approval-status-badge`.  7. **Hooks:** `use-approvals`, `use-approval-request`.  8. **Actions:** `submitForApproval(entityType, entityId, amount)`, `approveRequest`, `rejectRequest`, `escalateRequest`, `defineWorkflow`. Threshold logic reads `organization_settings.approval_limits`.  9. **Tests:** threshold escalation; self-approval rejected; state machine (pending→approved/rejected/escalated).
> Engine only here. Wiring (call `submitForApproval`) is added in M16/M17/M12/M20.

---

# PHASE C — Master data

## M8 — Customers (CRM)
1. **Tables:** `customers`, `payments` (the table is created here so Running Bill can exist; payment **recording UI/actions** land in M16).  2. **Enums:** `payment_mode`.  3. **Permissions:** `customers.view/create/edit/delete`, `running_bill.view`, `payments.view`.  4. **RLS:** `customers` standard; `payments` standard (record gated `payments.record` in M16). View `customer_running_bill` (security-barrier). ⚠ **G-26** the Running Bill (`Σ challan_item.value − post_sale_discount − Σ payments`) and the invoice/allocation ageing are two truths — document which is canonical before M15. ⚠ **G-38** add `customers.opening_balance` for legacy AR migration.  5. **Pages:** `customers`, `customers/new`, `customers/[id]`, `customers/[id]/edit`.  6. **Components:** `customer-list`, `customer-card`, `customer-form` (billing vs delivery, "Same as Billing"), `running-bill`, `payment-list`, `record-payment-dialog` (M16).  7. **Hooks:** `use-customers`, `use-customer`, `use-running-bill`.  8. **Actions:** `createCustomer`, `updateCustomer`, `softDeleteCustomer`, `listCustomers`, `getCustomer`, `getRunningBill`. (`recordPayment` in M16.)  9. **Tests:** `lib/calc/running-bill` unit; customer search; billing/delivery split persists.

## M9 — Leads (CRM)
1. **Tables:** `leads`, `lead_stages`, `lead_activities`.  2. **Enums:** `lead_status`, `lead_activity_type`.  3. **Permissions:** ⚠ **G-34** `leads.view/create/edit/delete` are **NOT in the catalog yet** — ADD them to `permissions` seed (`migrations/0003`) and to the role-grant matrix.  4. **RLS:** `leads` standard **with owner-scoping** (`created_by = auth.uid()` OR `has_permission('leads.view'…)` for managers); `lead_activities` child of lead.  5. **Pages:** `leads` (list + kanban), `leads/[id]`, `leads/new`.  6. **Components:** `lead-list`, `lead-pipeline` (kanban by stage), `lead-card`, `lead-form`, `activity-timeline`, `convert-to-customer-dialog`.  7. **Hooks:** `use-leads`, `use-lead`, `use-lead-activities`.  8. **Actions:** `createLead`, `updateLead`, `moveLeadStage`, `addLeadActivity`, `convertLead` (→ `createCustomer`), `listLeads`.  9. **Tests:** stage transitions; conversion creates a customer; owner-scope RLS.

## M10 — Inventory Lookups & Items (+ import calculator)
1. **Tables:** `item_families`, `brands`, `units`, `items`, `item_variations` (reads `suppliers` for `last_supplier_id` — created in M12; make FK nullable now).  2. **Enums:** `currency_code` (exists), `transport_type`.  3. **Permissions:** `items.view/create/edit/delete`, `pricing.override`. ⚠ **G-30** column-guard trigger: block `selling_price`/`purchase_price`/`stock` UPDATE without the right key. ⚠ **G-3** add `items.hsn_code` + default `gst_pct` (+ `tax_rates` lookup) now if GSTR matters.  4. **RLS:** `items` standard; lookups standard; `item_variations` child.  5. **Pages:** `items`, `items/new`, `items/[id]`, `items/[id]/edit`.  6. **Components:** `item-list`, `item-card` (low-stock flag), `item-detail`, `item-form`, `import-calculator`, `variation-builder`, `item-image-upload` (uses M5).  7. **Hooks:** `use-items`, `use-item`, `use-import-calc` (wraps `lib/calc/import-cost`).  8. **Actions:** `createItem`, `updateItem`, `softDeleteItem`, `createVariations` (spawn child items), `listItems`, `getItem`, `createBrand/createFamily/createUnit`.  9. **Tests:** **`lib/calc/import-cost` unit (critical)** — base×rate→disc→transport→duty→multiplier; variation spawn; low-stock flag.

## M11 — Stock (adjustments & movements)
1. **Tables:** `stock_adjustments` (immutable), `stock_movements` (append-only). Maintains `items.stock`.  2. **Enums:** `stock_adj_type`, `stock_direction`.  3. **Permissions:** `stock.adjust`, `reports.inventory.view`.  4. **RLS:** `stock_adjustments` insert gated `stock.adjust`, **no update/delete** (mandatory `reason`); `stock_movements` insert by system on posting, **no update/delete**. ⚠ **G-23** stock mutation MUST be a trigger doing in-place `stock = stock + delta` under row lock + a `CHECK (stock >= 0)` (or backorder flag). ⚠ **G-4** decide single- vs multi-location (`location_id`) now.  5. **Pages:** `inventory` (overview + valuation), `inventory/movements`; stock panel in `items/[id]`.  6. **Components:** `stock-overview`, `stock-adjust-dialog` (reason required, admin/manager), `stock-movement-table`, `stock-level-badge`, `low-stock-list`, `valuation-summary`.  7. **Hooks:** `use-stock-levels`, `use-stock-movements`, `use-adjust-stock`.  8. **Actions:** `adjustStock` (gated, audited), `listStockMovements`, `getStockLevels`, `getStockValuation`, `getLowStock`.  9. **Tests:** concurrent posting keeps stock correct (locking); negative-stock blocked; ⚠ **G-24** costing method (FIFO/WAC) chosen and COGS reproducible.

## M12 — Suppliers & Procurement (PO + GRN)
1. **Tables:** `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`.  2. **Enums:** `purchase_order_status`, `goods_receipt_status`.  3. **Permissions:** ⚠ **G-34** `suppliers.view/create/edit`, `purchase_orders.view/create/edit/delete`, `goods_receipt.post` are **NOT in the catalog** — ADD them.  4. **RLS:** all standard; `goods_receipt.post` gates GRN posting; child tables per **G-14**. ⚠ **G-8** decide supplier-bill/3-way-match scope. ⚠ **G-26b** capture `exchange_rate` on GRN for imports.  5. **Pages:** `suppliers`, `suppliers/new`, `suppliers/[id]`, `purchase-orders`, `.../new`, `.../[id]`, `.../[id]/receive`.  6. **Components:** `supplier-list/form`, `po-list`, `po-builder`, `po-item-row`, `goods-receipt-form`, `receive-goods-dialog`, `po-status-badge`.  7. **Hooks:** `use-suppliers`, `use-purchase-orders`, `use-purchase-order`, `use-receive-goods`.  8. **Actions:** `createSupplier/updateSupplier/listSuppliers`, `createPurchaseOrder`, `updatePurchaseOrder`, `sendPurchaseOrder`, `receiveGoods` (creates GRN → `stock_movements(in)` via M11 trigger, updates `last_purchase_price/date/supplier`, advances `purchase_order_items.received_qty`), `listPurchaseOrders`, `getPurchaseOrder`. Route `api/pdf/purchase-order`.  9. **Tests:** GRN posting increments stock + cost; partial receipt tracking; status transitions.

---

# PHASE D — Transactions

## M13 — Quotes
1. **Tables:** `quotes`, `quote_locations`, `quote_location_installation`, `quote_items`, `quote_item_options`, `quote_terms` (reads `customers`, `items`).  2. **Enums:** `quote_status`, `gst_mode`, `quote_total_mode`, `install_mode`, `term_category`.  3. **Permissions:** `quotes.view/create/edit/revise/delete/export`. ⚠ **G-32** decide Employee own-records scoping on `quotes` (add `created_by` row filter or drop the promise).  4. **RLS:** `quotes` standard; all child tables carry `org_id` + composite FK (**G-14**); `quotes_select` etc.  5. **Pages:** `quotes`, `quotes/new`, `quotes/[id]`, `quotes/[id]/edit`.  6. **Components:** `quote-list`, `quote-builder` (RHF `useFieldArray`), `location-section`, `line-item-row`, `alternate-item-row`, `installation-block`, `totals-panel`, `per-area-selection`, `total-mode-selector`, `gst-mode-selector`, `terms-editor`, `boq-preview`, `quote-preview`, `export-menu`.  7. **Hooks:** `use-quotes`, `use-quote`, `use-quote-form`, `use-quote-totals` (wraps `lib/calc/quote-totals`).  8. **Actions:** `createQuote`, `updateQuote`, `reviseQuote`, `changeQuoteStatus`, `listQuotes`, `getQuote`. Routes `api/pdf/quote`, `api/pdf/boq` (data-driven, locked columns).  9. **Tests:** **`lib/calc/quote-totals` unit (critical)** — line total, installation modes, GST modes, selected-areas-only, total modes; **preview == PDF parity**; revision chain.

## M14 — Sales Orders & Delivery Challans
1. **Tables:** `sales_orders`, `sales_order_items`, `delivery_challans`, `delivery_challan_items`.  2. **Enums:** `sales_order_status`.  3. **Permissions:** `sales_orders.view/create/edit/delete`, `challans.view/create/edit/post/delete`.  4. **RLS:** standard; `challans.post` gates posting; child tables per **G-14**. ⚠ **G-6** add `invoice/challan ↔ SO line` links + `delivered_qty/invoiced_qty` to prevent over/double-billing. ⚠ **G-9** define quote→SO conversion (selected locations only, exclude alternates, latest revision).  5. **Pages:** `sales-orders`, `.../new`, `.../[id]`, `challans`, `.../new`, `.../[id]`.  6. **Components:** `so-list`, `so-builder` (+ create-from-quote picker), `so-item-row`, `so-status-badge`, `challan-list`, `challan-form`, `post-challan-dialog`.  7. **Hooks:** `use-sales-orders`, `use-sales-order`, `use-challans`, `use-post-challan`.  8. **Actions:** `createSalesOrder` (from accepted quote), `updateSalesOrder`, `changeSOStatus`, `createChallan`, `postChallan` (→ `stock_movements(out)` via M11 trigger; one-way; feeds `customer_running_bill`), `listSalesOrders`, `listChallans`. Route `api/pdf/challan`.  9. **Tests:** quote→SO conversion correctness; challan posting decrements stock + updates running bill; no double-billing.

## M15 — Invoices (GST)
1. **Tables:** `invoices`, `invoice_items`.  2. **Enums:** `invoice_status`.  3. **Permissions:** `invoices.view/create/edit/issue/delete`.  4. **RLS:** standard; `invoices.issue` allowed in update policy; child per **G-14**. ⚠ **G-1** add `credit_notes`/`credit_note_items` (returns/reversals) — the schema only has `cancelled`. ⚠ **G-11** reserve `irn/ack_no/signed_qr/eway_bill_no` columns + issue-time hook before issuing real invoices. ⚠ **G-28** fix per-line vs invoice-level rounding so header == Σ lines.  5. **Pages:** `invoices`, `invoices/new`, `invoices/[id]`.  6. **Components:** `invoice-list`, `invoice-builder` (GST, HSN), `invoice-item-row`, `issue-invoice-dialog`, `invoice-preview`, `gst-summary`.  7. **Hooks:** `use-invoices`, `use-invoice`.  8. **Actions:** `createInvoice` (billed-vs-delivered guard — G-6), `updateInvoice` (draft only), `issueInvoice` (draft→issued state transition, server-layer; PDF + Resend), `voidInvoice`, `listInvoices`. Route `api/pdf/invoice`.  9. **Tests:** GST split (CGST/SGST/IGST by place_of_supply); state machine (only draft editable; issue irreversible); totals tie out.

## M16 — Payments
1. **Tables:** `payments` (from M8), `payment_allocations`.  2. **Enums:** `payment_mode` (exists).  3. **Permissions:** `payments.view/record/delete`, `discount.post_sale/approve`.  4. **RLS:** `payments` insert gated `payments.record`; `payment_allocations` append-only; void = soft, never hard. ⚠ **G-27** route `payments.delete`/`discount.approve` through M7 approvals (no self-approve).  5. **Pages:** `payments`, payment recording embedded in `customers/[id]`.  6. **Components:** `payment-list`, `record-payment-dialog`, `allocate-payment` (to invoices), `void-payment-dialog`.  7. **Hooks:** `use-payments`, `use-record-payment`.  8. **Actions:** `recordPayment` (+ `payment_allocations`), `allocatePayment`, `voidPayment` (audited), `applyPostSaleDiscount` (→ approvals if over threshold).  9. **Tests:** allocation math; running bill updates; discount approval threshold.

## M17 — Expenses & Budgets
1. **Tables:** `expenses`, `expense_approvals`, `budgets`.  2. **Enums:** `expense_status`, `budget_period_type`.  3. **Permissions:** `expenses.create/approve`, `finance.view/manage`.  4. **RLS:** `expenses` **owner-scoped** select (creator sees own; approvers/`finance.view` see all); approve gated `expenses.approve`. Wire M7 approvals.  5. **Pages:** `expenses`, `expenses/new`, `budgets`, `finance` (P&L summary).  6. **Components:** `expense-list`, `expense-form`, `expense-approval-queue`, `budget-editor`, `pnl-summary`.  7. **Hooks:** `use-expenses`, `use-budgets`.  8. **Actions:** `createExpense`, `submitExpense` (→ approval), `approveExpense`/`rejectExpense`, `createBudget`, `listExpenses`.  9. **Tests:** approval threshold escalation; owner-scope RLS; budget vs actual.

---

# PHASE E — HR

## M18 — Employees
1. **Tables:** `employees`.  2. **Enums:** —.  3. **Permissions:** `hr.view/manage`.  4. **RLS:** `employees` standard, **sensitive** (salary) — `hr.view` read, `hr.manage` write; ⚠ **G-30** column-guard salary fields.  5. **Pages:** `hr` (employee list), `hr/[id]`, `hr/new`, onboarding checklist.  6. **Components:** `employee-list`, `employee-form`, `employee-detail`, `onboarding-checklist`.  7. **Hooks:** `use-employees`, `use-employee`.  8. **Actions:** `createEmployee`, `updateEmployee`, `listEmployees`, `getEmployee`.  9. **Tests:** salary field access control; HR-only visibility.

## M19 — Attendance, Leave & Appraisals
1. **Tables:** `attendance`, `shifts`, `leave_requests`, `leave_balances`, `appraisals`.  2. **Enums:** `attendance_status`, `leave_type`, `leave_status`, `appraisal_status`.  3. **Permissions:** `hr.view/manage`, `leave.approve`.  4. **RLS:** standard; leave approval gated `leave.approve`; employee sees own attendance/leave.  5. **Pages:** `hr/attendance`, `hr/leave`, `hr/appraisals`.  6. **Components:** `attendance-calendar`, `mark-attendance`, `leave-request-form`, `leave-approval-queue`, `leave-balance`, `appraisal-form`.  7. **Hooks:** `use-attendance`, `use-leave`, `use-appraisals`.  8. **Actions:** `markAttendance`, `requestLeave`, `approveLeave`/`rejectLeave`, `accrueLeave`* (cron), `createAppraisal`.  9. **Tests:** leave balance math; approval flow; attendance regularization.

## M20 — Payroll
1. **Tables:** `payroll_runs`, `payroll_lines`.  2. **Enums:** `payroll_run_status`.  3. **Permissions:** `payroll.view` (HR), `payroll.manage` (Accountant — process). Wire M7 sign-off.  4. **RLS:** `payroll_runs`/`payroll_lines` very sensitive — `payroll.view` read, `payroll.manage` write; `payroll_lines` per **G-14**.  5. **Pages:** `payroll`, `payroll/[run]` (review), payslip view.  6. **Components:** `payroll-run-wizard` (period→compute→review→finalize), `payroll-line-table`, `payslip`.  7. **Hooks:** `use-payroll-runs`, `use-payroll-run`.  8. **Actions:** `createPayrollRun`, `computePayroll`, `submitPayrollForApproval` (M7), `finalizePayroll`, `listPayrollRuns`. Route `api/pdf/payslip`.  9. **Tests:** payroll computation; statutory components; sign-off gate.

---

# PHASE F — Insight

## M21 — Reporting & Analytics
1. **Tables:** `saved_reports`, `report_schedules`; materialized views `mv_sales_summary`, `mv_inventory_valuation`, `mv_receivables_ageing`, `mv_hr_headcount` (+ live views `customer_running_bill`, `v_*`).  2. **Enums:** `report_format`, `schedule_frequency`.  3. **Permissions:** `stock_report.view/export`, `reports.sales.view`, `reports.inventory.view`, `reports.financial.view`, `reports.hr.view`, `reports.export`.  4. **RLS:** `saved_reports`/`report_schedules` standard; MVs accessed through security-barrier `v_*` wrapper views gating `org_id`. ⚠ **G-13** plan MV refresh (per-org/incremental). ⚠ **G-12** add `v_customer_statement` + supplier-outstanding.  5. **Pages:** `reports`, `stock-reports`, `reports/sales`, `reports/receivables`, `reports/inventory`, `reports/hr`.  6. **Components:** `report-filters` (family→variation→brand cascade), `date-range-picker`, `stock-report-table`, `sales-report-table`, `receivables-ageing-table`, `valuation-report`, `chart-*`, `export-menu`, `schedule-report-dialog`.  7. **Hooks:** `use-report` (per type), `use-saved-reports`.  8. **Actions/routes:** `getStockReport`, `getSalesReport`, `getReceivablesAgeing`, `getInventoryValuation`, `saveReport`, `scheduleReport`; `api/pdf/[doc]`, `api/reports/export` (CSV/PDF); MV-refresh + report-runner crons.  9. **Tests:** hierarchical filter; export fidelity; MV freshness; PostHog dashboards wired.

## M22 — Dashboard
1. **Tables:** reads across all (via `v_*`/MVs).  2. **Enums:** —.  3. **Permissions:** `dashboard.view`.  4. **RLS:** read-only via existing policies/views.  5. **Pages:** `dashboard` (replaces the M1 placeholder).  6. **Components:** `kpi-card`, `activity-feed`, `department-load`, `priority-tasks`, `quick-stats`, `module-status`.  7. **Hooks:** `use-dashboard-metrics`.  8. **Actions:** `getDashboardMetrics` (RSC read; aggregates quote value, outstanding receivables, pending items).  9. **Tests:** metric aggregation; role-gated sections; empty states.

---

## 2. Master checklist (every module, in order)

```
[ ] enums.ts + SQL enum migration (names/order match)
[ ] Drizzle table(s) in lib/db/schema/<m>.ts  → add to schema/index.ts
[ ] SQL migration: tables + indexes + FKs (composite (org_id,parent_id) on children — G-14)
[ ] SQL migration: enable+force RLS + policies (standard 4 + specials)
[ ] Permission keys added to permissions catalog + role grants (G-34 for leads/suppliers/PO)
[ ] validations/<m>.ts (Zod) — shared by form + action
[ ] features/<m>/server/{queries.ts, actions.ts} (ActionResult, requirePermission, audit)
[ ] features/<m>/api/use-*.ts (TanStack Query keys [orgId,'<entity>',…])
[ ] features/<m>/components/*  +  app/(app)/<route>/page.tsx
[ ] lib/calc/* if money math (import-cost / quote-totals / running-bill) + unit tests
[ ] tests: unit (calc/schema) + integration (RLS/actions vs test DB) + 1 e2e
[ ] permission-gate in UI; Sentry capture; PostHog event; empty/loading/error states
[ ] address any ⚠ GAP listed for the module
```

## 3. Cross-module gap ledger (resolve when you reach the module)

| Gap | Affects module | Action |
|-----|----------------|--------|
| G-19 billing bootstrap | M4 | replace fail-open stubs; seed default plan + auto-subscription |
| G-14 child org_id FK | every child table (M13–M20) | composite FK + UNIQUE(org_id,id) |
| G-23 stock locking | M11 | in-place trigger + row lock + `stock >= 0` |
| G-24 costing method | M11 | choose FIFO/WAC; persist per-movement cost |
| G-1 / G-5 credit notes | M15 | add `credit_notes`/`credit_note_items` + restock + receivables term |
| G-6 invoice↔challan qty | M14/M15 | line links + delivered/invoiced qty + billed-vs-delivered guard |
| G-11 e-invoice/IRN/e-way | M15 | reserve columns + issue-time hook |
| G-26 dual receivables | M8/M15 | declare canonical AR; model discount as credit note |
| G-27 separation of duties | M3/M16/M17/M20 | `requested_by <> actor_id`; split/approve money flows |
| G-34 missing perm keys | M9, M12 | add `leads.*`, `suppliers.*`, `purchase_orders.*`, `goods_receipt.post` to catalog |
| G-30 column-level guards | M10/M11/M18/M20 | BEFORE UPDATE triggers on price/stock/salary/billing fields |
| G-32 employee own-records | M13/M14/M15 | add `created_by` row filter or drop the promise |
| G-31 RLS over Drizzle pool | all reads | route user CRUD through JWT Supabase client; Drizzle for system only |

---

*End of BUILD_SEQUENCE.md — build modules 0→22 in order; complete the master checklist for each; resolve the listed ⚠ GAPs in-module. Every name used here is canonical to the schema/permissions/API docs.*
