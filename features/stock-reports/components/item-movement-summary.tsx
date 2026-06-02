import type { ItemMovementRow } from '../server/queries'
import { ExportButton } from './export-button'
import styles from './stock-reports.module.scss'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)

interface Props { rows: ItemMovementRow[]; canExport: boolean }

export function ItemMovementSummary({ rows, canExport }: Props) {
  const exportData = rows.map(r => ({
    Name: r.name, SKU: r.sku ?? '', Family: r.family ?? '', Unit: r.unit ?? '',
    'Total Inward': r.totalInward, 'Total Outward': r.totalOutward,
    'Net Movement': r.netMovement, 'Current Stock': r.currentStock,
  }))

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <span className={styles.tableCount}>{rows.length} items with movements</span>
        <ExportButton data={exportData} filename="item-movement-summary" canExport={canExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>Item</th>
              <th style={{ textAlign:'left' }}>Family</th>
              <th style={{ textAlign:'center' }}>Unit</th>
              <th className={styles.numTh} style={{ color:'var(--c-success)' }}>Total Inward</th>
              <th className={styles.numTh} style={{ color:'var(--c-danger)' }}>Total Outward</th>
              <th className={styles.numTh}>Net Movement</th>
              <th className={styles.numTh}>Current Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className={styles.emptyCell}>No movements in this period</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div className={styles.nameCell}>{r.name}</div>
                  {r.sku && <div className={`${styles.monoCell} ${styles.dimCell}`} style={{ fontSize:10 }}>{r.sku}</div>}
                </td>
                <td className={styles.dimCell}>{r.family ?? '—'}</td>
                <td className={styles.centerCell}>{r.unit ?? '—'}</td>
                <td className={`${styles.numCell} ${styles.success}`} style={{ fontWeight:600 }}>
                  {r.totalInward > 0 ? fmtNum(r.totalInward) : '—'}
                </td>
                <td className={`${styles.numCell} ${styles.danger}`} style={{ fontWeight:600 }}>
                  {r.totalOutward > 0 ? fmtNum(r.totalOutward) : '—'}
                </td>
                <td className={`${styles.numCell} ${r.netMovement > 0 ? styles.success : r.netMovement < 0 ? styles.danger : ''}`} style={{ fontWeight:600 }}>
                  {r.netMovement > 0 ? `+${fmtNum(r.netMovement)}` : fmtNum(r.netMovement)}
                </td>
                <td className={styles.numCell}>{fmtNum(r.currentStock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
