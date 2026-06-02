import type { SoStatusHistoryRow } from '../server/queries'
import { SO_STATUS_LABELS } from '@/validations/sales-order'
import styles from './sales-orders.module.scss'

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })

export function SoStatusHistoryTab({ history }: { history: SoStatusHistoryRow[] }) {
  if (history.length === 0) {
    return <div className={styles.empty}>No status history available.</div>
  }

  return (
    <div className={styles.historyTimeline}>
      {history.map((h, i) => (
        <div key={h.id} className={`${styles.historyItem} ${i === history.length - 1 ? styles.historyLast : ''}`}>
          <div className={styles.historyDot} />
          <div className={styles.historyContent}>
            <div className={styles.historyTransition}>
              {h.fromStatus
                ? <><span className={styles.historyFrom}>{SO_STATUS_LABELS[h.fromStatus] ?? h.fromStatus}</span> → </>
                : null}
              <span className={`${styles.statusBadge} ${styles[`so_${h.toStatus}` as keyof typeof styles] ?? ''}`}>
                {SO_STATUS_LABELS[h.toStatus] ?? h.toStatus}
              </span>
            </div>
            {h.note && <div className={styles.historyNote}>{h.note}</div>}
            <div className={styles.historyMeta}>{fmtDateTime(h.changedAt)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
