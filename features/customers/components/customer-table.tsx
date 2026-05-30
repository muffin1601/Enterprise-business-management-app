'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { CustomerRow, CustomerPage } from '../server/queries'
import { deleteCustomer } from '../server/actions'
import { CUSTOMER_TYPE_LABELS, PAYMENT_TERMS_LABELS } from '@/validations/customer'
import styles from './customers.module.scss'

// ── Helpers ───────────────────────────────────────────────────────────────────
function relDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCredit(n: number) {
  if (!n) return '—'
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.badge} ${styles[status as keyof typeof styles] ?? ''}`}>
      {status}
    </span>
  )
}

// ── Sort state ────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'code' | 'status' | 'created_at'

interface Props {
  page: CustomerPage
  canEdit: boolean
  canDelete: boolean
  currentPage: number
  sort: SortKey
  order: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  onPageChange: (p: number) => void
}

export function CustomerTable({
  page,
  canEdit,
  canDelete,
  currentPage,
  sort,
  order,
  onSort,
  onPageChange,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can be restored later.`)) return
    setDeletingId(id)
    startTransition(async () => {
      await deleteCustomer(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  function SortTh({ col, label }: { col: SortKey; label: string }) {
    const active = sort === col
    const nextOrder = active && order === 'asc' ? 'desc' : 'asc'
    return (
      <th
        className={`${styles.th} ${styles.sortable}`}
        onClick={() => onSort(col)}
        aria-sort={active ? order : undefined}
      >
        <span className={styles.thSort}>
          {label}
          <i
            className={`ti ti-arrows-sort ${styles.sortIcon} ${active ? styles.sortActive : ''}`}
          />
        </span>
      </th>
    )
  }

  if (page.rows.length === 0) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>Customer</th>
              <th className={styles.th}>Contact</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Credit Limit</th>
              <th className={styles.th}>Terms</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.emptyRow}>
              <td colSpan={7}>No customers found</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  const { rows, total, pageSize, totalPages } = page
  const start = (currentPage - 1) * pageSize + 1
  const end   = Math.min(currentPage * pageSize, total)

  return (
    <div className={styles.page} style={{ gap: 10 }}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <SortTh col="name"       label="Customer" />
              <th className={styles.th}>Contact</th>
              <th className={styles.th}>Type</th>
              <th className={`${styles.th} ${styles.right}`}>Credit Limit</th>
              <th className={styles.th}>Terms</th>
              <SortTh col="status"     label="Status" />
              <SortTh col="created_at" label="Added" />
              <th className={`${styles.th} ${styles.right}`}></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={styles.row}
                style={{ opacity: deletingId === r.id ? 0.4 : 1 }}
              >
                <td className={styles.td}>
                  <Link href={`/customers/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div className={styles.customerName}>{r.name}</div>
                    <div className={styles.customerCode}>{r.code}</div>
                    {r.gstin && (
                      <div className={styles.cellMeta}>GST: {r.gstin}</div>
                    )}
                  </Link>
                </td>

                <td className={styles.td}>
                  {r.contactPerson && (
                    <div className={styles.customerName} style={{ fontWeight: 400 }}>
                      {r.contactPerson}
                    </div>
                  )}
                  {r.phone && <div className={styles.cellMeta}>{r.phone}</div>}
                  {r.email && <div className={styles.cellMeta}>{r.email}</div>}
                </td>

                <td className={styles.td}>
                  {CUSTOMER_TYPE_LABELS[r.type as keyof typeof CUSTOMER_TYPE_LABELS] ?? r.type}
                </td>

                <td className={`${styles.td} ${styles.right} ${styles.mono}`}>
                  {fmtCredit(r.creditLimit)}
                </td>

                <td className={styles.td}>
                  {PAYMENT_TERMS_LABELS[r.paymentTerms as keyof typeof PAYMENT_TERMS_LABELS] ?? r.paymentTerms}
                </td>

                <td className={styles.td}>
                  <StatusBadge status={r.status} />
                </td>

                <td className={styles.td}>{relDate(r.createdAt)}</td>

                <td className={`${styles.td} ${styles.right}`}>
                  <div className={styles.rowActions}>
                    <Link href={`/customers/${r.id}`}>
                      <IconButton title="View"><i className="ti ti-eye" /></IconButton>
                    </Link>
                    {canEdit && (
                      <Link href={`/customers/${r.id}/edit`}>
                        <IconButton title="Edit"><i className="ti ti-pencil" /></IconButton>
                      </Link>
                    )}
                    {canDelete && (
                      <IconButton
                        title="Delete"
                        onClick={() => handleDelete(r.id, r.name)}
                        disabled={deletingId === r.id}
                      >
                        <i className="ti ti-trash" />
                      </IconButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          Showing {start}–{end} of {total} customers
        </span>

        <div className={styles.pageBtns}>
          <button
            className={styles.pageBtn}
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <i className="ti ti-chevron-left" />
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1
            return (
              <button
                key={p}
                className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
          })}

          <button
            className={styles.pageBtn}
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <i className="ti ti-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small inline icon button ──────────────────────────────────────────────────
function IconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  title?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--color-text-faint)',
        fontSize: 15,
        padding: '3px 4px',
        display: 'flex',
        alignItems: 'center',
        transition: 'color 120ms',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget.style.color = 'var(--color-text)') }}
      onMouseLeave={(e) => { (e.currentTarget.style.color = 'var(--color-text-faint)') }}
    >
      {children}
    </button>
  )
}
