# Watcon Business Management System — Architecture & Folder Structure

> **Status:** Architecture blueprint (production-ready structure; no app code written yet)
> **Date:** 2026-05-29
> **Companions:** `PROJECT_PLAN.md`, `DATABASE_DESIGN.md`, `PERMISSIONS.md`
> **Stack:** Next.js (App Router) · TypeScript (strict) · Supabase · Drizzle ORM · React Query · React Hook Form · Zod · **CSS Modules + SCSS** · **CSS-variable design tokens** (styling system → [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md))

---

## 0. Reconciliation Note

This document **finalises** the folder layout sketched in `PROJECT_PLAN.md §10.3`. The earlier sketch put domain components under `components/<domain>/` and queries under `db/queries/`. This architecture adopts a **feature-sliced** layout instead, with the eight top-level directories you requested:

```
app/  components/  features/  lib/  services/  hooks/  types/  validations/
```

The Drizzle schema from `DATABASE_DESIGN.md` lives at **`lib/db/schema/`**; the RBAC keys from `PERMISSIONS.md` live at **`lib/auth/permissions.ts`**; the pure calculations from `PROJECT_PLAN.md §7` live at **`lib/calc/`**. Nothing in the prior documents is invalidated — only relocated to these canonical paths.

---

## 1. Architectural Principles

1. **Feature-sliced, not layer-sliced.** Vertical slices in `features/` keep everything for one business capability (quotes, items, customers…) together — UI, hooks, server actions, data access. You change a feature in one folder.
2. **Shared concerns are centralised.** Cross-cutting code (UI primitives, types, Zod schemas, global hooks, infrastructure adapters) lives in the dedicated top-level folders so it is discoverable and reused, never duplicated per feature.
3. **One source of truth per concern.** Types flow from Drizzle (`lib/db/schema`) → `types/`. Validation flows from `validations/` (Zod) → both client forms (RHF) and server actions. Business math lives once in `lib/calc/` and is shared by the live preview *and* the PDF (the recurring prototype bug where they diverged).
4. **Server-first.** Reads happen in React Server Components via Drizzle; mutations go through Server Actions / route handlers validated by Zod and authorised by RLS (`PERMISSIONS.md §6`). The client never holds privileged access.
5. **Strict dependency direction** (see §11). `app/` → `features/` → (`lib/`, `services/`, `validations/`, `types/`). Shared leaf folders never import upward.
6. **Multi-tenant + RBAC are ambient.** `org_id` scoping and permission checks are enforced at the DB (RLS) and re-checked in the server layer; the UI only gates for UX.

---

## 2. Top-Level Tree

```
watcon/
├── app/                      # Next.js App Router — routing, layouts, route handlers, server actions
├── components/               # Shared, cross-feature UI (hand-built primitives + .module.scss, layout, providers)
├── features/                 # Vertical feature slices (the bulk of the product)
├── lib/                      # Framework-agnostic core: db, supabase, auth, calc, pdf, utils
├── services/                 # Infrastructure adapters: email, whatsapp, storage, pdf engine, numbering
├── hooks/                    # Global React hooks (cross-feature)
├── types/                    # Shared TypeScript types (DB-inferred, API, permissions, enums)
├── validations/              # Shared Zod schemas (client + server validation)
├── supabase/                 # Supabase project: migrations, RLS SQL, seed, config
├── drizzle/                  # Drizzle generated migration artefacts + drizzle.config.ts output
├── public/                   # Static assets (fonts, favicon)
├── tests/                    # Unit/integration/e2e tests + fixtures
├── scripts/                  # Dev/ops scripts (seed, gen-types, check-rls)
├── .env.local                # Local secrets (gitignored)
├── .env.example              # Documented env contract
├── drizzle.config.ts         # Drizzle Kit config (schema path, dialect=postgres)
├── next.config.ts            # incl. sassOptions.includePaths → ['styles'] for clean @use
├── styles/                   # Global SCSS: design tokens (CSS vars), mixins, functions, reset
│                             #   (the single styling source of truth → FRONTEND_DESIGN_SYSTEM.md)
├── middleware.ts             # Supabase auth session refresh + route protection
├── tsconfig.json             # Strict; path aliases (@/app, @/features, @/lib, …)
└── package.json
```

---

## 3. `app/` — Routing Layer

**Why it exists:** Next.js App Router owns URL → UI mapping, layouts, loading/error boundaries, route handlers (REST endpoints), and server actions. Kept **thin**: pages fetch via feature server functions and compose feature components — **no business logic here**.

