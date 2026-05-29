# Watcon Business Management System — Row-Level Security (RLS) Policies

> **Status:** Canonical RLS / data-isolation design (production SaaS). Authoritative for Postgres policy SQL, helper functions, and tenant-isolation guarantees.
> **Date:** 2026-05-29
> **Companions:** [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (table/column source of truth) · [PERMISSIONS.md](PERMISSIONS.md) (roles, permission catalog, §6 helpers) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) (§10 RLS strategy) · [PROJECT_PLAN.md](PROJECT_PLAN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md)
> **Target platform:** Supabase (PostgreSQL 15+), `auth.uid()` / `request.jwt.claims`, Drizzle ORM, Edge Functions (service-role).

> **Derivation rule.** Every table, column, FK, and enum referenced here is taken **verbatim** from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). Every permission key is taken **verbatim** from [PERMISSIONS.md §2](PERMISSIONS.md). This document extends the policy sketch in [PERMISSIONS.md §6](PERMISSIONS.md) into a complete, per-table, billing-aware policy set. It never contradicts either.

---

## 1. RLS Principles

### 1.1 Default-deny + FORCE
Every tenant-scoped and platform table runs **both**:

```sql
alter table public.<t> enable row level security;   -- RLS active
alter table public.<t> force  row level security;   -- applies even to the table OWNER
```

- `ENABLE` turns RLS on; with no matching policy, **every** row is invisible/unwritable → default-deny.
- `FORCE` is critical: without it, the role that *owns* the table (the migration/`postgres` role) bypasses RLS. `FORCE` makes the policies bind even for the owner, so the only legitimate bypass is the **service-role** (which connects with `BYPASSRLS`, see §1.4). This closes the "owner sees everything" hole.

### 1.2 RLS is the source of truth for isolation
Authorization is enforced in **four layers** ([PERMISSIONS.md §7](PERMISSIONS.md)), but **layer 1 (RLS) is authoritative**:

| Layer | Mechanism | Trust |
|-------|-----------|-------|
| 1. Database | RLS + `app.has_permission()` / `app.is_member()` | **Cannot be bypassed by any client.** |
| 2. Server (Next.js Server Actions) | key checks, Zod, state transitions, approval thresholds | friendly errors / business rules |
| 3. UI | permission-key hooks hide/disable | UX only — never trusted |
| 4. Audit | triggers → `audit_logs` | attribution |

A bug in layers 2–3 must **never** be able to leak cross-tenant data, because layer 1 independently filters every row by `org_id` membership. Server code uses the **anon/authenticated** Supabase client carrying the user's JWT for all CRUD — RLS then applies. The service-role client is used only for the narrow, audited cases in §1.4.

### 1.3 Policy decomposition (the canonical shape)
Every business-table policy answers three questions, combined with `AND`:

1. **Tenancy** — `app.is_member(org_id)` (is the caller in this org at all?)
2. **Permission** — `app.has_permission('<module>.<action>', org_id)` (does the caller hold the key in *this* org?)
3. **Lifecycle** — `deleted_at is null` on reads (soft-delete hygiene), column immutability on updates.

Billing-gated writes add a fourth predicate (`app.has_active_subscription(org_id)`, §5).

### 1.4 Service-role bypass boundaries
The Supabase **service-role** key has `BYPASSRLS`. It is allowed **only** in trusted server contexts that no end-user can invoke directly:

| Allowed service-role use | Why RLS is bypassed | Tables touched |
|--------------------------|---------------------|----------------|
| **Stripe webhook handler** (Edge Function) | No `auth.uid()`; events are org-agnostic at receipt | `stripe_events`, `subscriptions`, `subscription_items`, `invoices_billing`, `payment_methods`, `organizations.status` |
| **Resend / WhatsApp delivery webhooks** | provider callbacks, no user session | `notification_deliveries` |
| **Cron jobs** (MV refresh, report schedules, seat sync, leave accrual) | system actor | `mv_*`, `usage_records`, `report_schedules`, `subscriptions.quantity` |
| **Org provisioning / invitation accept** | creates the first membership before one exists | `organizations`, `memberships`, `user_roles`, `roles` seed |
| **AV scan callback** | infra actor | `files.status` |

Rules for service-role code: (a) it is the **only** writer of billing-state tables; (b) it must still **scope every statement by `org_id` in the WHERE/VALUES explicitly** (RLS no longer guards it); (c) it must `INSERT` into `audit_logs` for any data-affecting action. Service-role keys never reach the browser or client bundle.

### 1.5 `authenticated` vs `anon`
- `anon` role (pre-login): no policy grants access to any business table → fully denied. Only public marketing/`plans` catalog reads (if exposed) would get an explicit `anon` policy; by default they do not.
- `authenticated` role (post-login, carries JWT): subject to all policies below.

---

## 2. Helper Functions (`app` schema, `SECURITY DEFINER`, `STABLE`)

