'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useTransition } from 'react'
import type { SoRow, SoPage } from '../server/queries'
import { deleteSalesOrder } from '../server/actions'
import { Icon } from '@/components/ui'
import { SO_STATUS_LABELS, SO_PRIORITY_LABELS } from '@/validations/sales-order'
import styles from './sales-orders.module.scss'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtINR = (n: number) => {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  if (n >= 1_000)      return `₹${new Intl.NumberFormat('en-IN').format(n)}`
  return `₹${n}`
}

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`so_${status}` as keyof typeof styles] ?? ''}`}>
      {SO_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'normal') return null
  return (
    <span className={`${styles.priorityBadge} ${styles[`priority_${priority}` as keyof typeof styles] ?? ''}`}>
      {SO_PRIORITY_LABELS[priority] ?? priority}
    </span>
  )
}

// ── Single card ───────────────────────────────────────────────────────────────

function SoCard({
  row,
  canDelete,
  onDelete,
}: { row: SoRow; canDelete: boolean; onDelete: (id: string, no: string) => void }) {
  return (
    <div className={styles.cardWrap}>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={styles.quoteNo}>{row.soNo}</span>
            <PriorityBadge priority={row.priority} />
          </div>
          <span className={styles.cardDate}>{fmtDate(row.date)}</span>
        </div>

        <div className={styles.cardCustomer}>{row.customerName ?? 'Unknown'}</div>
        <div className={styles.cardSubject}>
          {row.subject ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}
        </div>

        <div className={styles.cardMeta}>
          <StatusBadge status={row.status} />
          {row.advanceReceived && (
            <span className={styles.chip} title="Advance received">
              <Icon name="check-circle" size={11} /> Advance
            </span>
          )}
        </div>

        <div className={styles.cardCountRow}>
          <span>{row.locationCount} location{row.locationCount !== 1 ? 's' : ''}</span>
          <span className={styles.dot}>·</span>
          <span>{row.itemCount} item{row.itemCount !== 1 ? 's' : ''}</span>
          {row.expectedDelivery && (
            <>
              <span className={styles.dot}>·</span>
              <span>Del: {fmtDate(row.expectedDelivery)}</span>
            </>
          )}
        </div>

        <div className={styles.cardRef}>
          Ref: <Link href={`/quotes/${row.quoteId}` as Route} onClick={e => e.stopPropagation()} className={styles.quoteRef}>
            {row.quoteNo}
          </Link>
        </div>

        <div className={styles.cardFooter}>
          <span className={styles.amount}>{fmtINR(row.grandTotal)}</span>
          <div className={styles.cardActions}>
            <Link href={`/orders/${row.id}` as Route} className={styles.btnView}>
              <Icon name="eye" size={14} /> View
            </Link>
            {canDelete && ['draft', 'accepted', 'cancelled'].includes(row.status) && (
              <button
                className={styles.btnDelete}
                onClick={() => onDelete(row.id, row.soNo)}
                title="Delete"
                type="button"
              >
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card list + pagination ────────────────────────────────────────────────────

interface Props {
  page:         SoPage
  canDelete:    boolean
  currentPage:  number
  onPageChange: (p: number) => void
}

export function SoCards({ page, canDelete, currentPage, onPageChange }: Props) {
  const [, startT] = useTransition()

  function handleDelete(id: string, no: string) {
    if (!confirm(`Delete Sales Order ${no}? This cannot be undone.`)) return
    startT(async () => { await deleteSalesOrder(id) })
  }

  return (
    <>
      {page.rows.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="receipt" size={32} />
          <p>No sales orders found</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {page.rows.map(row => (
            <SoCard key={row.id} row={row} canDelete={canDelete} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {page.totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={currentPage <= 1}            onClick={() => onPageChange(currentPage - 1)}>‹ Prev</button>
          <span>Page {currentPage} of {page.totalPages}</span>
          <button disabled={currentPage >= page.totalPages} onClick={() => onPageChange(currentPage + 1)}>Next ›</button>
        </div>
      )}
    </>
  )
}
