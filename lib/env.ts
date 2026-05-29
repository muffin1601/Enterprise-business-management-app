import { z } from 'zod'

/**
 * Environment validation (Module 0, Step 7).
 *
 * Why: a missing/blank env var should fail loudly at boot, not surface as a
 * cryptic `undefined` deep inside a request. Server vars and client vars are
 * separated so we never accidentally read a server secret in the browser.
 *
 * Usage: import `serverEnv` in server-only code (actions, route handlers, db,
 * service clients) and `clientEnv` anywhere. `NEXT_PUBLIC_*` are inlined by
 * Next at build time, so the client schema only references those.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Supabase (Step 6)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Database (Step 5) — pooled for runtime, direct for drizzle-kit
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  // Sentry (Step 8) — auth token only needed at build for source maps
  SENTRY_AUTH_TOKEN: z.string().optional(),
})

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
})

/** Client-safe env — references only NEXT_PUBLIC_* (inlined by Next). */
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
})

/**
 * Server-only env. Lazily validated so importing this module in a client
 * bundle (transitively) never throws on missing server secrets — only the
 * first server-side access validates.
 */
let _serverEnv: z.infer<typeof serverSchema> | null = null
export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv must not be accessed in the browser')
  }
  if (!_serverEnv) {
    _serverEnv = serverSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    })
  }
  return _serverEnv
}
