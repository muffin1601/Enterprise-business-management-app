# Watcon SaaS — Pre-Development Critical Gaps Review

> **Status:** Architecture review — findings only (no documents modified, no code generated)
> **Date:** 2026-05-29
> **Reviewer:** Lead Architect / Senior Staff Engineer
> **Scope:** PROJECT_PLAN · SYSTEM_ARCHITECTURE · DATABASE_SCHEMA · DATABASE_DESIGN · API_DESIGN · PERMISSIONS · RLS_POLICIES · IMPLEMENTATION_PLAN · AUDIT_LOGS (plus ARCHITECTURE, ROADMAP)
> **Mandate:** Identify only problems that are **expensive to fix after development begins**.

---

## 1. How this review was conducted

This is an **adversarial** review: seven independent domain reviewers each attacked a slice of the design, then **every finding was independently verified** against the source documents — to confirm it is real, grounded in a cited section, and *not already addressed* elsewhere.

- **46 issues raised → 45 confirmed → 1 rejected** (the rejected one is listed in §15 for transparency).
- Severities below are the **verifier-adjudicated** values, not the raw reviewer claims. Several reviewer findings were **downgraded** because they overstated impact or missed an existing mitigation; where that happened, a **_Review note_** records the correction so you can trust the residual claim.
- Findings tagged **[KNOWN-OPEN]** are already tracked as open decisions in the docs — included because they are decisions that must be *closed before coding*, not blind spots.

### Severity tally (adjudicated)

| Severity | Count | Meaning |
|----------|:-----:|---------|
| 🔴 Critical | 1 | Correctness/compliance defect; fix before any schema is built |
| 🟠 High | 13 | Expensive cross-module retrofit if deferred; resolve in Phase 0/1 design |
| 🟡 Medium | 19 | Cheap now, costly after live data; settle as each module is specced |
| ⚪ Low | 12 | Add to open-questions / harden opportunistically |
| **Total** | **45** | |

### Findings per dimension

| # | Dimension | Findings |
|---|-----------|:--------:|
| 1 | Missing entities | 4 |
| 2 | Missing workflows | 5 |
| 3 | Missing reports | 2 |
| 4 | Multi-tenant risks | 1 |
| 5 | Security risks | 5 |
| 6 | Scaling risks | 1 |
| 7 | Billing risks | 7 |
| 8 | Inventory risks | 4 |
| 9 | Accounting risks | 3 |
| 10 | Permission model issues | 6 |
| 11 | Performance bottlenecks | 4 |
| 12 | Future migration problems | 3 |

---

## 2. Executive summary — the five themes that matter

1. **The financials can only move one direction.** There is no credit note / sales return / debit note anywhere, and outstanding is computed two incompatible ways (challan-based Running Bill vs invoice/allocation-based ageing). This is the single most expensive cluster to retrofit because it touches the receivables view, GST math, stock direction, and every financial report. → G-1, G-21, G-22, plus the accounting trio.
2. **Tenant isolation has two contract-level holes.** (a) Child tables carry a denormalized `org_id` that is never tied to the parent's `org_id`, so a dual-org member can attach children to another tenant's documents; (b) the read path runs through Drizzle on a pooled connection while RLS depends on per-request JWT claims — a documented contradiction between two canonical docs. Both are cheap to pin *now* and breach-class to fix later. → G-14, G-31.
3. **Billing is wired into RLS before billing exists.** Every business INSERT requires `has_active_subscription()`, but the MVP "runs as default plan" with no subscription row — so on day one the gate evaluates false and *no org can create anything*. Plus a quota function that never resets per period. → G-15, G-16.
4. **Inventory has no concurrency control and no costing method.** `items.stock` is a read-modify-write scalar with no row lock and no non-negative guard, and there is no FIFO/weighted-average layer, so COGS and valuation are undefined. → G-23, G-24.
5. **The permission model concentrates money power and under-enforces at the DB.** The Accountant role is maker *and* checker across invoices/payments/discounts/payroll (no separation of duties), several "field-level" and "own-records" rules live only in app code that RLS is supposed to backstop, and Super-Admin cross-tenant reads are unlogged. → G-27, G-29, G-30, G-32.

**Bottom line:** the design is strong and internally consistent, but it is **not yet safe to start coding**. There are **14 must-resolve items** (1 Critical + 13 High) — almost all are *cheap paper/schema decisions today* and *multi-week live-data migrations later*. Resolve them in a Phase-0 design gate (§16).

---

## 3. 🚦 Fix-before-coding priority list (the 14 must-resolve items)

| ID | Severity | Title | Dimension |
|----|:--------:|-------|-----------|
| G-1 | 🔴 Critical | No credit-note / sales-return / debit-note entity | Missing entities |
| G-2 | 🟠 High | No general ledger / journal (blocks later double-entry) [KNOWN-OPEN] | Missing entities |
| G-5 | 🟠 High | Sales-returns / credit-note **workflow** absent (same root as G-1) | Missing workflows |
| G-6 | 🟠 High | Invoice↔challan/SO link is single FK — no qty reconciliation (over/double-billing) | Missing workflows |
| G-11 | 🟠 High | No GST statutory outputs (GSTR-1/3B, e-invoice/IRN, e-way bill) | Missing reports |
| G-14 | 🟠 High | Child `org_id` not tied to parent `org_id` — cross-tenant child writes | Multi-tenant |
| G-15 | 🟠 High | `audit_logs` INSERT forgeable by any member | Security |
| G-16 | 🟠 High | Invitation-accept (service-role) lacks token-binding spec | Security |
| G-19 | 🟠 High | "MVP as default plan" + RLS sub-gate ⇒ all writes blocked day one | Billing |
| G-23 | 🟠 High | `items.stock` updated with no row lock / non-negative guard | Inventory |
| G-24 | 🟠 High | No inventory costing method (FIFO/WAC) — COGS undefined | Inventory |
| G-26 | 🟠 High | Two divergent receivables truths; `post_sale_discount` unreconciled | Accounting |
| G-27 | 🟠 High | Accountant role collapses separation of duties | Permissions |
| G-31 | 🟠 High | RLS JWT claims over pooled Drizzle connection — isolation-contract gap | Performance |

> G-1 and G-5 are the **same underlying gap** seen by two reviewers (entity vs workflow). Treat as one work item with the highest priority.

---

