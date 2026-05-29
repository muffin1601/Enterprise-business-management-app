import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { clientEnv, getServerEnv } from '@/lib/env'

/**
 * Service-role Supabase client — BYPASSES RLS (RLS_POLICIES.md §1.4).
 *
 * Allowed ONLY in trusted server contexts that no end-user can invoke directly
 * (webhooks, cron, org provisioning). Every statement must scope by org_id
 * explicitly. NEVER import this into a client component — the service-role key
 * must never reach the browser bundle (`server-only` enforces this at build).
 */
export function createSupabaseAdminClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
