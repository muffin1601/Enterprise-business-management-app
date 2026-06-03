'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useTransition } from 'react'
import type { RiRow, RiPage } from '../server/queries'
import { deleteRunningInvoice } from '../server/actions'
import { RI_STATUS_LABELS } from '@/validations/running-invoice'
import { Icon } from '@/components/ui'
import styles from './running-invoices.module.scss'

const fmtINR = (n: number) => {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(Math.round(n))}`
}

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`ri_${status}` as keyof typeof styles] ?? ''}`}>
      {RI_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function RiCard({ row, canDelete, onDelete }: {
  row: RiRow; canDelete: boolean; onDelete: (id: string, no: string) => void
}) {
  const today    = new Date().toISOString().split('T')[0]!
  const isOverdue = row.status === 'posted' && row.dueDate && row.dueDate < today

  return (
    <div className={`${styles.cardWrap} ${isOverdue ? styles.cardOverdue : ''}`}>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.riNo}>{row.riNo}</span>
          <span className={styles.cardDate}>{fmtDate(row.date)}</span>
        </div>

        <div className={styles.cardCustomer}>{row.customerName ?? '—'}</div>
        {row.subject && <div className={styles.cardSubject}>{row.subject}</div>}

        <div className={styles.cardMeta}>
          <StatusBadge status={row.status} />
          <Link href={`/orders/${row.soId}` as Route} onClick={e => e.stopPropagation()} className={styles.soRef}>
            {row.soNo}
          </Link>
          {isOverdue && <span className={styles.overdueBadge}>Overdue</span>}
        </div>

        <div className={styles.cardCountRow}>
          <span>{row.dcCount} challan{row.dcCount !== 1 ? 's' : ''}</span>
          <span className={styles.dot}>·</span>
          <span>{row.itemCount} item{row.itemCount !== 1 ? 's' : ''}</span>
          {row.dueDate && (
            <><span className={styles.dot}>·</span><span>Due: {fmtDate(row.dueDate)}</span></>
          )}
        </div>

        <div className={styles.cardFooter}>
          <div>
            <div className={styles.amount}>{fmtINR(row.grandTotal)}</div>
            {row.balanceDue > 0 && row.status !== 'draft' && (
              <div className={styles.balanceDue}>Balance: {fmtINR(row.balanceDue)}</div>
            )}
          </div>
          <div className={styles.cardActions}>
            <Link href={`/running-invoices/${row.id}` as Route} className={styles.btnView}>
              <Icon name="eye" size={14} /> View
            </Link>
            {canDelete && ['draft','cancelled'].includes(row.status) && (
              <button className={styles.btnDelete} onClick={() => onDelete(row.id, row.riNo)} type="button">
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
  page: RiPage; canDelete: boolean; currentPage: number; onPageChange: (p: number) => void
}

export function RiCards({ page, canDelete, currentPage, onPageChange }: Props) {
  const [, startT] = useTransition()

  function handleDelete(id: string, no: string) {
    if (!confirm(`Delete Running Invoice ${no}?`)) return
    startT(async () => {
      const res = await deleteRunningInvoice(id)
      if (!res.ok) alert(res.error?.message ?? 'Failed.')
    })
  }

  return (
    <>
      {page.rows.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="file-invoice" size={32} />
          <p>No running invoices found</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {page.rows.map(row => <RiCard key={row.id} row={row} canDelete={canDelete} onDelete={handleDelete} />)}
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
