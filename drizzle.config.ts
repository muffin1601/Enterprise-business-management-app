import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit config (Module 0, Step 5).
 *
 * - `schema`: Drizzle table definitions in lib/db/schema (source of generated SQL).
 * - `out`: generated migration SQL committed to /drizzle.
 * - Uses DIRECT_URL (non-pooled) for migrate/push so DDL runs on a direct
 *   connection, falling back to DATABASE_URL.
 *
 * NOTE: drizzle-kit generates the *table* DDL. RLS policies, helper functions,
 * triggers, and seed live as hand-authored SQL in /supabase/migrations
 * (DATABASE_DESIGN.md §12 steps 13–18) and are applied alongside.
 */
export default defineConfig({
  schema: './lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
