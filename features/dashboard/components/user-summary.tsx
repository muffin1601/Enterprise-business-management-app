'use client'

import { useOverview } from '@/features/dashboard/hooks'
import { Badge, Card } from '@/components/ui'
import styles from './dashboard.module.scss'

/** Signed-in user summary: name, email, roles in the active org. */
export function UserSummary() {
  const { data, isLoading } = useOverview()
  const user = data?.user

  return (
    <Card>
      <div className={styles.widgetHeader}>
        <h2 className={styles.widgetTitle}>Your account</h2>
      </div>

      {isLoading ? (
        <div className={styles.skeleton} />
      ) : (
        <div className={styles.facts}>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Name</span>
            <span>{user?.fullName || '—'}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Email</span>
            <span>{user?.email}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Roles</span>
            <span className={styles.roleChips}>
              {user && user.roles.length > 0 ? (
                user.roles.map((r) => (
                  <Badge key={r} tone="neutral">
                    {r}
                  </Badge>
                ))
              ) : (
                <span className={styles.itemMeta}>No role</span>
              )}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
