'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useTransition } from 'react'
import type { InvoiceRow, InvoicePage } from '../server/queries'
import { deleteInvoice } from '../server/actions'
import { INV_STATUS_LABELS } from '@/validations/invoice'
import { Icon } from '@/components/ui'
import styles from './invoices.module.scss'

const fmtINR = (n: number) => {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  if (n >= 1_000)      return `₹${new Intl.NumberFormat('en-IN').format(n)}`
  return `₹${n}`
}

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`inv_${status}` as keyof typeof styles] ?? ''}`}>
      {INV_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function InvoiceCard({ row, canDelete, onDelete }: {
  row: InvoiceRow
  canDelete: boolean
  onDelete: (id: string, no: string) => void
}) {
  const paidPct = row.grandTotal > 0 ? Math.min(100, Math.round((row.amountPaid / row.grandTotal) * 100)) : 0

  return (
    <div className={`${styles.cardWrap} ${row.isOverdue ? styles.cardOverdue : ''}`}>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.invoiceNo}>{row.invoiceNo}</span>
          <span className={styles.cardDate}>{fmtDate(row.date)}</span>
        </div>

        <div className={styles.cardCustomer}>{row.customerName ?? '—'}</div>
        <div className={styles.cardSubject}>
          {row.subject ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}
        </div>

        <div className={styles.cardMeta}>
          <StatusBadge status={row.status} />
          {row.isOverdue && <span className={styles.overdueBadge}>Overdue</span>}
          <Link
            href={`/orders/${row.soId}` as Route}
            onClick={e => e.stopPropagation()}
            style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--c-secondary)', textDecoration:'none', borderBottom:'1px solid var(--c-border)', letterSpacing:'0.04em' }}
          >
            {row.soNo}
          </Link>
        </div>

        {/* Payment progress bar */}
        {['issued','partially_paid','paid'].includes(row.status) && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
            </div>
            <span className={styles.progressLabel}>{paidPct}% paid</span>
          </div>
        )}

        {row.dueDate && (
          <div className={`${styles.dueDate} ${row.isOverdue ? styles.dueDateOverdue : ''}`}>
            Due: {fmtDate(row.dueDate)}
          </div>
        )}

        <div className={styles.cardFooter}>
          <div>
            <div className={styles.amount}>{fmtINR(row.grandTotal)}</div>
            {row.balanceDue > 0 && row.status !== 'draft' && (
              <div className={styles.balanceDue}>Balance: {fmtINR(row.balanceDue)}</div>
            )}
          </div>
          <div className={styles.cardActions}>
            <Link href={`/invoices/${row.id}` as Route} className={styles.btnView}>
              <Icon name="eye" size={14} /> View
            </Link>
            {canDelete && row.status === 'draft' && (
              <button className={styles.btnDelete} onClick={() => onDelete(row.id, row.invoiceNo)} type="button">
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  page:         InvoicePage
  canDelete:    boolean
  currentPage:  number
  onPageChange: (p: number) => void
}

export function InvoiceCards({ page, canDelete, currentPage, onPageChange }: Props) {
  const [, startT] = useTransition()

  function handleDelete(id: string, no: string) {
    if (!confirm(`Delete Invoice ${no}? This cannot be undone.`)) return
    startT(async () => { await deleteInvoice(id) })
  }

  return (
    <>
      {page.rows.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="file-dollar" size={32} />
          <p>No invoices found</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {page.rows.map(row => (
            <InvoiceCard key={row.id} row={row} canDelete={canDelete} onDelete={handleDelete} />
          ))}
        </div>
      )}
      {page.totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>‹ Prev</button>
          <span>Page {currentPage} of {page.totalPages}</span>
          <button disabled={currentPage >= page.totalPages} onClick={() => onPageChange(currentPage + 1)}>Next ›</button>
        </div>
      )}
    </>
  )
}
