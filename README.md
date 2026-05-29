# Watcon Business Management System

Production multi-tenant B2B SaaS for a construction-materials trading business.

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase/Postgres · Drizzle ORM · TanStack Query · React Hook Form · Zod · Tailwind · shadcn/ui · Stripe · Resend · Sentry · PostHog.

## Documentation

Planning & architecture live at the repo root: `PROJECT_PLAN.md`, `SYSTEM_ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `PERMISSIONS.md`, `RLS_POLICIES.md`, `AUDIT_LOGS.md`, `API_DESIGN.md`, `ARCHITECTURE.md` (folder structure), `IMPLEMENTATION_PLAN.md` (build order), `ROADMAP.md`, `CRITICAL_GAPS.md` (pre-dev review).

## Status

**Module 0 — Foundation** (in progress). See `IMPLEMENTATION_PLAN.md §Module 0`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

> The project becomes type-checkable/runnable once Step 2 (TypeScript config) is in place.

## Folder layout

Feature-sliced — see `ARCHITECTURE.md`. Top level: `app/` (routing), `components/` (shared UI),
`features/` (vertical slices), `lib/` (db, supabase, auth, calc, pdf, utils), `services/`
(email/whatsapp/storage/pdf adapters), `hooks/`, `types/`, `validations/`.
