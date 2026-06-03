import Link from 'next/link'
import type { Route } from 'next'
import type { RiDetail } from '../server/queries'
import { RI_STATUS_LABELS } from '@/validations/running-invoice'
import styles from './running-invoices.module.scss'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

export function RiHeaderCard({ ri }: { ri: RiDetail }) {
  const today     = new Date().toISOString().split('T')[0]!
  const isOverdue = ri.status === 'posted' && ri.dueDate && ri.dueDate < today

  return (
    <div className={styles.headerCard}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.riNumber}>{ri.riNo}</div>
          <div className={styles.riSubject}>{ri.subject ?? '—'}</div>
        </div>
        <div className={styles.headerBadges}>
          <span className={`${styles.statusBadge} ${styles[`ri_${ri.status}` as keyof typeof styles] ?? ''}`}>
            {RI_STATUS_LABELS[ri.status] ?? ri.status}
          </span>
          {isOverdue && <span className={styles.overdueBadge}>Overdue</span>}
        </div>
      </div>

      <div className={styles.headerMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Customer</span>
          <span className={styles.metaValue}>{ri.customerName ?? '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Invoice Date</span>
          <span className={styles.metaValue}>{fmtDate(ri.date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Due Date</span>
          <span className={`${styles.metaValue} ${isOverdue ? styles.overdueTxt : ''}`}>{fmtDate(ri.dueDate)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Sales Order</span>
          <Link href={`/orders/${ri.soId}` as Route} className={styles.docRef}>{ri.soNo}</Link>
        </div>
        {ri.customerGstin && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Customer GSTIN</span>
            <span className={styles.metaValue} style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>{ri.customerGstin}</span>
          </div>
        )}
        {ri.placeOfSupply && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Place of Supply</span>
            <span className={styles.metaValue}>{ri.placeOfSupply}</span>
          </div>
        )}
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>GST Type</span>
          <span className={styles.metaValue}>{ri.isIgst ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)'}</span>
        </div>
        {ri.paymentTerms && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Payment Terms</span>
            <span className={styles.metaValue}>{ri.paymentTerms}</span>
          </div>
        )}
        {ri.irn && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>IRN</span>
            <span className={styles.metaValue} style={{ fontFamily:'var(--font-mono)', fontSize:10, wordBreak:'break-all' }}>{ri.irn}</span>
          </div>
        )}
      </div>

      {ri.notes && (
        <div className={styles.notesBlock}>
          <span className={styles.metaLabel}>Notes</span>
          <p className={styles.notesText}>{ri.notes}</p>
        </div>
      )}
    </div>
  )
}
