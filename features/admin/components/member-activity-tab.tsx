import type { ActivityItem } from '../server/queries'
import styles from './team.module.scss'

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })

const ACTION_LABELS: Record<string, string> = {
  insert: 'Created', update: 'Updated', delete: 'Deleted',
}

const ACTION_COLORS: Record<string, string> = {
  insert: 'var(--c-success)', update: 'var(--c-info)', delete: 'var(--c-danger)',
}

const ENTITY_LABELS: Record<string, string> = {
  quotes: 'Quote', sales_orders: 'Sales Order', invoices: 'Invoice',
  purchase_orders: 'Purchase Order', delivery_challans: 'Delivery Challan',
  customers: 'Customer', vendors: 'Vendor', items: 'Item', payments: 'Payment',
  roles: 'Role',
}

export function MemberActivityTab({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <div className={styles.emptyState} style={{ padding:'48px 0' }}>
        <div className={styles.emptyTitle}>No activity yet</div>
        <div className={styles.emptySub}>Actions taken by this member will appear here</div>
      </div>
    )
  }

  return (
    <div className={styles.activityTimeline}>
      {activity.map(a => (
        <div key={a.id} className={styles.activityItem}>
          <div
            className={styles.activityDot}
            style={{ background: ACTION_COLORS[a.action] ?? 'var(--c-border-2)' }}
          />
          <div className={styles.activityContent}>
            <div className={styles.activityTitle}>
              <strong>{ACTION_LABELS[a.action] ?? a.action}</strong>
              {' '}
              {ENTITY_LABELS[a.entityType] ?? a.entityType}
              {a.after && typeof a.after === 'object' && 'name' in a.after && (
                <span className={styles.activityRef}> — {String(a.after.name)}</span>
              )}
              {a.after && typeof a.after === 'object' && 'invoiceNo' in a.after && (
                <span className={styles.activityRef}> — {String(a.after.invoiceNo)}</span>
              )}
              {a.after && typeof a.after === 'object' && 'status' in a.after && (
                <span className={styles.activityBadge}>{String(a.after.status)}</span>
              )}
            </div>
            <div className={styles.activityMeta}>{fmtDateTime(a.at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