All helpers live in schema `app`, are `SECURITY DEFINER` (run as owner so they can read `memberships`/`user_roles` regardless of the caller's RLS), `STABLE`, and pin `search_path` to prevent hijacking. The first five are carried verbatim from [PERMISSIONS.md §6.1](PERMISSIONS.md); the last two are **NEW (billing-aware)**.

### 2.1 Carried-over identity/permission helpers

```sql
-- Orgs the current JWT user belongs to (drives org-switcher + isolation)
create or replace function app.current_orgs()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select m.org_id from public.memberships m where m.user_id = auth.uid();
$$;

-- Is the caller a member of this org?
create or replace function app.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.org_id = p_org);
$$;

-- Platform super admin: trusted JWT app_metadata claim (set out-of-band, not user-editable)
create or replace function app.is_super_admin()
returns boolean language sql stable security definer set search_path = app, public as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false);
$$;

-- Company Owner within an org → implicit-all on org-scoped keys
create or replace function app.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and ur.org_id = p_org and r.key = 'company_owner');
$$;

-- Core permission check: super admin OR org owner OR union of granted role keys in this org
create or replace function app.has_permission(p_key text, p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select app.is_super_admin()
      or app.is_org_owner(p_org)
      or exists (
        select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        where ur.user_id = auth.uid()
          and ur.org_id = p_org
          and rp.permission_key = p_key);
$$;
```

### 2.2 NEW — billing-aware helpers

```sql
-- TRUE when the org's subscription entitles it to WRITE (active/trialing, or past_due
-- still inside grace). Reads are NOT gated by this — only mutations (§5).
-- Grace window: past_due remains writable until current_period_end + 7 days.
create or replace function app.has_active_subscription(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.org_id = p_org
      and s.deleted_at is null
      and (
            s.status in ('trialing','active')
        or (s.status = 'past_due'
            and coalesce(s.current_period_end, now()) + interval '7 days' > now())
      )
  )
  -- Super Admin (platform support) is never billing-blocked.
  or app.is_super_admin();
$$;

-- TRUE when adding ONE more unit of `p_metric` stays within the plan's limit/quota.
-- Compares the plan_features cap for the org's live plan against current usage.
-- Used by INSERT WITH CHECK on metered tables (seats, quotes, invoices, storage_mb...).
create or replace function app.within_plan_limit(p_org uuid, p_metric public.usage_metric)
returns boolean language sql stable security definer set search_path = app, public as $$
  with live as (   -- the org's current plan
    select s.plan_id
    from public.subscriptions s
    where s.org_id = p_org and s.deleted_at is null
      and s.status in ('trialing','active','past_due')
    limit 1
  ),
  cap as (         -- plan feature cap for this metric (NULL = unlimited)
    select pf.limit_value
    from plan_features pf
    join live on live.plan_id = pf.plan_id
    where pf.metric = p_metric
      and pf.feature_type in ('limit','quota')
    limit 1
  ),
  used as (        -- current consumption for the metric in the live billing period
    select coalesce(sum(ur.quantity),0) as q
    from public.usage_records ur
    where ur.org_id = p_org and ur.metric = p_metric
  )
  select app.is_super_admin()
      or (select limit_value from cap) is null          -- no cap defined → unlimited
      or (select q from used) < (select limit_value from cap);
$$;
```

> **Performance.** `is_member` / `has_permission` are called per-row. Postgres caches `STABLE` function results within a statement, and the supporting indexes (`memberships UNIQUE(org_id,user_id)`, `user_roles UNIQUE(org_id,user_id,role_id)`, `role_permissions PK(role_id,permission_key)` per [DATABASE_SCHEMA.md §6](DATABASE_SCHEMA.md)) keep them sub-millisecond. Wrap the predicate as `(select app.has_permission(...))` in hot policies to force a one-time InitPlan evaluation.

---

## 3. Tenant Isolation Guarantee

### 3.1 The mechanism
Isolation rests on three invariants from [DATABASE_SCHEMA.md §1.3 & §8.1](DATABASE_SCHEMA.md):

1. **Every tenant row carries `org_id NOT NULL`** — including *all child tables* (`quote_items`, `invoice_items`, `payroll_lines`, `approval_actions`, …). `org_id` is **denormalised onto children** so a policy can check membership **without a join**.
2. **`memberships(org_id, user_id)`** is the single source of "who belongs where". `app.is_member(org_id)` resolves the JWT's `auth.uid()` against it.
3. **`org_id` is immutable** — no UPDATE policy permits changing `org_id` (enforced by `WITH CHECK` keeping the row in a member org plus a trigger `trg_block_org_id_change`, §7.4). A row can never be moved between tenants.

```
JWT(auth.uid)
     │
     ▼
memberships(user_id → org_id[])        ← app.current_orgs(), app.is_member(org)
     │
     ▼
RLS USING ( app.is_member(org_id) AND app.has_permission(key, org_id) )
     │
     ▼
only rows whose org_id ∈ caller's orgs AND key granted in THAT org are visible/writable
```

Because the predicate is evaluated **per row against the row's own `org_id`**, a user who belongs to org A and org B sees A-data with A-roles and B-data with B-roles — never a mix, and never org C's data.

### 3.2 JWT claim validation
- `auth.uid()` is derived from the **verified** Supabase JWT (signature checked by PostgREST/GoTrue before the query runs). Policies trust `auth.uid()` but **re-resolve org membership from the database** (`memberships`), not from any client-supplied org id.
- The **active org** for a request is *not* trusted from the client. Server Actions pass `org_id` as a parameter, and RLS independently verifies `app.is_member(org_id)`; a forged `org_id` simply matches no membership → zero rows.
- `is_super_admin` is read from `request.jwt.claims → app_metadata → is_super_admin`. `app_metadata` is **server-set only** (GoTrue admin API), never writable by the user, so it cannot be self-elevated. ([PERMISSIONS.md §8.5](PERMISSIONS.md) open item: confirm provisioning flow.)
- Expired/absent JWT → `auth.uid()` is `null` → `is_member` returns false → default-deny.

### 3.3 What is NOT isolated by org (platform tables)
`users`, `permissions`, `plans`, `plan_features`, `stripe_events` carry **no `org_id`** ([DATABASE_SCHEMA.md §1.3](DATABASE_SCHEMA.md)). Their policies use different predicates (self-scoping for `users`; read-all/super-admin-write for catalogs; service-role-only for `stripe_events`) — see §4.1 and §4.2.

---

## 4. Per-Table Policies (every domain)

> **Standard template.** For a routine business table `T` with permission prefix `<p>`:
>
> ```sql
> alter table public.T enable row level security;
> alter table public.T force  row level security;
>
> create policy T_select on public.T for select
>   using ( app.is_member(org_id) and deleted_at is null
>           and app.has_permission('<p>.view', org_id) );
>
> create policy T_select_deleted on public.T for select          -- restore/audit visibility
>   using ( deleted_at is not null
>           and (app.is_org_owner(org_id) or app.has_permission('admin.audit', org_id)) );
>
> create policy T_insert on public.T for insert
>   with check ( app.is_member(org_id) and app.has_permission('<p>.create', org_id)
>                and app.has_active_subscription(org_id) );      -- billing gate (§5)
>
> create policy T_update on public.T for update                  -- soft-delete is an UPDATE of deleted_at
>   using  ( app.is_member(org_id) and app.has_permission('<p>.edit', org_id) )
>   with check ( app.is_member(org_id) );
>
> create policy T_delete on public.T for delete                  -- HARD delete: owner/super-admin only
>   using ( app.is_org_owner(org_id) );
> ```
>
> Below, only **deviations** from this template are spelled out in full SQL; tables that follow it exactly are listed with their `<p>` prefix and any notes. Soft-delete (`deleted_at := now()`) is performed as an UPDATE guarded at the app layer by `<p>.delete`; the DB `delete` policy stays owner-only because the app never hard-deletes business rows ([DATABASE_SCHEMA.md §7](DATABASE_SCHEMA.md)).

### 4.0 Tables that use the standard template unchanged

| Table | Prefix `<p>` | view / create / edit / delete keys | Notes |
|-------|--------------|------------------------------------|-------|
| `customers` | `customers` | customers.view/create/edit/delete | Accountant edit limited to billing/GST cols at app layer ([PERMISSIONS.md §8.3](PERMISSIONS.md)). |
| `suppliers` | `items`* | items.view/create/edit; delete owner | No dedicated supplier keys → governed by inventory keys. |
| `quotes` | `quotes` | quotes.view/create/edit/delete | `quotes.revise` also satisfies write (§4.5). Billing-gated insert. |
| `sales_orders` | `sales_orders` | sales_orders.view/create/edit/delete | |
| `delivery_challans` | `challans` | challans.view/create/edit/delete | `posted` flip → `challans.post` (§4.5). |
| `invoices` | `invoices` | invoices.view/create/edit/issue/delete | `issue` transition (§4.6). |
| `leads` | — (CRM custom) | see §4.4 | owner-scoping option. |
| `lead_stages`, `item_families`, `brands`, `units` | lookups | `<domain>` keys | low-risk lookups, members read. |
| `budgets` | `finance` | finance.view / finance.manage | manage = create/edit/delete. |
| `saved_reports`, `report_schedules` | reporting | reports.*.view / reports.export | owner/share scoping §4.10. |
| `shifts`, `appraisals`, `leave_requests`, `leave_balances`, `attendance` | `hr` | hr.view / hr.manage | sensitive (§4.8). |
| `approval_workflows`, `approval_steps` | `settings` | settings.manage to define | runtime in §4.9. |
| `notification_templates` | `settings` | settings.manage | platform defaults `org_id` null readable to all. |

\* `suppliers` has no own permission key in [PERMISSIONS.md §2](PERMISSIONS.md); it is treated as inventory master data gated by `items.*`.

---

### 4.1 Identity & Access

#### `organizations` — tenant root (platform-ish: keyed by `id`, not `org_id`)
```sql
alter table public.organizations enable row level security;
alter table public.organizations force  row level security;

create policy org_select on public.organizations for select
  using ( app.is_super_admin() or app.is_member(id) );

-- Provisioning is service-role only; owners may edit profile/settings of their own org.
create policy org_update on public.organizations for update
  using ( app.is_org_owner(id) or app.is_super_admin() )
  with check ( app.is_member(id) or app.is_super_admin() );

-- No insert/delete policy for end users → org create/suspend/purge is service-role
-- (org.manage / system.config performed via trusted server, §1.4).
```
Maps to: `org.manage`, `system.config` (platform), `settings.manage` (owner profile edits).

#### `organization_settings` — 1:1 with org (PK = org_id)
```sql
alter table public.organization_settings enable row level security;
alter table public.organization_settings force  row level security;

create policy os_select on public.organization_settings for select
  using ( app.is_member(org_id) );                     -- all members read config/flags

create policy os_write on public.organization_settings for all
  using ( app.has_permission('settings.manage', org_id) )
  with check ( app.is_member(org_id) );
```
Maps to: `settings.manage`. (`approval_limits` here drives §5 thresholds.)

#### `users` — profile mirror, **no `org_id`** (self-scoped)
```sql
alter table public.users enable row level security;
alter table public.users force  row level security;

-- See self, or any user who shares an org with you (for assignee pickers, audit attribution).
create policy users_select on public.users for select
  using ( id = auth.uid()
          or app.is_super_admin()
          or exists (select 1 from public.memberships m1
                     join public.memberships m2 on m1.org_id = m2.org_id
                     where m1.user_id = auth.uid() and m2.user_id = public.users.id) );

create policy users_update_self on public.users for update
  using ( id = auth.uid() or app.is_super_admin() )
  with check ( id = auth.uid() or app.is_super_admin() );
-- `is_super_admin` column is NOT user-settable: a column trigger rejects changes
-- unless app.is_super_admin() (see §7.4). Insert handled by auth trigger / service role.
```

#### `memberships` — seat ledger (no soft delete)
```sql
alter table public.memberships enable row level security;
alter table public.memberships force  row level security;

create policy mem_select on public.memberships for select
  using ( user_id = auth.uid()                         -- see my own memberships (org switcher)
          or app.has_permission('admin.users', org_id) -- admins see the org roster
          or app.is_super_admin() );

-- Adding/removing seats = admin.users (owner implicit-all). Billing-gated: cannot add a
-- seat if no active subscription (seat = billable membership, DATABASE_SCHEMA §8.2).
create policy mem_insert on public.memberships for insert
  with check ( app.has_permission('admin.users', org_id)
               and app.has_active_subscription(org_id)
               and ( is_billable = false or app.within_plan_limit(org_id, 'seats') ) );

create policy mem_update on public.memberships for update
  using ( app.has_permission('admin.users', org_id) )
  with check ( app.is_member(org_id) );

create policy mem_delete on public.memberships for delete   -- revoke = hard delete (no soft del)
  using ( app.has_permission('admin.users', org_id) and user_id <> auth.uid() );
-- (cannot remove yourself; prevents owner lockout — enforced + last-owner guard in app §7.5)
```
Maps to: `admin.users`. Seat limit via `within_plan_limit(org,'seats')` (§5).

#### `roles`
```sql
alter table public.roles enable row level security;
alter table public.roles force  row level security;

create policy roles_select on public.roles for select
  using ( org_id is null                               -- system templates visible to all
          or app.is_member(org_id) );

create policy roles_write on public.roles for all
  using ( org_id is not null and app.has_permission('admin.roles', org_id) )
  with check ( app.is_member(org_id) and is_system = false );  -- cannot create/alter system roles
```
Maps to: `admin.roles`.

#### `permissions` — global catalog, **no `org_id`**
```sql
alter table public.permissions enable row level security;
alter table public.permissions force  row level security;

create policy perm_select on public.permissions for select using ( auth.uid() is not null );
create policy perm_write  on public.permissions for all
  using ( app.is_super_admin() ) with check ( app.is_super_admin() );
```
Read-only catalog for all authenticated users; mutation platform-only (`system.config`).

#### `role_permissions` — junction (no `org_id`, no soft delete)
```sql
alter table public.role_permissions enable row level security;
alter table public.role_permissions force  row level security;

-- Visible if you can see the parent role's org; writable with admin.roles in that org.
create policy rp_select on public.role_permissions for select
  using ( exists (select 1 from public.roles r where r.id = role_id
                  and (r.org_id is null or app.is_member(r.org_id))) );

create policy rp_write on public.role_permissions for all
  using ( exists (select 1 from public.roles r where r.id = role_id
                  and r.org_id is not null and app.has_permission('admin.roles', r.org_id)) )
  with check ( exists (select 1 from public.roles r where r.id = role_id
                  and r.org_id is not null and app.is_member(r.org_id)) );
```
Maps to: `admin.roles`. (No `org_id` column → must join `roles`.)

#### `user_roles` — per-org role assignment (no soft delete)
```sql
alter table public.user_roles enable row level security;
alter table public.user_roles force  row level security;

create policy ur_select on public.user_roles for select
  using ( user_id = auth.uid() or app.has_permission('admin.users', org_id) );

create policy ur_write on public.user_roles for all
  using ( app.has_permission('admin.users', org_id) )
  with check ( app.is_member(org_id)
               and exists (select 1 from public.roles r          -- role must belong to same org
                           where r.id = role_id and (r.org_id = org_id or r.org_id is null)) );
```
Maps to: `admin.users` (owner implicit-all). Self-read so the UI can compute the caller's own keys.

#### `invitations` — pending seat acquisition
```sql
alter table public.invitations enable row level security;
alter table public.invitations force  row level security;

create policy inv_select on public.invitations for select
  using ( app.has_permission('admin.users', org_id) and deleted_at is null );

create policy inv_insert on public.invitations for insert
  with check ( app.has_permission('admin.users', org_id)
               and app.has_active_subscription(org_id)
               and app.within_plan_limit(org_id, 'seats') );  -- invite consumes a seat (§5, open item 8.4 schema)

create policy inv_update on public.invitations for update     -- revoke/resend
  using ( app.has_permission('admin.users', org_id) )
  with check ( app.is_member(org_id) );

create policy inv_delete on public.invitations for delete using ( app.is_org_owner(org_id) );
-- Accepting an invitation (status→accepted, create membership) is done by the
-- invitation-accept Edge Function (service role, §1.4) because the invitee is not yet a member.
```
Maps to: `admin.users`.

#### `number_sequences`
```sql
create policy nseq_select on public.number_sequences for select
  using ( app.is_member(org_id) );
create policy nseq_write on public.number_sequences for all
  using ( app.has_permission('settings.manage', org_id)
          -- document modules may bump the counter; allow any create-capable doc role:
          or app.has_permission('quotes.create', org_id)
          or app.has_permission('invoices.create', org_id)
          or app.has_permission('sales_orders.create', org_id)
          or app.has_permission('challans.create', org_id) )
  with check ( app.is_member(org_id) );
```
Maps to: `settings.manage` + document `create` keys (atomic `next_value` bump runs inside the doc-creation transaction).

#### `audit_logs` — append-only, immutable (no update/delete)
```sql
alter table public.audit_logs enable row level security;
alter table public.audit_logs force  row level security;

create policy audit_select on public.audit_logs for select
  using ( app.is_member(org_id)
          and ( app.is_org_owner(org_id) or app.has_permission('admin.audit', org_id) ) );

create policy audit_insert on public.audit_logs for insert
  with check ( app.is_member(org_id) and (actor_id = auth.uid() or actor_id is null) );
-- NO update / NO delete policy → rows are permanently immutable (§7).
```
Maps to: `admin.audit` (read). Insert by any member (triggers run as the acting member).

---

### 4.2 Billing (Stripe) — service-role-only mutation

> **Principle ([DATABASE_SCHEMA.md §8.3](DATABASE_SCHEMA.md)):** members **read** billing state (gated by `payments.view`/`finance.view`); **all writes flow from Stripe webhooks via the service role**, which bypasses RLS by design (§1.4). End users never directly INSERT/UPDATE billing-state rows.

#### `plans`, `plan_features` — platform catalogs (no `org_id`)
```sql
alter table public.plans enable row level security;
alter table public.plans force  row level security;
create policy plans_select on public.plans for select using ( auth.uid() is not null );
create policy plans_write  on public.plans for all
  using ( app.is_super_admin() ) with check ( app.is_super_admin() );

alter table public.plan_features enable row level security;
alter table public.plan_features force  row level security;
create policy pf_select on public.plan_features for select using ( auth.uid() is not null );
create policy pf_write  on public.plan_features for all
  using ( app.is_super_admin() ) with check ( app.is_super_admin() );
```
Maps to: `system.config` / `org.manage` (platform).

#### `subscriptions`, `subscription_items`, `invoices_billing`, `payment_methods`, `usage_records`
```sql
-- Pattern repeated for each table T in this group:
alter table public.T enable row level security;
alter table public.T force  row level security;

create policy T_select on public.T for select
  using ( app.is_member(org_id)
          and ( app.has_permission('finance.view', org_id)
                or app.has_permission('payments.view', org_id)
                or app.is_org_owner(org_id) ) );

-- NO insert/update/delete policies for end users → only service-role (BYPASSRLS) writes
-- these tables from the Stripe webhook handler. Owner-initiated changes (upgrade/cancel)
-- go through a server action that calls Stripe; the resulting webhook persists the row.
```
Notes per table:
- `subscriptions` / `subscription_items` — read-only to members with finance visibility; soft-delete only after Stripe cancellation (service role).
- `invoices_billing` — **never deleted** (legal record, [DATABASE_SCHEMA.md §7](DATABASE_SCHEMA.md)); read for `finance.view`; `hosted_invoice_url`/`invoice_pdf` surfaced in the billing portal.
- `payment_methods` — display fields only (no PCI); read same group; default-card change executed Stripe-side then mirrored by webhook.
- `usage_records` — **append-only, no soft delete**; written by cron/server (service role) for metering; read for `finance.view`. Drives `within_plan_limit` (§5).

Maps to: `finance.view` / `payments.view` (read); writes are service-role (no key).

#### `stripe_events` — webhook idempotency, **platform (no `org_id`), service-role-only**
```sql
alter table public.stripe_events enable row level security;
alter table public.stripe_events force  row level security;

create policy se_select on public.stripe_events for select using ( app.is_super_admin() );
-- NO insert/update/delete policy → ONLY service-role writes (the webhook fn does
-- INSERT ... ON CONFLICT (id) DO NOTHING for idempotency, then UPDATE status/processed_at).
```
Maps to: none (platform/service-role). Super Admin may inspect for support.

---

### 4.3 CRM

#### `customers`, `payments`
`customers` → standard template, prefix `customers`. `payments` deviates (record/void):
```sql
alter table public.payments enable row level security;
alter table public.payments force  row level security;

create policy pay_select on public.payments for select
  using ( app.is_member(org_id) and deleted_at is null
          and app.has_permission('payments.view', org_id) );

create policy pay_insert on public.payments for insert
  with check ( app.has_permission('payments.record', org_id)
               and app.has_active_subscription(org_id)
               and created_by = auth.uid() );

create policy pay_update on public.payments for update           -- edit + void (sets deleted_at)
  using ( app.has_permission('payments.record', org_id)          -- void(payments.delete) checked in app
          or app.has_permission('payments.delete', org_id) )
  with check ( app.is_member(org_id) );

-- No hard-delete policy: void via deleted_at + offsetting entry; always audited (PERMISSIONS §3 note).
```
Maps to: `payments.view`, `payments.record`, `payments.delete` (void only, ⚙). `lead_activities` follows the lead's CRM gating (members with CRM access; written by the assigned rep). `leads` → §4.4.

---

### 4.4 CRM lead ownership (optional row-scoping)
Leads support **owner-scoped** visibility (a rep sees their own + team leads). There is no dedicated lead permission key in [PERMISSIONS.md §2](PERMISSIONS.md), so leads are gated by **`customers.*`** (CRM module) with an owner row filter:
```sql
alter table public.leads enable row level security;
alter table public.leads force  row level security;

create policy leads_select on public.leads for select
  using ( app.is_member(org_id) and deleted_at is null
          and app.has_permission('customers.view', org_id)
          and ( owner_id = auth.uid()                       -- my leads
                or app.has_permission('customers.edit', org_id) -- managers/leads see all
                or app.is_org_owner(org_id) ) );

create policy leads_insert on public.leads for insert
  with check ( app.has_permission('customers.create', org_id)
               and app.has_active_subscription(org_id) );

create policy leads_update on public.leads for update
  using ( app.has_permission('customers.edit', org_id)
          and ( owner_id = auth.uid() or app.is_org_owner(org_id)
                or app.has_permission('customers.edit', org_id)) )
  with check ( app.is_member(org_id) );

create policy leads_delete on public.leads for delete using ( app.is_org_owner(org_id) );
```
`lead_activities`:
```sql
create policy la_select on public.lead_activities for select
  using ( app.is_member(org_id) and deleted_at is null
          and app.has_permission('customers.view', org_id) );
create policy la_write on public.lead_activities for all
  using ( app.has_permission('customers.edit', org_id) or app.has_permission('customers.create', org_id) )
  with check ( app.is_member(org_id) );
```

---

### 4.5 Inventory & Procurement

#### `items` — pricing override gated; stock not free-edited
```sql
create policy items_select on public.items for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('items.view', org_id) );

create policy items_insert on public.items for insert
  with check ( app.has_permission('items.create', org_id) and app.has_active_subscription(org_id) );

create policy items_update on public.items for update
  using ( app.has_permission('items.edit', org_id) )
  with check ( app.is_member(org_id) );
-- pricing.override (manual selling/cost) and stock field changes are enforced at the
-- server layer (column-level rule) since RLS is row- not column-granular; the canonical
-- way to change stock is stock_adjustments / stock_movements, never a bare items.stock UPDATE.

create policy items_delete on public.items for delete using ( app.is_org_owner(org_id) );
```
Maps to: `items.view/create/edit`, `pricing.override` (app-layer column guard), delete owner-only (`items.delete` soft-del at app).

#### `item_variations` → standard, prefix `items` (children of an item; CASCADE).

#### `stock_adjustments` — immutable, `stock.adjust`-only, self-attributed
```sql
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustments force  row level security;

create policy sa_select on public.stock_adjustments for select
  using ( app.is_member(org_id) and app.has_permission('items.view', org_id) );

create policy sa_insert on public.stock_adjustments for insert
  with check ( app.has_permission('stock.adjust', org_id)
               and adjusted_by = auth.uid()                 -- cannot attribute to someone else
               and reason is not null and length(btrim(reason)) > 0   -- FR-ITEM-5 mandatory reason
               and app.has_active_subscription(org_id) );

-- NO update / NO delete policies → permanently immutable (§7). Corrections = an offsetting adjustment.
```
Maps to: `stock.adjust` (write), `items.view` (read).

#### `stock_movements` — append-only ledger
```sql
alter table public.stock_movements enable row level security;
alter table public.stock_movements force  row level security;

create policy sm_select on public.stock_movements for select
  using ( app.is_member(org_id) and app.has_permission('items.view', org_id) );

create policy sm_insert on public.stock_movements for insert
  with check ( app.is_member(org_id)
               and ( app.has_permission('challans.post', org_id)     -- 'out' on challan post
                     or app.has_permission('stock.adjust', org_id)
                     or app.is_org_owner(org_id) ) );                 -- 'in' on GRN post via server
-- NO update/delete → immutable ledger. Goods-receipt posting writes 'in' rows from a
-- server action holding challans.post-equivalent procurement rights; see goods_receipts below.
```
Maps to: `items.view` (read), `challans.post` / `stock.adjust` (write).

#### `purchase_orders` / `purchase_order_items` / `goods_receipts` / `goods_receipt_items`
There is no dedicated `purchase_orders.*` key in [PERMISSIONS.md §2](PERMISSIONS.md); procurement is **Manager/Owner** territory. We gate it on inventory authority (`items.edit` for managing POs/GRNs) and route value-threshold approval through the generic engine (§4.9, `purchase_order` entity type).
```sql
-- purchase_orders (and goods_receipts) — header pattern:
create policy po_select on public.purchase_orders for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('items.view', org_id) );
create policy po_insert on public.purchase_orders for insert
  with check ( app.has_permission('items.create', org_id) and app.has_active_subscription(org_id) );
create policy po_update on public.purchase_orders for update
  using ( app.has_permission('items.edit', org_id) ) with check ( app.is_member(org_id) );
create policy po_delete on public.purchase_orders for delete using ( app.is_org_owner(org_id) );

-- child items: denormalised org_id → direct check, prefix items
create policy poi_select on public.purchase_order_items for select
  using ( app.is_member(org_id) and app.has_permission('items.view', org_id) );
create policy poi_write on public.purchase_order_items for all
  using ( app.has_permission('items.edit', org_id) or app.has_permission('items.create', org_id) )
  with check ( app.is_member(org_id) );
```
`goods_receipts` / `goods_receipt_items` use the **same pattern**. Posting a GRN (`status → posted`) — which writes `stock_movements (in)` and updates `items.stock/last_purchase_*` — is an UPDATE gated by `items.edit`, executed in a server transaction; the resulting `stock_movements` insert is permitted by the `sm_insert` owner/adjust clause. Maps to: `items.view/create/edit`; PO value approval → `approval_workflows`.

---

### 4.6 Sales (parent + denormalised children)

All sales children carry `org_id` ([DATABASE_SCHEMA.md §8.1](DATABASE_SCHEMA.md)) → **no join needed**.

#### `quotes` (+ `quote_locations`, `quote_location_installation`, `quote_items`, `quote_item_options`, `quote_terms`)
```sql
create policy quotes_select on public.quotes for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('quotes.view', org_id) );

create policy quotes_insert on public.quotes for insert
  with check ( ( app.has_permission('quotes.create', org_id) or app.has_permission('quotes.revise', org_id) )
               and app.has_active_subscription(org_id)
               and app.within_plan_limit(org_id, 'quotes') );    -- quote quota gate (§5)

create policy quotes_update on public.quotes for update
  using ( app.has_permission('quotes.edit', org_id) or app.has_permission('quotes.revise', org_id) )
  with check ( app.is_member(org_id) );

create policy quotes_delete on public.quotes for delete using ( app.is_org_owner(org_id) );

-- Children (same shape for each: quote_locations, quote_location_installation,
-- quote_items, quote_item_options, quote_terms) — denormalised org_id:
create policy qchild_select on public.quote_items for select
  using ( app.is_member(org_id) and app.has_permission('quotes.view', org_id) );
create policy qchild_write on public.quote_items for all
  using ( app.has_permission('quotes.edit', org_id) or app.has_permission('quotes.create', org_id)
          or app.has_permission('quotes.revise', org_id) )
  with check ( app.is_member(org_id) );
```
Maps to: `quotes.view/create/edit/revise/delete`; quote quota via `within_plan_limit(org,'quotes')`.

#### `sales_orders` / `sales_order_items` → standard, prefix `sales_orders` (children denormalised). Billing-gated insert.

#### `delivery_challans` / `delivery_challan_items` — `posted` is a guarded one-way transition
```sql
create policy dc_select on public.delivery_challans for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('challans.view', org_id) );
create policy dc_insert on public.delivery_challans for insert
  with check ( app.has_permission('challans.create', org_id) and app.has_active_subscription(org_id) );
create policy dc_update on public.delivery_challans for update
  using ( app.has_permission('challans.edit', org_id) or app.has_permission('challans.post', org_id) )
  with check ( app.is_member(org_id) );
-- Setting posted=true (decrement stock + write stock_movements 'out') requires challans.post;
-- the draft→posted transition + one-way rule is enforced at the server layer (PERMISSIONS §7).
create policy dc_delete on public.delivery_challans for delete using ( app.is_org_owner(org_id) );
```
Children `delivery_challan_items` (carry `value = qty×rate` snapshot, drive Running Bill) follow the quote-child pattern with prefix `challans`. Maps to: `challans.view/create/edit/post/delete`.

---

### 4.7 Accounting (GST)

#### `invoices` — `issue` is a guarded transition
```sql
create policy inv_select on public.invoices for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('invoices.view', org_id) );

create policy inv_insert on public.invoices for insert
  with check ( app.has_permission('invoices.create', org_id)
               and app.has_active_subscription(org_id)
               and app.within_plan_limit(org_id, 'invoices') );  -- invoice quota gate (§5)

create policy inv_update on public.invoices for update
  using ( app.has_permission('invoices.edit', org_id)
          or app.has_permission('invoices.issue', org_id)
          or app.has_permission('invoices.delete', org_id) )      -- cancel/void
  with check ( app.is_member(org_id) );
-- draft→issued (one-way) and "cannot edit an issued invoice" are enforced at the server
-- layer (PERMISSIONS §7); RLS grants the row, the state machine restricts the transition.

create policy inv_delete on public.invoices for delete using ( app.is_org_owner(org_id) );
```
Children `invoice_items` (carry `hsn_code`, `taxable_value`, `gst_pct` snapshots) follow the quote-child pattern, prefix `invoices`. Maps to: `invoices.view/create/edit/issue/delete`.

#### `payment_allocations` — junction (no soft delete)
```sql
alter table public.payment_allocations enable row level security;
alter table public.payment_allocations force  row level security;

create policy pa_select on public.payment_allocations for select
  using ( app.is_member(org_id) and app.has_permission('payments.view', org_id) );
create policy pa_write on public.payment_allocations for all
  using ( app.has_permission('payments.record', org_id) )
  with check ( app.is_member(org_id) );
```
Maps to: `payments.view` / `payments.record`.

#### `expenses` — submitter-vs-approver row scoping
```sql
create policy exp_select on public.expenses for select
  using ( app.is_member(org_id) and deleted_at is null and (
            app.has_permission('expenses.approve', org_id)        -- approvers see all
            or app.has_permission('finance.view', org_id)
            or created_by = auth.uid() ) );                       -- submitters see own
create policy exp_insert on public.expenses for insert
  with check ( app.has_permission('expenses.create', org_id)
               and created_by = auth.uid()
               and app.has_active_subscription(org_id) );
create policy exp_update on public.expenses for update
  using ( app.has_permission('expenses.approve', org_id)          -- approve/reject
          or (created_by = auth.uid() and status in ('draft','submitted')) )  -- edit own pre-approval
  with check ( app.is_member(org_id) );
create policy exp_delete on public.expenses for delete using ( app.is_org_owner(org_id) );
```
Maps to: `expenses.create` (own), `expenses.approve` / `finance.view` (all). Approval thresholds (⚙) escalate via §4.9 engine. `expense_approvals` (legacy direct table) → read with `finance.view`/`expenses.approve`, insert with `expenses.approve`.

---

### 4.8 HR (sensitive)

> Salary/bank fields are sensitive ([DATABASE_SCHEMA.md §3.7](DATABASE_SCHEMA.md)). HR owns employee lifecycle; **Accountant** processes payroll. Default-deny means no key = no row at all (e.g. Employees/Manager cannot read `employees` unless granted `hr.view`).

#### `employees`
```sql
create policy emp_select on public.employees for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('hr.view', org_id) );
create policy emp_write on public.employees for all
  using ( app.has_permission('hr.manage', org_id) )
  with check ( app.is_member(org_id) );
create policy emp_delete on public.employees for delete using ( app.is_org_owner(org_id) );
```
Maps to: `hr.view` / `hr.manage`.

#### `attendance`, `shifts`, `appraisals`, `leave_requests`, `leave_balances`
Standard template, prefix `hr` (view = `hr.view`, write = `hr.manage`). Exception — **leave approval**:
```sql
create policy leave_update on public.leave_requests for update
  using ( app.has_permission('leave.approve', org_id)             -- approve/reject
          or (created_by = auth.uid() and status = 'pending') )   -- requester edits/cancels own pending
  with check ( app.is_member(org_id) );
```
Maps to: `hr.view`, `hr.manage`, `leave.approve`.

#### `payroll_runs` / `payroll_lines` — view/manage split (HR views, Accountant runs)
```sql
create policy pr_select on public.payroll_runs for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('payroll.view', org_id) );
create policy pr_write on public.payroll_runs for all
  using ( app.has_permission('payroll.manage', org_id) )          -- Accountant/Owner only
  with check ( app.is_member(org_id) );

create policy pl_select on public.payroll_lines for select
  using ( app.is_member(org_id) and app.has_permission('payroll.view', org_id) );
create policy pl_write on public.payroll_lines for all
  using ( app.has_permission('payroll.manage', org_id) )
  with check ( app.is_member(org_id) );
```
Payroll **sign-off** routes through §4.9 (`payroll_run` entity type). Maps to: `payroll.view` (HR + Accountant read), `payroll.manage` (Accountant write).

---

### 4.9 Files & Approvals

#### `files` — Storage metadata; owner-entity scoped
```sql
create policy files_select on public.files for select
  using ( app.is_member(org_id) and deleted_at is null );          -- any member may see metadata of org files
create policy files_insert on public.files for insert
  with check ( app.is_member(org_id) and uploaded_by = auth.uid()
               and app.has_active_subscription(org_id)
               and app.within_plan_limit(org_id, 'storage_mb') );   -- storage quota gate (§5)
create policy files_update on public.files for update                -- e.g. link owner_entity, status
  using ( app.is_member(org_id) and (uploaded_by = auth.uid() or app.is_org_owner(org_id)) )
  with check ( app.is_member(org_id) );
create policy files_delete on public.files for delete using ( app.is_org_owner(org_id) );
-- AV-scan status updates (pending→clean/quarantined) are written by the scan callback (service role).
```
The actual byte read/write is governed by Storage RLS (§6); `files` row access mirrors it. Maps to: org membership + `storage_mb` quota.

#### `approval_workflows` / `approval_steps` — definitions (`settings.manage`)
Standard template with write key `settings.manage`, read `app.is_member(org_id)`.

#### `approval_requests` — runtime instances (visible to requester, approver, owner)
```sql
alter table public.approval_requests enable row level security;
alter table public.approval_requests force  row level security;

create policy ar_select on public.approval_requests for select
  using ( app.is_member(org_id) and deleted_at is null and (
            requested_by = auth.uid()
            or app.is_org_owner(org_id)
            -- approvers for the entity type hold the matching approve key:
            or (entity_type = 'discount'       and app.has_permission('discount.approve', org_id))
            or (entity_type = 'expense'        and app.has_permission('expenses.approve', org_id))
            or (entity_type = 'purchase_order' and app.has_permission('items.edit', org_id))
            or (entity_type = 'payroll_run'    and app.has_permission('payroll.manage', org_id))
            or (entity_type in ('quote','invoice') and app.has_permission('finance.view', org_id)) ) );

create policy ar_insert on public.approval_requests for insert
  with check ( app.is_member(org_id) and requested_by = auth.uid() );

create policy ar_update on public.approval_requests for update      -- advance step / resolve
  using ( app.is_member(org_id) and (
            (entity_type = 'discount'       and app.has_permission('discount.approve', org_id))
            or (entity_type = 'expense'     and app.has_permission('expenses.approve', org_id))
            or (entity_type = 'purchase_order' and app.has_permission('items.edit', org_id))
            or (entity_type = 'payroll_run' and app.has_permission('payroll.manage', org_id))
            or app.is_org_owner(org_id) ) )
  with check ( app.is_member(org_id) );
```
#### `approval_actions` — decision log (append-only, no soft delete)
```sql
create policy aa_select on public.approval_actions for select
  using ( app.is_member(org_id) );                                  -- visible to those who can see the request
create policy aa_insert on public.approval_actions for insert
  with check ( app.is_member(org_id) and actor_id = auth.uid() );
-- NO update/delete → immutable decision trail (§7).
```
Maps to: `discount.approve`, `expenses.approve`, `payroll.manage`, `items.edit` (PO) — per entity type. Numeric thresholds (⚙) sit in `organization_settings.approval_limits`, enforced at the server layer (§5.3).

---

### 4.10 Notifications (own-user scoping)

#### `notifications` — strictly the recipient's own rows
```sql
alter table public.notifications enable row level security;
alter table public.notifications force  row level security;

create policy notif_select on public.notifications for select
  using ( app.is_member(org_id) and user_id = auth.uid() );        -- only my notifications
create policy notif_insert on public.notifications for insert
  with check ( app.is_member(org_id) );                            -- server creates for a member; fan-out by service role
create policy notif_update on public.notifications for update      -- mark read / archive (status)
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );
-- No delete (archive via status, DATABASE_SCHEMA §7).
```

#### `notification_preferences` — own opt-ins
```sql
create policy np_select on public.notification_preferences for select
  using ( app.is_member(org_id) and user_id = auth.uid() );
create policy np_write on public.notification_preferences for all
  using ( app.is_member(org_id) and user_id = auth.uid() )
  with check ( app.is_member(org_id) and user_id = auth.uid() );
```

#### `notification_templates`
Standard template, write `settings.manage`; rows with `org_id is null` (platform defaults) are readable by all authenticated users:
```sql
create policy nt_select on public.notification_templates for select
  using ( org_id is null or app.is_member(org_id) );
create policy nt_write on public.notification_templates for all
  using ( org_id is not null and app.has_permission('settings.manage', org_id) )
  with check ( app.is_member(org_id) );
```

#### `notification_deliveries` — outbound log, append-only, service-role updates
```sql
alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force  row level security;

create policy nd_select on public.notification_deliveries for select
  using ( app.is_member(org_id) and ( app.is_org_owner(org_id)
          or app.has_permission('admin.audit', org_id) ) );        -- delivery diagnostics
create policy nd_insert on public.notification_deliveries for insert
  with check ( app.is_member(org_id) );
-- Status updates (queued→sent→delivered/bounced) come from Resend/WhatsApp webhooks
-- via service role (§1.4). No end-user update/delete policy.
```
Maps to: own-user (notifications/prefs), `settings.manage` (templates), `admin.audit` (delivery log).

---

### 4.11 Reporting

`saved_reports` — owner sees own + shared; `report_schedules` — follows parent report.
```sql
create policy sr_select on public.saved_reports for select
  using ( app.is_member(org_id) and deleted_at is null
          and ( owner_id = auth.uid() or is_shared = true or app.is_org_owner(org_id) ) );
create policy sr_insert on public.saved_reports for insert
  with check ( app.is_member(org_id) and owner_id = auth.uid()
               and ( app.has_permission('reports.sales.view', org_id)
                     or app.has_permission('reports.inventory.view', org_id)
                     or app.has_permission('reports.financial.view', org_id)
                     or app.has_permission('reports.hr.view', org_id) ) );
create policy sr_update on public.saved_reports for update
  using ( app.is_member(org_id) and (owner_id = auth.uid() or app.is_org_owner(org_id)) )
  with check ( app.is_member(org_id) );
create policy sr_delete on public.saved_reports for delete
  using ( owner_id = auth.uid() or app.is_org_owner(org_id) );
```
`report_schedules` writes require `reports.export` (scheduled delivery is an export); reads follow the saved report. Maps to: `reports.*.view`, `reports.export`.

> **Materialized views** (`mv_sales_summary`, `mv_inventory_valuation`, `mv_receivables_ageing`, `mv_hr_headcount`) cannot host RLS. Each is exposed only via a **security-barrier view** the API queries ([DATABASE_SCHEMA.md §8.4](DATABASE_SCHEMA.md)):
> ```sql
> create view public.v_sales_summary with (security_barrier) as
>   select * from mv_sales_summary where app.is_member(org_id)
>     and app.has_permission('reports.sales.view', org_id);
> -- analogously: v_inventory_valuation (reports.inventory.view),
> --              v_receivables_ageing (reports.financial.view),
> --              v_hr_headcount       (reports.hr.view)
> ```
> The base `mv_*` are `REVOKE`d from `authenticated`/`anon`; only the views are granted. `REFRESH MATERIALIZED VIEW CONCURRENTLY` runs as cron/service role.

---

## 5. Billing-Gated Access

### 5.1 The gate
Reads are **never** billing-blocked — a delinquent org can always see its data (and pay its bill). **Writes** require an entitling subscription via `app.has_active_subscription(org_id)` (§2.2), embedded in the `WITH CHECK` of every business-table `INSERT` (and present on sensitive UPDATEs like payments/stock).

State → write behaviour:

| `subscriptions.status` | Within grace? | Writes (create/most updates) | Reads |
|------------------------|---------------|------------------------------|-------|
| `trialing`, `active` | — | **allowed** | allowed |
| `past_due` | yes (≤ `current_period_end` + 7d) | **allowed** (grace) | allowed |
| `past_due` | no (grace expired) | **blocked** | allowed |
| `unpaid`, `canceled`, `incomplete*`, `paused` | — | **blocked** | allowed |
| none / no sub row | — | **blocked** | allowed (if member) |

Super Admin bypasses the gate (platform support). The `7 days` grace mirrors [DATABASE_SCHEMA.md §8.2](DATABASE_SCHEMA.md) "read-only / blocked" suspension and is the single tunable constant in `has_active_subscription`.

### 5.2 Plan limits (quotas) on metered tables
Creation of metered entities additionally checks `app.within_plan_limit(org_id, <metric>)`:

| Table | Metric | Policy clause |
|-------|--------|---------------|
| `memberships` (billable) / `invitations` | `seats` | `within_plan_limit(org,'seats')` |
| `quotes` | `quotes` | `within_plan_limit(org,'quotes')` |
| `invoices` | `invoices` | `within_plan_limit(org,'invoices')` |
| `files` | `storage_mb` | `within_plan_limit(org,'storage_mb')` |

`within_plan_limit` reads the org's live plan → `plan_features.limit_value` for the metric and compares against summed `usage_records`. A `NULL` cap = unlimited (e.g. enterprise plan). Module gates (`module.hr`, `module.analytics`, `whatsapp.send` — boolean `plan_features`) are enforced at the **server layer + PostHog feature flags** rather than RLS, because they gate whole features/routes, not individual rows ([DATABASE_SCHEMA.md §8.2](DATABASE_SCHEMA.md)).

> **Enforcement-point decision** ([DATABASE_SCHEMA.md §10.5](DATABASE_SCHEMA.md) open item): seats/storage are **hard-blocked** in RLS; quotes/invoices may be **soft** (overage billed via Stripe metered) — in that case drop the `within_plan_limit` clause from those policies and meter instead. Default here = hard block; flip per metric as the product decides.

### 5.3 Approval thresholds (⚙)
Numeric ceilings for `discount.approve` and `expenses.approve` ([PERMISSIONS.md §3 note](PERMISSIONS.md)) live in `organization_settings.approval_limits (jsonb)`. RLS grants the *capability* (the approve key); the **amount comparison** and Manager→Accountant/Owner **escalation** are enforced at the server layer + the §4.9 approval engine (`approval_workflows.min_amount`, `approval_steps.threshold_amount`), since RLS cannot compare a request amount against a per-role JSON ceiling cleanly.

---

## 6. Storage Bucket RLS (path = `{org_id}/...`)

Storage objects live in `storage.objects`; the first path segment is the **`org_id`** ([DATABASE_SCHEMA.md §3.8](DATABASE_SCHEMA.md): `files.path` convention `{org_id}/...`). Isolation = `split_part(name,'/',1)::uuid` must be an org the caller belongs to.

```sql
-- Buckets: product-images, company-logos, quote-assets, documents
-- READ: any member of the owning org
create policy storage_read on storage.objects for select
  using ( bucket_id in ('product-images','company-logos','quote-assets','documents')
          and app.is_member( (split_part(name,'/',1))::uuid ) );

-- WRITE product-images / quote-assets: needs inventory/sales authority + active sub + quota
create policy storage_pimg_write on storage.objects for insert
  with check ( bucket_id = 'product-images'
               and app.has_permission('items.edit', (split_part(name,'/',1))::uuid)
               and app.has_active_subscription( (split_part(name,'/',1))::uuid )
               and app.within_plan_limit( (split_part(name,'/',1))::uuid, 'storage_mb') );

create policy storage_quote_write on storage.objects for insert
  with check ( bucket_id = 'quote-assets'
               and ( app.has_permission('quotes.create', (split_part(name,'/',1))::uuid)
                     or app.has_permission('quotes.edit', (split_part(name,'/',1))::uuid) )
               and app.has_active_subscription( (split_part(name,'/',1))::uuid ) );

-- WRITE company-logos: settings.manage
create policy storage_logo_write on storage.objects for insert
  with check ( bucket_id = 'company-logos'
               and app.has_permission('settings.manage', (split_part(name,'/',1))::uuid) );

-- WRITE documents (expense receipts etc.): any member with an active sub
create policy storage_docs_write on storage.objects for insert
  with check ( bucket_id = 'documents'
               and app.is_member( (split_part(name,'/',1))::uuid )
               and app.has_active_subscription( (split_part(name,'/',1))::uuid ) );

-- UPDATE/DELETE objects: owner of the org (replace/cleanup); routine deletes are soft (files.deleted_at)
create policy storage_modify on storage.objects for update
  using ( app.is_member( (split_part(name,'/',1))::uuid ) );
create policy storage_delete on storage.objects for delete
  using ( app.is_org_owner( (split_part(name,'/',1))::uuid ) );
```
All buckets are **private** (no public read). Signed URLs are minted server-side after the same membership check. Maps to: `items.edit`, `quotes.create/edit`, `settings.manage`, org membership; quota via `storage_mb`.

---

## 7. Immutability Patterns

Append-only / immutable tables have **only `select` (+ scoped `insert`)** policies and **no `update`/`delete`** — so once written, no role (other than service-role for documented system updates) can alter them.

| Table | Policies present | Why immutable | Correction mechanism |
|-------|------------------|---------------|----------------------|
| `audit_logs` | select (`admin.audit`), insert (member) | tamper-evident trail | append-only; never edited |
| `stock_adjustments` | select (`items.view`), insert (`stock.adjust`) | inventory integrity (FR-ITEM-5) | offsetting adjustment |
| `stock_movements` | select (`items.view`), insert (post/adjust) | stock ledger integrity | reversing movement |
| `stripe_events` | select (super admin); writes service-role only | webhook idempotency | re-process via service role |
| `usage_records` | select (`finance.view`); insert service/cron | metering accuracy | corrective usage row |
| `payment_allocations` | select/write (`payments.*`) | allocation history | delete-by-cascade on void only |
| `approval_actions` | select (member), insert (`actor_id=auth.uid`) | decision trail | new action row |
| `notification_deliveries` | select (owner/audit), insert (member); status via service-role | delivery audit | new delivery attempt |

Implementation: simply **omit** `for update` / `for delete` policies. With `FORCE RLS` + no policy, the operation is denied to everyone except `BYPASSRLS` (service-role). For belt-and-suspenders on the most sensitive (`audit_logs`, `stock_adjustments`, `stripe_events`), add a `BEFORE UPDATE OR DELETE` trigger that `RAISE EXCEPTION` — this blocks even a future mis-added policy and the table owner.

### 7.4 `org_id` immutability & column guards
```sql
-- Block any attempt to move a row across tenants (defense beyond WITH CHECK).
create or replace function app.fn_block_org_id_change() returns trigger
language plpgsql as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id is immutable';
  end if;
  return new;
end $$;
-- attach: create trigger trg_block_org_id_change before update on public.<t>
--         for each row execute function app.fn_block_org_id_change();
```
A similar `BEFORE UPDATE` trigger on `public.users` rejects changes to `is_super_admin` unless `app.is_super_admin()` (prevents privilege self-elevation, §3.2).

### 7.5 Last-owner / self-removal guards
Triggers prevent removing the **last** `company_owner` `user_roles` row or one's own `memberships` (avoids tenant lockout); enforced in DB triggers because RLS cannot count siblings cleanly.

---

## 8. Testing Strategy

### 8.1 `check-rls` static script (CI gate)
A script (run in CI on every migration) asserts structural invariants against `pg_catalog`:

1. **Every table in `public` has RLS enabled *and* forced:**
   ```sql
   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and (c.relrowsecurity = false or c.relforcerowsecurity = false);
   -- expected: 0 rows (allow-list platform exceptions explicitly)
   ```
2. **Every RLS-enabled table has ≥1 policy:**
   ```sql
   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity
     and not exists (select 1 from pg_policies p where p.tablename=c.relname);
   -- expected: 0 rows
   ```
3. **Immutable tables have NO update/delete policy** (assert `cmd` ∈ {SELECT, INSERT} for the §7 list).
4. **Every business table's policies reference `org_id`** (grep `pg_policies.qual`/`with_check` for `org_id` or an `app.is_member`/`has_permission` call) — catches a child table that forgot tenancy.
5. **Helper functions exist, are `SECURITY DEFINER`, and pin `search_path`.**

A non-empty result on 1–5 fails the build.

### 8.2 pgTAP behavioural test matrix
Using `pgTAP` + a fixture of 2 orgs (A, B) × 6 roles + a super admin + an anon, each test sets the JWT (`set request.jwt.claims = '{...}'; set role authenticated;`) and asserts row visibility/mutability. Core matrix:

| # | Scenario | Expect |
|---|----------|--------|
| T1 | **Cross-tenant read** — user of org A `select * from customers` | 0 rows of org B (`results_eq` on org filter) |
| T2 | **Cross-tenant write** — A-user inserts row with `org_id = B` | `throws_ok` (WITH CHECK fail) |
| T3 | **Permission gate** — Employee `insert into items` | denied (`items.create` not held) |
| T4 | Employee `select items` | allowed (`items.view`) |
| T5 | **Stock adjust** — Employee insert `stock_adjustments` | denied; Manager allowed; missing `reason` denied |
| T6 | **Immutability** — anyone `update`/`delete` `audit_logs`/`stock_adjustments` | denied |
| T7 | **Payments** — Accountant record allowed; Manager record denied (view only) |
| T8 | **HR boundary** — Manager `select employees` | denied (no `hr.view`); HR allowed |
| T9 | **Payroll split** — HR `update payroll_runs` denied; Accountant allowed; both read |
| T10 | **Expense scoping** — Employee sees own expense, not a peer's; approver sees both |
| T11 | **Notification scoping** — user sees only own `notifications` |
| T12 | **Billing gate** — set sub `unpaid`; `insert into quotes` | denied; reads still succeed |
| T13 | **Grace** — sub `past_due` within 7d → insert allowed; beyond 7d → denied |
| T14 | **Plan limit** — at seat cap, `insert membership(is_billable)` | denied via `within_plan_limit` |
| T15 | **Owner implicit-all** — Company Owner does every org-scoped op without explicit grants |
| T16 | **Super admin** — cross-org read works; cannot be billing-blocked |
| T17 | **Soft-deleted hidden** — row with `deleted_at` invisible to normal select; visible to owner/`admin.audit` |
| T18 | **Storage path** — A-user uploads to `B/…` path | denied (`split_part` org mismatch) |
| T19 | **Stripe tables** — authenticated user `insert into subscriptions` | denied (service-role only); `finance.view` can read |
| T20 | **anon** — any select on any business table | 0 rows / denied |

Each row maps to the permission key it exercises ([PERMISSIONS.md §2](PERMISSIONS.md)), giving traceability from test → policy → key.

### 8.3 Negative-first discipline
Tests assert **denial before permission**: for every key, first prove the *absence* of the key denies the op, then grant it and prove it allows. This catches over-broad `USING (true)` mistakes. Run pgTAP in CI against an ephemeral Supabase branch seeded by the §6.5 PERMISSIONS seed migration.

---

## 9. Policy → Permission-Key Map (summary)

| Domain table(s) | view | write (create/edit) | delete/void | special |
|-----------------|------|---------------------|-------------|---------|
| organizations / settings | member / `settings.manage` | `settings.manage` | service-role | `org.manage` (platform) |
| memberships / user_roles / invitations | self/`admin.users` | `admin.users` | `admin.users` (owner) | seats `within_plan_limit` |
| roles / role_permissions | member | `admin.roles` | `admin.roles` | system roles locked |
| audit_logs | `admin.audit` | member (insert) | — (immutable) | |
| plans / plan_features | authenticated | `system.config` | super admin | platform |
| subscriptions / sub_items / invoices_billing / payment_methods / usage_records | `finance.view`/`payments.view` | **service-role** | service-role | Stripe webhook |
| stripe_events | super admin | service-role | — (immutable) | idempotency |
| leads / lead_activities | `customers.view` (+owner) | `customers.create/edit` | owner | owner-scope option |
| customers | `customers.view` | `customers.create/edit` | `customers.delete` | acct→billing cols (app) |
| payments / payment_allocations | `payments.view` | `payments.record` | `payments.delete` (void) | audited |
| items / item_variations | `items.view` | `items.create/edit` | owner (`items.delete`) | `pricing.override` (app) |
| stock_adjustments | `items.view` | `stock.adjust` | — (immutable) | reason mandatory |
| stock_movements | `items.view` | post/adjust | — (immutable) | ledger |
| purchase_orders / GRN (+items) | `items.view` | `items.create/edit` | owner | PO approval (engine) |
| quotes (+children) | `quotes.view` | `quotes.create/edit/revise` | owner (`quotes.delete`) | quote quota |
| sales_orders (+items) | `sales_orders.view` | `sales_orders.create/edit` | owner | |
| delivery_challans (+items) | `challans.view` | `challans.create/edit` | owner | `challans.post` transition |
| invoices (+items) | `invoices.view` | `invoices.create/edit` | owner | `invoices.issue`, invoice quota |
| expenses / expense_approvals | own + `expenses.approve`/`finance.view` | `expenses.create` (own) | owner | `expenses.approve`, thresholds |
| budgets | `finance.view` | `finance.manage` | `finance.manage` | |
| employees / attendance / shifts / appraisals / leave_* | `hr.view` | `hr.manage` | owner | `leave.approve` |
| payroll_runs / payroll_lines | `payroll.view` | `payroll.manage` | owner | sign-off (engine) |
| files | member | member (own, +`storage_mb`) | owner | bucket RLS §6 |
| notifications / preferences | own-user | own-user | — (archive) | |
| notification_templates | member/null | `settings.manage` | owner | platform defaults |
| notification_deliveries | owner/`admin.audit` | member (insert) | — (service-role status) | Resend webhook |
| approval_workflows / steps | member | `settings.manage` | owner | |
| approval_requests / actions | requester/approver | per entity approve key | — (actions immutable) | engine |
| saved_reports / report_schedules | owner/shared/`reports.*.view` | `reports.*.view` / `reports.export` | owner | |
| mv_* (via v_*) | `reports.*.view` | — (cron refresh) | — | security-barrier view |

---

*End of RLS_POLICIES.md — the Postgres row-level-security design artifact. Derived entirely from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (tables/columns) and [PERMISSIONS.md](PERMISSIONS.md) (roles/keys/§6 helpers). Policies are specified here, not yet applied as migrations; see [DATABASE_DESIGN.md](DATABASE_DESIGN.md) §12 migration ordering: extensions → helpers (§2) → policies (§4–6) → triggers (§7) → seed ([PERMISSIONS.md §6.5](PERMISSIONS.md)).*
