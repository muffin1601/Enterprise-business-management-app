'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useTransition } from 'react'
import type { DcRow, DcPage } from '../server/queries'
import { deleteDeliveryChallan } from '../server/actions'
import { DC_STATUS_LABELS } from '@/validations/delivery-challan'
import { Icon } from '@/components/ui'
import styles from './delivery-challans.module.scss'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`dc_${status}` as keyof typeof styles] ?? ''}`}>
      {DC_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function DcCard({ row, canDelete, onDelete }: {
  row: DcRow; canDelete: boolean; onDelete: (id: string, no: string) => void
}) {
  return (
    <div className={styles.cardWrap}>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.dcNo}>{row.dcNo}</span>
          <span className={styles.cardDate}>{fmtDate(row.date)}</span>
        </div>

        <div className={styles.cardCustomer}>{row.customerName ?? '—'}</div>
        {row.subject && <div className={styles.cardSubject}>{row.subject}</div>}

        <div className={styles.cardMeta}>
          <StatusBadge status={row.status} />
          <Link href={`/invoices/${row.invoiceId}` as Route} onClick={e => e.stopPropagation()} className={styles.invRef}>
            {row.invoiceNo}
          </Link>
        </div>

        <div className={styles.cardCountRow}>
          <span>{row.itemCount} item{row.itemCount !== 1 ? 's' : ''}</span>
          {row.dispatchDate && (
            <><span className={styles.dot}>·</span><span>Dispatched: {fmtDate(row.dispatchDate)}</span></>
          )}
        </div>

        <div className={styles.cardFooter}>
          <div className={styles.cardActions}>
            <Link href={`/delivery-challans/${row.id}` as Route} className={styles.btnView}>
              <Icon name="eye" size={14} /> View
            </Link>
            {canDelete && row.status === 'draft' && (
              <button className={styles.btnDelete} onClick={() => onDelete(row.id, row.dcNo)} type="button">
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
  page: DcPage; canDelete: boolean; currentPage: number; onPageChange: (p: number) => void
}

export function DcCards({ page, canDelete, currentPage, onPageChange }: Props) {
  const [, startT] = useTransition()

  function handleDelete(id: string, no: string) {
    if (!confirm(`Delete Delivery Challan ${no}? This cannot be undone.`)) return
    startT(async () => {
      const res = await deleteDeliveryChallan(id)
      if (!res.ok) alert(`Delete failed: ${res.error?.message}`)
    })
  }

  return (
    <>
      {page.rows.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="truck" size={32} />
          <p>No delivery challans found</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {page.rows.map(row => <DcCard key={row.id} row={row} canDelete={canDelete} onDelete={handleDelete} />)}
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
