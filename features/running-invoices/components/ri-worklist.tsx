import Link from 'next/link'
import type { Route } from 'next'
import type { UnbilledSummaryRow } from '../server/queries'
import styles from './running-invoices.module.scss'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

function AgingBadge({ days }: { days: number }) {
  if (days >= 15) return <span className={`${styles.agingBadge} ${styles.agingCritical}`}>⚠ {days}d overdue</span>
  if (days >= 7)  return <span className={`${styles.agingBadge} ${styles.agingWarn}`}>{days}d</span>
  return <span className={styles.agingOk}>{days}d</span>
}

interface Props { rows: UnbilledSummaryRow[]; canCreate: boolean }

export function RiWorklist({ rows, canCreate }: Props) {
  if (rows.length === 0) return null

  return (
    <div className={styles.worklist}>
      <div className={styles.worklistHeader}>
        <div className={styles.worklistTitle}>
          Ready to Invoice
          <span className={styles.worklistCount}>{rows.length}</span>
        </div>
        <div className={styles.worklistSub}>Delivered challans awaiting billing</div>
      </div>

      <div className={styles.worklistRows}>
        {rows.map(row => (
          <div key={row.soId} className={`${styles.worklistRow} ${row.agingDays >= 15 ? styles.worklistRowCritical : row.agingDays >= 7 ? styles.worklistRowWarn : ''}`}>
            <div className={styles.worklistInfo}>
              <Link href={`/orders/${row.soId}` as Route} className={styles.worklistSoNo}>
                {row.soNo}
              </Link>
              <span className={styles.worklistCustomer}>{row.customerName ?? '—'}</span>
              <span className={styles.worklistMeta}>
                {row.dcCount} challan{row.dcCount !== 1 ? 's' : ''} · Oldest: {fmtDate(row.oldestDcDate)}
              </span>
            </div>
            <div className={styles.worklistRight}>
              <AgingBadge days={row.agingDays} />
              {canCreate && (
                <Link
                  href={`/running-invoices/new?soId=${row.soId}` as Route}
                  className={styles.worklistCreateBtn}
                >
                  Create Invoice
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
