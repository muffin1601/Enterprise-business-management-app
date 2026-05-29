'use client'
import { createBrowserClient } from '@supabase/ssr'
import { clientEnv } from '@/lib/env'

/**
 * Browser Supabase client (carries the user session from cookies).
 * Used by client components for auth UI flows (e.g. magic-link request,
 * password update on the reset page) and Realtime subscriptions.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
