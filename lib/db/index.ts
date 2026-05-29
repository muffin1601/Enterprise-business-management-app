import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getServerEnv } from '@/lib/env'
import * as schema from './schema'

/**
 * Drizzle client over postgres-js.
 *
 * Scope (per RLS_POLICIES.md §1.2 and CRITICAL_GAPS.md G-31): user-facing CRUD
 * goes through the JWT-carrying Supabase client (RLS-enforced). This Drizzle
 * connection is reserved for system/service paths and typed reads where the
 * RLS context is explicitly established. Treat it as a privileged connection.
 *
 * A single pooled client is reused across the serverless lambda (cached on
 * globalThis to survive HMR in dev).
 */
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> }

const client =
  globalForDb._pg ??
  postgres(getServerEnv().DATABASE_URL, { prepare: false }) // prepare:false for pgBouncer/Supavisor transaction pooling

if (process.env.NODE_ENV !== 'production') globalForDb._pg = client

export const db = drizzle(client, { schema })
export type Database = typeof db
