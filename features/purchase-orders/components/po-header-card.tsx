import Link from 'next/link'
import type { Route } from 'next'
import type { PoDetail } from '../server/queries'
import { PO_STATUS_LABELS } from '@/validations/purchase-order'
import styles from './purchase-orders.module.scss'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function PoHeaderCard({ po }: { po: PoDetail }) {
  return (
    <div className={styles.headerCard}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.poNumber}>{po.poNo}</div>
          <div className={styles.poSubject}>{po.subject ?? po.customerRef ?? '—'}</div>
        </div>
        <span className={`${styles.statusBadge} ${styles[`po_${po.status}` as keyof typeof styles] ?? ''}`}>
          {PO_STATUS_LABELS[po.status] ?? po.status}
        </span>
      </div>

      <div className={styles.headerMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Vendor</span>
          <Link href={`/vendors/${po.vendorId}` as Route} className={styles.vendorLink}>
            {po.vendorName}
          </Link>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>PO Date</span>
          <span className={styles.metaValue}>{fmtDate(po.date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Expected Delivery</span>
          <span className={styles.metaValue}>{fmtDate(po.expectedDelivery)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Invoice Ref</span>
          <Link href={`/invoices/${po.invoiceId}` as Route} className={styles.vendorLink}>
            {po.invoiceNo}
          </Link>
        </div>
        {po.customerRef && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Customer</span>
            <span className={styles.metaValue}>{po.customerRef}</span>
          </div>
        )}
        {po.paymentTerms && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Payment Terms</span>
            <span className={styles.metaValue}>{po.paymentTerms}</span>
          </div>
        )}
        {po.vendorGstin && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Vendor GSTIN</span>
            <span className={styles.metaValue} style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>{po.vendorGstin}</span>
          </div>
        )}
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>GST Type</span>
          <span className={styles.metaValue}>{po.isIgst ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)'}</span>
        </div>
      </div>

      {po.notes && (
        <div className={styles.notesBlock}>
          <span className={styles.metaLabel}>Notes</span>
          <p className={styles.notesText}>{po.notes}</p>
        </div>
      )}
    </div>
  )
}
