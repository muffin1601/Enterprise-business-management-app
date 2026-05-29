# Integration tests (DB-backed)

The unit tests under `tests/unit/**` are pure (Zod schemas, calc functions) and run with `npm test` — no database.

**Integration tests for the Authentication module** must run against a real Postgres with the migrations + RLS applied, because their whole point is to verify policy behaviour. Recommended setup (CI + local):

1. `supabase start` (local stack) or a disposable Postgres service container.
2. Apply migrations in order: `supabase/migrations/0000 → 0003`.
3. Run scenarios as different JWT identities (set `request.jwt.claims` via `set_config`) and assert:

| Scenario | Expectation |
|----------|-------------|
| `create_organization('Acme')` as a fresh user | org + settings + owner membership + `company_owner` user_role + audit row created atomically |
| New auth user signs up | `app.handle_new_user` mirrors a `public.users` row |
| Member of org A reads org B's `organizations` | zero rows (RLS `org_select`) |
| Non-owner without `admin.users` inserts a `memberships` row | denied (`mem_insert`) |
| `is_super_admin` self-set by a normal user | rejected (trigger `block_super_admin_change`) |
| `switchOrganization` to a non-member org | `forbidden` |
| Insert into `audit_logs` then UPDATE/DELETE it | UPDATE/DELETE denied (append-only) |

These belong in a separate Vitest project (`environment: node`, real `DATABASE_URL`) or pgTAP, gated in CI — kept out of the default `npm test` so the fast unit suite stays DB-free (see `RLS_POLICIES.md §8`).
