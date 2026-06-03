import type { RiDetail } from '../server/queries'
import styles from './running-invoices.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

export function RiFinancialsCard({ ri }: { ri: RiDetail }) {
  return (
    <div className={styles.financialsCard}>
      <div className={styles.financialsTitle}>Invoice Summary</div>

      <div className={styles.financialsRow}>
        <span>Taxable Value</span><span>{fmtINR(ri.taxableValue)}</span>
      </div>

      {ri.gstPct > 0 && (
        ri.isIgst ? (
          <div className={styles.financialsRow}>
            <span>IGST @ {ri.gstPct}%</span><span>{fmtINR(ri.igstAmount)}</span>
          </div>
        ) : (
          <>
            <div className={styles.financialsRow}>
              <span>CGST @ {ri.gstPct / 2}%</span><span>{fmtINR(ri.cgstAmount)}</span>
            </div>
            <div className={styles.financialsRow}>
              <span>SGST @ {ri.gstPct / 2}%</span><span>{fmtINR(ri.sgstAmount)}</span>
            </div>
          </>
        )
      )}

      <div className={`${styles.financialsRow} ${styles.grandTotal}`}>
        <span>Grand Total</span><span>{fmtINR(ri.grandTotal)}</span>
      </div>

      {['posted','sent'].includes(ri.status) && (
        <>
          <div className={styles.financialsDivider} />
          <div className={styles.financialsRow}>
            <span>Received</span>
            <span style={{ color:'var(--c-success)' }}>{fmtINR(ri.amountReceived)}</span>
          </div>
          <div className={styles.financialsRow}>
            <span>Balance Due</span>
            <span style={{ color: ri.balanceDue > 0 ? 'var(--c-danger)' : 'var(--c-success)', fontWeight:600 }}>
              {fmtINR(ri.balanceDue)}
            </span>
          </div>
        </>
      )}

      <div className={styles.snapshotNote}>
        {ri.challans.length} challan{ri.challans.length !== 1 ? 's' : ''} · {ri.items.length} line item{ri.items.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
