# Watcon Business Management System — RBAC & Permissions

> **Status:** Authorization design (RLS policies specified, not yet migrated)
> **Date:** 2026-05-29
> **Companions:** `PROJECT_PLAN.md` (§8 matrix), `DATABASE_DESIGN.md` (§10 RLS strategy)
> **Canonical role set:** Super Admin · Company Owner · Manager · Employee · Accountant · HR

---

## 0. Reconciliation Note

This document **supersedes** the 9-role draft in `PROJECT_PLAN.md §8` with the **6 canonical roles** requested. The earlier roles map as follows:

| PROJECT_PLAN role | → Canonical role |
|-------------------|------------------|
| Super Admin | **Super Admin** |
| Admin | **Company Owner** (tenant-level full access) |
| Sales/Employee | **Employee** |
| Inventory/Store | folded into **Manager** (stock) + **Employee** (view) |
| Finance/Accounts | **Accountant** |
| HR | **HR** |
| Logistics | folded into **Manager** |
| Customer Service | folded into **Manager** (manage) + **Employee** (view) |
| Viewer | folded into **Employee** (least-privilege baseline) |

The DB structures (`roles`, `permissions`, `role_permissions`, `user_roles`) from `DATABASE_DESIGN.md §7.1` are unchanged — only the seeded role rows and grants differ.

---

## 1. RBAC Model

### 1.1 How authorization is composed
```
users ──< user_roles (per org) >── roles ──< role_permissions >── permissions
                                                                      │
                              app.has_permission(key, org)  ◄─────────┘
                                                                      │
                              RLS policies (DB enforcement) ◄─────────┘
                              UI gating (UX only) ◄─────────────────────
```

- **Roles are scoped per organization** (`user_roles(org_id, user_id, role_id)`), so the same person can hold different roles across tenants.
- **A user may hold multiple roles** in one org; effective permissions are the **union** of all granted permission keys.
- **Permissions are atomic keys** (`module.action`). Roles are bundles of keys. Pages/UI and RLS both resolve to keys — never to role names directly (except the two special roles below).
- **Two special roles bypass key checks:**
  - **Super Admin** — platform/cross-org; implicitly holds every key in every org (`app.is_super_admin()`).
  - **Company Owner** — implicitly holds every *org-scoped* key within its own org (`app.is_org_owner(org)`), but **not** platform keys.
- **Default-deny:** absence of a key = no access. Every RLS-protected table is `FORCE ROW LEVEL SECURITY` with explicit policies (`DATABASE_DESIGN.md §10.5`).

### 1.2 Permission key grammar
`<module>.<action>` — actions: `view, create, edit, delete, export, approve, post, adjust, issue, record, revise, manage`.
Platform keys are prefixed `system.` / `org.`.

---

## 2. Permission Catalog

