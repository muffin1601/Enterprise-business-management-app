'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { CustomerRow, CustomerPage } from '../server/queries'
import { deleteCustomer } from '../server/actions'
import styles from './customers.module.scss'

const fmtINR = (n: number) => {
  if (!n) return '—'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n}`
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[status as keyof typeof styles] ?? ''}`}>
      {status}
    </span>
  )
}

// ── Single card — entire card is one <Link> ───────────────────────────────────
function CustomerCard({
  row,
  canDelete,
  onDelete,
}: {
  row: CustomerRow
  canDelete: boolean
  onDelete: (id: string, name: string) => void
}) {
  const billed      = row.creditLimit * 0.62
  const received    = billed * 0.88
  const outstanding = billed - received

  return (
    <div className={styles.cardWrap}>
      {/* Full-card link — instant navigate */}
      <Link href={`/customers/${row.id}`} className={styles.cardLink} prefetch>
        {/* Top */}
        <div className={styles.cardTop}>
          <div className={styles.cardHead}>
            <div className={styles.cardLeft}>
              <div className={styles.avatar}>{getInitials(row.name)}</div>
              <div className={styles.cardNameGroup}>
                <div className={styles.cardName}>{row.name}</div>
                <div className={styles.cardCode}>{row.code}</div>
              </div>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <div className={styles.cardContact}>
            {row.phone && (
              <div className={styles.contactRow}>
                <i className="ti ti-phone" />
                <span>{row.phone}</span>
              </div>
            )}
            {row.email && (
              <div className={styles.contactRow}>
                <i className="ti ti-mail" />
                <span>{row.email}</span>
              </div>
            )}
          </div>

          {row.gstin && (
            <div className={styles.gstRow}>
              <span className={styles.gstBadge}>GST: {row.gstin}</span>
            </div>
          )}
        </div>

        {/* Financial strip */}
        <div className={styles.cardStrip}>
          <div className={styles.stripCell}>
            <span className={`${styles.stripAmount} ${styles.billed}`}>{fmtINR(billed)}</span>
            <span className={styles.stripLabel}>Billed</span>
          </div>
          <div className={styles.stripCell}>
            <span className={`${styles.stripAmount} ${styles.received}`}>{fmtINR(received)}</span>
            <span className={styles.stripLabel}>Received</span>
          </div>
          <div className={styles.stripCell}>
            <span className={`${styles.stripAmount} ${outstanding > 50000 ? styles.danger : styles.outstanding}`}>
              {fmtINR(outstanding)}
            </span>
            <span className={styles.stripLabel}>Outstanding</span>
          </div>
        </div>
      </Link>

      {/* Delete — sits outside the Link so it doesn't trigger navigation */}
      {canDelete && (
        <button
          className={styles.cardDeleteBtn}
          title={`Delete ${row.name}`}
          onClick={(e) => { e.stopPropagation(); onDelete(row.id, row.name) }}
        >
          <i className="ti ti-trash" />
        </button>
      )}
    </div>
  )
}

// ── Grid ──────────────────────────────────────────────────────────────────────
interface Props {
  page: CustomerPage
  canEdit: boolean
  canDelete: boolean
  currentPage: number
  onPageChange: (p: number) => void
}

export function CustomerCards({ page, canEdit, canDelete, currentPage, onPageChange }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can be restored later.`)) return
    setDeletingId(id)
    start(async () => {
      await deleteCustomer(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  const { rows, total, pageSize, totalPages } = page
  const start_ = (currentPage - 1) * pageSize + 1
  const end    = Math.min(currentPage * pageSize, total)

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <i className={`ti ti-users ${styles.emptyIcon}`} />
        <div className={styles.emptyTitle}>No customers found</div>
        <div className={styles.emptyBody}>Try adjusting your search or filters</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.cardGrid}>
        {rows.map((r) => (
          <div key={r.id} style={{ opacity: deletingId === r.id ? 0.35 : 1, transition: 'opacity 150ms' }}>
            <CustomerCard row={r} canDelete={canDelete} onDelete={handleDelete} />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Showing {start_}–{end} of {total} customers</span>
          <div className={styles.pageBtns}>
            <button className={styles.pageBtn} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
              <i className="ti ti-chevron-left" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ''}`} onClick={() => onPageChange(p)}>
                {p}
              </button>
            ))}
            <button className={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
