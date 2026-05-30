# Watcon Business Management System — Audit Logging & Compliance Design

> **Status:** Canonical audit & compliance reference (production SaaS).
> **Date:** 2026-05-29
> **Companions:** [PROJECT_PLAN.md](PROJECT_PLAN.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [PERMISSIONS.md](PERMISSIONS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md)
> **Target platform:** Supabase (PostgreSQL 15+, Auth, Edge Functions), Drizzle ORM, Sentry, PostHog.
> **Authority:** Table/column names derive verbatim from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (the `audit_logs` spec in §3.1, the `audit_action` enum in §2.1) and the RLS helpers in [PERMISSIONS.md](PERMISSIONS.md) §6.1. This document does not introduce columns that contradict that schema; the optional hash-chain column (§8.3) is flagged as an additive extension.

---

## 1. Goals & Compliance Drivers

The audit subsystem answers, for any business-significant change, the **five W's**:

| Question | Captured in |
|----------|-------------|
| **Who** did it | `audit_logs.actor_id` (= `auth.uid()` at change time), plus `ip`, `user_agent` |
| **When** | `audit_logs.at` (`timestamptz`, server clock) |
| **What** entity | `audit_logs.entity_type` + `entity_id` |
| **What** action | `audit_logs.action` (`audit_action` enum) |
| **Old → New** | `audit_logs.before` / `after` (jsonb) + `changed_fields` (`text[]`) |
| **From where / which call** | `ip`, `user_agent`, `request_id` (correlation to Sentry/server logs) |

### 1.1 Why this exists (compliance drivers)

1. **SaaS trust & B2B accountability.** Tenants (companies) need to answer "who changed this quote price / voided this invoice / adjusted this stock." Audit is a contractual trust feature, surfaced in **Admin → Audit** (§8).
2. **Financial integrity (GST / accounting).** Invoice issue/void, payment recording, and discount overrides are money-affecting and must be reconstructable for statutory and internal review. India GST tax invoices (`invoices` in [DATABASE_SCHEMA.md §3.6](DATABASE_SCHEMA.md)) are legal documents; the schema mandates `RESTRICT`/soft-delete and never hard-deletes — the audit trail completes that picture by recording *who* issued/voided and *when*.
3. **Security & access governance.** Role/permission grants, membership/invitation changes, login events, and super-admin actions are security-relevant and must be independently reviewable (SOC2-style access trail).
4. **Billing dispute defence.** Subscription/plan/seat changes (Stripe-driven) are recorded so billing disputes can be reconstructed independent of Stripe's own dashboard.
5. **Data-protection (PII/DPDP).** Data exports and access to sensitive HR/payroll data are logged; snapshots are **redacted** (§5) so the audit trail itself does not become a secondary PII/secrets leak.

### 1.2 Non-negotiable properties

- **Immutable / append-only.** `audit_logs` has **no `updated_at`, no `deleted_at`** (per [DATABASE_SCHEMA.md §3.1](DATABASE_SCHEMA.md) and the soft-delete exclusion list in §7). Only `INSERT` and `SELECT` are ever permitted — no `UPDATE`, no `DELETE` at the application or RLS layer (§2.2, §8.2).
- **Multi-tenant scoped.** Every row carries `org_id NOT NULL`; reads are isolated by `app.is_member(org_id)` and gated by the `admin.audit` permission (§6, §8.2). A tenant can only ever see its own trail; Super Admins see cross-org for platform operations.
- **Capture-at-source.** The DB trigger path (§3a) cannot be bypassed by an errant code path — any `INSERT/UPDATE/DELETE` on an audited table writes a row, even from psql or a service-role job. Intent metadata is layered on top by the app (§3b).
- **Tamper-evident (optional hardening).** Append-only RLS + optional per-row hash-chaining (§8.3) makes after-the-fact edits detectable.

---

## 2. `audit_logs` Table Spec

> Authoritative definition is [DATABASE_SCHEMA.md §3.1](DATABASE_SCHEMA.md). Reproduced here with audit-specific notes. The schema lists this table as **`no soft delete, no updated_at`** — append-only.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK default `gen_random_uuid()` | |
| `org_id` | `uuid` | NOT NULL → `organizations.id` | Tenant scope. Denormalised onto the log so RLS needs no join (consistent with [DATABASE_SCHEMA.md §8.1](DATABASE_SCHEMA.md)). |
| `actor_id` | `uuid` | NULL → `users.id` (logical) | `auth.uid()` at change time. **NULL** for system/Stripe-webhook/cron actions (service role); the `before/after` then identifies the source. No FK enforced so a purged user never blocks insert (mirrors `SET NULL` actor convention). |
| `entity_type` | `text` | NOT NULL | The audited table name, e.g. `payments`, `invoices`, `stock_adjustments`, `user_roles`, `subscriptions`. |
| `entity_id` | `uuid` | NOT NULL | PK of the affected row. |
| `action` | `audit_action` | NOT NULL | Enum: `insert`, `update`, `delete`, `restore`, `login`, `permission_change` ([DATABASE_SCHEMA.md §2.1](DATABASE_SCHEMA.md)). |
| `before` | `jsonb` | NULL | Pre-image (redacted, §5). NULL on `insert`/`login`. |
| `after` | `jsonb` | NULL | Post-image (redacted, §5). NULL on `delete`. |
| `changed_fields` | `text[]` | NULL | Keys whose value changed on `update` (computed, §3a). |
| `ip` | `inet` | NULL | Client IP (forwarded from app/edge). |
| `user_agent` | `text` | NULL | **Additive vs the §3.1 minimal list** — present per the task's required column set; nullable, populated by the app layer. |
| `request_id` | `text` | NULL | **Additive** — correlation id linking the row to a server request / Sentry trace / PostHog event (§7). Nullable. |
| `at` | `timestamptz` | NOT NULL default `now()` | Event time. **INSERT + SELECT only; immutable.** |

> **Note on additive columns.** `user_agent` and `request_id` are listed in this document's required spec and are **nullable additions** to the minimal core in [DATABASE_SCHEMA.md §3.1](DATABASE_SCHEMA.md); they never alter the immutability or the indexes already declared there. The canonical indexes are `idx_audit_entity (org_id, entity_type, entity_id, at)` and `idx_audit_actor (actor_id, at)` ([DATABASE_SCHEMA.md §6.2](DATABASE_SCHEMA.md)).

### 2.1 `action` semantics

| `action` | Source path | `before` | `after` |
|----------|-------------|----------|---------|
| `insert` | trigger `AFTER INSERT` | NULL | new row |
| `update` | trigger `AFTER UPDATE` | old row | new row (+ `changed_fields`) |
| `delete` | trigger `AFTER DELETE` (hard delete / purge) | old row | NULL |
| `restore` | app `withAudit` when `deleted_at` set → NULL | row w/ `deleted_at` | row w/o `deleted_at` |
| `login` | auth hook / Edge Function | NULL | `{event, method, success}` |
| `permission_change` | app `withAudit` on `user_roles` / `role_permissions` writes | prior grants | new grants |

> **Soft-delete maps to `update`, not `delete`.** Because business tables soft-delete (`deleted_at = now()`, [DATABASE_SCHEMA.md §7](DATABASE_SCHEMA.md)), the trigger sees an `UPDATE` and `changed_fields = {deleted_at}`. The app additionally emits an explicit `restore` action when clearing `deleted_at`, so the timeline reads cleanly.

### 2.2 Immutability enforcement (DDL)

```sql
alter table public.audit_logs enable row level security;
alter table public.audit_logs force  row level security;

-- No UPDATE / DELETE policies exist => default-deny blocks them for every role.
-- Belt-and-braces: a trigger that hard-stops any mutation even via service role.
create or replace function app.fn_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only (% blocked)', tg_op
    using errcode = 'check_violation';
end $$;

create trigger trg_audit_no_update
  before update or delete on public.audit_logs
  for each row execute function app.fn_audit_immutable();

-- Optional: revoke at the grant level too.
revoke update, delete on public.audit_logs from authenticated, anon, service_role;
```

---

## 3. Capture Mechanisms

Two complementary mechanisms. **Both write to `audit_logs`.** They are not redundant — one guarantees *coverage*, the other captures *intent*.

```
                 ┌─────────────────────────── audit_logs ───────────────────────────┐
                 ▲                                                                    ▲
   (a) DB trigger fn_audit()                                       (b) app withAudit() wrapper
   AFTER INSERT/UPDATE/DELETE                                      Server Action / business flow
   • guaranteed row-level diff                                     • business-meaningful action
   • reads actor from JWT claims                                   • enriches ip/user_agent/request_id
   • cannot be bypassed                                            • cross-table semantic events
```

### 3a. Postgres trigger `fn_audit()` — generic, guaranteed coverage

A single generic trigger function attached to every audited table. It reads the actor from the Supabase request JWT (`request.jwt.claims`, same source the RLS helpers use in [PERMISSIONS.md §6.1](PERMISSIONS.md)), computes the diff, and inserts an immutable row. Because it fires `AFTER` the write inside the same transaction, **no business write can escape it** — including writes from psql, a misbehaving Server Action, or a maintenance script.

```sql
-- Generic audit trigger. Attach with: AFTER INSERT OR UPDATE OR DELETE
-- The trigger writes the FULL row image; redaction (§5) is applied here.
create or replace function app.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_actor   uuid;
  v_org     uuid;
  v_before  jsonb;
  v_after   jsonb;
  v_changed text[];
  v_action  audit_action;
  v_claims  jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  -- Actor = authenticated user id from the JWT; NULL for service-role/cron/webhook.
  v_actor := nullif(v_claims ->> 'sub', '')::uuid;

  if (tg_op = 'INSERT') then
    v_action := 'insert';
    v_after  := app.fn_audit_redact(tg_table_name, to_jsonb(new));
    v_org    := new.org_id;
  elsif (tg_op = 'UPDATE') then
    v_action := 'update';
    v_before := app.fn_audit_redact(tg_table_name, to_jsonb(old));
    v_after  := app.fn_audit_redact(tg_table_name, to_jsonb(new));
    v_org    := new.org_id;
    -- changed fields = keys whose (redacted) values differ
    select array_agg(key)
      into v_changed
      from jsonb_each(v_after) a
      where a.value is distinct from (v_before -> a.key)
        and a.key not in ('updated_at');         -- ignore noise columns
    -- Skip no-op updates (only updated_at bumped)
    if v_changed is null then
      return null;
    end if;
  elsif (tg_op = 'DELETE') then
    v_action := 'delete';
    v_before := app.fn_audit_redact(tg_table_name, to_jsonb(old));
    v_org    := old.org_id;
  end if;

  insert into public.audit_logs
    (org_id, actor_id, entity_type, entity_id, action,
     before, after, changed_fields,
     ip, user_agent, request_id, at)
  values
    (v_org, v_actor, tg_table_name,
     coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid,
     v_action, v_before, v_after, v_changed,
     nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for','')::inet,
     current_setting('request.headers', true)::jsonb ->> 'user-agent',
     current_setting('app.request_id', true),     -- set by app via set_config (see 3b)
     now());

  return null;  -- AFTER trigger
end $$;
```

Attach to a table (one line per audited table — see §4 for the list):

```sql
create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function app.fn_audit();
```

**Notes**
- The function is `SECURITY DEFINER` so it can always insert into `audit_logs` regardless of the caller's RLS; the `audit_logs` insert policy still also permits authenticated inserts (§8.2).
- `tg_table_name` becomes `entity_type` — guaranteeing entity names always equal real table names from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).
- Redaction (`app.fn_audit_redact`, §5) is applied **before** anything is persisted, so secrets/PII never reach the log.
- `request.headers` / `request.jwt.claims` are populated by Supabase/PostgREST per request. For server-side Drizzle calls over a pooled connection, the app sets the same GUCs via `set_config` at the start of the transaction (§3b) so the trigger sees a consistent actor/ip/request_id.

