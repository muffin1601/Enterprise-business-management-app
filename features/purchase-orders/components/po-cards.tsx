'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useTransition } from 'react'
import type { PoRow, PoPage } from '../server/queries'
import { deletePurchaseOrder } from '../server/actions'
import { PO_STATUS_LABELS } from '@/validations/purchase-order'
import { Icon } from '@/components/ui'
import styles from './purchase-orders.module.scss'

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
    <span className={`${styles.statusBadge} ${styles[`po_${status}` as keyof typeof styles] ?? ''}`}>
      {PO_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function PoCard({ row, canDelete, onDelete }: {
  row: PoRow; canDelete: boolean; onDelete: (id: string, no: string) => void
}) {
  return (
    <div className={styles.cardWrap}>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.poNo}>{row.poNo}</span>
          <span className={styles.cardDate}>{fmtDate(row.date)}</span>
        </div>

        <div className={styles.cardVendor}>{row.vendorName}</div>
        {row.customerRef && <div className={styles.cardRef}>For: {row.customerRef}</div>}
        {row.subject && <div className={styles.cardSubject}>{row.subject}</div>}

        <div className={styles.cardMeta}>
          <StatusBadge status={row.status} />
          <Link href={`/invoices/${row.invoiceId}` as Route} onClick={e => e.stopPropagation()} className={styles.invRef}>
            {row.invoiceNo}
          </Link>
        </div>

        <div className={styles.cardCountRow}>
          <span>{row.itemCount} item{row.itemCount !== 1 ? 's' : ''}</span>
          {row.expectedDelivery && (
            <><span className={styles.dot}>·</span><span>Del: {fmtDate(row.expectedDelivery)}</span></>
          )}
        </div>

        <div className={styles.cardFooter}>
          <span className={styles.amount}>{fmtINR(row.grandTotal)}</span>
          <div className={styles.cardActions}>
            <Link href={`/purchase-orders/${row.id}` as Route} className={styles.btnView}>
              <Icon name="eye" size={14} /> View
            </Link>
            {canDelete && ['draft','cancelled'].includes(row.status) && (
              <button className={styles.btnDelete} onClick={() => onDelete(row.id, row.poNo)} type="button">
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
  page: PoPage; canDelete: boolean; currentPage: number; onPageChange: (p: number) => void
}

export function PoCards({ page, canDelete, currentPage, onPageChange }: Props) {
  const [, startT] = useTransition()

  function handleDelete(id: string, no: string) {
    if (!confirm(`Delete Purchase Order ${no}? This cannot be undone.`)) return
    startT(async () => {
      const res = await deletePurchaseOrder(id)
      if (!res.ok) alert(`Delete failed: ${res.error?.message}`)
    })
  }

  return (
    <>
      {page.rows.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="shopping-cart" size={32} />
          <p>No purchase orders found</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {page.rows.map(row => <PoCard key={row.id} row={row} canDelete={canDelete} onDelete={handleDelete} />)}
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
