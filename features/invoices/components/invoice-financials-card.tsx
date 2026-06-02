import type { InvoiceDetail } from '../server/queries'
import styles from './invoices.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

export function InvoiceFinancialsCard({ inv }: { inv: InvoiceDetail }) {
  const paidPct = inv.grandTotal > 0 ? Math.min(100, Math.round((inv.amountPaid / inv.grandTotal) * 100)) : 0

  return (
    <div className={styles.financialsCard}>
      <div className={styles.financialsTitle}>Invoice Summary</div>

      <div className={styles.financialsRow}>
        <span>Taxable Value</span>
        <span>{fmtINR(inv.taxableValue)}</span>
      </div>

      {inv.transport > 0 && (
        <div className={styles.financialsRow}>
          <span>Transport{inv.transportNote ? ` (${inv.transportNote})` : ''}</span>
          <span>{fmtINR(inv.transport)}</span>
        </div>
      )}

      {inv.gstMode !== 'none' && (
        inv.isIgst ? (
          <div className={styles.financialsRow}>
            <span>IGST @ {inv.gstPct}%</span>
            <span>{fmtINR(inv.igstAmount)}</span>
          </div>
        ) : (
          <>
            <div className={styles.financialsRow}>
              <span>CGST @ {inv.gstPct / 2}%</span>
              <span>{fmtINR(inv.cgstAmount)}</span>
            </div>
            <div className={styles.financialsRow}>
              <span>SGST @ {inv.gstPct / 2}%</span>
              <span>{fmtINR(inv.sgstAmount)}</span>
            </div>
          </>
        )
      )}

      <div className={`${styles.financialsRow} ${styles.grandTotal}`}>
        <span>Grand Total</span>
        <span>{fmtINR(inv.grandTotal)}</span>
      </div>

      <div className={styles.financialsDivider} />

      {/* Payment progress */}
      {['issued','partially_paid','paid'].includes(inv.status) && (
        <>
          <div className={styles.financialsRow}>
            <span>Amount Paid</span>
            <span style={{ color: 'var(--c-success)' }}>{fmtINR(inv.amountPaid)}</span>
          </div>
          <div className={styles.financialsRow}>
            <span>Balance Due</span>
            <span style={{ color: inv.balanceDue > 0 ? 'var(--c-danger)' : 'var(--c-success)' }}>
              {fmtINR(inv.balanceDue)}
            </span>
          </div>
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
            </div>
            <span className={styles.progressLabel}>{paidPct}% collected</span>
          </div>
        </>
      )}

      {inv.status === 'draft' && (
        <div className={styles.snapshotNote}>Draft — not yet issued to customer</div>
      )}
    </div>
  )
}
