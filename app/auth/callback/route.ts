import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * OAuth / magic-link / email-confirm / password-recovery callback.
 *
 * Supabase redirects here with a `code`; we exchange it for a session (which
 * sets the auth cookies) and forward to `next` (default /dashboard; the
 * recovery flow passes ?next=/reset-password).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