```
app/
├── layout.tsx                # Root layout: fonts (Noto Serif JP), providers, html shell
├── globals.scss              # Imports styles/tokens + reset; defines :root CSS variables
├── page.tsx                  # Redirect → /dashboard or /login
│
├── (auth)/                   # Route group: unauthenticated
│   ├── layout.tsx            # Minimal centered layout
│   └── login/page.tsx        # Login (Supabase Auth)
│
├── (app)/                    # Route group: authenticated app shell (sidebar + topbar)
│   ├── layout.tsx            # Guards session; renders AppShell; role-gated nav
│   ├── dashboard/page.tsx
│   ├── items/
│   │   ├── page.tsx                  # Catalogue list (RSC)
│   │   ├── new/page.tsx              # New item + import calculator
│   │   └── [id]/
│   │       ├── page.tsx              # Item detail (stock, last purchase, history)
│   │       └── edit/page.tsx
│   ├── stock-reports/page.tsx
│   ├── customers/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx             # Detail + Running Bill
│   ├── quotes/
│   │   ├── page.tsx
│   │   ├── new/page.tsx              # Quote builder
│   │   └── [id]/
│   │       ├── page.tsx              # Quote detail / preview
│   │       └── edit/page.tsx
│   ├── sales-orders/[...]            # list / [id]
│   ├── challans/[...]
│   ├── payments/page.tsx
│   ├── invoices/[...]
│   ├── finance/page.tsx              # P&L, budgets
│   ├── expenses/page.tsx
│   ├── payroll/page.tsx
│   ├── hr/[...]                      # employees / leave / appraisals
│   ├── support/[...]                 # tickets
│   ├── reports/page.tsx
│   ├── admin/
│   │   ├── users/page.tsx
│   │   ├── roles/page.tsx
│   │   └── audit/page.tsx
│   └── settings/page.tsx
│
├── (platform)/               # Super Admin only (cross-org)
│   └── platform/
│       ├── organizations/page.tsx
│       └── system/page.tsx
│
└── api/                      # Route handlers (non-RSC endpoints)
    ├── pdf/[doc]/route.ts            # Server PDF generation (quote, BOQ, stock report, invoice)
    ├── email/route.ts                # Send report/invoice with PDF attachment
    ├── whatsapp/route.ts             # WhatsApp Business API send
    └── webhooks/
        └── supabase/route.ts         # Auth/storage webhooks
```

> **Route groups** `(auth)`/`(app)`/`(platform)` apply different layouts and guards without affecting URLs. Each leaf `page.tsx` is a few lines: resolve params → call a feature server query → render a feature component.

---

## 4. `components/` — Shared UI

**Why it exists:** Presentational, **feature-agnostic** building blocks reused everywhere. If a component encodes domain logic (a quote line row), it belongs in a feature; if it's generic (a data table, a money input), it lives here.

```
components/
├── ui/                       # Hand-built primitives (Button, Dialog, Input, Table, …) — each
│                             #   a .tsx + co-located .module.scss consuming design tokens
├── layout/
│   ├── app-shell.tsx         # Sidebar + topbar + content frame (Japanese-minimal)
│   ├── sidebar.tsx           # Nav, role-gated via usePermissions
│   ├── topbar.tsx            # Org switcher, user menu, search
│   └── page-header.tsx       # Title + breadcrumb + actions slot
├── shared/
│   ├── data-table/           # Sortable/paginated table wrapper (TanStack Table)
│   ├── empty-state.tsx
│   ├── confirm-dialog.tsx
│   ├── money-input.tsx       # ₹ numeric input (precision-safe)
│   ├── file-upload.tsx       # → Supabase Storage (product images, logos)
│   ├── permission-gate.tsx   # Renders children only if user holds a permission key
│   └── export-menu.tsx       # Print / Save PDF / Email / WhatsApp / Copy
└── providers/
    ├── query-provider.tsx    # React Query client
    ├── theme-provider.tsx
    └── supabase-provider.tsx # Browser Supabase client context
```

---

## 5. `features/` — Vertical Feature Slices

**Why it exists:** The core of the product. Each folder is a self-contained business capability owning its UI, local hooks, server-side data access (queries + mutations/actions), and use-cases. Maps 1:1 to the modules in `PROJECT_PLAN.md §3`.

```
features/
├── auth/
├── dashboard/
├── items/
├── stock-reports/
├── customers/
├── quotes/
├── sales-orders/
├── challans/
├── payments/
├── invoices/
├── finance/
├── hr/
├── support/
├── reports/
└── admin/
```

