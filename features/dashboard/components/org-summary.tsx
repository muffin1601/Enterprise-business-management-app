'use client'

import { useOverview } from '@/features/dashboard/hooks'
import { Card } from '@/components/ui'
import styles from './dashboard.module.scss'

/** Organization summary: name, currency, GSTIN, age, member count. */
export function OrgSummary() {
  const { data, isLoading } = useOverview()
  const org = data?.org

  return (
    <Card>
      <div className={styles.widgetHeader}>
        <h2 className={styles.widgetTitle}>Organization</h2>
      </div>

      {isLoading ? (
        <div className={styles.skeleton} />
      ) : (
        <div className={styles.facts}>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Name</span>
            <span>{org?.name || '—'}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Currency</span>
            <span>{org?.currency}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>GSTIN</span>
            <span>{org?.gstin || 'Not set'}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Members</span>
            <span>{data?.kpis.members ?? 0}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Age</span>
            <span>{org ? `${org.ageDays} day${org.ageDays === 1 ? '' : 's'}` : '—'}</span>
          </div>
        </div>
      )}
    </Card>
  )
}
