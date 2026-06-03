# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run lint         # ESLint via next lint
npm test             # Run unit tests (Vitest, no DB)
npm run test:watch   # Vitest in watch mode

# Run a single test file
npx vitest run tests/unit/calc/costing.test.ts

# Database (Drizzle + Supabase)
npm run db:generate  # Generate Drizzle migration from schema
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema to DB directly (dev only)
npm run db:studio    # Drizzle Studio browser UI
npm run db:seed      # Seed with sample data (scripts/seed.ts)
```

Integration tests (DB-backed, not in `npm test`) require a running Supabase local stack:
```bash
supabase start       # local Postgres + auth
# then run the integration suite separately (see tests/integration/README.md)
```

---

## Architecture

### Stack
Next.js 15 App Router · TypeScript · Supabase/Postgres (RLS) · Drizzle ORM · Zod · React Hook Form · TanStack Query · Sass (CSS Modules) · Vitest · Sentry · PostHog.

### Folder layout
```
app/                  Next.js routes
  (auth)/             Public login/signup pages
  (app)/              All authenticated app routes (shell layout)
    quotes/[id]/edit  Typical feature route: page → editor component
components/
  app-shell/          Sidebar, topbar, layout wrappers
  shared/             Cross-feature components (permission gate, etc.)
  ui/                 Primitive UI components
features/
  <module>/
    components/       React components for that feature
    server/
      actions.ts      Next.js Server Actions (mutations)
      queries.ts      Server-side data fetching functions
lib/
  auth/
    action-context.ts  Permission resolution (cached per request)
    session.ts         Active org resolution, user helpers
  supabase/
    server.ts          Authenticated Supabase client (carries user JWT, respects RLS)
    client.ts          Browser Supabase client
    admin.ts           Service-role client — BYPASSES RLS, server-only
  calc/
    costing.ts         Import landed-cost calculator (pure, unit-tested)
  db/                  Drizzle schema + query helpers
services/             External adapters (email/Resend, storage, PDF, WhatsApp)
validations/          Zod schemas — shared between client and server
supabase/migrations/  SQL migration files (numbered 0000–)
tests/
  unit/               Pure tests (no DB) — run with `npm test`
  integration/        DB-backed tests — run separately against local Supabase
```

### Feature slice pattern
Every module follows the same shape: `features/<module>/components/` for UI and `features/<module>/server/actions.ts` + `queries.ts` for data. Pages in `app/(app)/<module>/` are thin — they fetch via `queries.ts`, gate with `getActionContext().has(...)`, and delegate rendering to the feature component.

### Authorization
All permission checks flow through `lib/auth/action-context.ts`. Call `getActionContext()` at the top of any Server Action or route page — it's React `cache()`-deduplicated so only one DB round-trip fires per render tree.

```ts
const ctx = await getActionContext()
if (!ctx.has('quotes.edit')) return err('forbidden', ...)
```

Permission keys follow `<module>.<action>` grammar (e.g. `quotes.edit`, `stock.adjust`). Two roles bypass key checks: **Super Admin** (`ctx.isSuperAdmin`) and **Company Owner** (`ctx.isOwner`).

The Supabase RLS policies enforce the same permissions at the database layer — the `createSupabaseServerClient()` carries the user's JWT so every query is automatically row-filtered. Use `createSupabaseAdminClient()` only in trusted server-side contexts (webhooks, org provisioning) — it bypasses RLS entirely and must never reach a client bundle (`server-only` import enforces this).

### Multi-tenancy
Every business table has `org_id NOT NULL`. The active org is resolved from a `watcon-active-org` cookie in `lib/auth/session.ts → getActiveOrgId()`, then validated against `memberships`. All queries must scope to `orgId`. RLS provides the DB-level enforcement.

### Database conventions
- All business tables: `id uuid PK`, `org_id uuid NOT NULL`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` (soft delete).
- Never hard-delete business rows — set `deleted_at = now()`. All reads filter `.is('deleted_at', null)`.
- Money columns: `numeric(14,2)`, quantities: `numeric(14,3)`, percentages: `numeric(6,3)`. Never `float`.
- Migrations live in `supabase/migrations/` numbered sequentially. Drizzle schema in `lib/db/schema/`.

### Validation
Zod schemas in `validations/` are the single source of truth shared between client forms and server actions. Server actions call `schema.safeParse(input)` before any DB write.

### Calculations
Pure calculation logic lives in `lib/calc/` — especially `costing.ts` (import landed-cost: exchange rate → discount → transport → customs duty → profit multiplier → selling price). These are unit-tested in `tests/unit/`. Do not inline pricing math elsewhere.

### Design language
Japanese wabi-sabi minimalism — monochrome (black/white/greys), hairline borders, generous whitespace. Noto Serif JP for display headings, clean sans for body. Sass CSS Modules for component styles. No Tailwind utility-class sprawl.

---

## Key implementation notes

- `getActionContext()` is cached per render via React `cache()` — call it freely in server components and actions on the same request without extra DB hits.
- The `LogoUpload` component in `quote-editor.tsx` uploads directly to Supabase storage (bucket `item-images`, path `quotes/{quoteId}/logo.*`) from the browser, then calls `onUploaded(url)` to update parent state; the URL is persisted via the debounced `saveAll`. Keep `logoUrl` in both the `saveAll` useCallback deps and the debounce `useEffect` deps or the save won't fire.
- Quote auto-save: 1500 ms debounce on all meta/location/item state changes. The `saveAll` useCallback must list every piece of state it reads in its dependency array.
- Server Actions return `{ ok: true, data }` or `{ ok: false, error: { code, message } }` — use the `ok`/`err` helpers from `lib/utils` consistently.
- `supabase/migrations/` are append-only — never edit an applied migration; add a new one.
