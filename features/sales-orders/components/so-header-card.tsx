import Link from 'next/link'
import type { Route } from 'next'
import type { SoDetail } from '../server/queries'
import { SO_STATUS_LABELS, SO_PRIORITY_LABELS } from '@/validations/sales-order'
import styles from './sales-orders.module.scss'

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SoHeaderCard({ so }: { so: SoDetail }) {
  return (
    <div className={styles.headerCard}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.soNumber}>{so.soNo}</div>
          <div className={styles.soSubject}>{so.subject ?? '—'}</div>
        </div>
        <div className={styles.headerBadges}>
          <span className={`${styles.statusBadge} ${styles[`so_${so.status}` as keyof typeof styles] ?? ''}`}>
            {SO_STATUS_LABELS[so.status] ?? so.status}
          </span>
          {so.priority !== 'normal' && (
            <span className={`${styles.priorityBadge} ${styles[`priority_${so.priority}` as keyof typeof styles] ?? ''}`}>
              {SO_PRIORITY_LABELS[so.priority] ?? so.priority}
            </span>
          )}
        </div>
      </div>

      <div className={styles.headerMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Bill To</span>
          <span className={styles.metaValue}>{so.billToName ?? so.customerName ?? '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Order Date</span>
          <span className={styles.metaValue}>{fmtDate(so.date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Expected Delivery</span>
          <span className={styles.metaValue}>{fmtDate(so.expectedDelivery)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Quote Reference</span>
          <Link href={`/quotes/${so.quoteId}` as Route} className={styles.quoteRef}>
            {so.quoteNo}
          </Link>
        </div>
        {(so.billToPhone ?? so.customerPhone) && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Phone</span>
            <span className={styles.metaValue}>{so.billToPhone ?? so.customerPhone}</span>
          </div>
        )}
        {(so.billToEmail ?? so.customerEmail) && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Email</span>
            <span className={styles.metaValue}>{so.billToEmail ?? so.customerEmail}</span>
          </div>
        )}
        {so.billToGstin && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>GSTIN</span>
            <span className={styles.metaValue}>{so.billToGstin}</span>
          </div>
        )}
      </div>

      {so.notes && (
        <div className={styles.notesBlock}>
          <span className={styles.metaLabel}>Notes</span>
          <p className={styles.notesText}>{so.notes}</p>
        </div>
      )}
    </div>
  )
}
