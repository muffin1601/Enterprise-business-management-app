'use client'

import { useOverview } from '@/features/dashboard/hooks'
import { Card } from '@/components/ui'
import styles from './dashboard.module.scss'

/** KPI cards from real identity data (members, invites, roles). */
export function KpiCards() {
  const { data, isLoading } = useOverview()

  const cards = [
    { label: 'Members', value: data?.kpis.members ?? 0 },
    { label: 'Active', value: data?.kpis.activeMembers ?? 0 },
    { label: 'Pending invites', value: data?.kpis.pendingInvites ?? 0 },
    { label: 'Roles in use', value: data?.kpis.rolesInUse ?? 0 },
  ]

  return (
    <div className={styles.kpis}>
      {cards.map((c) => (
        <Card key={c.label} className={styles.kpi}>
          {isLoading ? (
            <div className={styles.skeleton} />
          ) : (
            <span className={styles.kpiValue}>{c.value}</span>
          )}
          <span className={styles.kpiLabel}>{c.label}</span>
        </Card>
      ))}
    </div>
  )
}
