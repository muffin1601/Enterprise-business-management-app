import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { clientEnv } from '@/lib/env'

/**
 * Authenticated, RLS-respecting Supabase client for Server Components,
 * Server Actions, and Route Handlers. It carries the user's JWT (from cookies),
 * so every query runs as the logged-in user and is filtered by RLS
 * (RLS_POLICIES.md §1.2 — "server code uses the authenticated client for CRUD").
 *
 * Next 15: `cookies()` is async, hence this factory is async.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // In RSC render, cookie writes throw — safe to ignore because the
          // middleware (lib/supabase/middleware.ts) already refreshes the session.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    },
  )
}