## 4. Missing entities (4)

### G-1 🔴 Critical — No credit-note / sales-return / debit-note entity
- **Impact:** A materials trader routinely has returns, short-supply, rate corrections, and post-issue adjustments. The only modeled reversal is `invoice_status='cancelled'`. There is no way to (a) issue a GST-compliant credit note against an issued invoice, (b) put returned stock back via `stock_movements(in)` from the sales side, or (c) reduce outstanding without faking a payment. The Running Bill formula has no negative term. Cancelling an issued GST invoice instead of crediting it is **non-compliant in India**.
- **Proposed solution:** Add `credit_notes` + `credit_note_items` (mirroring invoices: `original_invoice_id`, reason, GST split, HSN) and a `document_type`/sign dimension so receivables net them; add a `credit_note_id` source to `stock_movements`. Decide the returns-restock policy **before** the receivables/ageing read-models are built.
- **Cost if fixed later:** Two new tables + a sign/type dimension across receivables logic + rebuild of `mv_receivables_ageing` and `customer_running_bill` + backfill of every "return" workaround users entered as payments/cancellations. **~2–3 wk + per-tenant financial reconciliation.** Near-zero if done now.

### G-2 🟠 High [KNOWN-OPEN] — No general ledger / journal
- **Impact:** Receivables, running bill, and P&L are all summed from source documents; there is no `accounts`/`journal_entries`/`journal_lines` layer and no home for opening balances, write-offs, bad-debt, or advances. If double-entry is adopted post-launch, every historical document must be replayed into journals *and* every report rewritten to read the ledger.
- **Proposed solution:** Make the accounting-depth decision a Phase-0 **gate**, not a deferred option. If P&L/trial-balance/advances/bad-debt are even plausible, introduce the ledger now and post documents to it from day one (reports can keep reading documents initially). At minimum add a sign-aware AR ledger.
- **Cost if fixed later:** Replay/backfill of all historical financial documents into journals across every tenant + rewrite of every receivables/sales/valuation read-model + reconciliation sign-off. **Multi-week, high-risk migration on live financial data.**
- **_Review note:_** Already tracked (DATABASE_SCHEMA §10 Q2, ROADMAP §8.2). Document-derived AR is a legitimate v1 posture — the requirement is to *decide consciously*, not necessarily to build it now.

### G-3 🟡 Medium [KNOWN-OPEN] — HSN code & GST rate have no master / per-item home
- **Impact:** `hsn_code` is free text on `invoice_items` only; GST rate is a single scalar on quotes. No `tax_rates`/HSN master and no `hsn_code`/`gst_pct` on `items`. Result: inconsistent HSN per item across invoices (fatal for GSTR-1 HSN summary) and quotes can't model multiple GST slabs.
- **Proposed solution:** Add `hsn_code` + default `gst_pct` (+`cess_pct`) to `items` and an effective-dated `tax_rates`/`hsn_codes` lookup that documents snapshot from; keep per-line snapshots for history.
- **Cost if fixed later:** `ALTER items` + catalogue-wide HSN/rate backfill per tenant + reconciling inconsistently-typed historical invoices before any GSTR export. **~1–2 wk + data cleanup.**
- **_Review note:_** Downgraded from High — `invoice_items.gst_pct` is already per-line (multi-rate *invoices* work; only quotes are single-rate), and `item_id` FK enables a clean backfill. Tracked in §10 Q1.

### G-4 🟡 Medium — Stock is a single scalar with no warehouse/location dimension
- **Impact:** On-hand is one mutable `items.stock`; `stock_movements` has no location. A trader with a yard + multiple godowns/sites can't track where stock sits, and stock transfers have no representation. Adding locations later is not additive — `items.stock` becomes ambiguous and valuation/posting paths must all gain a location.
- **Proposed solution:** Decide single- vs multi-location before launch. If plausible, add `warehouses`/`locations` + `location_id` on `stock_movements` now, keeping `items.stock` as a denormalized total. If firmly single-location, **document it as an explicit constraint in §10**.
- **Cost if fixed later:** Backfill a location onto every historical movement + re-derive per-location balances + rework valuation MVs and posting code. **~2 wk + per-tenant reconciliation.**
- **_Review note:_** No evidence in the docs of multiple stock-holding locations (the prototype's "multi-location" means quote areas, not godowns), so likelihood is unconfirmed — the ask is to record the decision.

---

## 5. Missing workflows (5)

### G-5 🟠 High — Sales-returns / credit/debit-note workflow absent
- **Impact:** Same root as G-1, from the workflow angle: stock can only decrement (no sales-side `stock_movements(in)`), the Running Bill has no return term (only the blunt `post_sale_discount` escape valve), and GST credit notes are statutory. The same gap exists on the purchase side (no purchase return/debit note vs GRN/PO).
- **Proposed solution:** Build the return → credit-note → stock-in → receivables-reduction flow end to end; mirror with purchase debit notes. Add enum values + permission keys now.
- **Cost if fixed later:** New tables + enum migration + `customer_running_bill` view rewrite + `lib/calc/running-bill` change + GST recompute, validated against live ledgers. **~2–3 wk + restatement of customer balances.**

### G-6 🟠 High — Invoice↔challan/SO link is a single nullable FK; no quantity reconciliation
- **Impact:** Trading sales are partial (one SO → many challans; one invoice → many challans). `invoices` has only single `challan_id`/`sales_order_id`; `invoice_items` don't link to the challan/SO line; `sales_order_items` have no `delivered_qty`/`invoiced_qty` (the **PO side tracks `received_qty`, the sales side doesn't** — asymmetric). Nothing prevents billing the same goods twice or over-delivered status from being computed. `partially_delivered` exists as an enum with no backing data.
- **Proposed solution:** Model invoice→delivery as M:N (`invoice_item.challan_item_id`), add `delivered_qty`/`invoiced_qty` running totals to `sales_order_items`, define the SO status state-machine, and add a billed-vs-delivered guard in `createInvoice`.
- **Cost if fixed later:** Link table + running-qty columns + backfill of partial states across all tenants' open orders + `createInvoice`/`postChallan` logic. **~2 wk + risk of mis-stated open-order books.**

