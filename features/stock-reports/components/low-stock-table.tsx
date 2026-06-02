import Link from 'next/link'
import type { Route } from 'next'
import type { LowStockRow } from '../server/queries'
import { ExportButton } from './export-button'
import styles from './stock-reports.module.scss'

const fmtINR = (n: number) =>
  n > 0 ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}` : '—'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)

interface Props { rows: LowStockRow[]; canExport: boolean }

export function LowStockTable({ rows, canExport }: Props) {
  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>✅</div>
        <div className={styles.emptyTitle}>All items are well-stocked</div>
        <div className={styles.emptySub}>No items are below their reorder level</div>
      </div>
    )
  }

  const exportData = rows.map(r => ({
    SKU: r.sku ?? '', Name: r.name, Family: r.family ?? '', Unit: r.unit ?? '',
    'Current Stock': r.stock, 'Reorder Level': r.reorderLevel, Shortfall: r.shortfall,
    'Pending PO Qty': r.pendingPoQty, 'Est. Reorder Cost': r.estReorderCost,
  }))

  const totalShortfall   = rows.reduce((s, r) => s + r.shortfall, 0)
  const totalReorderCost = rows.reduce((s, r) => s + r.estReorderCost, 0)

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <div style={{ display:'flex', gap:24, alignItems:'center' }}>
          <span className={styles.alertSummary}>
            <span className={styles.danger}>{rows.filter(r => r.stock === 0).length}</span> out of stock
            &nbsp;·&nbsp;
            <span className={styles.warning}>{rows.filter(r => r.stock > 0).length}</span> low stock
          </span>
        </div>
        <ExportButton data={exportData} filename="low-stock-alert" canExport={canExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>Item</th>
              <th style={{ textAlign:'left' }}>Family / Brand</th>
              <th style={{ textAlign:'center' }}>Unit</th>
              <th className={styles.numTh}>Current Stock</th>
              <th className={styles.numTh}>Reorder Level</th>
              <th className={styles.numTh}>Shortfall</th>
              <th className={styles.numTh}>Pending PO</th>
              <th className={styles.numTh}>Est. Cost</th>
              <th style={{ textAlign:'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={r.stock === 0 ? styles.rowOut : styles.rowLow}>
                <td>
                  <div className={styles.nameCell}>{r.name}</div>
                  {r.sku && <div className={`${styles.dimCell} ${styles.monoCell}`} style={{ fontSize:10 }}>{r.sku}</div>}
                </td>
                <td className={styles.dimCell}>{[r.family, r.brand].filter(Boolean).join(' · ') || '—'}</td>
                <td className={styles.centerCell}>{r.unit ?? '—'}</td>
                <td className={`${styles.numCell} ${r.stock === 0 ? styles.danger : styles.warning}`} style={{ fontWeight:700 }}>
                  {fmtNum(r.stock)}
                </td>
                <td className={styles.numCell}>{fmtNum(r.reorderLevel)}</td>
                <td className={`${styles.numCell} ${styles.danger}`} style={{ fontWeight:600 }}>
                  +{fmtNum(r.shortfall)}
                </td>
                <td className={`${styles.numCell} ${r.pendingPoQty > 0 ? styles.success : styles.dimCell}`}>
                  {r.pendingPoQty > 0 ? fmtNum(r.pendingPoQty) : '—'}
                </td>
                <td className={styles.numCell}>{fmtINR(r.estReorderCost)}</td>
                <td className={styles.centerCell}>
                  <Link href={`/purchase-orders/new` as Route} className={styles.actionLink}>
                    + Create PO
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.tfootRow}>
              <td colSpan={5} style={{ textAlign:'right', fontWeight:600, fontSize:11 }}>Totals</td>
              <td className={`${styles.numCell} ${styles.danger}`} style={{ fontWeight:700 }}>{fmtNum(totalShortfall)}</td>
              <td />
              <td className={styles.numCell} style={{ fontWeight:700 }}>{fmtINR(totalReorderCost)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
