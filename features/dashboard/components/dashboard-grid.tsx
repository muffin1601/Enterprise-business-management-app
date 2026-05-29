'use client'

import { KpiCards } from './kpi-cards'
import { ActivityChart } from './activity-chart'
import { NotificationsWidget } from './notifications-widget'
import { RecentActivity } from './recent-activity'
import { QuickActions } from './quick-actions'
import { UserSummary } from './user-summary'
import { OrgSummary } from './org-summary'
import styles from './dashboard.module.scss'

/** Composes all dashboard widgets into the responsive grid. */
export function DashboardGrid() {
  return (
    <div className={styles.grid}>
      <div className={styles.spanFull}>
        <KpiCards />
      </div>

      <div className={styles.spanTwoThirds}>
        <ActivityChart />
      </div>
      <div className={styles.spanThird}>
        <NotificationsWidget />
      </div>

      <div className={styles.spanTwoThirds}>
        <RecentActivity />
      </div>
      <div className={styles.spanThird}>
        <QuickActions />
      </div>

      <div className={styles.spanHalf}>
        <UserSummary />
      </div>
      <div className={styles.spanHalf}>
        <OrgSummary />
      </div>
    </div>
  )
}