### 5.1 Anatomy of a feature slice (canonical shape)
Every feature follows the same internal layout. Example — `features/quotes/`:

```
features/quotes/
├── components/                       # Feature-specific UI (client/server components)
│   ├── quote-list.tsx
│   ├── quote-builder.tsx             # RHF + useFieldArray (locations → items → options)
│   ├── location-section.tsx
│   ├── line-item-row.tsx
│   ├── alternate-item-row.tsx        # optional items (excluded from total)
│   ├── installation-block.tsx
│   ├── totals-panel.tsx              # live totals (consumes lib/calc/quote-totals)
│   ├── terms-editor.tsx
│   └── boq-preview.tsx
├── hooks/                            # Feature-local hooks
│   ├── use-quote-form.ts             # RHF setup + Zod resolver
│   └── use-quote-totals.ts           # derived live totals (watch + calc)
├── server/                          # Server-only data access (never imported by client)
│   ├── queries.ts                    # getQuotes, getQuoteById (Drizzle reads, RSC)
│   └── actions.ts                    # createQuote, updateQuote, reviseQuote (Server Actions)
├── api/                              # React Query hooks (client mutations/reads via actions)
│   └── use-quotes.ts
├── lib/                              # Feature-only helpers (formatting, mappers)
│   └── quote-mappers.ts              # DB row ⇄ form model
└── index.ts                          # Public surface of the feature (barrel)
```

> **Rule:** `server/` files are `import 'server-only'`. Client components reach the server through `api/` (React Query → Server Actions). Feature-local types live next to use; **shared** types/schemas go to `types/` and `validations/`.

### 5.2 Notable feature specifics
- **`items/`** — `components/import-calculator.tsx` drives the landed-cost flow; the math itself is in `lib/calc/import-cost.ts` (shared, tested). `components/stock-adjust-dialog.tsx` is gated by `stock.adjust` (`PERMISSIONS.md §3`).
- **`stock-reports/`** — `components/report-filters.tsx` implements the hierarchical family → variation → brand cascade; export goes through `components/shared/export-menu` → `services/pdf`.
- **`customers/`** — `components/running-bill.tsx` renders the derived ledger from `lib/calc/running-bill.ts`.
- **`quotes/`** — the most complex form; nested `useFieldArray`, per-area selection, GST modes, total-display modes (`PROJECT_PLAN.md §7.2`).
- **`admin/`** — users, role/permission assignment, audit-log viewer (`PERMISSIONS.md §4.2`).

---

## 6. `lib/` — Framework-Agnostic Core

**Why it exists:** Pure, reusable building blocks with no React/route dependencies (except the supabase client wrappers). This is the foundation features build on.

```
lib/
├── db/
│   ├── index.ts              # Drizzle client (postgres-js), server-only
│   ├── schema/               # Drizzle tables — DATABASE_DESIGN.md §11
│   │   ├── index.ts
│   │   ├── enums.ts
│   │   ├── _shared.ts        # envelope, money(), qty(), pct() helpers
│   │   ├── identity.ts
│   │   ├── inventory.ts
│   │   ├── customers.ts
│   │   ├── quotes.ts
│   │   ├── sales.ts
│   │   ├── backoffice.ts
│   │   └── relations.ts
│   └── helpers.ts            # notDeleted(), paginate(), withAudit() mutation wrapper
├── supabase/
│   ├── server.ts             # createServerClient (RSC/actions, cookies)
│   ├── client.ts             # createBrowserClient
│   └── middleware.ts         # session refresh helper used by root middleware.ts
├── auth/
│   ├── permissions.ts        # Permission-key union + catalog (PERMISSIONS.md §2)
│   ├── rbac.ts               # hasPermission(), requirePermission() server guards
│   └── session.ts            # getSession(), getCurrentOrg(), getCurrentUser()
├── calc/                     # PURE business math — PROJECT_PLAN.md §7 (unit-tested)
│   ├── import-cost.ts        # currency × rate → disc → transport → duty → multiplier
│   ├── quote-totals.ts       # line/installation/GST/grand totals, per-area selection
│   └── running-bill.ts       # billed − discount − paid = outstanding
├── pdf/
│   └── templates/            # Data-driven PDF layouts (locked columns) — quote, boq, stock, invoice
├── constants/                # units, payment modes, statuses, app config
├── utils/                    # cx() (join CSS-Module class names), formatMoney(), formatDate(), generateRef(), etc.
└── env.ts                    # Zod-validated environment variables (fail fast at boot)
```

> **`lib/calc/` is the anti-bug investment:** preview UI and PDF both import the same functions, guaranteeing the numbers agree. Covered by unit tests in `tests/unit/calc`.