| Key | Description | Module |
|-----|-------------|--------|
| `dashboard.view` | View dashboard & KPIs | Dashboard |
| `items.view` | View item catalogue & detail | Inventory |
| `items.create` | Create items / variations | Inventory |
| `items.edit` | Edit item fields | Inventory |
| `items.delete` | Soft-delete items | Inventory |
| `stock.adjust` | Add/reduce stock (with reason) | Inventory |
| `pricing.override` | Override computed selling/cost price | Inventory |
| `stock_report.view` | View stock reports | Reports |
| `stock_report.export` | Export/print/PDF/email/WhatsApp reports | Reports |
| `customers.view` | View customers | CRM |
| `customers.create` | Create customers | CRM |
| `customers.edit` | Edit customers | CRM |
| `customers.delete` | Soft-delete customers | CRM |
| `running_bill.view` | View running bill / receivables ledger | CRM/Finance |
| `quotes.view` | View quotes | Sales |
| `quotes.create` | Create quotes | Sales |
| `quotes.edit` | Edit quotes | Sales |
| `quotes.revise` | Create quote revisions | Sales |
| `quotes.delete` | Soft-delete quotes | Sales |
| `quotes.export` | Print/PDF/BOQ export | Sales |
| `sales_orders.view` | View sales orders | Sales |
| `sales_orders.create` | Create SO (from quote) | Sales |
| `sales_orders.edit` | Edit SO | Sales |
| `sales_orders.delete` | Soft-delete SO | Sales |
| `challans.view` | View delivery challans | Logistics |
| `challans.create` | Create challans | Logistics |
| `challans.edit` | Edit challans | Logistics |
| `challans.post` | Post challan (decrements stock) | Logistics |
| `challans.delete` | Soft-delete challan | Logistics |
| `payments.view` | View payments | Finance |
| `payments.record` | Record receipts & allocations | Finance |
| `payments.delete` | Reverse/void payments | Finance |
| `invoices.view` | View tax invoices | Finance |
| `invoices.create` | Create invoices | Finance |
| `invoices.edit` | Edit draft invoices | Finance |
| `invoices.issue` | Issue/finalise invoices | Finance |
| `invoices.delete` | Cancel/soft-delete invoices | Finance |
| `discount.post_sale` | Apply post-sale discount | Finance |
| `discount.approve` | Approve discounts above threshold | Finance |
| `finance.view` | View P&L, budgets, financial dashboards | Finance |
| `finance.manage` | Manage budgets, financial config | Finance |
| `expenses.create` | Submit expenses | Finance |
| `expenses.approve` | Approve/reject expenses | Finance |
| `payroll.view` | View payroll & salary data | Finance/HR |
| `payroll.manage` | Run/process payroll | Finance |
| `reports.sales.view` | Sales reports | Reports |
| `reports.inventory.view` | Inventory/stock-value reports | Reports |
| `reports.financial.view` | Financial reports (P&L, ageing, GST) | Reports |
| `reports.hr.view` | HR reports (headcount, leave, attrition) | Reports |
| `reports.export` | Export any permitted report | Reports |
| `hr.view` | View employee records | HR |
| `hr.manage` | Manage employees, onboarding, appraisals | HR |
| `leave.approve` | Approve/reject leave | HR |
| `support.view` | View tickets | Support |
| `support.manage` | Manage/resolve tickets, SLA | Support |
| `admin.users` | Create/invite users, assign roles | Admin |
| `admin.roles` | Define roles & permission grants | Admin |
| `admin.audit` | View audit logs | Admin |
| `settings.manage` | Company profile, numbering, tax config | Admin |
| `org.manage` | **Platform:** provision/suspend orgs | System |
| `system.config` | **Platform:** global config, feature flags | System |

---

## 3. Role → Permission Grant Matrix

Legend: ● granted · ○ via implicit-all (Super Admin / Owner) · ⚙ granted with approval-threshold · — denied.

| Permission key | Super Admin | Company Owner | Manager | Employee | Accountant | HR |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| dashboard.view | ○ | ○ | ● | ● | ● | ● |
| items.view | ○ | ○ | ● | ● | ● | — |
| items.create | ○ | ○ | ● | — | — | — |
| items.edit | ○ | ○ | ● | — | — | — |
| items.delete | ○ | ○ | — | — | — | — |
| stock.adjust | ○ | ○ | ● | — | — | — |
| pricing.override | ○ | ○ | ● | — | — | — |
| stock_report.view | ○ | ○ | ● | ● | ● | — |
| stock_report.export | ○ | ○ | ● | — | ● | — |
| customers.view | ○ | ○ | ● | ● | ● | — |
| customers.create | ○ | ○ | ● | ● | — | — |
| customers.edit | ○ | ○ | ● | ● | ● | — |
| customers.delete | ○ | ○ | — | — | — | — |
| running_bill.view | ○ | ○ | ● | ● | ● | — |
| quotes.view | ○ | ○ | ● | ● | ● | — |
| quotes.create | ○ | ○ | ● | ● | — | — |
| quotes.edit | ○ | ○ | ● | ● | — | — |
| quotes.revise | ○ | ○ | ● | ● | — | — |
| quotes.delete | ○ | ○ | ● | — | — | — |
| quotes.export | ○ | ○ | ● | ● | ● | — |
| sales_orders.view | ○ | ○ | ● | ● | ● | — |
| sales_orders.create | ○ | ○ | ● | ● | — | — |
| sales_orders.edit | ○ | ○ | ● | — | — | — |
| sales_orders.delete | ○ | ○ | ● | — | — | — |
| challans.view | ○ | ○ | ● | ● | ● | — |
| challans.create | ○ | ○ | ● | ● | — | — |
| challans.edit | ○ | ○ | ● | — | — | — |
| challans.post | ○ | ○ | ● | — | — | — |
| challans.delete | ○ | ○ | ● | — | — | — |
| payments.view | ○ | ○ | ● | — | ● | — |
| payments.record | ○ | ○ | — | — | ● | — |
| payments.delete | ○ | ○ | — | — | ⚙ | — |
| invoices.view | ○ | ○ | ● | ● | ● | — |
| invoices.create | ○ | ○ | — | — | ● | — |
| invoices.edit | ○ | ○ | — | — | ● | — |
| invoices.issue | ○ | ○ | — | — | ● | — |
| invoices.delete | ○ | ○ | — | — | ⚙ | — |
| discount.post_sale | ○ | ○ | ● | — | ● | — |
| discount.approve | ○ | ○ | ⚙ | — | ● | — |
| finance.view | ○ | ○ | ● | — | ● | — |
| finance.manage | ○ | ○ | — | — | ● | — |
| expenses.create | ○ | ○ | ● | ● | ● | ● |
| expenses.approve | ○ | ○ | ⚙ | — | ● | — |
| payroll.view | ○ | ○ | — | — | ● | ● |
| payroll.manage | ○ | ○ | — | — | ● | — |
| reports.sales.view | ○ | ○ | ● | ● | ● | — |
| reports.inventory.view | ○ | ○ | ● | ● | ● | — |
| reports.financial.view | ○ | ○ | ● | — | ● | — |
| reports.hr.view | ○ | ○ | ● | — | — | ● |
| reports.export | ○ | ○ | ● | — | ● | ● |
| hr.view | ○ | ○ | ● | — | — | ● |
| hr.manage | ○ | ○ | — | — | — | ● |
| leave.approve | ○ | ○ | ● | — | — | ● |
| support.view | ○ | ○ | ● | ● | — | — |
| support.manage | ○ | ○ | ● | — | — | — |
| admin.users | ○ | ● | — | — | — | — |
| admin.roles | ○ | ● | — | — | — | — |
| admin.audit | ○ | ● | — | — | ● | — |
| settings.manage | ○ | ● | — | — | — | — |
| org.manage | ● | — | — | — | — | — |
| system.config | ● | — | — | — | — | — |

