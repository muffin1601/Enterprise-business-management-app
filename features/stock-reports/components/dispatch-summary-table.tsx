import Link from 'next/link'
import type { Route } from 'next'
import type { DispatchRow } from '../server/queries'
import { DC_STATUS_LABELS } from '@/validations/delivery-challan'
import { ExportButton } from './export-button'
import styles from './stock-reports.module.scss'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)

interface Props {
  rows:        DispatchRow[]
  total:       number
  canExport:   boolean
  currentPage: number
  totalPages:  number
  onPageChange:(p: number) => void
}

export function DispatchSummaryTable({ rows, total, canExport, currentPage, totalPages, onPageChange }: Props) {
  const exportData = rows.map(r => ({
    'DC No': r.dcNo, Date: r.date, 'Dispatch Date': r.dispatchDate ?? '',
    Customer: r.customerName ?? '', 'Invoice Ref': r.invoiceNo ?? '',
    Status: r.status, 'Items': r.itemCount, 'Total Qty': r.totalQty,
    'Delivery Address': r.deliveryAddress ?? '',
  }))

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <span className={styles.tableCount}>{total} challans</span>
        <ExportButton data={exportData} filename="dispatch-summary" canExport={canExport} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>DC No.</th>
              <th style={{ textAlign:'left' }}>Customer</th>
              <th style={{ textAlign:'left' }}>Invoice Ref</th>
              <th style={{ textAlign:'center' }}>Date</th>
              <th style={{ textAlign:'center' }}>Dispatch Date</th>
              <th style={{ textAlign:'center' }}>Status</th>
              <th className={styles.numTh}>Items</th>
              <th className={styles.numTh}>Total Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className={styles.emptyCell}>No delivery challans in this period</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>
                  <Link href={`/delivery-challans/${r.id}` as Route} className={styles.docLink}>
                    {r.dcNo}
                  </Link>
                </td>
                <td className={styles.nameCell}>{r.customerName ?? '—'}</td>
                <td>
                  {r.invoiceNo
                    ? <span className={`${styles.dimCell} ${styles.monoCell}`} style={{ fontSize:11 }}>{r.invoiceNo}</span>
                    : <span className={styles.dimCell}>—</span>}
                </td>
                <td className={styles.centerCell} style={{ whiteSpace:'nowrap' }}>{fmtDate(r.date)}</td>
                <td className={styles.centerCell} style={{ whiteSpace:'nowrap' }}>{fmtDate(r.dispatchDate)}</td>
                <td className={styles.centerCell}>
                  <span className={`${styles.statusBadge} ${styles[`dc_${r.status}` as keyof typeof styles] ?? ''}`}>
                    {DC_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </td>
                <td className={styles.numCell}>{r.itemCount}</td>
                <td className={styles.numCell} style={{ fontWeight:600 }}>{fmtNum(r.totalQty)}</td>
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
