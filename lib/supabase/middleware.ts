import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { clientEnv } from '@/lib/env'

/**
 * Session refresh + route protection, run from the root `middleware.ts`.
 *
 * Why: Supabase access tokens are short-lived; this refreshes them on every
 * request and writes the rotated cookies onto the response, so RSC/Actions
 * always see a valid session. It also gates the protected route groups:
 *  - unauthenticated user hitting an app route  → /login
 *  - authenticated user hitting an auth route     → /dashboard
 *
 * NOTE: membership/onboarding gating ("logged in but no company yet") is done
 * in the (app) layout, not here — middleware avoids DB round-trips per request.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth',
  // The invite-accept page is reachable pre-membership; it self-guards auth and
  // preserves its ?token= through login, so middleware must not strip the query.
  '/invite',
  '/api/webhooks',
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: getUser() (not getSession()) re-validates the JWT with the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  if (user && (path === '/login' || path === '/register' || path === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