> **Approval thresholds (⚙):** `discount.approve` for Manager and `expenses.approve` are limited by a configurable amount ceiling (`settings.approval_limits`); above the ceiling the action escalates to Accountant/Owner. `payments.delete` / `invoices.delete` are restricted to **void/reverse** (never hard delete) and always audited.

---

## 4. Per-Role Specifications

Each role below details **Pages accessible**, **CRUD permissions**, **Reporting permissions**, and **Financial permissions**.

### 4.1 Super Admin
**Scope:** Platform/cross-organization. Watcon system operator.

- **Pages accessible:** *Everything*, plus platform-only pages — Organizations admin, System Config, Feature Flags, Global Audit, all tenant data (read for support). Login lands on a Platform Console.
- **CRUD permissions:** Full CRUD on every entity in every org **including hard maintenance operations** (purges, restores from soft-delete). Can impersonate within support boundaries (audited).
- **Reporting permissions:** All reports across all orgs; cross-tenant analytics.
- **Financial permissions:** All financial actions in any org; no approval ceilings. Intended for support/operations, not day-to-day bookkeeping.

### 4.2 Company Owner
**Scope:** Full control of **their own organization** (tenant owner). No platform/cross-org access.

- **Pages accessible:** All org pages — Dashboard, Inventory, Stock Reports, Customers, Quotes, Sales Orders, Challans, Payments, Invoices, Finance/P&L, HR, Support, **Administration** (Users, Roles, Audit, Settings). No platform console.
- **CRUD permissions:** Full CRUD (incl. delete) on every org entity. Manages users, role assignments, and company settings/numbering/tax config.
- **Reporting permissions:** All reports (sales, inventory, financial, HR) + export.
- **Financial permissions:** All — record/void payments, create/issue/cancel invoices, approve any discount/expense (no ceiling), manage budgets and payroll, view P&L.

### 4.3 Manager
**Scope:** Operational leadership — runs sales, inventory, logistics, and customer service; sees financial summaries but does not do bookkeeping.

- **Pages accessible:** Dashboard, Inventory (items + stock adjust), Stock Reports, Customers, Quotes, Sales Orders, Delivery Challans, Payments (**view**), Invoices (**view**), Finance dashboard (**view P&L**), HR (**view team + approve leave**), Support (manage), Reports. **No** Administration pages, **no** payroll, **no** Settings.
- **CRUD permissions:**
  - Items: create, edit, **stock.adjust**, pricing.override (no delete).
  - Customers: create, edit (no delete).
  - Quotes: full incl. revise + delete + export.
  - Sales Orders: full.
  - Challans: full incl. **post** (decrements stock).
  - Support tickets: manage.
