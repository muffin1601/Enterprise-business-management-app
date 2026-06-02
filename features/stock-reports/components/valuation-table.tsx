import type { ValuationRow, ValuationSummary } from '../server/queries'
import { ExportButton } from './export-button'
import styles from './stock-reports.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

interface Props {
  rows:       ValuationRow[]
  summary:    ValuationSummary
  canExport:  boolean
  currentPage:number
  totalRows:  number
}

export function ValuationTable({ rows, summary, canExport, currentPage, totalRows }: Props) {
  const exportData = rows.map(r => ({
    SKU: r.sku ?? '', Name: r.name, Family: r.family ?? '', Brand: r.brand ?? '',
    Stock: r.stock, Unit: r.unit ?? '',
    'Purchase Price': r.purchasePrice ?? '', 'Selling Price': r.sellingPrice ?? '',
    'Purchase Value': r.purchaseValue, 'Selling Value': r.sellingValue,
    'Margin': r.margin, 'Margin %': r.marginPct.toFixed(1),
  }))

  return (
    <div className={styles.tableWrap}>
      {/* Summary cards */}
      <div className={styles.valuationSummary}>
        <div className={styles.valCard}>
          <span className={styles.valLabel}>Purchase Value</span>
          <span className={styles.valAmount}>{fmtINR(summary.totalPurchaseValue)}</span>
          <span className={styles.valSub}>{totalRows} items</span>
        </div>
        <div className={styles.valCard}>
          <span className={styles.valLabel}>Selling Value</span>
          <span className={styles.valAmount} style={{ color:'var(--c-success)' }}>{fmtINR(summary.totalSellingValue)}</span>
          <span className={styles.valSub}>At MRP / selling price</span>
        </div>
        <div className={styles.valCard}>
          <span className={styles.valLabel}>Potential Margin</span>
          <span className={styles.valAmount} style={{ color:'var(--c-info)' }}>{fmtINR(summary.totalMargin)}</span>
          <span className={styles.valSub}>
            {summary.totalSellingValue > 0 ? fmtPct((summary.totalMargin / summary.totalSellingValue) * 100) : '—'}
          </span>
        </div>
      </div>

      <div className={styles.tableHeader}>
        <span className={styles.tableCount}>{totalRows} items with stock</span>
        <ExportButton data={exportData} filename="stock-valuation" canExport={canExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>Item</th>
              <th style={{ textAlign:'left' }}>Family</th>
              <th style={{ textAlign:'center' }}>Unit</th>
              <th className={styles.numTh}>Stock</th>
              <th className={styles.numTh}>Purchase ₹</th>
              <th className={styles.numTh}>Selling ₹</th>
              <th className={styles.numTh}>Purchase Value</th>
              <th className={styles.numTh}>Selling Value</th>
              <th className={styles.numTh}>Margin</th>
              <th className={styles.numTh}>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className={styles.emptyCell}>No items with stock found</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div className={styles.nameCell}>{r.name}</div>
                  {r.sku && <div className={`${styles.dimCell} ${styles.monoCell}`} style={{ fontSize:10 }}>{r.sku}</div>}
                </td>
                <td className={styles.dimCell}>{r.family ?? '—'}</td>
                <td className={styles.centerCell}>{r.unit ?? '—'}</td>
                <td className={styles.numCell}>{fmtNum(r.stock)}</td>
                <td className={styles.numCell}>{r.purchasePrice ? fmtINR(r.purchasePrice) : '—'}</td>
                <td className={styles.numCell}>{r.sellingPrice ? fmtINR(r.sellingPrice) : '—'}</td>
                <td className={styles.numCell} style={{ fontWeight:600 }}>{fmtINR(r.purchaseValue)}</td>
                <td className={`${styles.numCell} ${styles.success}`} style={{ fontWeight:600 }}>{fmtINR(r.sellingValue)}</td>
                <td className={`${styles.numCell} ${r.margin >= 0 ? styles.success : styles.danger}`}>{fmtINR(r.margin)}</td>
                <td className={`${styles.numCell} ${r.marginPct >= 20 ? styles.success : r.marginPct < 0 ? styles.danger : ''}`}>
                  {r.marginPct > 0 ? fmtPct(r.marginPct) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.tfootRow}>
              <td colSpan={6} style={{ textAlign:'right', fontWeight:600, fontSize:11 }}>Totals</td>
              <td className={styles.numCell} style={{ fontWeight:700 }}>{fmtINR(summary.totalPurchaseValue)}</td>
              <td className={`${styles.numCell} ${styles.success}`} style={{ fontWeight:700 }}>{fmtINR(summary.totalSellingValue)}</td>
              <td className={`${styles.numCell} ${styles.success}`} style={{ fontWeight:700 }}>{fmtINR(summary.totalMargin)}</td>
              <td className={styles.numCell} style={{ fontWeight:700 }}>
                {summary.totalSellingValue > 0 ? fmtPct((summary.totalMargin / summary.totalSellingValue) * 100) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
