import { redirect } from 'next/navigation'
import { getOptionalUser, getActiveOrgId } from '@/lib/auth/session'
import { QueryProvider } from '@/components/providers/query-provider'
import styles from './app-layout.module.scss'

/**
 * Protected app shell. Two gates:
 *  1. No session → /login (middleware also enforces this; belt-and-braces).
 *  2. Signed in but no organization yet → /onboarding/company-setup.
 *
 * Onboarding lives OUTSIDE this group so it isn't caught by gate 2 (no loop).
 * The full sidebar/topbar shell arrives with the Dashboard module.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser()
  if (!user) redirect('/login')

  const orgId = await getActiveOrgId()
  if (!orgId) redirect('/onboarding/company-setup')

  return (
    <QueryProvider>
      <div className={styles.shell}>{children}</div>
    </QueryProvider>
  )
}