#### When to use the trigger path
- The **default** for all row-level CRUD on audited tables — it is the *coverage guarantee*.
- It answers "what columns changed on this row, old → new," without any app cooperation.
- It is the only thing that catches out-of-band writes (psql, SQL console, batch jobs).

### 3b. App-layer `withAudit()` wrapper — business intent

Trigger rows are accurate but *low-level* ("`quotes.status` changed `sent`→`accepted`"). The app wrapper records **business intent** and the **request context** (ip, user_agent, request_id), and emits **semantic, cross-table** events the trigger cannot infer ("Quote QT-2026-001 accepted, converting to SO-2026-014" or "Discount override 22% approved on quote line").

`withAudit()` is a thin Server Action wrapper (TypeScript in `lib/audit`, per [ARCHITECTURE.md](ARCHITECTURE.md) — no code reproduced here). Conceptually it:
1. Opens the transaction and sets per-request GUCs the trigger reads:
   `select set_config('app.request_id', $1, true);` (txn-local), and propagates the JWT so `request.jwt.claims` resolves the actor.
2. Runs the business mutation (which fires the trigger → coverage row).
3. Optionally writes one **intent** row to `audit_logs` for the *primary* entity with a curated `after` payload and the right semantic `action` (e.g. `restore`, `permission_change`, `login`).

