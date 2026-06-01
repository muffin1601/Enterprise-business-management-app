'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition, useRef } from 'react'
import type { QuoteRow, QuotePage } from '../server/queries'
import { deleteQuote } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './quotes.module.scss'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtINR = (n: number | null | undefined) => {
  if (n == null || n === 0) return '₹0'
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  if (n >= 1_000)      return `₹${new Intl.NumberFormat('en-IN').format(n)}`
  return `₹${n}`
}

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', accepted: 'Accepted', revised: 'Revised', cancelled: 'Cancelled',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[status as keyof typeof styles] ?? ''}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── Single quote card ─────────────────────────────────────────────────────────
function QuoteCard({
  row, canDelete, onDelete,
}: { row: QuoteRow; canDelete: boolean; onDelete: (id: string, no: string) => void }) {
  const locationNames = (row.locationNames ?? []).slice(0, 3)
  const extra         = (row.locationNames ?? []).length - 3

  return (
    <div className={styles.cardWrap}>
      {/* ── Card body (not clickable — use buttons below) ─── */}
      <div className={styles.cardBody}>

        {/* ── Top: quote no + REV badge ─────────────────────── */}
        <div className={styles.cardTop}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={styles.quoteNo}>{row.quoteNo}</span>
            {(row.revision ?? 0) > 0 && (
              <span className={styles.revBadge}>REV {row.revision}</span>
            )}
          </div>
        </div>

        {/* ── Customer + subject ────────────────────────────── */}
        <div className={styles.cardCustomer}>{row.customerName ?? 'Unknown'}</div>
        <div className={styles.cardSubject}>{row.subject ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}</div>

        {/* ── Meta: status + gst + chips ────────────────────── */}
        <div className={styles.cardMeta}>
          <StatusBadge status={row.status} />
          {row.gstMode === 'none' && <span className={styles.gstBadge}>No GST</span>}
          {locationNames.map((name, i) => <span key={i} className={styles.chip}>{name}</span>)}
          {extra > 0 && <span className={styles.chip}>+{extra}</span>}
        </div>

        {/* ── Count row ─────────────────────────────────────── */}
        <div className={styles.cardCountRow}>
          <span>{row.locationCount ?? 0} location{(row.locationCount ?? 0) !== 1 ? 's' : ''}</span>
          <span className={styles.dot}>·</span>
          <span>{row.itemCount ?? 0} item{(row.itemCount ?? 0) !== 1 ? 's' : ''}</span>
          {row.hasInstallation && (
            <span className={styles.installTag}>
              <Icon name="settings" size={10} />
              Installation
            </span>
          )}
        </div>

        {/* ── Amount + date ─────────────────────────────────── */}
        <div className={styles.cardFooter}>
          <span className={styles.cardAmount}>{fmtINR(row.grandTotal)}</span>
          <span className={styles.cardDate}>{fmtDate(row.date)}</span>
        </div>
      </div>

      {/* ── Action bar ────────────────────────────────────────── */}
      <div className={styles.cardActions}>
        <Link
          href={`/quotes/${row.id}/edit` as Route}
          className={styles.cardActionBtn}
          title="Open editor"
        >
          <Icon name="pencil" size={13} />
          Edit
        </Link>
        <Link
          href={`/quotes/${row.id}/preview` as Route}
          className={styles.cardActionBtn}
          title="Open preview"
        >
          <Icon name="eye" size={13} />
          Preview
        </Link>
        <a
          href={`/quotes/${row.id}/preview?print=1`}
          target="_blank"
          rel="noreferrer"
          className={styles.cardActionBtn}
          title="Print / Save as PDF"
        >
          <Icon name="download" size={13} />
          Print
        </a>
        {canDelete && (
          <button
            className={`${styles.cardActionBtn} ${styles.cardActionDanger}`}
            title={`Delete ${row.quoteNo}`}
            onClick={() => onDelete(row.id, row.quoteNo)}
          >
            <Icon name="trash" size={13} />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Grid + pagination ─────────────────────────────────────────────────────────
interface Props {
  page: QuotePage; canEdit: boolean; canDelete: boolean
  currentPage: number; onPageChange: (p: number) => void
}

export function QuoteCards({ page, canEdit, canDelete, currentPage, onPageChange }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, quoteNo: string) {
    if (!confirm(`Delete "${quoteNo}"? This action can be reversed by an admin.`)) return
    setDeletingId(id)
    start(async () => {
      const res = await deleteQuote(id)
      setDeletingId(null)
      if (!res.ok) {
        alert(`Could not delete: ${res.error.message}`)
        return
      }
      router.refresh()
    })
  }

  const { rows, total, pageSize, totalPages } = page
  const s_ = (currentPage - 1) * pageSize + 1
  const e_ = Math.min(currentPage * pageSize, total)

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="file-text" size={40} className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>No quotes found</div>
        <div className={styles.emptyBody}>Try adjusting your search or filters</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.cardGrid}>
        {rows.map((r) => (
          <div key={r.id} style={{ opacity: deletingId === r.id ? 0.35 : 1, transition: 'opacity 150ms' }}>
            <QuoteCard row={r} canDelete={canDelete} onDelete={handleDelete} />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Showing {s_}–{e_} of {total} quotes</span>
          <div className={styles.pageBtns}>
            <button className={styles.pageBtn} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
              <Icon name="chevron-left" size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ''}`} onClick={() => onPageChange(p)}>{p}</button>
            ))}
            <button className={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
              <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────
const STATUSES = [
  { key: 'all',       label: 'All' },
  { key: 'draft',     label: 'Draft' },
  { key: 'sent',      label: 'Sent' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'revised',   label: 'Revised' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

export function QuoteFilters({ total }: { total: number }) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const debounce = useRef<NodeJS.Timeout>(undefined)

  const [search, setSearch] = useState(sp.get('q') ?? '')
  const status = sp.get('status') ?? 'all'

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v === '' || v === 'all') next.delete(k); else next.set(k, v)
    })
    next.delete('page')
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => push({ q: v }), 350)
  }

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchWrap}>
        <Icon name="search" size={14} className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by quote no, subject, customer…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className={styles.tabGroup}>
        {STATUSES.map((s) => (
          <button
            key={s.key}
            className={styles.tab}
            data-active={status === s.key ? 'true' : undefined}
            onClick={() => push({ status: s.key })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <span className={styles.filterCount}>{total} quotes</span>
    </div>
  )
}
