import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'

export type MyProfile = {
  id: string
  email: string
  fullName: string
  phone: string
  avatarUrl: string
}

/**
 * The signed-in user's own profile row (public.users). RLS users_select returns
 * the self row. Falls back to the auth email if the mirror row hasn't been
 * created yet (e.g. trigger lag right after signup).
 */
export async function getMyProfile(): Promise<MyProfile> {
  const user = await requireUser()
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, phone, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: (data?.email as string) ?? user.email ?? '',
    fullName: (data?.full_name as string | null) ?? '',
    phone: (data?.phone as string | null) ?? '',
    avatarUrl: (data?.avatar_url as string | null) ?? '',
  }
}
