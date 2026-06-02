import type { MovementRow } from '../server/queries'
import { ExportButton } from './export-button'
import styles from './stock-reports.module.scss'

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const fmtNum = (n: number) =>
  n > 0 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n) : '—'

const TYPE_LABELS = { inward: 'GRN Inward', outward: 'DC Outward', adjustment: 'Adjustment' }
const TYPE_STYLES: Record<string, string> = { inward: 'inward', outward: 'outward', adjustment: 'adj' }

interface Props {
  rows:        MovementRow[]
  total:       number
  canExport:   boolean
  currentPage: number
  totalPages:  number
  onPageChange:(p: number) => void
}

export function MovementLedgerTable({ rows, total, canExport, currentPage, totalPages, onPageChange }: Props) {
  const exportData = rows.map(r => ({
    Date: r.date, Item: r.itemName, SKU: r.sku ?? '',
    Type: TYPE_LABELS[r.type], Reference: r.refNo, 'Related Doc': r.relatedDoc ?? '',
    'Qty In': r.qtyIn || '', 'Qty Out': r.qtyOut || '', Note: r.note ?? '',
  }))

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <span className={styles.tableCount}>{total} movements</span>
        <ExportButton data={exportData} filename="stock-movements" canExport={canExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>Date</th>
              <th style={{ textAlign:'left' }}>Item</th>
              <th style={{ textAlign:'center' }}>Type</th>
              <th style={{ textAlign:'left' }}>Reference</th>
              <th style={{ textAlign:'left' }}>Related Doc</th>
              <th className={styles.numTh} style={{ color:'var(--c-success)' }}>Qty In</th>
              <th className={styles.numTh} style={{ color:'var(--c-danger)' }}>Qty Out</th>
              <th style={{ textAlign:'left' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className={styles.emptyCell}>No movements in this period</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td className={styles.dimCell} style={{ whiteSpace:'nowrap' }}>{fmtDate(r.date)}</td>
                <td>
                  <div className={styles.nameCell}>{r.itemName}</div>
                  {r.sku && <div className={`${styles.monoCell} ${styles.dimCell}`} style={{ fontSize:10 }}>{r.sku}</div>}
                </td>
                <td className={styles.centerCell}>
                  <span className={`${styles.movementBadge} ${styles[`move_${TYPE_STYLES[r.type]}` as keyof typeof styles] ?? ''}`}>
                    {TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td className={styles.monoCell} style={{ fontSize:11 }}>{r.refNo}</td>
                <td className={styles.dimCell} style={{ fontSize:11 }}>{r.relatedDoc ?? '—'}</td>
                <td className={`${styles.numCell} ${styles.success}`} style={{ fontWeight: r.qtyIn > 0 ? 600 : 400 }}>
                  {fmtNum(r.qtyIn)}
                </td>
                <td className={`${styles.numCell} ${styles.danger}`} style={{ fontWeight: r.qtyOut > 0 ? 600 : 400 }}>
                  {fmtNum(r.qtyOut)}
                </td>
                <td className={styles.dimCell} style={{ fontSize:11 }}>{r.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>‹ Prev</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>Next ›</button>
        </div>
      )}
    </div>
  )
}
