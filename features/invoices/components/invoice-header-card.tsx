import Link from 'next/link'
import type { Route } from 'next'
import type { InvoiceDetail } from '../server/queries'
import { INV_STATUS_LABELS } from '@/validations/invoice'
import styles from './invoices.module.scss'

const linkStyle = {
  fontFamily: 'var(--font-mono)', fontSize: 12,
  color: 'var(--c-secondary)', textDecoration: 'none',
  borderBottom: '1px solid var(--c-border)',
} as const

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function InvoiceHeaderCard({ inv }: { inv: InvoiceDetail }) {
  const today    = new Date().toISOString().split('T')[0]!
  const isOverdue = !!(inv.dueDate && inv.dueDate < today && ['issued','partially_paid'].includes(inv.status))

  return (
    <div className={styles.headerCard}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.invoiceNumber}>{inv.invoiceNo}</div>
          <div className={styles.invSubject}>{inv.subject ?? '—'}</div>
        </div>
        <div className={styles.headerBadges}>
          <span className={`${styles.statusBadge} ${styles[`inv_${inv.status}` as keyof typeof styles] ?? ''}`}>
            {INV_STATUS_LABELS[inv.status] ?? inv.status}
          </span>
          {isOverdue && <span className={styles.overdueBadge}>Overdue</span>}
        </div>
      </div>

      <div className={styles.headerMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Customer</span>
          <span className={styles.metaValue}>{inv.customerName ?? '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Invoice Date</span>
          <span className={styles.metaValue}>{fmtDate(inv.date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Due Date</span>
          <span className={`${styles.metaValue} ${isOverdue ? styles.overdueTxt : ''}`}>{fmtDate(inv.dueDate)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Sales Order</span>
          <Link href={`/orders/${inv.soId}` as Route} style={linkStyle}>{inv.soNo}</Link>
        </div>
        {inv.quoteNo && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Quote Ref</span>
            <Link href={`/quotes/${inv.quoteId}` as Route} style={linkStyle}>{inv.quoteNo}</Link>
          </div>
        )}
        {inv.placeOfSupply && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Place of Supply</span>
            <span className={styles.metaValue}>{inv.placeOfSupply}</span>
          </div>
        )}
        {inv.paymentTerms && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Payment Terms</span>
            <span className={styles.metaValue}>{inv.paymentTerms}</span>
          </div>
        )}
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>GST Type</span>
          <span className={styles.metaValue}>{inv.isIgst ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)'}</span>
        </div>
      </div>

      {inv.notes && (
        <div className={styles.notesBlock}>
          <span className={styles.metaLabel}>Notes</span>
          <p className={styles.notesText}>{inv.notes}</p>
        </div>
      )}
    </div>
  )
}
