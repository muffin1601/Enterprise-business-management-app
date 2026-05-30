import { getOptionalUser } from '@/lib/auth/session'
import { getOrgSwitcherData } from '@/features/company/server/queries'
import { DashboardGrid } from '@/features/dashboard/components/dashboard-grid'

export const metadata = { title: 'Dashboard · Watcon' }

export default async function DashboardPage() {
  const [user, { memberships, activeOrgId }] = await Promise.all([
    getOptionalUser(),
    getOrgSwitcherData(),
  ])

  const activeOrg = memberships.find((m) => m.orgId === activeOrgId)

  return (
    <DashboardGrid
      orgName={activeOrg?.orgName ?? 'Watcon'}
      userName={user?.email ?? ''}
    />
  )
}
