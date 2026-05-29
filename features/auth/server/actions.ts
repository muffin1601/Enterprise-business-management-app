'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { clientEnv } from '@/lib/env'
import { getActiveOrgId } from '@/lib/auth/session'
import { recordLogin } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  loginSchema,
  magicLinkSchema,
  registerSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from '@/validations/auth'

/**
 * Authentication Server Actions (IMPLEMENTATION_PLAN.md Module 1).
 * All return ActionResult<T> (API_DESIGN.md §2.1) — the client navigates on ok.
 * Supabase Auth owns credentials/sessions; these wrap it with Zod validation
 * and a uniform error contract. fieldErrors map straight onto RHF setError.
 */

const fieldErrors = (e: import('zod').ZodError) => e.flatten().fieldErrors as Record<string, string[]>

/**
 * New-account registration. Supabase Auth sends a verification email; the
 * `handle_new_user` trigger mirrors the profile (with full_name from metadata)
 * into public.users on confirm. To avoid account enumeration we always report
 * success — Supabase obfuscates the "already registered" case itself.
 */
export async function signUp(
  input: unknown,
): Promise<ActionResult<{ needsVerification: boolean; email: string }>> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check your details.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })
  if (error) {
    if (error.status === 429) return err('rate_limited', 'Too many attempts. Try again shortly.')
    return err('internal', 'Could not create your account. Try again.')
  }

  // session present → email confirmation is disabled in Supabase, user is in.
  const needsVerification = !data.session
  return ok({ needsVerification, email: parsed.data.email })
}

/** Resend the signup verification email (no enumeration: always reports sent). */
export async function resendVerification(
  input: unknown,
): Promise<ActionResult<{ sent: true }>> {
  const parsed = resendVerificationSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Enter a valid email.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback` },
  })
  if (error && error.status === 429)
    return err('rate_limited', 'Please wait before requesting another email.')

  return ok({ sent: true })
}

/** Email + password login. */
export async function signIn(input: unknown): Promise<ActionResult<{ userId: string }>> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check your details.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return err('unauthenticated', 'Invalid email or password.')

  // Audit the login against the user's active org (best-effort; see lib/audit).
  const orgId = await getActiveOrgId()
  if (orgId) await recordLogin({ orgId, userId: data.user.id, method: 'password' })

  return ok({ userId: data.user.id })
}

/** Passwordless magic-link: emails a one-time sign-in link. */
export async function signInWithMagicLink(input: unknown): Promise<ActionResult<{ sent: true }>> {
  const parsed = magicLinkSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Enter a valid email.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback` },
  })
  if (error) return err('internal', 'Could not send the magic link. Try again.')

  // Always report success regardless of whether the email exists (no account enumeration).
  return ok({ sent: true })
}

/** "Forgot password": sends a recovery email that lands on /reset-password. */
export async function requestPasswordReset(input: unknown): Promise<ActionResult<{ sent: true }>> {
  const parsed = requestPasswordResetSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Enter a valid email.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  })
  if (error) return err('internal', 'Could not send the reset email. Try again.')

  return ok({ sent: true })
}

/** Set a new password — requires the recovery session established by the callback. */
export async function resetPassword(input: unknown): Promise<ActionResult<{ updated: true }>> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check your password.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('unauthenticated', 'Reset link expired. Request a new one.')

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return err('internal', error.message)

  return ok({ updated: true })
}

/** Sign out and return to login (server-side redirect). */
export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
