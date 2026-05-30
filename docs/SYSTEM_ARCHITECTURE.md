# Watcon Business Management System — System Architecture

> **Status:** Master system-architecture reference (production multi-tenant SaaS). Design blueprint; no app code yet.
> **Date:** 2026-05-29
> **Companions:** [PROJECT_PLAN.md](PROJECT_PLAN.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [PERMISSIONS.md](PERMISSIONS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md)
> **Stack:** Next.js 15 (App Router, RSC, Server Actions) · TypeScript (strict) · Supabase (Auth + Postgres + Storage + Edge Functions + Realtime) · Drizzle ORM · TanStack Query · React Hook Form · Zod · **CSS Modules + SCSS** · **CSS-variable design tokens** · **Stripe** · **Resend** · **Sentry** · **PostHog**
> **Styling:** in-house UI system — CSS Modules (`.module.scss`) over a CSS-variable token foundation. **No Tailwind, no shadcn/ui.** See [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md).
> **Deploy target:** Vercel (Next.js) + Supabase (managed Postgres/Auth/Storage/Functions).

> **Scope of this document.** This is the *system-level* architecture — how the runtime pieces fit together, how a request flows, how tenancy and billing and files and notifications and approvals and reporting and observability all work end to end. It sits **above** [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (canonical tables/columns), [PERMISSIONS.md](PERMISSIONS.md) (RLS/RBAC), and [ARCHITECTURE.md](ARCHITECTURE.md) (folder structure). Every table/column/policy name used here is taken verbatim from those docs; this file never redefines them.

---

## Table of Contents
1. [Executive Summary & Architecture Goals](#1-executive-summary--architecture-goals)
2. [High-Level Topology & Request Lifecycle](#2-high-level-topology--request-lifecycle)
3. [Multi-Company (Multi-Tenant) Architecture](#3-multi-company-multi-tenant-architecture)
4. [Billing Architecture (Stripe)](#4-billing-architecture-stripe)
5. [File Storage Architecture (Supabase Storage)](#5-file-storage-architecture-supabase-storage)
6. [Notification Architecture](#6-notification-architecture)
7. [Approval Workflow Architecture](#7-approval-workflow-architecture)
8. [Reporting & Analytics Architecture](#8-reporting--analytics-architecture)
9. [Observability](#9-observability)
10. [Security, Environments, Deployment & Caching](#10-security-environments-deployment--caching)

---

## 1. Executive Summary & Architecture Goals

The Watcon Business Management System is a **multi-tenant B2B SaaS** that turns five validated prototypes (Dashboard, Customer Management, Item Management, Quote Management, Stock Reports) into a billed, production-grade product covering CRM, inventory + procurement, sales (order-to-cash), GST accounting, and HR + payroll — plus the cross-cutting SaaS subsystems (Files, Notifications, Approvals, Reporting).

**Tenancy model (canonical).** Shared-database, shared-schema, **row-level isolation**. The tenant is a **company** = one `organizations` row (`org_id`). A user (`auth.users` / `public.users`) may belong to **many** companies via `memberships`; roles are scoped per org via `user_roles(org_id, user_id, role_id)`. **Billing is per organization**: each org has one Stripe customer + one subscription on a plan; seats = active billable memberships; plan gates features and usage limits.

**Architecture goals**

| Goal | How this architecture meets it |
|------|-------------------------------|
| **Hard tenant isolation** | RLS is the source of truth (`FORCE ROW LEVEL SECURITY`, default-deny). `org_id` on every business row (denormalised to children). App + DB both enforce. |
| **Server-first, secure by default** | Reads in RSC via Drizzle; mutations via Server Actions validated by Zod, authorised by RBAC keys, re-checked by RLS. The client never holds privileged access. |
| **One source of truth per concern** | Schema → types; Zod → client+server validation; `lib/calc/` → preview *and* PDF math. (See [ARCHITECTURE.md §1](ARCHITECTURE.md).) |
| **Billing that can't drift** | Stripe is the system of record for money; our `subscriptions`/`invoices_billing` mirror it via idempotent webhooks (`stripe_events`). |
| **Operable & observable** | Sentry (errors + performance + releases), PostHog (product analytics + feature flags), structured logs, health checks. |
| **Composable cross-cutting systems** | One generic approval engine, one notification fan-out, one file-metadata layer, one reporting layer — reused by every module. |
| **Predictable cost & data growth** | Soft-delete + partial indexes; materialized views for analytics; Storage for blobs (never base64). |

**Non-goals (v1, per open questions in [DATABASE_SCHEMA.md §10](DATABASE_SCHEMA.md)):** full double-entry ledger, GSTR e-filing exports, and metered usage-overage billing are deferred; the schema is forward-compatible with all three.

---

## 2. High-Level Topology & Request Lifecycle

### 2.1 Topology diagram

```
                                   ┌──────────────────────────── BROWSER ───────────────────────────┐
                                   │  React (Client Components) · CSS Modules+SCSS · TanStack Query   │
                                   │  PostHog JS (events, flags) · Sentry Browser SDK · Supabase JS   │
                                   └───────────▲───────────────────────────────────▲─────────────────┘
                                               │ RSC payload / Server Action RPC     │ Realtime (WS)
                                               │ (HTTPS)                             │
┌──────────────────────────────────── VERCEL (Next.js 15, App Router) ──────────────────────────────────────┐
│  Edge:  middleware.ts → Supabase session refresh + route-group guard (auth / app / platform)               │
│  Node runtime:                                                                                              │
│    • RSC (Server Components)  ── read ──►  Drizzle (postgres-js)  ──►  Supabase Postgres (RLS enforced)      │
│    • Server Actions           ── write ─►  Zod validate → RBAC guard → Drizzle txn (+ withAudit) → RLS       │
│    • Route Handlers (app/api/*): /pdf, /email, /whatsapp, /webhooks/{stripe,resend}                         │
│  Sentry server SDK (traces, errors, source-mapped releases) · structured JSON logs                          │
└───────▲────────────▲───────────────▲────────────────▲───────────────────────▲────────────────▲────────────┘
        │            │               │                │                       │                │
        │ Postgres   │ Auth (JWT)    │ Storage         │ Edge Functions/cron   │ Stripe API     │ Resend API
        ▼            ▼               ▼                ▼                       ▼                ▼
┌──────────────────────────── SUPABASE ────────────────────────────┐   ┌──────────┐    ┌──────────┐
│ Postgres 15 (RLS, app.* helpers, triggers, mv_*)                  │   │  STRIPE  │    │  RESEND  │
│ Auth (GoTrue: email/OTP, JWT app_metadata.is_super_admin)         │   │ Billing  │    │  Email   │
│ Storage (buckets: product-images, company-logos, quote-assets,    │   │ Checkout │    │          │
│          documents) — Storage RLS keyed by {org_id}/...           │   │ Portal   │    └─────┬────┘
│ Edge Functions: stripe-webhook · resend-webhook · mv-refresh ·    │   │ Webhooks │          │ delivery
│                 report-runner   (Supabase cron / pg_cron)         │   └────┬─────┘          │ webhooks
│ Realtime: in-app notifications channel per user                   │        │ events         ▼
└───────────────────────────────────────────────────────────────────┘        ▼  app/api/webhooks/stripe
                                                            app/api/webhooks/resend
        ┌──────────────┐
        │   POSTHOG    │  product analytics · funnels · feature flags (server + client)
        └──────────────┘
```

### 2.2 Request lifecycle — reads (RSC) vs mutations (Server Actions)

**Read path (Server Component):**
1. `middleware.ts` refreshes the Supabase session cookie and guards the route group (`(auth)` / `(app)` / `(platform)` — [ARCHITECTURE.md §3](ARCHITECTURE.md)).
2. The RSC resolves the current user/org via `lib/auth/session.ts` (`getCurrentUser`, `getCurrentOrg`).
3. It calls a feature server query (`features/<x>/server/queries.ts`) using **Drizzle** over `postgres-js`.
4. Drizzle queries run **as the authenticated Postgres role**, so **RLS filters every row** by `app.is_member(org_id)` + `app.has_permission('<x>.view', org_id)`. No org filter is hand-written in app code — RLS is authoritative.
5. RSC streams HTML/RSC payload to the browser; TanStack Query hydrates client interactivity.

**Mutation path (Server Action):**
1. Client form (React Hook Form + Zod resolver from `validations/`) calls a TanStack Query mutation in `features/<x>/api/`, which invokes a **Server Action** in `features/<x>/server/actions.ts`.
2. The action **re-validates** the payload with the same Zod schema (trust boundary), then calls `lib/auth/rbac#requirePermission('<x>.create', org)`.
3. It writes through Drizzle inside a **transaction**; `lib/db/helpers#withAudit` records an `audit_logs` row; `services/numbering` assigns document numbers from `number_sequences` (atomic `SELECT … FOR UPDATE`).
4. **RLS independently re-checks** the org + permission on every affected row (defense in depth — [PERMISSIONS.md §7](PERMISSIONS.md)).
5. The action returns a typed `ActionResult<T>`; the client invalidates the relevant TanStack Query keys; Sentry captures any thrown error; PostHog records the business event.

> **Money & calculations never live in the DB.** Pure functions in `lib/calc/` (import landed-cost, quote totals, running bill — [PROJECT_PLAN §7](PROJECT_PLAN.md) / [DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md)) are shared by the live preview and the PDF so the numbers can never diverge.

### 2.3 Runtime boundaries

| Concern | Where it runs | Auth context |
|---------|---------------|--------------|
| RSC reads, Server Actions | Vercel Node runtime | End-user JWT → RLS-scoped Postgres role |
| `middleware.ts` | Vercel Edge | Session cookie refresh only |
| Stripe / Resend webhooks | `app/api/webhooks/*` (Node) **or** Supabase Edge Function | **Service role** (bypasses RLS by design — see §4.3, §10.1) |
| `mv-refresh`, `report-runner` | Supabase Edge Function on cron | Service role |
| Realtime notifications | Supabase Realtime | RLS-filtered subscription per user |

---

## 3. Multi-Company (Multi-Tenant) Architecture

### 3.1 The tenant = an organization

```
auth.users (Supabase) ── 1:1 ──► public.users (profile mirror, is_super_admin)
        │
        └──< memberships (org_id, user_id, is_default, is_billable) >── organizations (org_id = tenant root)
                                                                              │
                              user_roles (org_id, user_id, role_id) ──► roles ──< role_permissions >── permissions
```

- A **user** is platform-level (no `org_id`); their tenancy is expressed entirely through `memberships` (M:N) and `user_roles` (per-org role grants). This is the **multi-company architecture**: the same person can be Company Owner in org A and Accountant in org B. (Tables: [DATABASE_SCHEMA.md §3.1](DATABASE_SCHEMA.md).)
- Every tenant-scoped table — **including all child tables** (`quote_items`, `invoice_items`, `payroll_lines`, `approval_actions`, …) — carries `org_id NOT NULL`, denormalised so RLS checks need no join ([DATABASE_SCHEMA.md §8.1](DATABASE_SCHEMA.md)).

### 3.2 JWT claims & tenant resolution

Supabase Auth issues a JWT per session. We use two claim surfaces:

| Claim | Source | Use |
|-------|--------|-----|
| `sub` (`auth.uid()`) | GoTrue | Identifies the user; basis for `memberships`/`user_roles` lookups in RLS helpers. |
| `app_metadata.is_super_admin` | Set out-of-band by platform ops (never user-editable) | Read by `app.is_super_admin()` ([PERMISSIONS.md §6.1](PERMISSIONS.md)). |
| **active org** | App layer (cookie/header `x-org-id`), validated against `memberships` | Selects *which* org the session is acting in for this request. |

**Why the active org is app-layer, not a JWT claim.** A user can belong to many orgs and switch without re-issuing a token. The active org is resolved per request:

1. `lib/auth/session.ts#getCurrentOrg()` reads the org from a signed cookie (`watcon_org`) or falls back to `memberships.is_default = true`.
2. It **validates membership** (`app.is_member(org)`); a forged org id fails RLS regardless, because RLS recomputes membership from `auth.uid()` — the cookie is a *selector*, never a grant.
3. RSC/actions pass that `org` to `app.has_permission(key, org)` calls and to Drizzle queries.

> **Isolation guarantee.** Even if every app-layer check were bypassed, `app.is_member(org_id)` in each RLS `USING`/`WITH CHECK` clause means a user can only ever read/write rows of orgs they hold a `memberships` row for. RLS is recomputed from `auth.uid()` on the DB side — the client cannot influence it.

### 3.3 Org switching flow

```
[Topbar org switcher]  → Server Action switchOrg(org_id)
   1. assert app.is_member(org_id)         (reject if not a member)
   2. set signed cookie watcon_org=org_id
   3. optionally set memberships.is_default
   4. revalidatePath('/')  + clear TanStack Query cache (org-scoped keys)
   → next RSC render reads new active org; RLS now scopes to it
```

All TanStack Query keys are **prefixed with the active org** (`['org', orgId, 'quotes', …]`) so switching orgs cannot serve another org's cached data (§10.4).

### 3.4 Isolation guarantees summary

| Layer | Guarantee |
|-------|-----------|
| **DB / RLS** | `FORCE ROW LEVEL SECURITY` + `app.is_member(org_id)` on every policy → cross-tenant read/write impossible. |
| **App / Server** | Active org validated against `memberships`; permission keys re-checked via `lib/auth/rbac`. |
| **Storage** | Bucket policies key on `{org_id}/` path prefix (§5.3). |
| **Cache** | Org-prefixed query keys; cache cleared on org switch. |
| **Billing** | One `stripe_customer_id` per org; subscription/seat state never shared across orgs. |
| **Platform tables** | `users`, `permissions`, `plans`, `plan_features`, `stripe_events` are intentionally org-free (cross-tenant catalogs) and exposed only through specific policies / service role. |

---

## 4. Billing Architecture (Stripe)

### 4.1 Model

**Billing is per organization.** Each `organizations` row owns exactly one `stripe_customer_id` and (normally) one **live** `subscriptions` row on a `plans` row — enforced by the partial unique index `uq_sub_live (org_id) WHERE status IN ('trialing','active','past_due') AND deleted_at IS NULL` ([DATABASE_SCHEMA.md §6.2](DATABASE_SCHEMA.md)).

Tables ([DATABASE_SCHEMA.md §3.2](DATABASE_SCHEMA.md)): `plans`, `plan_features`, `subscriptions`, `subscription_items`, `invoices_billing` (Stripe invoices, distinct from sales `invoices`), `payment_methods`, `usage_records`, `stripe_events`.

> **Money representation.** Stripe amounts are stored as `bigint` **minor units** (paise/cents) with a `currency` column, exactly as Stripe sends them — never mixed with app money (`numeric(14,2)`).

### 4.2 Seat counting

```
seats = COUNT(*) FROM memberships
        WHERE org_id = :org
          AND is_billable = true
          AND <member user active>
```

On every membership change (invitation accepted, member removed, `is_billable` toggled), a Server Action recomputes seats and syncs `subscriptions.quantity` to Stripe (and back via webhook). Whether *invited-but-unaccepted* `invitations` count toward seats is an open decision ([DATABASE_SCHEMA.md §10.4](DATABASE_SCHEMA.md)); default = count on **acceptance**.

### 4.3 Webhook handling + idempotency

Stripe is the **system of record** for billing; our tables are a **read model** synced via webhooks. The endpoint is `app/api/webhooks/stripe/route.ts` (or a Supabase Edge Function `stripe-webhook`), running with the **service role** (bypasses RLS — these writes are not user-scoped).

**Idempotency via `stripe_events`** (PK = Stripe `event.id`):
1. Verify the Stripe signature (raw body + `STRIPE_WEBHOOK_SECRET`).
2. `INSERT INTO stripe_events (id, type, payload, status='received')` — if the PK already exists, **return 200 immediately** (duplicate delivery; nothing to do).
3. Dispatch on `type`, update our tables, then set `status='processed'` / `processed_at`. On failure, set `status='failed'` + `error`, return 5xx so Stripe retries.

Handled events → effect:

| Stripe event | Effect on our schema |
|--------------|----------------------|
| `checkout.session.completed` | Link `organizations.stripe_customer_id`; create `subscriptions` (status `trialing`/`active`). |
| `customer.subscription.created/updated` | Upsert `subscriptions` (status, period, `quantity`, `cancel_at_period_end`, `trial_ends_at`). |
| `customer.subscription.deleted` | Mark `subscriptions.status='canceled'`, `canceled_at`; downstream suspension (§4.6). |
| `invoice.created/finalized` | Upsert `invoices_billing` (status, amounts, `hosted_invoice_url`, `invoice_pdf`, periods). |
| `invoice.paid` | `invoices_billing.status='paid'`, `paid_at`; clear any `past_due`. |
| `invoice.payment_failed` | Start dunning; `subscriptions.status='past_due'` (Stripe-driven). |
| `payment_method.attached/detached` | Upsert/remove `payment_methods` (display fields only — no PCI data). |

### 4.4 Subscribe sequence (Checkout)

```
User (Owner)        Next.js (Server Action)        Stripe                 Webhook (service role)
   │                       │                          │                         │
   │ "Subscribe to Growth" │                          │                         │
   ├──────────────────────►│ create Customer (if none)│                         │
   │                       ├─────────────────────────►│  customer.id            │
   │                       │ save stripe_customer_id   │                         │
   │                       ├─ create Checkout Session ►│  session.url            │
   │  redirect to Checkout │◄─────────────────────────┤                         │
   ├──────────────────────────────────────────────────► (Stripe-hosted payment) │
   │                       │                          │  checkout.session.completed
   │                       │                          ├────────────────────────►│ upsert subscriptions
   │                       │                          │  customer.subscription.created
   │                       │                          ├────────────────────────►│ + invoices_billing
   │  return_url /billing  │◄──── redirect ───────────┤                         │
   │  (RSC reads subscriptions → shows Active/Trialing)│                         │
```

### 4.5 Webhook sequence (idempotent)

```
Stripe ──POST event──► /api/webhooks/stripe
                          │ 1. verify signature (STRIPE_WEBHOOK_SECRET)
                          │ 2. INSERT stripe_events(id=event.id) ON CONFLICT → return 200 (dup)
                          │ 3. dispatch(type) → update subscriptions / invoices_billing / payment_methods
                          │ 4. set stripe_events.status = processed | failed
                          └─ 200 OK  (or 5xx → Stripe retries with same event.id ⇒ safe)
```

### 4.6 Trials, dunning, grace periods, suspension

- **Trial:** `plans.trial_days` (default 14) → `subscriptions.status='trialing'`, `trial_ends_at`. Full feature access during trial.
- **Dunning:** `invoice.payment_failed` → `past_due`. Stripe Smart Retries drive re-attempts; we surface a banner (via PostHog flag / `organization_settings.feature_flags`).
- **Grace period:** while `past_due`, the org remains **read-mostly** — reads allowed, write-heavy actions blocked at the **app layer** (RLS still isolates data). Boundary = `subscriptions.current_period_end`.
- **Suspension:** `unpaid`/`canceled` → app flips effective access to read-only/blocked and may set `organizations.status='inactive'` ([DATABASE_SCHEMA.md §8.2](DATABASE_SCHEMA.md)). Data is **never** deleted; `invoices_billing` is retained for legal/audit.

### 4.7 Plan-based feature gating & usage limits

`plan_features` rows define gates per plan ([DATABASE_SCHEMA.md §3.2](DATABASE_SCHEMA.md)):

| `feature_type` | Meaning | Example | Enforcement |
|----------------|---------|---------|-------------|
| `boolean` | Module on/off | `module.hr`, `module.analytics`, `whatsapp.send` | App layer + UI gate (`permission-gate` + flag); surfaced as PostHog feature flag. |
| `limit` | Hard cap | `seats`, `storage_mb` | Server pre-check vs current usage; block on exceed. |
| `quota` | Periodic allowance | `quotes`, `invoices`, `api_calls` per period | Compared against aggregated `usage_records`. |

Enforcement points: feature gating is checked in Server Actions and reflected in the UI; hard caps are double-checked against `usage_records` aggregates (`idx_usage_org_metric_period`). Soft (overage-billed) vs hard-block per metric is an open decision ([DATABASE_SCHEMA.md §10.5](DATABASE_SCHEMA.md)).

- **Customer portal:** the Stripe Billing Customer Portal handles plan changes, payment-method updates, and invoice history; we deep-link from `/settings` billing. Portal-driven changes return to us via the same webhooks (§4.3) — no divergent write path.

---

## 5. File Storage Architecture (Supabase Storage)

### 5.1 Buckets & path convention

| Bucket | Contents | Public? |
|--------|----------|---------|
| `product-images` | Item / variant images | Signed URLs only |
| `company-logos` | Org logos (`organizations.logo_url`, quote headers) | Signed URLs only |
| `quote-assets` | Quote/BOQ images & generated PDFs | Signed URLs only |
| `documents` | Expense receipts, generic uploads, generated reports | Signed URLs only |

**Path convention: every object is `{org_id}/...`** so the tenant is encoded in the path and Storage RLS can derive it (`split_part(name,'/',1)::uuid`). Example: `product-images/{org_id}/{item_id}/{uuid}.webp`.

### 5.2 The `files` metadata table

Every Storage object has a `files` row ([DATABASE_SCHEMA.md §3.8](DATABASE_SCHEMA.md)): `bucket`, `path` (UNIQUE `(bucket, path)`), polymorphic `owner_entity_type`/`owner_entity_id`, `mime`, `size_bytes` (feeds `storage_mb` usage metering), `checksum` (sha256 dedupe/integrity), `status` (`pending → clean | quarantined | deleted`), `uploaded_by`. Images and files are **always** Storage URLs + a `files` row — **never base64** in the DB.

### 5.3 Storage RLS (keyed by `{org_id}/`)

From [PERMISSIONS.md §6.4](PERMISSIONS.md) — read requires org membership, write requires the owning entity's permission:

```sql
create policy storage_pimg_read on storage.objects for select
  using ( bucket_id = 'product-images'
          and app.is_member( (split_part(name,'/',1))::uuid ) );

create policy storage_pimg_write on storage.objects for insert
  with check ( bucket_id = 'product-images'
               and app.has_permission('items.edit', (split_part(name,'/',1))::uuid) );
```

Analogous policies exist per bucket (e.g. `documents` write requires `expenses.create` for receipts).

### 5.4 Upload flow (signed, server-orchestrated)

```
Client (file-upload.tsx)        Server Action / storage.service        Supabase Storage
   │ pick file (validate mime/size client-side, UX only)
   ├──────────────────────────────►│ requirePermission('items.edit', org)
   │                                ├─ create signed upload URL ({org_id}/...)
   │ ◄── signed PUT URL ────────────┤
   ├── PUT bytes directly to Storage ───────────────────────────────────►│ object stored
   │ ◄── 200 ───────────────────────────────────────────────────────────┤
   ├──────────────────────────────►│ insert files row (status='pending',
   │                                │   checksum, size_bytes, owner_entity_*)
   │                                │ set entity.image_url = signed/public path
   │ (async) AV scan / image proc → files.status='clean' (or 'quarantined')
```

- **Reads** use **time-boxed signed URLs** minted server-side (`storage.service.ts`), never long-lived public links — preserving tenant isolation.
- **Image handling:** client-side downscale/convert to WebP before upload; large assets resized via an Edge Function on the `clean` transition. `size_bytes` aggregates into `usage_records (metric='storage_mb')` for plan limits (§4.7).
- **Lifecycle:** deleting an entity soft-deletes its `files` row and removes the Storage object asynchronously; `files.status='deleted'` is the tombstone.

---

## 6. Notification Architecture

### 6.1 Channels & tables

Tables ([DATABASE_SCHEMA.md §3.9](DATABASE_SCHEMA.md)): `notifications` (in-app), `notification_preferences` (per-user × category × channel opt-in), `notification_templates` (Handlebars/MJML per channel), `notification_deliveries` (append-only outbound log). Channels (`notification_channel`): `in_app`, `email` (Resend), `whatsapp` (future provider), `webhook`.

### 6.2 Event → fan-out → channel

```
Domain event (e.g. invoice.issued, quote.accepted, lead.assigned, approval.pending)
        │  raised by a Server Action after a successful txn
        ▼
notification.service (services/notifications)
        │ 1. resolve recipients (user_id(s), or role → users in org)
        │ 2. load notification_templates by (org_id, key, channel)
        │ 3. for each recipient × channel:
        │      check notification_preferences(category, channel) → skip if disabled
        │      check plan feature (whatsapp.send) for gated channels
        ▼
  ┌────────────────┬──────────────────────────┬───────────────────────────┐
  │ in_app         │ email (Resend)            │ whatsapp (future)         │
  ▼                ▼                          ▼                            
insert notifications   render template → Resend.send()      provider send
(Realtime push to        │                                       │
 user channel)           ├─ insert notification_deliveries (queued→sent)
                         │  store provider_message_id
                         ▼
            Resend delivery webhook → /api/webhooks/resend
            updates notification_deliveries.status (delivered|bounced|failed)
```

- **In-app** is delivered over **Supabase Realtime**: each user subscribes to an RLS-filtered channel on `notifications` (`idx_notif_user_status` powers the unread badge). Archive via `status` (no soft delete).
- **Email** goes through **Resend** (`services/email`); `notification_deliveries` records `provider='resend'` + `provider_message_id`; the Resend webhook (`app/api/webhooks/resend`) reconciles `delivered`/`bounced`/`failed` (`idx_nd_provider_msg`).
- **Digesting:** preference categories (`billing`, `sales`, `hr`, …) support immediate vs digest; digests are assembled by the `report-runner`/cron Edge Function and sent as a single Resend email, recording one delivery per digest.

> **Fan-out policy:** in-app is **always** created; email/WhatsApp are gated by `notification_preferences` **and** plan feature (`whatsapp.send`) per [DATABASE_SCHEMA.md §10.8](DATABASE_SCHEMA.md).

---

## 7. Approval Workflow Architecture

### 7.1 One generic engine, many use-cases

A single engine drives **discount approval, expense approval, PO approval, and payroll sign-off**. Tables ([DATABASE_SCHEMA.md §3.10](DATABASE_SCHEMA.md)):

- `approval_workflows` — definition per `entity_type` (`discount | expense | purchase_order | payroll_run | quote | invoice`), with `min_amount` trigger threshold + `config`.
- `approval_steps` — ordered steps; `step_type` ∈ `role | user | amount_threshold` (`role_key`, `approver_id`, `threshold_amount`, `is_required`).
- `approval_requests` — runtime instance pointing **polymorphically** at the target (`entity_type` + `entity_id`), tracking `current_step`, `status`, `amount`.
- `approval_actions` — append-only decision log (`decision` ∈ `approved | rejected | delegated | commented`).

### 7.2 How each domain plugs in

| Domain | Trigger | Target | Resolution effect |
|--------|---------|--------|-------------------|
| **Discount** | discount % / amount exceeds `settings.approval_limits` for the actor's role ([PERMISSIONS.md §8](PERMISSIONS.md)) | `quotes` / `invoices` | On approve, allow `discount.post_sale` / proceed. |
| **Expense** | `expenses` submitted above ceiling | `expenses` | On final approve, `expenses.status='approved'` → payable. |
| **Purchase Order** | PO `subtotal` ≥ workflow `min_amount` | `purchase_orders` | On approve, PO may be `sent` to supplier. |
| **Payroll** | `payroll_runs` computed | `payroll_runs` | Sign-off gates `payroll_run_status` `computed → approved`. |

> The legacy `expense_approvals` table is retained for compatibility; new flows use the generic engine ([DATABASE_SCHEMA.md §10.6](DATABASE_SCHEMA.md)).

### 7.3 State machine

```
            create approval_request (status = pending, current_step = 1)
                                   │
                                   ▼
                   ┌────────────  PENDING  ────────────┐
                   │                │                  │
        step approver               step approver       request timeout /
        approves required           rejects             above next ceiling
                   │                │                  │
        more steps? ──yes──► advance current_step      ▼
                   │            (stay PENDING)      ESCALATED ─► reassign to
                  no                                  Accountant/Owner ─► PENDING
                   ▼                                  
                APPROVED                              REJECTED
       (apply effect: post discount,                 (entity returns to draft;
        send PO, mark expense approved,               notify requester)
        sign off payroll)
                   │
        requester may CANCEL while PENDING ─► CANCELLED
```

- **Thresholds & escalation:** Manager-level `discount.approve` / `expenses.approve` are ⚙ capped by `organization_settings.approval_limits`; exceeding the ceiling escalates the step to Accountant/Owner ([PERMISSIONS.md §3, §7, §8](PERMISSIONS.md)). Enforced at the **server layer** (state transitions are not expressible in RLS alone).
- Each transition fan-outs a notification (`approval.pending`, `approval.approved`, `approval.rejected`) via §6.

---

## 8. Reporting & Analytics Architecture

### 8.1 Three tiers

```
Tier 1  OPERATIONAL (live)        Tier 2  ANALYTICAL (materialized)     Tier 3  PRODUCT (PostHog)
RSC + Drizzle reads,              mv_sales_summary                      events, funnels, retention,
RLS-scoped, real-time             mv_inventory_valuation                feature-flag exposure
(e.g. customer_running_bill       mv_receivables_ageing
 view, stock reports)             mv_hr_headcount
```

- **Operational reports** (live): Stock Reports, Running Bill, dashboard KPIs — computed on read via Drizzle over RLS-scoped tables (the `customer_running_bill` view derives `Σ challan value − post_sale_discount − Σ payments`, [DATABASE_SCHEMA.md §9](DATABASE_SCHEMA.md)).
- **Materialized views** (`mv_*`, [DATABASE_SCHEMA.md §3.11](DATABASE_SCHEMA.md)) carry `org_id` and are exposed only through **security-barrier views** (`v_sales_summary … WHERE app.is_member(org_id)`) — Postgres MVs can't host RLS directly ([DATABASE_SCHEMA.md §8.4](DATABASE_SCHEMA.md)). Each MV has a unique index for `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

### 8.2 Scheduled refresh & report delivery

```
Supabase cron (pg_cron) ──► Edge Function: mv-refresh
   • nightly: mv_inventory_valuation, mv_hr_headcount, mv_sales_summary
   • hourly:  mv_receivables_ageing      (freshness SLA per DATABASE_SCHEMA §10.9)
   • REFRESH MATERIALIZED VIEW CONCURRENTLY <mv>  (service role)

Supabase cron ──► Edge Function: report-runner
   • scan report_schedules WHERE next_run_at <= now() AND is_active
   • run saved_reports.filters → query (security-barrier views)
   • render data-driven PDF/CSV/XLSX (locked columns) via services/pdf
   • deliver to report_schedules.recipients via Resend (channel='email')
   • record notification_deliveries; bump last_run_at, next_run_at
```

- **Saved & scheduled reports:** `saved_reports` (definition + `filters` + `format`) and `report_schedules` (`frequency`, `next_run_at`, `recipients`, `channel`) ([DATABASE_SCHEMA.md §3.11](DATABASE_SCHEMA.md)). Scheduled email reports reuse the **Resend** path and notification-delivery logging from §6.
- **Data-driven PDF (locked columns):** report and document PDFs render from data through `lib/pdf/templates` (`services/pdf`) with **fixed column layouts** so the same data always produces the same locked output ([ARCHITECTURE.md §6–7](ARCHITECTURE.md)). The stock report supports Print/PDF/Email/WhatsApp.
- **PostHog product analytics:** funnels (signup → first quote → first invoice), feature adoption, retention, and feature-flag exposure. Server events are sent from Server Actions; client events from PostHog JS. Flags map to plan features (§4.7) so gated modules are both *entitled* (plan) and *rolled out* (flag).

---

## 9. Observability

### 9.1 Sentry — errors, performance, releases

- **Errors:** Sentry SDK in both the browser and the Vercel Node runtime; Server Action and Route Handler errors are captured with org/user context (no PII beyond `user_id`/`org_id`).
- **Performance:** distributed tracing across RSC render → Server Action → Drizzle query; webhook handlers (`stripe-webhook`, `resend-webhook`) traced as transactions.
- **Releases & source maps:** each Vercel deploy uploads source maps and tags a Sentry release with the Git SHA, so stack traces de-minify and regressions are attributable to a deploy.

### 9.2 PostHog — product analytics & flags

- Events, funnels, and retention (§8.3); **feature flags** double as the rollout switch for plan-gated modules (`module.hr`, `module.analytics`, `whatsapp.send`), cached into `organization_settings.feature_flags`.

### 9.3 Structured logging & health checks

- **Structured JSON logs** from Server Actions / handlers with correlation fields (`org_id`, `user_id`, `request_id`, `action`); aggregated via Vercel logs.
- **Audit trail** is separate and authoritative for security events — immutable `audit_logs` via `withAudit` + triggers ([PERMISSIONS.md §7](PERMISSIONS.md)).
- **Health checks:** `GET /api/health` (app up + DB ping), Supabase project health, and a synthetic check that the latest `stripe_events` is `processed` (billing-sync liveness). MV staleness alerts if `mv-refresh` misses its SLA.

---

## 10. Security, Environments, Deployment & Caching

### 10.1 Security architecture

| Control | Implementation |
|---------|----------------|
| **Tenant isolation** | RLS everywhere (`FORCE`), `app.is_member`/`has_permission`/`is_org_owner`/`is_super_admin` ([PERMISSIONS.md §6](PERMISSIONS.md)). |
| **AuthN** | Supabase Auth (GoTrue), httpOnly session cookies refreshed in `middleware.ts`. |
| **AuthZ** | 4-layer defense in depth: DB (RLS) → Server (RBAC + Zod + state machines) → UI gating → Audit ([PERMISSIONS.md §7](PERMISSIONS.md)). |
| **Service-role usage** | Confined to webhook/cron Edge Functions; never reachable from the browser; bypasses RLS only for system-of-record sync (§2.3, §4.3). |
| **Secrets** | `lib/env.ts` Zod-validates env at boot (fail fast). Stripe/Resend/Service keys live only in server env (Vercel + Supabase secrets), never `NEXT_PUBLIC_*`. |
| **Webhook verification** | Stripe signature + Resend signature checks before any DB write. |
| **Rate limiting** | Per-IP/user limits on auth, webhook, `/api/email`, `/api/whatsapp`, and Server Actions (edge middleware / Upstash-style limiter). |
| **No PCI / no base64** | Only Stripe references + display fields in `payment_methods`; files are Storage URLs + `files` rows. |
| **Audit** | Immutable `audit_logs`; sensitive actions (stock adjust, payment void, invoice issue, role change) always logged. |

### 10.2 Environments

| Env | Next.js | Supabase | Stripe | Purpose |
|-----|---------|----------|--------|---------|
| **Local** | `next dev` | Local Supabase / dev branch | Test mode + Stripe CLI `listen` | Development. |
| **Preview** | Vercel preview per PR | Supabase **branch** (ephemeral) | Test mode | Review apps; isolated data. |
| **Production** | Vercel prod | Supabase prod project | Live mode | Customers. |

Vercel environment variables are scoped per environment; **Supabase branches** give each preview an isolated database for safe RLS/migration testing.

### 10.3 CI/CD & migrations

```
git push / PR ─► CI:  typecheck · lint (incl. import-boundary rules) ·
                      unit tests (lib/calc) · integration (Server Actions vs test DB) ·
                      check-rls.ts (every table has RLS + ≥1 policy)
              ─► Vercel preview deploy + Supabase branch
merge to main ─► migrations applied (DATABASE_DESIGN §12 ordering:
                  Drizzle DDL → RLS helpers → policies → seed) ─► Vercel prod deploy
                  ─► Sentry release + source maps uploaded
```

Migrations are **ordered**: Drizzle-generated DDL first, then hand-authored RLS helpers → policies → triggers/views → seed (`supabase/migrations/`, [ARCHITECTURE.md §12](ARCHITECTURE.md)).

### 10.4 Caching strategy

| Layer | Mechanism | Tenant-safety |
|-------|-----------|---------------|
| **RSC** | Next.js fetch/segment cache; `revalidatePath`/`revalidateTag` after mutations | RLS-scoped reads; tags include org. |
| **TanStack Query** | Client cache for interactive data | **All keys org-prefixed** (`['org', orgId, …]`); cache cleared on org switch (§3.3). |
| **Feature flags** | `organization_settings.feature_flags` caches PostHog flags | Per-org. |
| **MVs** | Precomputed analytics (§8) | Per-org rows, security-barrier views. |

> **Invalidation rule:** every Server Action that mutates a feature's data invalidates that feature's org-prefixed query keys and revalidates affected RSC segments — preventing stale cross-render data and any cross-org bleed.

### 10.5 Folder-structure pointer

The runtime concerns above map onto the feature-sliced codebase defined in **[ARCHITECTURE.md](ARCHITECTURE.md)**: routing in `app/`, business slices in `features/<x>/{components,hooks,server,api,lib}`, framework-agnostic core in `lib/` (`db`, `supabase`, `auth`, `calc`, `pdf`), infrastructure adapters in `services/` (`storage`, `pdf`, `email`, `whatsapp`, `notifications`, `numbering`), shared `types/` and `validations/`, and Supabase SQL in `supabase/migrations/`. Dependency direction is strictly downward (`app → features → lib/services/validations/types`).

---

*End of SYSTEM_ARCHITECTURE.md — system-level blueprint for the multi-tenant SaaS. Tables/columns are canonical per [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); authorization per [PERMISSIONS.md](PERMISSIONS.md); folder layout per [ARCHITECTURE.md](ARCHITECTURE.md); phasing per [ROADMAP.md](ROADMAP.md). No application code or migrations are generated here.*
