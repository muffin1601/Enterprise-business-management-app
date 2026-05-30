# Sprint 0 Foundation — Code Review

> **Reviewer:** Lead Architect / Senior Staff Engineer pass
> **Date:** 2026-05-29
> **Scope:** All non-doc source under the repo root (configs, `lib/`, `features/`, `app/`, `validations/`, `types/`, `supabase/migrations/`, `tests/`).
> **Method:** Full read of every `.ts`/`.tsx`/`.sql`/`.json` file + `tsc --noEmit` (exit 0, clean). **No code was modified.**
> **Verdict:** Identity/auth/RLS core is **solid and production-shaped**. The headline problems are (1) the **forbidden Tailwind/shadcn stack is still wired in** despite the locked CSS-Modules decision, and (2) **Sprint 0 §12–18 (styling system, app shell, error/loading states, Sentry, PostHog) are not implemented**. Plus a real **Drizzle↔SQL schema drift** and a **super-admin source-of-truth split** worth fixing before business modules land.

---

## Severity summary

| # | Finding | Category | Severity |
|---|---------|----------|----------|
| S-1 | Forbidden stack present: `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate`, `class-variance-authority`, `tailwind-merge` in `package.json`; `sass` missing | Dependency / Architecture | **High** |
| S-2 | `lib/utils/cn.ts` uses `tailwind-merge` (shadcn convention) — the entire styling system was supposed to be CSS Modules + tokens | Architecture | **High** |
| S-3 | Sprint 0 §12–18 not built: no global SCSS, no `:root` tokens, no app shell, no `error.tsx`/`loading.tsx`, no Sentry config, no PostHog provider, no React-Query provider | Architecture / Completeness | **High** |
| S-4 | Drizzle `role_permissions` has **no primary key** (modeled as `uniqueIndex`), and `roles` is **missing the partial unique index** `uq_roles_system_key` — `drizzle-kit generate/push` will diverge from the hand-written SQL | TypeScript / Schema | **Medium** |
| S-5 | Super-admin has **two sources of truth** with no sync: `users.is_super_admin` column vs. JWT `app_metadata.is_super_admin` (what both app- and DB-layer actually read) | Security | **Medium** |
| S-6 | Billing RLS gates (`has_active_subscription`, `within_plan_limit`) are **fail-open stubs** wired into live `INSERT` policies (`memberships`, `invitations`) | Security | **Medium** (known: G-19) |
| S-7 | `create_organization` has no per-user org cap / rate limit — any authenticated user can create unlimited billable orgs | Security / Scalability | **Medium** |
| S-8 | `styles/` directory does not exist on disk (Section 1's only new addition did not persist) | Folder structure | **Low** |
| S-9 | Stale/misleading comments reference Tailwind/shadcn as the forward plan across `layout.tsx`, `(app)/layout.tsx`, `globals.css`, `env.ts`, `next.config.ts` | Architecture (docs-in-code) | **Low** |
| S-10 | Per-request DB cost: `(app)/layout.tsx` → `getActiveOrgId()` → `getUserMemberships()` (join) on every protected navigation; `getActionContext()` does up to 3 sequential round-trips per action | Scalability | **Medium** |
| S-11 | `users_select` RLS uses a correlated `memberships` self-join (co-member visibility) — quadratic-ish without careful indexing at scale | Scalability | **Low/Medium** |
| S-12 | `audit_logs` insert policy lets any member forge arbitrary audit rows (`actor_id = auth.uid() or null`, free-form `entity_type`/`before`/`after`) | Security | **Low** |
| S-13 | Inconsistent auth-guard error contract: `session.ts` throws `Error('unauthenticated')`; `action-context.ts` throws `AuthError` | Architecture | **Low** |
| S-14 | No `.env.example` despite strict `lib/env.ts` validation; no `postgres()` `max` pool cap | DX / Scalability | **Low** |
| S-15 | All UI is inline-styled (`style={{…}}`) — acceptable as placeholder, but blocks the CSS-Modules architecture until migrated | Architecture | **Low** |

---

## 1. Security

### S-5 — Super-admin: two sources of truth, no sync **(Medium)**
- DB layer: [0002_…sql](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L19-L24) — `app.is_super_admin()` reads `request.jwt.claims -> 'app_metadata' ->> 'is_super_admin'`.
- App layer: [action-context.ts:37-38](lib/auth/action-context.ts#L37-L38) — reads `user.app_metadata.is_super_admin`.
- But the **column** `users.is_super_admin` ([identity.ts:65](lib/db/schema/identity.ts#L65)) is guarded by a dedicated trigger `block_super_admin_change` ([0002:210-219](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L210-L219)) as if it were authoritative.

**Problem:** Setting `users.is_super_admin = true` grants nothing — RLS only honors the JWT `app_metadata` claim, and **nothing in Sprint 0 copies the column into `app_metadata`** (that requires a `supabase.auth.admin.updateUserById(...)` call via the service-role client, which doesn't exist yet). Two admins could reasonably toggle the column and be surprised it has no effect. Decide on **one** source of truth (recommend: `app_metadata` is authoritative for RLS; the column is a read-model mirror updated by an admin action) and document it. Until then the `block_super_admin_change` trigger is guarding a field that does nothing.

### S-6 — Fail-open billing gates in live policies **(Medium, known G-19)**
`app.has_active_subscription()` and `app.within_plan_limit()` are `select true` stubs ([0002:53-61](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L53-L61)) but are **already referenced** in the `mem_insert` and `inv_insert` `WITH CHECK` clauses ([0002:120-123](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L120-L123), [0002:164-167](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L164-L167)). This is the intended MVP bootstrap (CRITICAL_GAPS G-19) and is **fail-open by design** — flagged here only so it stays on the radar: shipping to production with these stubs means **no seat/plan enforcement exists**. Track a hard gate ("replace before billing module GA").

### S-7 — Unbounded org creation **(Medium)**
[create_organization](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L243-L289) validates `auth.uid()` and name, but has **no cap on orgs-per-user and no rate limit**. Any authenticated user can loop-create unlimited organizations, each spawning an owner membership + settings + audit row. Combined with S-6 (no plan limits), this is an abuse/DoS-of-storage vector. Add a per-user org ceiling (or require an allow-list / payment) before public signup opens.

### S-12 — Forgeable audit rows **(Low)**
`audit_insert` ([0002:188-189](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L188-L189)) accepts any member insert where `actor_id = auth.uid() OR actor_id IS NULL`, with free-form `entity_type`/`entity_id`/`before`/`after`. A member can pollute the immutable audit trail with fabricated entries. Mitigation: write audit rows only from `SECURITY DEFINER` functions/triggers (as `create_organization` already does) and **remove the broad member-insert policy**, or constrain it.

### Positives (verified)
- `getUser()` (re-validates JWT) is used everywhere a session is trusted — middleware, session util, action-context, reset flow — **never** `getSession()`. ✅
- `setActiveOrgId` cookie is `httpOnly` + `sameSite:'lax'` + `secure` in prod. ✅
- Active org is **server-resolved against memberships**, never trusted from the request body ([action-context.ts:34](lib/auth/action-context.ts#L34), [company/actions.ts:58-65](features/company/server/actions.ts#L58-L65)). ✅
- Account-enumeration avoided on magic-link / password-reset (always returns success) ([auth/actions.ts:47-48](features/auth/server/actions.ts#L47-L48)). ✅
- Service-role client is `'server-only'` and documented bypass-RLS ([admin.ts:1](lib/supabase/admin.ts#L1)). ✅
- All helper functions are `security definer set search_path = app, public` (search-path injection closed). ✅
- `FORCE ROW LEVEL SECURITY` on every identity table (table owner can't bypass). ✅
- `create_organization` is `revoke all from public; grant execute to authenticated`. ✅

---

## 2. TypeScript / Type-safety

- **`tsc --noEmit` is clean (exit 0).** Strict mode + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` all on — good rigor. The one indexed access (`memberships[0]!`) is correctly non-null-asserted after a length guard ([session.ts:59](lib/auth/session.ts#L59)). ✅
- **S-4 (Medium) — Drizzle model drifts from the SQL it's supposed to mirror:**
  - `role_permissions` is declared with `uniqueIndex('pk_role_permissions')` ([identity.ts:128-130](lib/db/schema/identity.ts#L128-L130)) → the Drizzle table has **no primary key**, while the SQL has `primary key (role_id, permission_key)` ([0001:85](supabase/migrations/0001_identity_tables.sql#L85)). `drizzle-kit generate/push` would emit a plain unique index, not a PK.
  - `roles` only declares `uq_roles_org_key` ([identity.ts:106](lib/db/schema/identity.ts#L106)); the SQL **also** has `uq_roles_system_key … where org_id is null` ([0001:72](supabase/migrations/0001_identity_tables.sql#L72)). Because Postgres treats NULLs as distinct, the Drizzle-generated schema would **fail to enforce system-role key uniqueness** — exactly the constraint `create_organization` relies on when it does `select id … where key='company_owner' and org_id is null` ([0002:274](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L274)).
  - **Why it matters:** `drizzle.config.ts` points `generate` at the Drizzle schema, but migrations are hand-authored. The two are not reconciled, so anyone running `db:push` will silently desync the DB from the audited SQL. Either (a) make the Drizzle schema a faithful mirror (add the partial index + a real composite PK), or (b) document that Drizzle is **types-only** and `db:push`/`generate` are forbidden for identity tables.
- `getUserMemberships` leans on `as unknown as {…}` coercion for the embedded relation ([session.ts:42](lib/auth/session.ts#L42)) — pragmatic given Supabase's loose embed typing, but a generated `Database` type (from `supabase gen types`) would remove the cast and is worth adding to Sprint 0.
- `enums.ts` value order is asserted to match SQL by comment only ([enums.ts:9-20](lib/db/schema/enums.ts#L9-L20)) — fine, but it's an invariant a test should pin.

---

## 3. Architecture violations

### S-1 / S-2 / S-3 — The locked "no Tailwind / CSS Modules only" decision is not yet reflected in code **(High)**
The user's standing constraint is *"Do NOT use: Tailwind, shadcn/ui, Material UI, Bootstrap"* and the styling system is CSS Modules + SCSS + CSS-variable tokens (`DESIGN_TOKENS.md`, `FRONTEND_DESIGN_SYSTEM.md`). Current state contradicts this:
- `package.json` still ships the **entire Tailwind/shadcn toolchain** (S-1, see §4).
- [cn.ts](lib/utils/cn.ts) is the shadcn `cn()` helper built on `tailwind-merge` (S-2). Per `DESIGN_TOKENS.md §12` ("No Tailwind / no `cva` / no `tailwind-merge`") this should be a `cx()` wrapping `clsx` only.
- [globals.css](app/globals.css) is an empty CSS file whose comment says *"Step 3 (Tailwind) replaces this with `@tailwind base/components/utilities`"* — should be `globals.scss` holding the `:root` token blocks from `DESIGN_TOKENS.md`.
- **Sprint 0 §12–18 deliverables are absent:**
  - §12 Global SCSS architecture — **missing** (`styles/` dir doesn't exist).
  - §13 CSS-variable design system — **missing** (tokens live only in `DESIGN_TOKENS.md`, never pasted into a stylesheet).
  - §14 App shell layout — **placeholder only** ([(app)/layout.tsx:19](app/(app)/layout.tsx#L19) is a bare `<div style>`); no sidebar/topbar, no `components/layout/*`.
  - §15 Error boundaries — **missing** (no `error.tsx` / `global-error.tsx` / `not-found.tsx` anywhere).
  - §16 Loading states — **missing** (no `loading.tsx`).
  - §17 Sentry — **missing** (dep present, but no `sentry.*.config.ts` / `instrumentation.ts`, and `next.config.ts` is not wrapped in `withSentryConfig`).
  - §18 PostHog — **missing** (deps present, no provider/pageview wiring).
  - Also absent: the **React Query provider** (`@tanstack/react-query` is a dependency but `components/providers/` is an empty `.gitkeep`) — required before any data module.
- `next.config.ts` has no `sassOptions.includePaths` ([next.config.ts:12-21](next.config.ts#L12-L21)) — needed for `@use` of the token/mixins partials.

> **Note on §1–§11:** these are genuinely **already done** from the Auth module build (path aliases, env validation, Supabase clients, Drizzle, DB layer, auth/permission utils, shared types/validation) and are in good shape — so the *remaining* real Sprint 0 work is precisely §12–18 + the Tailwind→CSS-Modules migration. The review's "incomplete" findings are all on that styling/observability half.

### S-9 — Forward-looking comments still cite forbidden tech **(Low)**
`layout.tsx`, `(app)/layout.tsx`, `globals.css`, `env.ts`, and `next.config.ts` all describe future steps in terms of "Tailwind", "shadcn/ui". These are now wrong and will mislead a junior dev (whom `BUILD_SEQUENCE.md` explicitly targets). Rewrite to reference the CSS-Modules/SCSS plan.

### S-13 — Two different auth-failure contracts **(Low)**
[session.ts:26](lib/auth/session.ts#L26) `requireUser()` throws `new Error('unauthenticated')`; [action-context.ts:21-25](lib/auth/action-context.ts#L21-L25) throws a typed `AuthError`. Server actions catch neither uniformly today. Standardize on `AuthError` (or a shared guard) so the `ActionResult` mapping is consistent.

### Positives
- Feature-sliced layout is clean and matches `ARCHITECTURE.md`; server/client boundaries are correct (`'use server'`, `'use client'`, `'server-only'` all placed properly). ✅
- `ActionResult<T>` discriminated union + `ok`/`err` helpers are a clean, enforced contract ([types/action.ts](types/action.ts)). ✅
- Org provisioning via a single `SECURITY DEFINER` RPC is the right call — atomic, no service-role key in the action, sidesteps the RLS bootstrap problem. ✅
- Onboarding deliberately placed **outside** the `(app)` group to avoid the redirect loop ([(app)/layout.tsx:9-10](app/(app)/layout.tsx#L9-L10)). ✅

---

## 4. Dependency issues

### S-1 — Forbidden + missing packages **(High)**
From [package.json:35-50](package.json#L35-L50):

| Package | Status | Action |
|---------|--------|--------|
| `tailwindcss`, `postcss`, `autoprefixer` | **forbidden** (devDeps) | remove |
| `tailwindcss-animate`, `class-variance-authority`, `tailwind-merge` | **forbidden** (deps) | remove |
| `sass` | **missing** | add (required for `.module.scss` + `@use`) |
| `@sentry/nextjs` | present but **unused** | keep, but wire in §17 (currently dead weight) |
| `posthog-js`, `posthog-node` | present but **unused** | keep, but wire in §18 |
| `lucide-react` | present, allowed | OK |

Until `sass` is installed, the entire CSS-Modules strategy is unbuildable; until the Tailwind packages are removed, the build still resolves a forbidden toolchain (and `cn.ts` actively imports `tailwind-merge`). Versions are otherwise current and coherent (Next 15.1, React 19, Drizzle 0.38, Zod 3.24). `engines.node >=20.11` is set. ✅

---

## 5. Folder structure

- **S-8 (Low):** `styles/` does **not exist** on disk. Section 1 reported adding it, but it isn't present (the `mkdir` did not persist / was untracked-and-empty). It must exist to host `_tokens.scss`, `_mixins.scss`, `globals.scss` for §12–13.
- `components/{ui,layout,shared,providers}`, `hooks/`, `services/` exist but are **empty `.gitkeep` stubs** — expected at this stage; just confirming they're scaffolded, not populated.
- Otherwise the no-`src/` feature-sliced tree matches `ARCHITECTURE.md` exactly. `app/` route groups `(auth)`/`(app)` + out-of-group `onboarding` + `auth/callback` route handler are all correctly placed. ✅
- `drizzle/` (generated) is correctly `exclude`d in `tsconfig.json`. ✅

---

## 6. Scalability

### S-10 — Per-request DB amplification **(Medium)**
- Every protected navigation hits `(app)/layout.tsx` → `getActiveOrgId()` → `getUserMemberships()`, which runs a `memberships ⋈ organizations` query **in addition to** the middleware's `getUser()` round-trip ([session.ts:31-44](lib/auth/session.ts#L31-L44), [(app)/layout.tsx:15-17](app/(app)/layout.tsx#L15-L17)).
- Every server action calls `getActionContext()`, which issues **up to three sequential** Supabase queries (owner check → `user_roles` → `role_permissions`) ([action-context.ts:41-65](lib/auth/action-context.ts#L41-L65)).
- At low volume this is fine. Before business modules multiply action calls, add a **request-scoped cache** (e.g. React `cache()` for memberships/permissions within a render) and/or fold the owner+roles+permissions lookup into a single query or a `SECURITY DEFINER` function returning the permission set in one round-trip.

### S-11 — `users_select` correlated self-join **(Low/Medium)**
The co-member visibility clause ([0002:104-110](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L104-L110)) joins `memberships` to itself per row evaluated. With large orgs / many shared members this degrades. Ensure `idx_memberships_user` (present ✅) plus an `(org_id)` index support it, and consider a `SECURITY DEFINER` "are we co-members" helper to keep the planner happy.

### S-14 — Connection pool cap unset **(Low)**
`postgres(getServerEnv().DATABASE_URL, { prepare: false })` ([db/index.ts:22](lib/db/index.ts#L22)) sets `prepare:false` for the Supavisor/pgBouncer transaction pooler (correct) but no `max`. In a serverless fan-out, defaulting `max:10` per instance can exhaust the pooler. Set an explicit small `max` (e.g. 1–3) for serverless.

### Positives
- `prepare:false` + `globalThis` client reuse is the correct postgres-js-on-pooler pattern. ✅
- Indexes on `memberships(user_id)`, `audit_logs(org_id,entity_type,entity_id,at)` and `(actor_id,at)`, and all the right unique constraints are present in SQL. ✅
- `pg_trgm` extension pre-created for later search modules. ✅

---

## 7. Minor / nits
- No `.env.example` despite strict env validation (S-14) — add one so a fresh clone fails *with guidance*, not a raw Zod stack trace.
- `last_login_at` column exists but is never written (no login hook) — fine, just unused for now.
- `app.current_orgs()` helper is defined but unused by any policy (policies use `is_member`) — dead code or future use; confirm intent.
- `handle_new_user` uses `on conflict (id) do nothing`, but `users.email` is also `UNIQUE`; an email collision would raise `unique_violation` rather than being swallowed. Auth enforces unique email upstream, so low risk — note for completeness ([0002:223-234](supabase/migrations/0002_rls_helpers_policies_triggers.sql#L223-L234)).
- `organizations.pan` column exists but `create_organization` doesn't accept it ([identity.ts:33](lib/db/schema/identity.ts#L33) vs RPC signature) — intentional (collected later), just noting the gap.
- `login-form.tsx` casts `redirectTo` to `Route` from a raw query param ([login-form.tsx:36](features/auth/components/login-form.tsx#L36)) — open-redirect-adjacent. Today it's same-origin via `router.push` (relative), so low risk, but validate it starts with `/` and isn't `//host` before trusting it.

---

## Recommended order to clear this before business modules
1. **Unblock styling (S-1/S-2/S-3 §12–14):** remove Tailwind packages, add `sass`, rename `globals.css`→`.scss` with the `DESIGN_TOKENS` `:root` blocks, add `styles/_tokens.scss`/`_mixins.scss`, set `sassOptions.includePaths`, convert `cn.ts`→`cx.ts`, build the providers (React Query) + real app shell.
2. **Observability (S-3 §17–18):** wire Sentry (`instrumentation.ts` + `withSentryConfig`) and PostHog provider — deps are already installed.
3. **Error/loading UX (S-3 §15–16):** add `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`.
4. **Reconcile schema (S-4):** make the Drizzle schema mirror the SQL (composite PK on `role_permissions`, partial unique index on `roles`) **or** mark Drizzle types-only and forbid `db:push` for identity.
5. **Resolve super-admin source of truth (S-5)** and add the per-render permission cache (S-10).
6. **Before public signup:** org-creation cap (S-7) and the real billing helpers (S-6).

*No code was modified during this review.*