```text
withAudit({
  orgId, actor, entityType: 'quotes', entityId, action: 'update',
  intent: 'quote.accept',           // business verb (also a PostHog event, §7)
  requestId, ip, userAgent,
}, async (tx) => { /* mutate quote + create sales_order */ })
```

#### When to use the wrapper
- For **money-/security-significant business verbs** that need a clean, human-readable timeline entry: invoice issue/void, payment void, discount override approval, role grant/revoke, invitation send/accept, subscription/plan change, **data export**, and **login** events.
- When the meaningful unit spans multiple tables (issuing an invoice touches `invoices`, `invoice_items`, possibly `payment_allocations`) and you want a single anchor event.
- To attach request context (`ip`, `user_agent`, `request_id`) that the DB alone may not have when invoked via a pooled service connection.

> **Rule of thumb:** the **trigger is always on** (coverage); the **wrapper adds the headline**. Never disable the trigger to "let the wrapper handle it" — that breaks the bypass guarantee.

---

## 4. What Is Audited (explicit list)

Every row below is covered by the **trigger** (row diffs) and the money/security-significant ones additionally by a **wrapper intent** event. Entity names are exact table names from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

| # | Business event | `entity_type` (table) | `action` | Wrapper intent | Notes |
|---|----------------|-----------------------|----------|----------------|-------|
| 1 | **Stock adjustments** | `stock_adjustments` | `insert` | `stock.adjust` | Admin-only (`stock.adjust`), `reason` mandatory; table is append-only so adjustments are inherently immutable. |
| 2 | **Pricing / discount overrides** | `quote_items`, `quotes`, `invoice_items`, `delivery_challans` | `update` | `pricing.override` | Captures `rate`/`discount_pct`/`discount` old→new; flagged when it exceeds `organization_settings.approval_limits` (triggers approval, #11). |
| 3 | **Payments** | `payments`, `payment_allocations` | `insert` / `update` (void via `deleted_at`) | `payment.record` / `payment.void` | Money-affecting; `reference` (UTR/cheque) redacted in snapshot (§5). |
| 4 | **Invoice issue / void** | `invoices` | `update` | `invoice.issue` / `invoice.void` | Guarded transitions (`invoices.issue` permission, [PERMISSIONS.md](PERMISSIONS.md)); `status` draft→issued / →cancelled. Legal record. |
| 5 | **Quote status changes** | `quotes` | `update` | `quote.send` / `quote.accept` / `quote.revise` / `quote.cancel` | `quote_status` transitions; revision chain via `parent_quote_id`. |
| 6 | **Role / permission changes** | `user_roles`, `role_permissions`, `roles` | `permission_change` | `role.grant` / `role.revoke` / `perm.change` | Security-critical; append-only junctions (revoke = delete row → captured as `delete`). |
| 7 | **Membership / invitation changes** | `memberships`, `invitations` | `insert` / `update` / `delete` | `member.invite` / `member.join` / `member.remove` / `invite.revoke` | Affects **seat count** → billing (§4 of schema, [DATABASE_SCHEMA.md §8.2](DATABASE_SCHEMA.md)). |
| 8 | **Subscription / billing changes** | `subscriptions`, `subscription_items`, `plans` (via org), `payment_methods` | `update` | `billing.subscription_changed` / `billing.plan_changed` / `billing.payment_method_changed` | Mostly Stripe-webhook driven (actor NULL = system); the webhook Edge Function calls a wrapper that records intent + `stripe_events.id` as `request_id`. |
| 9 | **Login / auth events** | `users` (entity_id = user id) | `login` | `auth.login` / `auth.login_failed` / `auth.logout` / `auth.password_reset` | From Supabase auth hook / Edge Function; updates `users.last_login_at`. Includes MFA + super-admin elevation. |
| 10 | **Data exports** | the exported entity (`invoices`, `customers`, `mv_*`, …) | `update`* | `export.csv` / `export.pdf` / `export.report` | *No row mutates — recorded **only** via wrapper intent (the one case with no trigger row). Captures report type, filters, row count, format ([DATABASE_SCHEMA.md §3.11](DATABASE_SCHEMA.md) `saved_reports`/`report_schedules`). |
| 11 | **Approval decisions** | `approval_requests`, `approval_actions`, `expense_approvals` | `insert` / `update` | `approval.approve` / `approval.reject` / `approval.delegate` / `approval.escalate` | Drives discount/expense/PO/payroll sign-off ([DATABASE_SCHEMA.md §3.10](DATABASE_SCHEMA.md)); `approval_actions` is append-only (decision log) — itself a mini audit trail, mirrored into `audit_logs` for unified search. |

**Also audited (coverage tier, trigger only unless noted):** `customers`, `items`, `expenses` (submit/approve via #11), `goods_receipts` posting (stock-in), `delivery_challans` posting (stock-out), `payroll_runs` sign-off (`payroll.approve` intent), `organization_settings` (esp. `approval_limits`), `number_sequences`.

**Deliberately NOT audited into `audit_logs`** (to keep the legal/security trail clean — see §7):
- High-volume immutable ledgers `stock_movements`, `usage_records` (already append-only; their existence *is* the trail).
- In-app `notifications` reads, `notification_deliveries` provider callbacks (Resend/WhatsApp webhooks → those have their own status fields).
- Raw Stripe webhook receipt (lives in `stripe_events`; only the *resulting* org-facing change is audited, #8).

---

## 5. Sensitive-Data Handling (redaction & masking)

The audit trail must not become a secondary leak of PII, salary, or payment secrets. **Redaction happens inside `fn_audit_redact()` before persistence** (called by `fn_audit()` in §3a), so raw secrets never touch `audit_logs`.

### 5.1 Redaction catalog (per table → fields)

| Table | Fields redacted / masked | Strategy |
|-------|--------------------------|----------|
| `employees` | `ctc`, `salary`, `bank_account`, `ifsc`, `pan` | **Drop value, record `changed`-flag only.** Salary diffs recorded as `{"salary":"<redacted:changed>"}` so you know it changed without exposing the figure (HR/`payroll.*` viewers see actuals elsewhere). |
| `payroll_lines` | `gross`, `net`, `earnings`, `deductions` | Redacted to `<redacted>`; the *fact* of a payroll line change is audited, not the amounts. |
| `payments` | `reference` (UTR/cheque no.) | **Mask:** last 4 retained (`****1234`). |
| `payment_methods` | already display-only (`last4`, `brand`) | No change — PCI data never stored ([DATABASE_SCHEMA.md §3.2](DATABASE_SCHEMA.md)); pass through. |
| `customers` / `suppliers` / `leads` | `phone`, `email`, `gstin`, `pan` | **Mask:** `j***@d.com`, `98****3210`. GSTIN/PAN partial-masked. |
| `users` | `phone`, `email` | Masked as above (login events store `email` masked). |
| `invitations` | `token` | **Drop** (signed accept secret). |
| `subscriptions` / `payment_methods` | Stripe ids | Retained (not secret; needed for billing-dispute reconciliation). |
| any | columns matching `*_token`, `*_secret`, `password*`, `api_key*` | **Drop** by name-pattern as a safety net. |

```sql
-- Redaction map driven by a small static config; pattern-based fallback for secrets.
create or replace function app.fn_audit_redact(p_table text, p_row jsonb)
returns jsonb language plpgsql immutable as $$
declare
  v_drop text[];   -- fully removed
  v_mask text[];   -- last-4 / partial mask
  k text;
begin
  v_drop := case p_table
    when 'employees'      then array['ctc','salary','bank_account','ifsc']
    when 'payroll_lines'  then array['gross','net','earnings','deductions']
    when 'invitations'    then array['token']
    else array[]::text[] end;

  v_mask := case p_table
    when 'payments'  then array['reference']
    when 'customers' then array['phone','email','gstin','pan']
    when 'suppliers' then array['phone','email','gstin']
    when 'leads'     then array['phone','email']
    when 'users'     then array['phone','email']
    else array[]::text[] end;

  -- pattern-based secret scrub (defence in depth)
  for k in select jsonb_object_keys(p_row) loop
    if k ~* '(token|secret|password|api_key)$' then
      v_drop := array_append(v_drop, k);
    end if;
  end loop;

  foreach k in array v_drop loop
    if p_row ? k then p_row := jsonb_set(p_row, array[k], '"<redacted>"'); end if;
  end loop;
  foreach k in array v_mask loop
    if p_row ? k and p_row ->> k is not null then
      p_row := jsonb_set(p_row, array[k], to_jsonb('***'|| right(p_row ->> k, 4)));
    end if;
  end loop;

  return p_row;
end $$;
```

### 5.2 Read-time field masking

Even redacted, the **Audit UI** (§8) applies a second mask layer: only holders of `payroll.view` see payroll-table audit rows at all; `admin.audit` holders see other domains. This is enforced by the read policy joining the entity's view permission where feasible, and by the API filtering `entity_type` against the viewer's permission set.

---

## 6. Querying & Retention

### 6.1 Entity history view

```sql
-- Full chronological history of one entity (e.g. one invoice), newest first.
create or replace view public.v_audit_entity_history
with (security_barrier) as
  select a.id, a.at, a.action, a.actor_id, u.full_name as actor_name,
         a.entity_type, a.entity_id, a.changed_fields, a.before, a.after,
         a.ip, a.request_id
  from public.audit_logs a
  left join public.users u on u.id = a.actor_id
  where app.is_member(a.org_id)
    and app.has_permission('admin.audit', a.org_id);
-- usage: select * from v_audit_entity_history
--        where entity_type='invoices' and entity_id = :id order by at desc;
```

Backed by `idx_audit_entity (org_id, entity_type, entity_id, at)` ([DATABASE_SCHEMA.md §6.2](DATABASE_SCHEMA.md)).

### 6.2 Actor activity feed

```sql
-- "What did this user do?" — backed by idx_audit_actor (actor_id, at)
create or replace view public.v_audit_actor_activity
with (security_barrier) as
  select a.at, a.action, a.entity_type, a.entity_id, a.changed_fields, a.org_id
  from public.audit_logs a
  where app.is_member(a.org_id)
    and app.has_permission('admin.audit', a.org_id);
-- usage: ... where actor_id = :uid and at >= :from order by at desc;
```

### 6.3 Retention policy by plan tier

Audit retention is a **plan feature** (`plan_features.feature_key = 'audit.retention_days'`, `feature_type='limit'`, [DATABASE_SCHEMA.md §3.2](DATABASE_SCHEMA.md)). Money/security rows have a regulatory floor regardless of plan.

| Plan | `audit.retention_days` (general rows) | Financial/security rows |
|------|---------------------------------------|-------------------------|
| Free | 90 | retained ≥ 7 years (compliance floor) |
| Starter | 365 | ≥ 7 years |
| Growth | 730 | ≥ 7 years |
| Enterprise | 2555 (7y) or custom | ≥ 7 years / custom |

- **Financial/security rows are NEVER auto-pruned** below the legal floor: rows where `entity_type IN ('invoices','payments','payment_allocations','subscriptions','invoices_billing','user_roles','role_permissions','memberships')` or `action IN ('login','permission_change')`.
- **General rows** older than the plan's `retention_days` are **archived, then purged** (§6.4).

### 6.4 Archival

```sql
-- Nightly Supabase cron (Edge Function via service role). Archive then purge.
-- 1) Copy expiring NON-protected rows to cold storage (Parquet on Storage 'audit-archive' bucket).
--    Done by the Edge Function streaming a COPY (...) TO query result.
-- 2) Delete only the archived, non-protected, expired rows:
delete from public.audit_logs a
using public.subscriptions s
join public.plan_features pf
  on pf.plan_id = s.plan_id and pf.feature_key = 'audit.retention_days'
where s.org_id = a.org_id
  and s.status in ('trialing','active','past_due')
  and a.at < now() - make_interval(days => pf.limit_value::int)
  and a.entity_type not in
      ('invoices','payments','payment_allocations','subscriptions','invoices_billing',
       'user_roles','role_permissions','memberships')
  and a.action not in ('login','permission_change');
```

> The purge `DELETE` runs as **service role**, the only principal allowed to delete (the immutability trigger in §2.2 must be temporarily within an allow-list, or — cleaner — archival uses partition detach rather than `DELETE`; see §8.4). Archived data remains queryable on demand by re-loading into a temp table; the archive bucket is org-pathed (`{org_id}/audit/YYYY/…`) and `files`-tracked.

---

## 7. Boundary: `audit_logs` vs Sentry vs PostHog

These three systems overlap superficially ("they all record what happened") but serve **disjoint purposes**. Mixing them is the most common design mistake — clarified here.

| Dimension | **`audit_logs`** (this doc) | **Sentry** | **PostHog** |
|-----------|------------------------------|------------|-------------|
| **Purpose** | Legal / security / compliance trail | Error & performance monitoring | Product analytics + feature flags |
| **Question answered** | "Who changed this record, old→new, when?" | "What broke, where, with what stack trace?" | "How do users move through the product? Is this feature adopted?" |
| **Source of truth for** | Accountability, disputes, access governance | System health, regressions | Funnels, retention, experiments |
| **Storage** | Postgres `audit_logs` (tenant DB, immutable) | Sentry SaaS (errors, traces, replays) | PostHog SaaS (events, persons) |
| **Granularity** | Per business-record mutation | Per exception / transaction span | Per user interaction / feature event |
| **Retention** | Plan-tiered + legal floor (§6.3) | Sentry quota (e.g. 90d) | PostHog plan |
| **PII** | Redacted/masked (§5) | Scrubbed via Sentry data-scrubbing | Pseudonymous person profiles |
| **Tamper-evident** | Yes (append-only, optional hash chain §8.3) | No (monitoring, not legal) | No |
| **Who reads it** | Tenant admins (`admin.audit`), Super Admin | Engineers / on-call | PM / growth / engineering |
| **Tenant-visible?** | Yes (Admin → Audit UI) | No (internal) | No (internal) |

### 7.1 The correlation key

All three share the **`request_id`** (and the Sentry trace id). The `withAudit()` wrapper (§3b):
1. Generates / receives `request_id`, sets it via `set_config('app.request_id', …, true)` so the **trigger** stamps it on `audit_logs.request_id`.
2. Adds it as a **Sentry tag** (`Sentry.setTag('request_id', …)`) so an error during the same business action is cross-linkable.
3. Emits the matching **PostHog** capture (`posthog.capture('quote.accept', { request_id, org_id, … })`) — the wrapper `intent` (§4) doubles as the PostHog event name.

```
Server Action  ── request_id ──┬──► audit_logs.request_id   (compliance)
                               ├──► Sentry tag request_id   (errors)
                               └──► PostHog event property   (analytics)
```

### 7.2 Routing rules (which signal goes where)

- **Mutation of a business record** → `audit_logs` (always) + PostHog event (if product-meaningful). Never Sentry.
- **Caught/uncaught exception** → Sentry only. Never `audit_logs` (an error is not an audited business action).
- **Feature usage / navigation / funnel step** → PostHog only.
- **Plan-gated feature access decision** → PostHog feature flag eval (decision) + `audit_logs` only if it changes a stored entitlement.
- **Login / auth** → `audit_logs` (`login` action, §4 #9) + PostHog `identify`. Failed logins also → Sentry breadcrumb if security-anomalous.

---

## 8. Audit UI, Export & Tamper-Evidence

### 8.1 Admin → Audit (UI)

A tenant-facing screen under **Settings → Admin → Audit** (visible to `admin.audit` holders and the Company Owner; Super Admin sees a cross-org variant). Per [ARCHITECTURE.md](ARCHITECTURE.md) feature-slice `features/audit`.

- **Filters:** date range, `entity_type`, `entity_id` (deep-link from any record's "History" tab → `v_audit_entity_history`), `actor_id` (people picker), `action`, free-text on `changed_fields`.
- **Row view:** actor (name + masked email), timestamp, action badge, entity link, and a **diff viewer** rendering `before` vs `after` with `changed_fields` highlighted (redacted fields show `<redacted>`/masked).
- **Record History tab:** every business detail page gets a "History" tab querying `v_audit_entity_history` for that `entity_id` — the most-used path (e.g. invoice/quote/customer history).
- **Activity feed:** per-user via `v_audit_actor_activity`.
- All reads go through the **security-barrier views** (§6) so RLS + `admin.audit` gating is automatic.

### 8.2 Read policy (RLS)

Consistent with the audit read pattern in [PERMISSIONS.md §6.2](PERMISSIONS.md) (admins/owners read trail):

```sql
-- SELECT: members holding admin.audit (or owner/super-admin via has_permission) see their org's trail
create policy audit_logs_select on public.audit_logs for select
  using ( app.is_member(org_id)
          and (app.is_org_owner(org_id) or app.has_permission('admin.audit', org_id)) );

-- INSERT: any authenticated member of the org may append (the trigger runs as definer;
-- direct app intent inserts also allowed). Actor/org are validated.
create policy audit_logs_insert on public.audit_logs for insert
  with check ( app.is_member(org_id) );

-- NO update / NO delete policies  => immutable (default-deny), reinforced by trg_audit_no_update (§2.2).
```

> Super Admin (`app.is_super_admin()`) transparently passes `has_permission`/`is_member` checks for platform-level investigations, consistent with [PERMISSIONS.md §6.1](PERMISSIONS.md).

### 8.3 Export

- **CSV/PDF export** from the Audit UI is itself an audited event (§4 #10, `export.report` intent) — exporting the audit log is recorded in the audit log.
- Export streams through a Server Action / Edge Function honoring the same RLS views; redaction already applied at write time so exports are safe by construction.
- Large exports (full retention dump for a compliance request) run as a scheduled Edge Function writing a `files`-tracked object to the `documents`/`audit-archive` bucket, then notify via Resend.

### 8.4 Tamper-evidence considerations

1. **Append-only is the baseline.** No `UPDATE`/`DELETE` policy + `trg_audit_no_update` (§2.2) + `REVOKE` make the table immutable for all non-service principals. This alone defeats casual tampering.
2. **Optional hash-chaining (additive hardening).** For tenants/plans needing cryptographic tamper-evidence, add a nullable `prev_hash text` and `row_hash text` column (additive — does not affect §2 core):
   ```sql
   -- row_hash = sha256(prev_hash || canonical_json(this_row_minus_hashes))
   -- computed in fn_audit() against the org's latest row_hash (per-org chain).
   ```
   Any retro-edit breaks the chain; a nightly verifier Edge Function recomputes the chain per org and alerts (Sentry + Resend to the Owner) on mismatch. Chain head can be **anchored** periodically (e.g. emailed/notarized digest) for non-repudiation.
3. **Partition + detach for retention** instead of `DELETE` (preferred over §6.4's delete): range-partition `audit_logs` by month; archival **detaches** old partitions and exports them, so live data is never mutated and the immutability trigger never needs an exception. Protected financial/security rows stay in non-detached partitions until the legal floor passes.
4. **Separation of duties.** Only the **service role** (used by the archival cron) can ever remove partitions; application principals (authenticated users) can only append and read. The archival job is itself audited at the platform level.

---

*End of AUDIT_LOGS.md — the audit & compliance design. Table/column names and RLS helpers derive from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) and [PERMISSIONS.md](PERMISSIONS.md). `user_agent`, `request_id`, and the optional `prev_hash`/`row_hash` are flagged additive extensions over the minimal `audit_logs` core in DATABASE_SCHEMA §3.1; everything else is consistent with the canonical schema.*