### G-7 🟡 Medium [KNOWN-OPEN] — No stock reservation between SO and challan (overselling possible)
- **Impact:** Stock moves only at challan posting; an accepted SO reserves nothing, so two SOs can commit the same stock and available-to-promise is always on-hand. Docs assume this away without an alternative.
- **Proposed solution:** Decide reservation policy before building Items/Inventory/SO. Minimal: compute `reserved = Σ open-SO qty − delivered` and expose ATP (no new movement type needed). If out of scope, get explicit sign-off.
- **Cost if fixed later:** ~1.5 wk + interim overselling customer-trust cost. **_Review note:_** Tracked in PROJECT_PLAN §9.1.7 / DATABASE_DESIGN §13.2; SO status + SO→challan link already allow ATP computation, so the migration cost is overstated. Downgraded to Medium.

### G-8 🟡 Medium — PO→GRN has no supplier-bill leg (no 3-way match)
- **Impact:** Procurement stops at goods receipt; there is no supplier invoice/bill, so no PO-vs-GRN-vs-bill match (the control that catches a supplier over-billing). `last_purchase_price` is driven off the GRN, not an agreed bill, so costing can drift.
- **Proposed solution:** Add `supplier_bills`/`bill_items` referencing PO+GRN with a variance/tolerance match step gated before payment; drive `last_purchase_price` off the matched bill. Reserve the linkage now even if v1 keeps it light.
- **Cost if fixed later:** New tables + rework of `postGoodsReceipt` costing + re-derive `last_purchase_price`. **~1.5 wk.** (Procurement is Phase-3, so additive if reserved now.)

### G-9 🟡 Medium — Quote acceptance / quote→SO conversion lacks a state-machine
- **Impact:** Conversion is only "copies snapshot lines." Two rules are undefined: (1) does `createSalesOrder` copy only `selected` locations and exclude `quote_item_options` alternates? (getting it wrong over-commits/over-bills); (2) which revision is accepted, and is acceptance blocked on a superseded revision? `acceptQuote` just sets status with no guard.
- **Proposed solution:** Specify the conversion contract (SO inherits only `selected` locations, primary items only, latest revision); encode as state-transition rules + parity tests. **Paper fix, cheap now.**
- **Cost if fixed later:** SOs created from full/unselected quotes mis-commit stock and mis-bill → data cleanup + conversion-logic rewrite. **~1 wk + order corrections.**

---

## 6. Missing reports (2)