- **Reporting permissions:** Sales, Inventory, Financial (view), HR (view), + export.
- **Financial permissions:** View payments, view invoices, view P&L; apply post-sale discounts; approve discounts/expenses **up to threshold** (escalates above). Cannot record payments, create invoices, run payroll, or manage budgets.

### 4.4 Employee
**Scope:** Front-line sales/operations executor. Least-privilege baseline.

- **Pages accessible:** Dashboard, Items (**view only**), Stock Reports (**view only**), Customers, Quotes, Sales Orders, Delivery Challans, Invoices (**view related**), Running Bill (**view**), Support (**view**). **No** Finance management, **no** stock adjustment, **no** HR, **no** Administration.
- **CRUD permissions:**
  - Items: **view only**.
  - Customers: create, edit (no delete). Inline customer creation during quoting.
  - Quotes: create, edit, revise, export (no delete).
  - Sales Orders: view, create.
  - Challans: view, create (cannot **post** — Manager posts/decrements stock).
  - Support: view.
- **Reporting permissions:** Sales (own/scope) and Inventory (view); no financial/HR reports; no export.
- **Financial permissions:** View running bill and own-related invoices only. No payment recording, no discount authority, no P&L.

### 4.5 Accountant
**Scope:** Finance & accounts — receivables, invoicing, payments, expenses, payroll processing, financial reporting.

- **Pages accessible:** Dashboard, Items (**view** for pricing reference), Stock Reports, Customers (**view + edit billing**), Quotes/SO/Challans (**view**), Payments, Invoices, Running Bill/Receivables, Finance/P&L, Expenses, Payroll, Reports, Audit (**view**). **No** stock adjustment, **no** HR management, **no** Administration (Users/Roles/Settings).
- **CRUD permissions:**
  - Items: view only.
  - Customers: view, edit (billing/GST details only — enforced at app layer).
  - Sales docs (quotes/SO/challans): view.
  - Invoices: full — create, edit (draft), **issue**, void (⚙).
  - Payments: view, **record**, void (⚙).
- **Reporting permissions:** Financial (P&L, receivables ageing, GST), Sales, Inventory, + export. Stock-report export allowed.
- **Financial permissions:** **Full bookkeeping** — record/allocate payments, create & issue tax invoices, apply & approve post-sale discounts, create & approve expenses, manage budgets (`finance.manage`), run payroll (`payroll.manage`), view all financial dashboards.

### 4.6 HR
**Scope:** Human resources — employee lifecycle, leave, appraisals, payroll inputs. No commercial/inventory/finance access.

- **Pages accessible:** Dashboard, HR (Employees, Onboarding, Appraisals, Leave), Payroll (**view inputs**), HR Reports, Expenses (**own submission**). **No** Inventory, Sales, Customers, Finance management, or Administration.
- **CRUD permissions:**
  - Employees: full CRUD (`hr.manage`) — records, onboarding, appraisals.
  - Leave: approve/reject (`leave.approve`).
  - Own expenses: create.
- **Reporting permissions:** HR reports (headcount, leave, attrition, appraisal status) + export. No sales/inventory/financial reports.
- **Financial permissions:** **View** payroll/salary data only (`payroll.view`) — Accountant processes payroll runs. May submit personal expenses. No payments, invoices, P&L, or budgets.

---

## 5. Page-Access Matrix

✅ full · 👁 view-only · — none.

