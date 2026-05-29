import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Root middleware: refreshes the Supabase session on every request and gates
 * protected routes (lib/supabase/middleware.ts). Membership/onboarding gating
 * lives in the (app) layout to avoid DB round-trips here.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
