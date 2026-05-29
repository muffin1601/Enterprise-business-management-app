import { z } from 'zod'
import { email, nonEmpty, password } from './common'

/** Email + password login. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

/**
 * New-account registration. `fullName` is carried into Supabase user metadata
 * so the `handle_new_user` trigger mirrors it onto public.users.full_name.
 */
export const registerSchema = z
  .object({
    fullName: nonEmpty('Full name').max(120),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterInput = z.infer<typeof registerSchema>

/** Resend the email-verification link to an unconfirmed account. */
export const resendVerificationSchema = z.object({ email })
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>

/** Passwordless magic-link request. */
export const magicLinkSchema = z.object({ email })
export type MagicLinkInput = z.infer<typeof magicLinkSchema>

/** "Forgot password" — sends a recovery email. */
export const requestPasswordResetSchema = z.object({ email })
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>

/** Set a new password (on the reset page, after the recovery link establishes a session). */
export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