### G-11 🟠 High — No GST statutory outputs (GSTR-1/3B, e-invoice/IRN, e-way bill)
- **Impact:** The schema stores everything that triggers Indian GST obligations (CGST/SGST/IGST, HSN, place_of_supply) but defines no GSTR export, **no e-invoice IRN/QR, and no e-way bill** — which are legally mandatory for B2B invoices above threshold. An issued tax invoice without an IRN is non-compliant, and IRN must be generated at issue time and stored on the invoice row (a column that doesn't exist).
- **Proposed solution:** Decide v1 GST compliance scope explicitly. If issuing real tax invoices, **reserve invoice columns now** (`irn`, `ack_no`, `ack_date`, `signed_qr`, `eway_bill_no/date`) and an issue-time IRN hook, plus a `gst_export` view feeding GSTR-1. E-filing integration can be post-v1, but the columns + hook must exist *before* invoices are issued in production.
- **Cost if fixed later:** Re-issuing already-issued statutory documents (legally fraught) + invoice table migration + new GSTR view. **~2 wk + compliance exposure on every invoice issued in the gap.**
- **_Review note:_** GSTR *export* is flagged open, but IRN/e-invoice/e-way are mentioned in **no** doc — the schema's "supports full GST" claim is overstated.

### G-12 🟡 Medium — No Customer Statement of Account or Supplier/Payables Outstanding report
- **Impact:** There's a per-customer Running Bill (snapshot) and a receivables-ageing bucket, but no **transactional statement of account** (the single most-requested customer document) and **no payables view at all** — GRN updates `last_purchase_price` but there are no supplier-bill/payment/outstanding tables. The business can see who owes it, not what it owes.
- **Proposed solution:** Add a `v_customer_statement` (date-ranged debits/credits + running balance) — cheap over existing data. Decide whether PO→GRN produces a payable; if yes add `supplier_bills`/`supplier_payments` + a payables-ageing view. Define before Reports (Module 10) is built.
- **Cost if fixed later:** Statement view is cheap; supplier-outstanding needs new payables tables + GRN-to-bill workflow + backfill. **~1–1.5 wk.**

---

## 7. Multi-tenant risks (1)

### G-14 🟠 High — Child `org_id` is denormalized but never tied to the parent's `org_id`
- **Impact:** Every sales/accounting/approval child (`quote_items`, `invoice_items`, `delivery_challan_items`, `payment_allocations`, `payroll_lines`, …) carries its own `org_id` and references its parent by a single-column FK. Child-write RLS checks only `is_member(child.org_id)`. Nothing forces `child.org_id = parent.org_id` or that the referenced parent belongs to the caller's org. A member of **both** org A and B (the explicit multi-tenant use case) can insert a child with `org_id=A` pointing at org B's parent — corrupting another tenant's document tree, totals, and audit attribution. The pgTAP test (T2) only checks same-table org spoofing, so the matrix gives **false confidence**.
- **Proposed solution:** Add a composite FK on every child: `FK (org_id, <parent_id>) REFERENCES parent(org_id, id)`, backed by `UNIQUE(org_id, id)` on each parent — Postgres then guarantees the invariant at zero RLS cost. Add a `check-rls` assertion and a pgTAP case (A-member inserts child pointing at B-parent → must throw).
- **Cost if fixed later:** `UNIQUE(org_id,id)` + composite FKs across ~12 child tables on live multi-tenant data + integrity audit of diverged rows + insert-path rework. **~2–3 wk migration + forced re-test of every sales/accounting flow.** Cheap in the initial migration.

---

## 8. Security risks (5)

### G-15 🟠 High — `audit_logs` INSERT is forgeable by any org member
- **Impact:** The audit trail is sold as the immutable, tamper-evident source of truth (7-year financial floor), but the INSERT policy lets **any authenticated member** append fabricated rows — fake `before`/`after`, fake `entity_id`, `action='permission_change'`, even `actor_id=null` to impersonate the system/Stripe actor. Append-only protects against deletion, not forged appends; this also defeats the optional hash-chain unless chaining is server-exclusive. (The two docs are inconsistent: AUDIT_LOGS §8.2 is even broader than RLS §4.1.)
- **Proposed solution:** Revoke direct INSERT from `authenticated`/`anon`. The `fn_audit()` trigger is SECURITY DEFINER and already writes; app-intent rows route through a definer function that stamps `actor_id=auth.uid()` server-side and forbids `actor_id IS NULL` from a user session. Make hash-chain computation definer/service-role only.
- **Cost if fixed later:** Cheap as a policy edit, but if discovered post-launch the **integrity of the entire existing trail is in question** — every compliance/dispute claim built on it is suspect, possibly triggering customer disclosure. Re-baselining is the expensive part.

### G-16 🟠 High — Invitation-accept runs as service-role (RLS bypass) with no token-binding spec
- **Impact:** Accept is a BYPASSRLS operation (invitee isn't a member yet) that writes `memberships`+`user_roles`. The spec never requires: (a) cryptographic token verification matched to one pending row, (b) single-use atomic consumption, (c) `auth.uid()`'s verified email = `invitations.email`, (d) server-side expiry enforcement. A leaked/guessable/replayable token = **direct cross-tenant access grant** with no RLS net beneath it.
- **Proposed solution:** Specify the accept contract: high-entropy token stored *hashed*; atomic single-use `UPDATE … WHERE token_hash=? AND status='pending' AND expires_at>now()`; require verified-email match; re-check `within_plan_limit(seats)` in the same txn. Add pgTAP/integration tests for reuse/expiry/email-mismatch/seat-race.
- **Cost if fixed later:** A token leak is a cross-tenant breach with no RLS backstop; remediation = rotate all outstanding invites + hash-token schema change + accept-function rework + incident response. **~1–2 wk + IR.**

### G-17 🟡 Medium — Storage RLS derives tenant from path prefix; UPDATE/move has no `WITH CHECK`
- **Impact:** Bucket isolation rests on `split_part(name,'/',1)=org_id`. The `storage_modify` UPDATE policy has no `WITH CHECK` on the new name, and nothing ties the storage object's path-org to `files.org_id`, so metadata and bytes can diverge.
- **Proposed solution:** Add `WITH CHECK` pinning `split_part(NEW.name)=split_part(OLD.name)`; add a `files` CHECK/trigger that `split_part(path,'/',1)=org_id`; reject non-UUID first segments; add pgTAP path-forgery tests.
- **Cost if fixed later:** Storage-wide audit for mismatched/moved objects + backfill the invariant + policy redeploy. **_Review note:_** Downgraded from High — Postgres reuses the `USING` expr as the implicit `WITH CHECK`, so a cross-org rename is actually **denied** today; the real gap is the missing metadata/byte invariant (defense-in-depth), not an open breach.

### G-18 ⚪ Low — JWT-claim staleness: revoked super-admin / access persists until token refresh
- **Impact:** `is_super_admin` is read from the JWT `app_metadata` claim; a demoted super-admin keeps platform-wide bypass until token expiry. (Part 2 — stale permission cache — was largely a misread: `ActionContext` is per-request.)
- **Proposed solution:** Short access-token TTL, or have `app.is_super_admin()` additionally read the live `users.is_super_admin` flag (a definer read) so demotion takes effect immediately.
- **Cost if fixed later:** Auth/session refactor + re-audit of layer-2 gates. **~1–2 wk.** **_Review note:_** Bounded by JWT lifetime and the tiny super-admin population; Low.

### G-20 ⚪ Low — Capabilities granted in the UI matrix that RLS cannot enforce
- **Impact:** A few column/value-scoped rules are app-layer-only (Accountant billing-only edits; `pricing.override`/stock immutability; **`notifications` INSERT allows any member to target any `user_id`** → forged in-app notifications). These are **intra-tenant** integrity gaps, not cross-tenant (isolation holds).
- **Proposed solution:** Push money/PII-sensitive ones into BEFORE-UPDATE triggers (see G-30); tighten `notif_insert WITH CHECK` so a member can only notify themselves unless holding a server-only fan-out role.
- **Cost if fixed later:** Column-guard triggers + re-scope + re-test. **~1 wk.** **_Review note:_** Mostly acknowledged tradeoffs; only the forged-notification hole is novel and cheap. Low.

---

## 9. Scaling risks (1)

### G-13 ⚪ Low — Global `REFRESH MATERIALIZED VIEW CONCURRENTLY` recomputes all tenants
- **Impact:** Analytics MVs have no org partitioning; each refresh re-scans full base tables for every tenant regardless of activity, contending with OLTP. Hourly receivables refresh amplifies it.
- **Proposed solution:** Prefer incremental per-org rollup tables or per-tenant partial refresh; set explicit freshness SLAs + staleness alerting. The API queries the wrapping `v_*` security-barrier views, so the underlying MV can be swapped without rewriting report queries.
- **Cost if fixed later:** New write-path maintenance + backfill. **_Review note:_** Downgraded — single-org pilot near-term, and the view-abstraction boundary makes the swap cheap; cost-if-late was overstated. Low.

---

## 10. Billing risks (7)

### G-19 🟠 High — "MVP as default plan" contradicts the RLS write-gate → all writes blocked day one
- **Impact:** Every business INSERT embeds `has_active_subscription(org_id)`, which returns TRUE only if a `subscriptions` row with an entitling status exists. MVP creates **no** subscription rows ("billing UI deferred"), so the gate evaluates FALSE for every org and **quotes/challans/invoices/items inserts are all denied at the DB**. The product is unusable on first deploy unless someone seeds a fake subscription.
- **Proposed solution:** Decide the bootstrap NOW and make the gate coherent from the first migration: either (a) seed a `free`/`default` plan and auto-create a `trialing/active` subscription at org creation (preferred — `within_plan_limit` also needs a `plan_id`), or (b) make `has_active_subscription` fail-open when no subscription row exists.
- **Cost if fixed later:** Emergency hotfix migration + backfill a subscription for every tenant, or a production outage where no org can create any document. **~1 wk + incident.** **_Review note:_** Surfaces on the first end-to-end write test, so it's a launch-blocker rather than a silent prod outage — but must be designed in Phase 0.

### G-16b 🟡 Medium — `within_plan_limit` aggregates usage over all time (no period filter)
- **Impact:** The `used` CTE sums `usage_records` by org+metric with **no `period_key` filter**, contradicting its own comment. A monthly "quotes" quota of 100 is consumed cumulatively forever → month 2 every quote INSERT is denied even though the period should reset.
- **Proposed solution:** Filter `usage_records` by the current period (derived from the subscription's `current_period_start`) for `feature_type='quota'`; keep all-time only for cumulative `limit` metrics. Also define **who writes** the usage rows and when.
- **Cost if fixed later:** Cheap function fix, but late it manifests as paying customers silently unable to create quotes mid-month → churn. **_Review note:_** Not yet wired to any quota metric (`within_plan_limit` is only invoked for `seats`), so the blast radius isn't live — fix the function spec before it is.

### G-16c 🟡 Medium — Seat sync to Stripe is not idempotent or transactional
- **Impact:** Seats = COUNT(billable active memberships), pushed to Stripe on every membership change via app-layer `syncSeats` (read-modify-write to an external system). Concurrent accept/remove calls race; the `subscription.updated` webhook *also* writes `quantity`, so two writers can clobber each other → `quantity` ≠ real seat count → mis-billing.
- **Proposed solution:** Wrap recount+update in a per-org advisory lock; pass a deterministic Idempotency-Key; treat the webhook as the authoritative writer of `quantity`; add the seat-reconcile cron.
- **Cost if fixed later:** Billing disputes + revenue leakage + Stripe credit/debit reconciliation per customer + locking retrofit into the RBAC/invite flow. **~1.5–2 wk + finance cleanup.** **_Review note:_** Stripe is system-of-record and a reconcile cron is planned, so drift is transient/self-healing — Medium, but specify locking now.

### G-16d 🟡 Medium — Past-due grace expiry has no driving event / scheduled transition
- **Impact:** The grace cutover depends on `current_period_end` (only updated by webhook) and is evaluated **lazily on next write**. No scheduled job flips access, sets `organizations.status`, or sends suspension notices at grace end; a stalled dunning cycle on a stale `period_end` lets an org write for weeks past true grace, or get cut off early.
- **Proposed solution:** Add a billing-state reconcile cron that re-pulls past_due/unpaid orgs from Stripe, owns the grace→blocked transition + dunning notifications, and drains `stripe_events` stuck in `status='failed'`.
- **Cost if fixed later:** Revenue leak or surprise cutoffs + building the cron + backfilling correct statuses. **~1 wk.**

### G-16e 🟡 Medium — `invoices_billing` has no GST split for the SaaS subscription fee
- **Impact:** The Stripe subscription invoice the vendor charges its own Indian B2B customers stores only `amount_due/paid/currency` — no `taxable_value`/CGST/SGST/IGST, no `place_of_supply`, no link to the paying org's GSTIN. An Indian SaaS fee is a taxable supply, and B2B customers need a GST invoice with their GSTIN for input tax credit.
- **Proposed solution:** Decide the SaaS-tax posture before billing ships: enable Stripe Tax (India GST) and either store Stripe's tax breakdown + customer GSTIN in `invoices_billing` (treating the Stripe-hosted PDF as the legal invoice), or add the tax columns to issue your own. Add to §10 open questions.
- **Cost if fixed later:** GST non-compliance on collected subscription revenue + customers unable to claim ITC + retrofitting tax columns onto a never-deleted financial table + reissuing past invoices. **~1 wk + legal exposure.**

### G-16f ⚪ Low — 14-day full-feature trials with no abuse controls
- **Impact:** Trials are per-org, org creation is self-service, and a user can belong to many orgs — so one actor spins up unlimited orgs each getting a fresh 14-day full-access trial. No per-identity trial-consumption record.
- **Proposed solution:** Require a payment method to start a trial and/or track trial eligibility per owner identity (`organizations.trial_used` or platform record keyed on owner). Cheap as columns/seed logic now.
- **Cost if fixed later:** Trial-farming revenue/infra leak + backfilling which identities consumed a trial. **~3–5 days.** **_Review note:_** Niche B2B Indian ERP, low viral-farming likelihood; Low but record as a P1 billing decision.

### G-16g ⚪ Low — Two webhook events both create the subscription with no ordering/upsert key
- **Impact:** `checkout.session.completed` ("create") and `customer.subscription.created` ("upsert") both write the subscription; Stripe doesn't guarantee order. A bare INSERT on the "create" path can produce two rows for one org, violating `uq_sub_live` and wedging webhook retries.
- **Proposed solution:** Make all subscription-writing handlers a single idempotent `UPSERT ON CONFLICT(stripe_subscription_id)`; treat `customer.subscription.*` as the authoritative writer and have checkout only link `stripe_customer_id`.
- **Cost if fixed later:** Non-deterministic event-order bugs in prod + duplicate-row cleanup. **~3–5 days.** **_Review note:_** The unique key already exists and one diagram already says "upsert" — a one-line contract clarification. Low.

---

## 11. Inventory risks (4)

### G-23 🟠 High — `items.stock` updated with no row lock or non-negative guard
- **Impact:** Concurrent `postChallan`/`postGoodsReceipt` on the same item read-modify-write `items.stock` under READ COMMITTED → **lost updates** silently corrupting on-hand. No `CHECK (stock >= 0)`, and the decrement is unconditional → **negative stock / overselling**. Every downstream number (valuation, low-stock, MVs, reports) reads `items.stock`, so drift poisons everything and is invisible until a manual count.
- **Proposed solution:** Single guarded path — a trigger on `stock_movements` insert doing in-place `UPDATE items SET stock = stock + delta` (not read-then-write) under the implicit row lock, plus explicit `SELECT … FOR UPDATE` at posting start; add a `stock >= 0` constraint (or an explicit backorder flag). Decide whether `items.stock` is cache or source of truth.
- **Cost if fixed later:** Reconcile corrupted on-hand across all tenants + retrofit locking/triggers into shipped posting flows. **~1–2 wk + integrity audit.** **_Review note:_** The trigger is already *intended* (ROADMAP), which mitigates lost-updates if it uses in-place arithmetic; the genuinely unaddressed part is the non-negative guard.

### G-24 🟠 High — No inventory costing method (FIFO / weighted-average); COGS undefined
- **Impact:** Stock value = `stock × purchase_price` and GRN overwrites `last_purchase_price`, but there's no layer deriving COGS on stock-out or a moving average. With imported goods at multiple landed costs and repeated GRNs at changing rates, valuation is wrong and `mv_sales_summary.margin` is meaningless. `stock_movements.value` on out-movements is sales value, not cost.
- **Proposed solution:** Choose a method now (weighted-average is simplest here): recompute `items.purchase_price` as moving WA on GRN posting and persist the cost used on each out-movement so COGS is reproducible; for FIFO, add a cost-lot table. Tie `margin` to it in `lib/calc`.
- **Cost if fixed later:** Backfill cost onto all historical movements + cost-lot tables + restate valuation/margin reports. **Multi-week + disrupts shipped financial reports.**

### G-25 ⚪ Low — Variations-as-items can double-count stock vs a parent template
- **Impact:** Nothing enforces that a `is_template` parent has zero stock or is excluded from valuation; if a parent both has stock and has stocked variants, valuation double-counts.
- **Proposed solution:** Add a CHECK/trigger (`is_template ⇒ stock=0`) and exclude templates from valuation views; block hard-delete of a parent with live variants.
- **Cost if fixed later:** Valuation de-dup + reclassification per tenant. **_Review note:_** Conditional (clean leaf-stock data sums correctly); the orphan claim was a misread. Cheap hardening — Low.

### G-26b ⚪ Low — Multi-currency PO/GRN has no exchange-rate capture
- **Impact:** POs carry a `currency` but neither PO nor GRN stores an `exchange_rate`; the import calculator's rate lives only on `items` (catalog costing). A foreign-currency receipt can't convert to INR at receipt time → wrong-currency `last_purchase_price`/valuation.
- **Proposed solution:** Add `exchange_rate` (+ optional landed-cost components) to `goods_receipts`/`_items`, or constrain MVP POs to INR and explicitly defer multi-currency procurement.
- **Cost if fixed later:** Procurement-table migration + recompute import costs. **_Review note:_** §9.2 assumes India/INR and there's a cheap INR-rate workaround; Low.

---

## 12. Accounting risks (3)

### G-26 🟠 High — Two divergent receivables truths; `post_sale_discount` unreconciled
- **Impact:** Outstanding is computed two incompatible ways: Running Bill = Σ challan_item.value − post_sale_discount − **Σ all payments** (GST-exclusive, ignores allocation); receivables ageing = invoices (GST-inclusive) − payment_allocations. They will routinely disagree, and editing/voiding a challan or invoice shifts one but not the other. `post_sale_discount` is a customer-level number that never appears on any invoice.
- **Proposed solution:** Define **one canonical receivable**. Decide whether legal AR is invoice-based (then Running Bill derives from invoices, GST-inclusive, and `post_sale_discount` becomes a credit note / invoice adjustment — ties into G-1) or challan-based for pre-invoice tracking only. Handle allocated vs on-account payments explicitly. Document the reconciliation.
- **Cost if fixed later:** Re-model discounts as credit notes + reconcile historical balances across tenants. **High blast radius across Customers/Invoices/Payments/ageing.**

### G-28 🟡 Medium — Per-line vs invoice-level rounding rule undefined
- **Impact:** GST `%` is `numeric(6,3)`, money `numeric(14,2)`; whether GST rounds per line or once at invoice level is unresolved. If `lib/calc` and header storage round differently, stored `cgst/sgst/igst/total` won't equal the sum of lines on legal invoices — a per-document discrepancy that's hard to detect.
- **Proposed solution:** Fix the policy now (recommend round per line at 2dp then sum, the common convention, or a documented rounding-difference line); implement once in `lib/calc` and assert header == Σ lines in tests + a DB check at issue time.
- **Cost if fixed later:** Re-derive/restate totals on issued invoices per tenant. **_Review note:_** Tracked open (PROJECT_PLAN §9.1.8); cheap to settle pre-code.

### G-29b ⚪ Low — No financial period-close / lock mechanism
- **Impact:** Nothing locks a reported GST period; invoices/payments/movements stay mutable into prior periods, so reconciliation can't be trusted stable.
- **Proposed solution:** Add `period_locks(org_id, period_key, locked_at, locked_by)` and reject money-affecting writes into a locked period in server actions/triggers.
- **Cost if fixed later:** Lock enforcement into shipped mutation paths + declare historical boundaries per tenant. **_Review note:_** GSTR e-filing is a deferred non-goal and draft-only-edit/void+audit partially constrain mutation; add to §10 now. Low.

---

## 13. Permission model issues (6)

### G-27 🟠 High — Accountant role collapses separation of duties
- **Impact:** One Accountant identity can run a complete fraud cycle unaided: create an invoice, issue it, record the receipt, allocate it, apply a post-sale discount, **approve that same discount**, and process payroll. No maker/checker boundary on the highest-value money paths; RLS permits it all because the keys are on one role and the threshold is the only brake.
- **Proposed solution:** Decide the SoD model now: (1) DB-enforce `requested_by <> actor_id` on `approval_requests`/`approval_actions` so no one self-approves even holding both keys; (2) split Accountant into "AR clerk" (record payments) vs "AR controller" (issue/approve/void), or get explicit sign-off accepting combined duties with compensating controls; (3) route `payments.delete`/`discount.approve` through the approval engine even below threshold.
- **Cost if fixed later:** Re-seed `role_permissions` across all tenants + new role rows + UI remap + approval-engine constraints + backfill in-flight approvals. **~1–2 wk + a fraud-exposure window in prod.**

### G-29 🟡 Medium — Company Owner implicit-all is unattributable in audit & bypasses thresholds invisibly
- **Impact:** Owner holds every key via `is_org_owner()` with **zero** `role_permissions` rows. So (1) audit records `actor_id` but never *which permission/role* authorized an action — owner actions are indistinguishable; (2) approval thresholds are silently bypassed with no escalation record; (3) owner capabilities are invisible to any access-recertification/SOC2 review because they aren't enumerable.
- **Proposed solution:** Add an `authorized_via`/`effective_role` field to audit (or the `withAudit` intent) capturing explicit-grant vs owner-implicit vs super-admin; have owner over-threshold money actions still write an auto-approved `approval_requests` row; optionally materialize owner permissions into a built-in role for enumeration.
- **Cost if fixed later:** Adding a column to **append-only** `audit_logs` (cannot backfill historical attribution — the trail gap is **permanent**) + rework every permission check. **~1 wk + permanent blind spot.**

### G-30 🟡 Medium [KNOWN-OPEN] — Field-level restrictions enforced only at the app layer
- **Impact:** Three column-level rules are app-only while the design claims "RLS is authoritative": Accountant `customers.edit` is full-row at the DB (can rewrite delivery address, `post_sale_discount`, etc.); `pricing.override` and `items.stock` immutability are server-only, so a direct Drizzle/PostgREST call with `items.edit` can overwrite price/stock, bypassing the `stock_adjustments` ledger.
- **Proposed solution:** Add BEFORE-UPDATE column-guard triggers (the docs' own §7.4 pattern): reject `stock`/`selling_price`/`cost` changes without the specific key; reject non-billing column changes by Accountant. Cheap pre-migration, impossible to retrofit cleanly once corrupt data exists.
- **Cost if fixed later:** Column-guard triggers + audit/cleanup of corrupted price/stock + stock-ledger reconciliation. **~2 wk, partly unrecoverable.** **_Review note:_** Intra-tenant integrity only (cross-tenant isolation intact); tracked in PERMISSIONS §8.3.

### G-32 🟡 Medium — Employee "own-records only" is in the matrix but absent from RLS for sales docs
- **Impact:** The page matrix promises Employees see only own SO/challans, and §4.4 says "own-related invoices only" — but the RLS policies for `quotes`/`sales_orders`/`delivery_challans`/`invoices` have **no `created_by = auth.uid()` filter** (unlike `leads`/`expenses` which do). Any Employee with `.view` sees **every** rep's quotes, orders, and customer receivables. Real intra-tenant data exposure contradicting the documented scoping.
- **Proposed solution:** Decide now: (a) drop the own-records promise and document org-wide visibility, or (b) add a `created_by`-or-manager row filter to those four select policies (the `created_by` envelope column already exists). Settle before build.
- **Cost if fixed later:** Rewrite four select policies (+ a "see-all" manager key). **_Review note:_** Cheap pre-dev (`created_by` already on every table; policies not yet migrated) — the reviewer's "backfill ownership, 1–2 wk" cost was overstated. Medium for the exposure, not the cost.

### G-33 🟡 Medium — Super-Admin cross-tenant reads/impersonation are unbounded and unlogged
- **Impact:** Super-Admin reads every tenant's data via `is_super_admin()`, and §4.1 claims "impersonate within support boundaries (audited)" — but audit is trigger-based on writes only; **SELECTs are never logged** and there is no impersonation table/column anywhere. Tenants can't see when the vendor accessed their data — a confidentiality-trust and SOC2 gap.
- **Proposed solution:** Define a break-glass mechanism now: a `super_admin_access_log` (admin id, target org, reason/ticket, start/end) surfaced read-only to the tenant's Owner; require an explicit impersonation token + justification rather than ambient `is_super_admin()` for cross-tenant data views.
- **Cost if fixed later:** Retrofit access logging into a built support console + new table + tenant disclosure UI; **~1 wk, and all pre-retrofit access is permanently untraceable.**

### G-34 ⚪ Low [KNOWN-OPEN] — Permission-key drift: keys referenced but undefined, and defined-but-never-enforced
- **Impact:** `payroll.approve` is referenced in audit text but not in the catalog (though the actual sign-off *is* engine-gated on `payroll.manage` — mostly loose wording). The `.delete` keys (`items.delete`, `quotes.delete`, `sales_orders.delete`, …) exist and are granted but **no policy ever checks them** — soft-delete is an `.edit`-gated UPDATE, so a Manager with `.edit` but not `.delete` can still soft-delete via a raw UPDATE. Contradicts "RLS is authoritative."
- **Proposed solution:** Either add a policy branch requiring `<T>.delete` when `NEW.deleted_at` is set, or remove the `.delete` keys and document soft-delete as `.edit`-gated. Add a CI key-reconciliation check (catalog ↔ policy ↔ audit).
- **Cost if fixed later:** Missing keys + policy branches + re-seed + CI gate. **~3–5 days.** **_Review note:_** Narrow within-tenant consistency gap, self-documented as intentional; Low.

---

## 14. Performance bottlenecks (4)

### G-31 🟠 High — RLS depends on per-request JWT claims, but reads run over a pooled Drizzle connection
- **Impact:** The whole isolation model resolves `auth.uid()` from `request.jwt.claims`, but **RLS_POLICIES §1.2 says reads use the authenticated Supabase client while SYSTEM_ARCHITECTURE §2.2 routes all reads through Drizzle/postgres-js** — a raw connection as one fixed role over a shared serverless pool that must set GUCs via `set_config`. If a `SET` is session-scoped (not txn-local `set_config(...,true)`), or a read isn't wrapped in a transaction, or a connection returns mid-state, one request can inherit another tenant's `auth.uid()` → cross-tenant rows. The read path has **no stated transaction/GUC discipline** (only `withAudit` mutations do).
- **Proposed solution:** Pin the contract now: either (a) route all RLS-protected reads through the authenticated Supabase client and reserve Drizzle for service-role/system paths, or (b) mandate every Drizzle query run in a txn that first sets `request.jwt.claims` txn-local as a non-superuser role, with a connection-acquisition guard. Add a CI test firing concurrent multi-tenant reads through the pool asserting zero bleed; document pool mode + connection budget.
- **Cost if fixed later:** A cross-tenant breach class incident → emergency rewrite of the entire DB access layer + rotation + customer notification + re-validate every RLS test under the pool. **Multi-week + legal/reputational exposure.** **_Review note:_** Most likely failure if claims are simply unset is **fail-closed** (zero rows, loud in dev), not silent leak — which is why it's High not Critical — but it is a genuine contradiction between two canonical docs on the system's most critical property and **must be resolved before any data-access code is written.**

### G-35 🟡 Medium [KNOWN-OPEN] — `has_permission`/`is_member` not wrapped as InitPlan `(select …)` → per-row N+1
- **Impact:** Every policy ANDs two SECURITY DEFINER functions (a memberships lookup + a 3-table join). Unless written as `(select app.has_permission(...))`, Postgres re-invokes them per candidate row — tens of thousands of joins on a 50k-row list. The fix exists only as advisory prose, not in the canonical template or CI.
- **Proposed solution:** Make the `(select …)` InitPlan wrapping **mandatory** in the §4 template, regenerate all policies, and add a `check-rls` assertion for the wrapped form.
- **Cost if fixed later:** Cheap now (template/codegen); late = retro-rewrite policies on live tenants + chase slow-query incidents. **_Review note:_** Latency, not correctness; supporting indexes are adequate. Medium.

### G-36 🟡 Medium — `customer_running_bill` computed live over ever-growing tables with no rollup
- **Impact:** Running Bill aggregates append-only `delivery_challan_items` + `payments` live, and the customer-card shows it per row — so listing N customers risks N correlated lifetime aggregations (O(customers × history)). It's explicitly Tier-1 live (not an MV).
- **Proposed solution:** Maintain per-customer aggregate columns (`billed_total`/`received_total`) updated transactionally on post/record/void (reconciled by cron), or add it to an MV, or forbid live totals in unbounded lists. Settle before challan/payment data accumulates (backfill is the costly part).
- **Cost if fixed later:** Backfill aggregates across all customers/tenants + transactional update paths + reconcile job. **~1–2 wk.** **_Review note:_** List-fan-out is an inference (the detail action takes a single id); per-customer indexes exist. Medium.

### G-37 ⚪ Low — Quote/invoice detail + PDF fan out across child tables; synchronous PDF render
- **Impact:** A quote detail/PDF assembles 6 tables with no cap on options-per-item or items-per-location, rendered live and synchronously in the Route Handler — large multi-location BOQs (the headline feature) can render thousands of rows on the request path.
- **Proposed solution:** Cap quote children via Zod input limits; move large-BOQ PDF generation to async/streamed; keep keyset cursor as the default (offset only for small admin grids).
- **Cost if fixed later:** Rework quote builder + PDF route. **_Review note:_** Offset concern already mitigated (cursor is default); single-quote reads scale fine — the only genuine risk is synchronous PDF CPU/memory. Low.

---

## 15. Future migration problems (3)

### G-38 🟡 Medium — No customer opening-balance field — running bill can't represent legacy AR
- **Impact:** Running Bill is purely document-derived, so when migrating an existing business, each customer's pre-existing outstanding has nowhere to live — forcing fake historical challans (polluting stock/sales reports) or under-stated receivables.
- **Proposed solution:** Add `opening_balance` (+ `opening_balance_date`) to `customers` and include it as the base term in `customer_running_bill` and `mv_receivables_ageing` before any data is migrated. Pairs with G-2.
- **Cost if fixed later:** Edit receivables view + ageing MV + unwind fake-document workarounds + reconcile per tenant. **~3–5 days; near-zero pre-launch.** **_Review note:_** Unallocated *advances* already work (a payment needs no allocation); only legacy *debit* balances lack a home.

### G-39 ⚪ Low — `currency_code` (and volatile sets) as pgEnum — adding a value needs `ALTER TYPE`
- **Impact:** `currency_code` is fixed to {INR,USD,EUR,CNY} on `organizations`/`items`/`purchase_orders`. An importer will hit a 5th currency; converting an enum to a lookup after rows exist is a column-type migration + backfill.
- **Proposed solution:** Convert `currency_code` to a `currencies` lookup (ISO 4217) before launch since it gates import money math; keep truly fixed sets (`gst_mode`, `stock_direction`) as enums.
- **Cost if fixed later:** Column-type migration + backfill across three tables per tenant. **_Review note:_** On modern PG, `ALTER TYPE … ADD VALUE` is a cheap online op, so simply adding a 5th value isn't the hazard claimed; full conversion only needed if currency becomes user-configurable. Low.

### G-40 ⚪ Low — Item cost as overwriting scalars — no cost layers for FIFO/WAC
- **Impact:** GRN overwrites `last_purchase_price`; valuation uses the single latest `purchase_price`. No cost-layer table, so FIFO/WAC reconstruction isn't native.
- **Proposed solution:** If accurate COGS/margin matters (it feeds `mv_sales_summary.margin`), capture cost layers at receipt; else explicitly accept latest-cost valuation as a documented v1 limit. (Tie into G-24.)
- **Cost if fixed later:** **_Review note:_** Per-receipt landed cost is **not** lost — `goods_receipt_items.rate` and append-only `stock_movements` are reconstructable, so a future FIFO/WAC switch is feasible; the "permanent gap" claim was unfounded. Low — just document the v1 method.

---

## 16. Recommended Phase-0 decision gate

Before writing any schema or code, hold a design-gate to **close these decisions** (most are one-line schema/seed choices now, multi-week migrations later):

**Must close (blockers):**
1. **Reversals model** (G-1/G-5/G-26): credit notes + sales returns + which receivable is canonical + how `post_sale_discount` is represented. *This one decision unblocks the entire financial cluster.*
2. **Billing bootstrap** (G-19): seed a default plan + auto-subscription, or fail-open `has_active_subscription`. Plus the period-filter fix (G-16b).
3. **Tenant-isolation contract** (G-14 composite FKs + G-31 Drizzle/JWT/pool discipline). *Security-critical; cheap now.*
4. **Inventory integrity** (G-23 locking + non-negative; G-24 costing method).
5. **Audit integrity** (G-15 revoke member INSERT) and **invitation security** (G-16 token binding).
6. **Separation of duties** (G-27): split Accountant or add `requested_by <> actor_id`.

**Decide & document (constraints):**
7. GST compliance depth + IRN/e-way columns (G-11), double-entry vs document-AR (G-2), single- vs multi-location (G-4), stock reservation (G-7), SaaS-fee GST (G-16e), customer opening balance (G-38), rounding rule (G-28), period close (G-29b).

**Harden in the canonical templates (cheap, high-leverage):**
8. InitPlan-wrap all RLS predicates (G-35); column-guard triggers (G-30); own-records row filters or drop the promise (G-32); CI key-reconciliation (G-34); notification INSERT scoping (G-20).

---

## 17. Rejected finding (transparency)

One raised issue did **not** survive verification:

- **`gst-place-of-supply-source-state-underspecified`** — claimed the source state for intra/inter-state GST determination was undefined. Verification found `place_of_supply` on invoices plus the org's own state derivable from `organization_settings`, so CGST/SGST vs IGST is determinable; the finding was a misreading and is **not** a real gap.

---

*End of CRITICAL_GAPS.md — review artifact only. No existing documents were modified and no code was generated, per mandate. Findings reflect verifier-adjudicated severity. Recommended next step: the Phase-0 decision gate (§16) before implementation begins.*
