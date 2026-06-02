import type { PoDetail } from '../server/queries'
import styles from './purchase-orders.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

export function PoFinancialsCard({ po }: { po: PoDetail }) {
  return (
    <div className={styles.financialsCard}>
      <div className={styles.financialsTitle}>PO Summary</div>

      <div className={styles.financialsRow}>
        <span>Taxable Value</span>
        <span>{fmtINR(po.taxableValue)}</span>
      </div>

      {po.transport > 0 && (
        <div className={styles.financialsRow}>
          <span>Transport{po.transportNote ? ` (${po.transportNote})` : ''}</span>
          <span>{fmtINR(po.transport)}</span>
        </div>
      )}

      {po.gstMode !== 'none' && (
        po.isIgst ? (
          <div className={styles.financialsRow}>
            <span>IGST @ {po.gstPct}%</span>
            <span>{fmtINR(po.igstAmount)}</span>
          </div>
        ) : (
          <>
            <div className={styles.financialsRow}>
              <span>CGST @ {po.gstPct / 2}%</span>
              <span>{fmtINR(po.cgstAmount)}</span>
            </div>
            <div className={styles.financialsRow}>
              <span>SGST @ {po.gstPct / 2}%</span>
              <span>{fmtINR(po.sgstAmount)}</span>
            </div>
          </>
        )
      )}

      <div className={`${styles.financialsRow} ${styles.grandTotal}`}>
        <span>Grand Total</span>
        <span>{fmtINR(po.grandTotal)}</span>
      </div>

      {po.advanceAmount > 0 && (
        <>
          <div className={styles.financialsDivider} />
          <div className={styles.financialsRow}>
            <span>Advance {po.advancePaid ? '✓ Paid' : '(Pending)'}</span>
            <span style={{ color: po.advancePaid ? 'var(--c-success)' : 'var(--c-tertiary)' }}>
              {fmtINR(po.advanceAmount)}
            </span>
          </div>
        </>
      )}

      <div className={styles.snapshotNote}>
        Purchase order · {po.items.length} line items
      </div>
    </div>
  )
}
