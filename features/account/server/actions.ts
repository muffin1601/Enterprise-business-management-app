'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ok, err, type ActionResult } from '@/types/action'
import { changePasswordSchema, updateProfileSchema } from '@/validations/user'

/**
 * User Profile actions (Authentication module). The user edits their own
 * public.users row — RLS `users_update_self` (id = auth.uid()) is the backstop,
 * and the `is_super_admin` column trigger blocks privilege escalation. All
 * return ActionResult<T> (API_DESIGN.md §2.1).
 */

const fieldErrors = (e: import('zod').ZodError) =>
  e.flatten().fieldErrors as Record<string, string[]>

/** Update display profile fields (name, phone, avatar URL). Email is not editable here. */
export async function updateProfile(input: unknown): Promise<ActionResult<{ updated: true }>> {
  const parsed = updateProfileSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check your details.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('unauthenticated', 'You must be signed in.')

  const { error } = await supabase
    .from('users')
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq('id', user.id)

  if (error) return err('internal', 'Could not save your profile. Try again.')

  revalidatePath('/account')
  return ok({ updated: true })
}

/** Change the signed-in user's password (session-authenticated; no current pw needed). */
export async function changePassword(input: unknown): Promise<ActionResult<{ updated: true }>> {
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check your password.', { fieldErrors: fieldErrors(parsed.error) })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('unauthenticated', 'You must be signed in.')

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return err('internal', error.message)

  return ok({ updated: true })
}
