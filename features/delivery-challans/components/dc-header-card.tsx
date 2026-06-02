import Link from 'next/link'
import type { Route } from 'next'
import type { DcDetail } from '../server/queries'
import { DC_STATUS_LABELS } from '@/validations/delivery-challan'
import styles from './delivery-challans.module.scss'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function DcHeaderCard({ dc }: { dc: DcDetail }) {
  return (
    <div className={styles.headerCard}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.dcNumber}>{dc.dcNo}</div>
          <div className={styles.dcSubject}>{dc.subject ?? '—'}</div>
        </div>
        <span className={`${styles.statusBadge} ${styles[`dc_${dc.status}` as keyof typeof styles] ?? ''}`}>
          {DC_STATUS_LABELS[dc.status] ?? dc.status}
        </span>
      </div>

      <div className={styles.headerMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Customer</span>
          <span className={styles.metaValue}>{dc.customerName ?? '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>DC Date</span>
          <span className={styles.metaValue}>{fmtDate(dc.date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Dispatch Date</span>
          <span className={styles.metaValue}>{fmtDate(dc.dispatchDate)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Expected Delivery</span>
          <span className={styles.metaValue}>{fmtDate(dc.expectedDelivery)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Invoice Ref</span>
          <Link href={`/invoices/${dc.invoiceId}` as Route} className={styles.invRefLink}>
            {dc.invoiceNo}
          </Link>
        </div>
        {dc.vehicleNo && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Vehicle No.</span>
            <span className={styles.metaValue} style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{dc.vehicleNo}</span>
          </div>
        )}
        {dc.lrNo && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>LR No.</span>
            <span className={styles.metaValue} style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{dc.lrNo}</span>
          </div>
        )}
        {dc.stockDeducted && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Stock Status</span>
            <span className={styles.metaValue} style={{ color:'var(--c-success)' }}>✓ Deducted from inventory</span>
          </div>
        )}
      </div>

      {dc.notes && (
        <div className={styles.notesBlock}>
          <span className={styles.metaLabel}>Notes</span>
          <p className={styles.notesText}>{dc.notes}</p>
        </div>
      )}
    </div>
  )
}