| Page / Route | Super Admin | Company Owner | Manager | Employee | Accountant | HR |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/items` | ✅ | ✅ | ✅ | 👁 | 👁 | — |
| `/items/new`, `/items/[id]/edit` | ✅ | ✅ | ✅ | — | — | — |
| Stock adjust panel | ✅ | ✅ | ✅ | — | — | — |
| `/stock-reports` | ✅ | ✅ | ✅ | 👁 | ✅ | — |
| `/customers` | ✅ | ✅ | ✅ | ✅ | 👁 | — |
| Running Bill | ✅ | ✅ | ✅ | 👁 | ✅ | — |
| `/quotes` | ✅ | ✅ | ✅ | ✅ | 👁 | — |
| `/sales-orders` | ✅ | ✅ | ✅ | ✅* | 👁 | — |
| `/challans` | ✅ | ✅ | ✅ | ✅* | 👁 | — |
| `/payments` | ✅ | ✅ | 👁 | — | ✅ | — |
| `/invoices` | ✅ | ✅ | 👁 | 👁 | ✅ | — |
| `/finance` (P&L, budgets) | ✅ | ✅ | 👁 | — | ✅ | — |
| `/expenses` | ✅ | ✅ | ✅ | 👁* | ✅ | 👁* |
| `/payroll` | ✅ | ✅ | — | — | ✅ | 👁 |
| `/hr` | ✅ | ✅ | 👁 | — | — | ✅ |
| `/support` | ✅ | ✅ | ✅ | 👁 | — | — |
| `/reports` | ✅ | ✅ | ✅ | 👁* | ✅ | 👁* |
| `/admin/users` | ✅ | ✅ | — | — | — | — |
| `/admin/roles` | ✅ | ✅ | — | — | — | — |
| `/admin/audit` | ✅ | ✅ | — | — | 👁 | — |
| `/settings` | ✅ | ✅ | — | — | — | — |
| `/platform/*` (orgs, system) | ✅ | — | — | — | — | — |

> `*` scoped: Employee sees only own/created records or own expenses; HR sees only HR reports and own expenses. Scoping is enforced by RLS row filters, not just page gating.

---

## 6. Supabase RLS Policies

> Enforcement is at the database (`DATABASE_DESIGN.md §10`). Roles never appear in policies directly except the two special roles; everything else resolves through `app.has_permission()`. All tables run `ENABLE` + `FORCE ROW LEVEL SECURITY` (default-deny).

### 6.1 Helper functions (schema `app`, `SECURITY DEFINER`, `STABLE`)
```sql
-- Orgs the current JWT user belongs to
create or replace function app.current_orgs()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select m.org_id from public.memberships m where m.user_id = auth.uid();
$$;

create or replace function app.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.org_id = p_org);
$$;

-- Platform super admin (global flag on users / JWT claim)
create or replace function app.is_super_admin()
returns boolean language sql stable security definer set search_path = app, public as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false);
$$;

-- Company Owner within an org (implicit-all org-scoped)
create or replace function app.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and ur.org_id = p_org and r.key = 'company_owner');
$$;

-- Core permission check: union of all roles' granted keys in this org
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

### 6.2 Standard policy template (per business table `T`)
Replace `<T>` with the entity's permission prefix (`items`, `customers`, `quotes`, …).
```sql
alter table public.T enable row level security;
alter table public.T force  row level security;

-- READ: member of org, row not soft-deleted, holds view permission
create policy T_select on public.T for select
  using ( app.is_member(org_id)
          and deleted_at is null
          and app.has_permission('<T>.view', org_id) );

-- READ (admins/owners see soft-deleted for restore/audit)
create policy T_select_deleted on public.T for select
  using ( deleted_at is not null
          and (app.is_org_owner(org_id) or app.has_permission('admin.audit', org_id)) );

-- INSERT
create policy T_insert on public.T for insert
  with check ( app.is_member(org_id) and app.has_permission('<T>.create', org_id) );

-- UPDATE (org_id immutable; edit permission required)
create policy T_update on public.T for update
  using  ( app.is_member(org_id) and app.has_permission('<T>.edit', org_id) )
  with check ( app.is_member(org_id) );

-- SOFT DELETE is an UPDATE setting deleted_at → covered by <T>.delete via app guard;
-- HARD DELETE restricted to owner/super admin only
create policy T_delete on public.T for delete
  using ( app.is_org_owner(org_id) );
```

### 6.3 Concrete policies for sensitive tables

**items** — stock fields editable only via adjustments; pricing override gated.
```sql
create policy items_select on public.items for select
  using ( app.is_member(org_id) and deleted_at is null
          and app.has_permission('items.view', org_id) );
create policy items_insert on public.items for insert
  with check ( app.has_permission('items.create', org_id) );
create policy items_update on public.items for update
  using ( app.has_permission('items.edit', org_id) )
  with check ( app.is_member(org_id) );
-- delete (soft) gated in app via items.delete; hard delete owner-only
create policy items_delete on public.items for delete
  using ( app.is_org_owner(org_id) );
```

**stock_adjustments** — admin/manager-only, immutable, requires `stock.adjust`.
```sql
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustments force row level security;

create policy sa_select on public.stock_adjustments for select
  using ( app.is_member(org_id) and app.has_permission('items.view', org_id) );

create policy sa_insert on public.stock_adjustments for insert
  with check ( app.has_permission('stock.adjust', org_id)
               and adjusted_by = auth.uid()
               and reason is not null and length(btrim(reason)) > 0 );

-- no update / no delete policies → immutable for everyone (service role only)
```

**payments** — record by Accountant/Owner; no hard delete (void via offset).
```sql
create policy pay_select on public.payments for select
  using ( app.is_member(org_id) and deleted_at is null
          and app.has_permission('payments.view', org_id) );
create policy pay_insert on public.payments for insert
  with check ( app.has_permission('payments.record', org_id) );
create policy pay_update on public.payments for update
  using ( app.has_permission('payments.record', org_id) )
  with check ( app.is_member(org_id) );
-- void (soft) requires payments.delete; checked in app + audited; no hard delete policy
```

**invoices** — issue is a state transition guarded separately at the app layer.
```sql
create policy inv_select on public.invoices for select
  using ( app.is_member(org_id) and deleted_at is null
          and app.has_permission('invoices.view', org_id) );
create policy inv_insert on public.invoices for insert
  with check ( app.has_permission('invoices.create', org_id) );
create policy inv_update on public.invoices for update
  using ( app.has_permission('invoices.edit', org_id)
          or app.has_permission('invoices.issue', org_id) )
  with check ( app.is_member(org_id) );
```

**quotes** (+ children) — children inherit the parent's org; check via join.
```sql
create policy quotes_select on public.quotes for select
  using ( app.is_member(org_id) and deleted_at is null
          and app.has_permission('quotes.view', org_id) );
create policy quotes_cud on public.quotes for all
  using ( app.has_permission('quotes.edit', org_id) or app.has_permission('quotes.create', org_id) )
  with check ( app.is_member(org_id) );

-- child example: quote_items — org_id stored on child for direct check (denormalised)
create policy qi_select on public.quote_items for select
  using ( app.is_member(org_id) and app.has_permission('quotes.view', org_id) );
create policy qi_cud on public.quote_items for all
  using ( app.has_permission('quotes.edit', org_id) )
  with check ( app.is_member(org_id) );
```

**hr / employees / payroll** — HR & Accountant boundary.
```sql
create policy emp_select on public.employees for select
  using ( app.is_member(org_id) and deleted_at is null and app.has_permission('hr.view', org_id) );
create policy emp_cud on public.employees for all
  using ( app.has_permission('hr.manage', org_id) )
  with check ( app.is_member(org_id) );

create policy payroll_select on public.payroll_runs for select
  using ( app.is_member(org_id) and app.has_permission('payroll.view', org_id) );
create policy payroll_cud on public.payroll_runs for all
  using ( app.has_permission('payroll.manage', org_id) )
  with check ( app.is_member(org_id) );
```

**Employee row-scoping** (own-records only) — e.g. expenses submitted by self.
```sql
create policy exp_select on public.expenses for select
  using ( app.is_member(org_id) and deleted_at is null and (
            app.has_permission('expenses.approve', org_id)        -- approvers see all
            or app.has_permission('finance.view', org_id)
            or created_by = auth.uid()                            -- submitters see own
        ) );
create policy exp_insert on public.expenses for insert
  with check ( app.has_permission('expenses.create', org_id) and created_by = auth.uid() );
```

**audit_logs** — read by Owner/Accountant; insert by authenticated; never mutate.
```sql
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
create policy audit_select on public.audit_logs for select
  using ( app.is_member(org_id) and ( app.is_org_owner(org_id)
                                       or app.has_permission('admin.audit', org_id) ) );
create policy audit_insert on public.audit_logs for insert
  with check ( app.is_member(org_id) );
-- no update/delete policy → immutable
```

**organizations / memberships / user_roles** — administration.
```sql
create policy org_select on public.organizations for select
  using ( app.is_super_admin() or app.is_member(id) );
create policy org_update on public.organizations for update
  using ( app.is_org_owner(id) or app.is_super_admin() ) with check ( true );

create policy ur_select on public.user_roles for select
  using ( app.is_member(org_id) );
create policy ur_cud on public.user_roles for all
  using ( app.has_permission('admin.users', org_id) )   -- owner implicit-all covers this
  with check ( app.is_member(org_id) );
```

### 6.4 Storage RLS (buckets keyed by `{org_id}/...`)
```sql
-- product-images: write requires items.create/edit; read requires org membership
create policy storage_pimg_read on storage.objects for select
  using ( bucket_id = 'product-images'
          and app.is_member( (split_part(name,'/',1))::uuid ) );
create policy storage_pimg_write on storage.objects for insert
  with check ( bucket_id = 'product-images'
               and app.has_permission('items.edit', (split_part(name,'/',1))::uuid) );
```

### 6.5 Seed: roles & grants (migration step `18_seed`)
```sql
-- roles (org-scoped rows created per org; system roles template)
insert into public.roles (org_id, key, name, is_system) values
 (:org, 'company_owner','Company Owner', true),
 (:org, 'manager',      'Manager',       true),
 (:org, 'employee',     'Employee',      true),
 (:org, 'accountant',   'Accountant',    true),
 (:org, 'hr',           'HR',            true);
-- super_admin is platform-level (JWT claim), not an org role row.

-- role_permissions populated from the §3 matrix (one INSERT per ● cell).
-- Company Owner gets NO explicit rows (implicit-all via app.is_org_owner).
-- Example (Manager subset):
insert into public.role_permissions (role_id, permission_key)
select r.id, k.key
from public.roles r
cross join (values
  ('dashboard.view'),('items.view'),('items.create'),('items.edit'),
  ('stock.adjust'),('pricing.override'),('stock_report.view'),('stock_report.export'),
  ('customers.view'),('customers.create'),('customers.edit'),('running_bill.view'),
  ('quotes.view'),('quotes.create'),('quotes.edit'),('quotes.revise'),('quotes.delete'),('quotes.export'),
  ('sales_orders.view'),('sales_orders.create'),('sales_orders.edit'),('sales_orders.delete'),
  ('challans.view'),('challans.create'),('challans.edit'),('challans.post'),('challans.delete'),
  ('payments.view'),('invoices.view'),('discount.post_sale'),('finance.view'),
  ('expenses.create'),('reports.sales.view'),('reports.inventory.view'),('reports.financial.view'),
  ('reports.hr.view'),('reports.export'),('hr.view'),('leave.approve'),
  ('support.view'),('support.manage')
) as k(key)
where r.key = 'manager' and r.org_id = :org;
-- (Employee, Accountant, HR seeded analogously from the matrix.)
```

---

## 7. Enforcement Layers (defense in depth)

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **1. Database (authoritative)** | RLS policies + `app.has_permission()` | Cannot be bypassed by client; tenant + permission isolation. |
| **2. Server (Next.js)** | Server Actions / route handlers check permission keys before mutation; Zod validation | Friendly errors, business rules (approval thresholds, state transitions like invoice `issue`). |
| **3. UI gating** | Permission-key hooks hide/disable pages, nav, buttons | UX only — never trusted for security. |
| **4. Audit** | Triggers + `audit_logs` on sensitive tables | Detect/attribute privilege use; immutable trail. |

**State-transition rules** not expressible in RLS alone (enforced at layer 2):
- Invoice `issue` only from `draft`; cannot edit an `issued` invoice (only `cancel`/void).
- Challan `post` is one-way (decrements stock, writes `stock_movements`); unposting requires Owner + audit.
- Discount/expense **approval thresholds** (`settings.approval_limits`) escalate Manager → Accountant/Owner.

---

## 8. Open Items
1. **Approval ceilings** — confirm numeric thresholds for `discount.approve` / `expenses.approve` per role (stored in `settings`).
2. **Payroll boundary** — confirmed split: HR owns inputs (`payroll.view`), Accountant processes (`payroll.manage`). Verify with stakeholder.
3. **Accountant customer edits** — limited to billing/GST fields; enforced at app layer (RLS grants row-level `edit`, app restricts editable columns). Consider a column-level policy or trigger if strict DB enforcement is required.
4. **Custom roles** — `admin.roles` lets Company Owner define additional roles/grants beyond the 6 seeded; UI for this is an Admin-panel feature (Phase 5).
5. **Super Admin claim** — `is_super_admin` carried as a JWT `app_metadata` claim set out-of-band (not user-editable); confirm provisioning flow.

---

*End of PERMISSIONS.md — authorization design artifact. RLS policies are specified but not yet applied as migrations (see `DATABASE_DESIGN.md §12` for migration ordering: helpers → policies → seed in steps 15–18).*
