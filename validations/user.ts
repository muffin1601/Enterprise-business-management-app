import { z } from 'zod'
import { nonEmpty, password, phone, uuid } from './common'

/**
 * Self-service account/profile schemas (Authentication module — User Profile).
 * The authenticated user edits their own public.users row (RLS users_update_self:
 * id = auth.uid()). `email` is intentionally NOT editable here — changing it goes
 * through Supabase Auth's confirm-email flow, a separate concern.
 */
export const updateProfileSchema = z.object({
  fullName: nonEmpty('Full name').max(120),
  // Optional fields accept an empty string from the form (normalized to null server-side).
  phone: phone.optional().or(z.literal('')),
  avatarUrl: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

/** Assign / revoke an org role for a member (User Management; `admin.users`). */
export const userRoleSchema = z.object({
  userId: uuid,
  roleId: uuid,
})
export type UserRoleInput = z.infer<typeof userRoleSchema>

/** Activate / deactivate a member's account (User Management; `admin.users`). */
export const setUserStatusSchema = z.object({
  userId: uuid,
  active: z.boolean(),
})
export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>

/** Change password for the signed-in session (Supabase auth.updateUser). */
export const changePasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
