import Link from 'next/link'
import type { Route } from 'next'
import { signOut } from '@/features/auth/server/actions'
import { getOrgSwitcherData } from '@/features/company/server/queries'
import { OrgSwitcher } from '@/features/company/components/org-switcher'
import { DashboardGrid } from '@/features/dashboard/components/dashboard-grid'
import { Button } from '@/components/ui'
import styles from './page.module.scss'

/**
 * Dashboard: header (org switcher + nav) over a React-Query-driven widget grid
 * (KPIs, activity chart, recent activity, notifications, user/org summaries).
 * All widgets read real identity-schema data via /api/dashboard/* route handlers.
 */
export default async function DashboardPage() {
  const { memberships, activeOrgId } = await getOrgSwitcherData()

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1>Dashboard</h1>
        <div className={styles.headerActions}>
          <OrgSwitcher memberships={memberships} activeOrgId={activeOrgId} />
          <Link href={'/users' as Route}>
            <Button variant="ghost" size="sm">Users</Button>
          </Link>
          <Link href="/settings/team">
            <Button variant="ghost" size="sm">Team</Button>
          </Link>
          <Link href="/settings/company">
            <Button variant="ghost" size="sm">Settings</Button>
          </Link>
          <Link href="/account">
            <Button variant="ghost" size="sm">Account</Button>
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>
      </div>

      <DashboardGrid />
    </main>
  )
}
