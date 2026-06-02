'use client'

import type { CurrentStockRow } from '../server/queries'
import { STOCK_STATUS_LABELS, type StockStatus } from '@/validations/stock-report'
import { ExportButton } from './export-button'
import styles from './stock-reports.module.scss'

const fmtINR = (n: number) =>
  n > 0 ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}` : '—'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)

function StatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`stock_${status}` as keyof typeof styles] ?? ''}`}>
      {STOCK_STATUS_LABELS[status]}
    </span>
  )
}

interface Props { rows: CurrentStockRow[]; total: number; canExport: boolean; currentPage: number; totalPages: number; onPageChange: (p: number) => void }

export function CurrentStockTable({ rows, total, canExport, currentPage, totalPages, onPageChange }: Props) {
  const exportData = rows.map(r => ({
    SKU: r.sku ?? '', Name: r.name, Family: r.family ?? '', Brand: r.brand ?? '',
    Unit: r.unit ?? '', Stock: r.stock, 'Reorder Level': r.reorderLevel,
    'Purchase Price': r.purchasePrice ?? '', 'Selling Price': r.sellingPrice ?? '',
    'Purchase Value': r.purchaseValue, 'Selling Value': r.sellingValue, Status: STOCK_STATUS_LABELS[r.stockStatus],
  }))

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <span className={styles.tableCount}>{total} items</span>
        <ExportButton data={exportData} filename="current-stock" canExport={canExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>SKU</th>
              <th style={{ textAlign:'left' }}>Item Name</th>
              <th style={{ textAlign:'left' }}>Family</th>
              <th style={{ textAlign:'left' }}>Brand</th>
              <th style={{ textAlign:'center' }}>Unit</th>
              <th className={styles.numTh}>Stock</th>
              <th className={styles.numTh}>Reorder Lvl</th>
              <th className={styles.numTh}>Purchase ₹</th>
              <th className={styles.numTh}>Selling ₹</th>
              <th className={styles.numTh}>Purch. Value</th>
              <th className={styles.numTh}>Sell. Value</th>
              <th style={{ textAlign:'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} className={styles.emptyCell}>No items found</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className={r.stockStatus === 'out' ? styles.rowOut : r.stockStatus === 'low' ? styles.rowLow : ''}>
                <td className={styles.monoCell}>{r.sku ?? '—'}</td>
                <td className={styles.nameCell}>{r.name}</td>
                <td className={styles.dimCell}>{r.family ?? '—'}</td>
                <td className={styles.dimCell}>{r.brand ?? '—'}</td>
                <td className={styles.centerCell}>{r.unit ?? '—'}</td>
                <td className={`${styles.numCell} ${r.stockStatus === 'out' ? styles.danger : r.stockStatus === 'low' ? styles.warning : ''}`} style={{ fontWeight:600 }}>
                  {fmtNum(r.stock)}
                </td>
                <td className={styles.numCell}>{r.reorderLevel > 0 ? fmtNum(r.reorderLevel) : '—'}</td>
                <td className={styles.numCell}>{r.purchasePrice ? fmtINR(r.purchasePrice) : '—'}</td>
                <td className={styles.numCell}>{r.sellingPrice ? fmtINR(r.sellingPrice) : '—'}</td>
                <td className={styles.numCell}>{fmtINR(r.purchaseValue)}</td>
                <td className={styles.numCell}>{fmtINR(r.sellingValue)}</td>
                <td className={styles.centerCell}><StatusBadge status={r.stockStatus} /></td>
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
