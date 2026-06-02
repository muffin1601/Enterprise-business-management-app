'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { VendorRow, VendorPage } from '../server/queries'
import { deleteVendor } from '../server/actions'
import { VENDOR_TYPE_LABELS, VENDOR_STATUS_LABELS } from '@/validations/vendor'
import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[status as keyof typeof styles] ?? ''}`}>
      {VENDOR_STATUS_LABELS[status as keyof typeof VENDOR_STATUS_LABELS] ?? status}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={styles.typeBadge}>
      {VENDOR_TYPE_LABELS[type as keyof typeof VENDOR_TYPE_LABELS] ?? type}
    </span>
  )
}

function VendorCard({ row, canDelete, onDelete }: {
  row: VendorRow
  canDelete: boolean
  onDelete: (id: string, name: string) => void
}) {
  return (
    <div className={styles.cardWrap}>
      <Link href={`/vendors/${row.id}`} className={styles.cardLink} prefetch>
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

          <div className={styles.cardMeta}>
            <TypeBadge type={row.type} />
            {row.city && row.state && (
              <span className={styles.locationChip}>
                <Icon name="map-pin" size={11} /> {row.city}, {row.state}
              </span>
            )}
          </div>

          <div className={styles.cardContact}>
            {row.phone && (
              <div className={styles.contactRow}>
                <Icon name="phone" />
                <span>{row.phone}</span>
              </div>
            )}
            {row.email && (
              <div className={styles.contactRow}>
                <Icon name="mail" />
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

        <div className={styles.cardStrip}>
          <div className={styles.stripCell}>
            <span className={styles.stripLabel}>Payment Terms</span>
            <span className={styles.stripValue}>{row.paymentTerms.replace('_', ' ')}</span>
          </div>
          {row.industry && (
            <div className={styles.stripCell}>
              <span className={styles.stripLabel}>Industry</span>
              <span className={styles.stripValue}>{row.industry}</span>
            </div>
          )}
          {row.contactPerson && (
            <div className={styles.stripCell}>
              <span className={styles.stripLabel}>Contact</span>
              <span className={styles.stripValue}>{row.contactPerson}</span>
            </div>
          )}
        </div>
      </Link>

      {canDelete && (
        <button
          className={styles.cardDeleteBtn}
          title={`Delete ${row.name}`}
          onClick={e => { e.stopPropagation(); onDelete(row.id, row.name) }}
        >
          <Icon name="trash" />
        </button>
      )}
    </div>
  )
}

interface Props {
  page: VendorPage; canEdit: boolean; canDelete: boolean
  currentPage: number; onPageChange: (p: number) => void
}

export function VendorCards({ page, canEdit, canDelete, currentPage, onPageChange }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    start(async () => {
      const res = await deleteVendor(id)
      setDeletingId(null)
      if (!res.ok) {
        alert(`Delete failed: ${res.error?.message ?? 'Unknown error'}`)
        return
      }
      router.refresh()
    })
  }

  const { rows, total, pageSize, totalPages } = page
  const start_ = (currentPage - 1) * pageSize + 1
  const end    = Math.min(currentPage * pageSize, total)

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="building" className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>No vendors found</div>
        <div className={styles.emptyBody}>Try adjusting your search or filters</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.cardGrid}>
        {rows.map(r => (
          <div key={r.id} style={{ opacity: deletingId === r.id ? 0.35 : 1, transition: 'opacity 150ms' }}>
            <VendorCard row={r} canDelete={canDelete} onDelete={handleDelete} />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Showing {start_}–{end} of {total} vendors</span>
          <div className={styles.pageBtns}>
            <button className={styles.pageBtn} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
              <Icon name="chevron-left" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ''}`} onClick={() => onPageChange(p)}>
                {p}
              </button>
            ))}
            <button className={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
              <Icon name="chevron-right" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
