import { redirect } from 'next/navigation'
import { getOptionalUser, getActiveOrgId, getUserMemberships } from '@/lib/auth/session'
import { QueryProvider } from '@/components/providers/query-provider'
import { AppShell } from '@/components/app-shell/AppShell'

/**
 * Protected app shell. Gates auth + org membership, then renders the
 * universal sidebar/topbar shell (AppShell) around every (app) route.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser()
  if (!user) redirect('/login')

  const memberships = await getUserMemberships()
  if (memberships.length === 0) redirect('/onboarding/company-setup')

  const orgId = await getActiveOrgId()
  if (!orgId) redirect('/onboarding/company-setup')

  const activeOrg = memberships.find((m) => m.orgId === orgId)

  return (
    <QueryProvider>
      <AppShell
        userName={user.email ?? ''}
        orgName={activeOrg?.orgName ?? 'Watcon'}
      >
        {children}
      </AppShell>
    </QueryProvider>
  )
}
