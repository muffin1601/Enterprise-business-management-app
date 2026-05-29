'use client'

import Link from 'next/link'
import { useNotices } from '@/features/dashboard/hooks'
import { Badge, Card } from '@/components/ui'
import styles from './dashboard.module.scss'

/**
 * Notifications, derived from real signals. A dedicated notifications table is a
 * later module; until then pending invitations are the actionable notices.
 */
export function NotificationsWidget() {
  const { data, isLoading } = useNotices()
  const invites = data?.invitations ?? []

  return (
    <Card>
      <div className={styles.widgetHeader}>
        <h2 className={styles.widgetTitle}>Notifications</h2>
        <Link href="/settings/team" className={styles.widgetLink}>
          Manage
        </Link>
      </div>

      {isLoading ? (
        <div className={styles.skeleton} />
      ) : invites.length === 0 ? (
        <p className={styles.empty}>You&rsquo;re all caught up.</p>
      ) : (
        <div className={styles.list}>
          {invites.map((i) => (
            <div key={i.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>Invitation pending</span>
                <span className={styles.itemMeta}>
                  {i.email} · {i.roleName}
                </span>
              </div>
              <Badge tone="warning">Pending</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
