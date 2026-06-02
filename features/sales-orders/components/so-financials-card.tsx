import type { SoDetail } from '../server/queries'
import styles from './sales-orders.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

const GST_MODE_LABELS: Record<string, string> = {
  add:       'GST Added',
  inclusive: 'GST Inclusive',
  none:      'No GST',
}

export function SoFinancialsCard({ so }: { so: SoDetail }) {
  const advancePct = so.grandTotal > 0
    ? Math.round((so.advanceAmount / so.grandTotal) * 100)
    : 0

  return (
    <div className={styles.financialsCard}>
      <div className={styles.financialsTitle}>Order Summary</div>

      <div className={styles.financialsRow}>
        <span>Material Subtotal</span>
        <span>{fmtINR(so.materialSubtotal)}</span>
      </div>

      {so.transport > 0 && (
        <div className={styles.financialsRow}>
          <span>Transport{so.transportNote ? ` (${so.transportNote})` : ''}</span>
          <span>{fmtINR(so.transport)}</span>
        </div>
      )}

      {so.gstMode !== 'none' && (
        <div className={styles.financialsRow}>
          <span>GST @ {so.gstPct}% ({GST_MODE_LABELS[so.gstMode]})</span>
          <span>{fmtINR(so.gstAmount)}</span>
        </div>
      )}

      <div className={`${styles.financialsRow} ${styles.grandTotal}`}>
        <span>Grand Total</span>
        <span>{fmtINR(so.grandTotal)}</span>
      </div>

      <div className={styles.financialsDivider} />

      <div className={styles.financialsRow}>
        <span>Advance {so.advanceReceived ? '✓ Received' : '(Pending)'}</span>
        <span style={{ color: so.advanceReceived ? 'var(--c-green)' : 'var(--c-tertiary)' }}>
          {fmtINR(so.advanceAmount)} ({advancePct}%)
        </span>
      </div>

      <div className={styles.financialsRow}>
        <span>Balance Due</span>
        <span>{fmtINR(Math.max(0, so.grandTotal - (so.advanceReceived ? so.advanceAmount : 0)))}</span>
      </div>

      <div className={styles.snapshotNote}>
        Financial snapshot from quote {so.quoteNo} · Immutable
      </div>
    </div>
  )
}