---

## 7. `services/` — Infrastructure Adapters

**Why it exists:** Boundaries to the outside world and stateful infrastructure. Features call services; services never call features. Swapping a provider (e.g. WhatsApp vendor) changes one folder.

```
services/
├── storage/
│   └── storage.service.ts    # Supabase Storage: upload/sign URLs for images & logos
├── pdf/
│   └── pdf.service.ts        # Render lib/pdf templates → buffer (server) / jsPDF (client)
├── email/
│   └── email.service.ts      # Transactional email w/ PDF attachment (Resend / Edge Function)
├── whatsapp/
│   └── whatsapp.service.ts   # WhatsApp Business API (Twilio/Wati/Interakt) — PROJECT_PLAN §9.1
├── notifications/
│   └── notification.service.ts
└── numbering/
    └── sequence.service.ts   # ref_no / so_no / challan_no / invoice_no generation (DB sequences)
```

> **services vs features/server:** `features/*/server` holds *domain* logic (build a quote, post a challan) using Drizzle. `services/` holds *infrastructure* (send the email, render the PDF, store the file). A feature action orchestrates both: `createInvoice` (feature) → `pdf.service` + `email.service` (services).

---

## 8. `hooks/` — Global React Hooks

**Why it exists:** Reusable client hooks that are **not** tied to a single feature. Feature-specific hooks stay inside the feature slice (§5.1).

```
hooks/
├── use-permissions.ts        # Reads current user's permission keys → gate UI
├── use-org.ts                # Active organization context (multi-tenant)
├── use-debounce.ts           # Search inputs (catalogue, customer list)
├── use-pagination.ts
├── use-media-query.ts        # Responsive (site/field use)
├── use-toast.ts              # toast/notification hook (drives the in-house Toast primitive)
└── use-confirm.ts            # Imperative confirm dialog
```

---

## 9. `types/` — Shared TypeScript Types

**Why it exists:** A single home for cross-feature types so they're discoverable and never redefined. Types are **derived**, not hand-maintained, wherever possible.

```
types/
├── db.ts                     # Drizzle-inferred row/insert types: InferSelectModel<typeof quotes>, …
├── supabase.ts               # `supabase gen types` output (auth, storage)
├── permissions.ts            # PermissionKey union (re-export from lib/auth for type use)
├── enums.ts                  # UI-facing enum unions mirroring pgEnums (QuoteStatus, GstMode, …)
├── api.ts                    # Server-action result shapes, paginated<T>, ActionResult<T>
└── common.ts                 # Money, ID, ISODate branded types; shared utility types
```

> **Why derived:** `db.ts` re-exports `InferSelectModel`/`InferInsertModel` from `lib/db/schema`, so a schema change propagates types automatically — no drift between the database and the app.

---

## 10. `validations/` — Shared Zod Schemas

**Why it exists:** Validation is needed in **two places** — client forms (React Hook Form resolver) and server actions (trust boundary). Centralising the Zod schemas guarantees both sides validate identically, and the inferred types (`z.infer`) feed form models.

```
validations/
├── common.ts                 # money, percentage, gstin, pan, phone, email, isoDate primitives
├── auth.ts                   # login, password schemas
├── item.ts                   # itemSchema, importPricingSchema, variationSchema, stockAdjustSchema
├── customer.ts               # customerSchema (billing/delivery split), paymentSchema
├── quote.ts                  # quoteSchema, locationSchema, lineItemSchema, optionSchema,
│                             #   installationSchema, termSchema (mirrors quotes data model)
├── sales.ts                  # salesOrderSchema, challanSchema
├── invoice.ts                # invoiceSchema (GST split, HSN)
├── hr.ts                     # employeeSchema, leaveSchema
└── index.ts                  # barrel
```

> **Flow:** `validations/quote.ts` → consumed by `features/quotes/hooks/use-quote-form.ts` (RHF resolver) **and** `features/quotes/server/actions.ts` (re-validate before DB write). One schema, two enforcement points.

---

## 11. Dependency Rules (Import Direction)

```
            app/  ─────────────┐
              │                │ composes
              ▼                ▼
          features/  ───────────────────────────┐
              │            │            │        │
              ▼            ▼            ▼         ▼
            lib/       services/   validations/ types/   components/(shared)
              │            │
              ▼            ▼
       (db, calc, auth)  (storage/email/whatsapp/pdf)
```

