'use client'

import { useActivity } from '@/features/dashboard/hooks'
import { Card } from '@/components/ui'
import styles from './dashboard.module.scss'

/** Latest audit events (gated by RLS audit_select → owner / admin.audit). */
export function RecentActivity() {
  const { data, isLoading } = useActivity()

  return (
    <Card>
      <div className={styles.widgetHeader}>
        <h2 className={styles.widgetTitle}>Recent activity</h2>
      </div>

      {isLoading ? (
        <div className={styles.list}>
          <div className={styles.skeleton} />
        </div>
      ) : !data?.canView ? (
        <p className={styles.empty}>You don&rsquo;t have access to the activity log.</p>
      ) : data.recent.length === 0 ? (
        <p className={styles.empty}>No recent activity.</p>
      ) : (
        <div className={styles.list}>
          {data.recent.map((a) => (
            <div key={a.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>{a.label}</span>
                <span className={styles.itemMeta}>{a.actorName ?? 'System'}</span>
              </div>
              <span className={styles.itemMeta}>
                {new Date(a.at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