**Allowed:**
- `app/` imports from `features/`, `components/`, `lib/`, `hooks/`, `types/`.
- `features/` import from `lib/`, `services/`, `validations/`, `types/`, `components/`, `hooks/`.
- `lib/`, `services/` import from `validations/`, `types/`, and `lib/` (utils/db). 
- Everything may import `types/` and `validations/` (leaf, dependency-free).

**Forbidden:**
- `lib/` / `services/` importing from `features/` or `app/` (no upward deps).
- One `features/<a>` importing another `features/<b>`'s **internals** — cross-feature reuse goes through the feature's `index.ts` barrel or is promoted to `lib/`/`components/`.
- Client components importing anything in `features/*/server/` (those are `server-only`).

> Enforced with ESLint (`eslint-plugin-boundaries` / `import/no-restricted-paths`) and `tsconfig` path aliases (`@/lib`, `@/features`, `@/components`, `@/types`, `@/validations`, `@/services`, `@/hooks`).

---

## 12. Supporting Directories (root)

```
supabase/
├── config.toml
├── migrations/               # Hand-authored SQL: RLS helpers, policies, triggers, views, seed
│   │                         #   (DATABASE_DESIGN.md §12 steps 13–18)
└── seed.sql                  # Roles, permission catalog, default org, lookups

drizzle/
└── (generated migration SQL from drizzle-kit — DATABASE_DESIGN.md §12 steps 1–12)

tests/
├── unit/
│   └── calc/                 # import-cost, quote-totals, running-bill (the critical math)
├── integration/              # server actions against a test DB
├── e2e/                      # Playwright: login → build quote → export PDF
└── fixtures/

scripts/
├── seed.ts                   # Programmatic seed (dev)
├── gen-types.ts              # supabase gen types → types/supabase.ts
└── check-rls.ts              # Assert every table has RLS enabled + ≥1 policy (PERMISSIONS §6)
```

---

## 13. End-to-End Trace (how the layers cooperate)

**Scenario: a Sales user creates a quote and exports the BOQ PDF.**

1. **Route** — `app/(app)/quotes/new/page.tsx` (RSC) checks session/permission via `lib/auth`, renders `features/quotes/components/quote-builder`.
2. **Form** — `quote-builder` uses `features/quotes/hooks/use-quote-form` → React Hook Form with the `validations/quote.ts` Zod resolver. Live totals come from `use-quote-totals` → `lib/calc/quote-totals.ts`.
3. **Submit** — calls `features/quotes/api/use-quotes` (React Query mutation) → `features/quotes/server/actions.ts#createQuote`.
4. **Server action** — re-validates with `validations/quote.ts`, checks `quote.create` via `lib/auth/rbac`, writes through `lib/db` (Drizzle) inside a transaction; `services/numbering` assigns `ref_no`; `lib/db/helpers#withAudit` logs it. **RLS** independently confirms the org/permission.
5. **Export** — `components/shared/export-menu` → `api/pdf/[doc]/route.ts` → `services/pdf` renders `lib/pdf/templates/boq` **from data** (locked columns), optionally handed to `services/email` / `services/whatsapp`.
6. **Types** — every hop is typed: form model from `z.infer` (validations) ⇄ DB rows from `types/db.ts` (Drizzle-inferred), mapped by `features/quotes/lib/quote-mappers.ts`.

Each concern lives in exactly one place, and the dependency arrows only point downward.

---

## 14. Why This Structure (summary)

| Folder | Exists because… |
|--------|-----------------|
| **`app/`** | Next.js requires routing/layouts here; kept thin so business logic stays testable and reusable. |
| **`components/`** | Generic UI (tables, inputs, dialogs — hand-built primitives styled with CSS Modules + tokens) must be shared, not copied per feature. |
| **`features/`** | Business capabilities are the unit of change; vertical slices keep their UI + logic + data access together. |
| **`lib/`** | Pure core (DB schema, auth, calculations, PDF templates, utils) with no framework coupling — the stable foundation. |
| **`services/`** | External/infrastructure boundaries (email, WhatsApp, storage, PDF, numbering) isolated for swap-ability and testing. |
| **`hooks/`** | Cross-feature client behaviours (permissions, debounce, pagination) shared without circular feature deps. |
| **`types/`** | One discoverable home for derived, cross-cutting types — eliminates drift from the database. |
| **`validations/`** | Zod schemas shared by client forms and server actions guarantee identical client+server validation. |

---

*End of ARCHITECTURE.md — structural blueprint only. No application code or files have been scaffolded. Next step: scaffold the Next.js project against this layout (Phase 0 in `PROJECT_PLAN.md §11`), starting with `lib/db/schema`, `lib/auth`, and the `(app)` shell.*
