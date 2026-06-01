'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { ItemRow, ItemPage } from '../server/queries'
import { deleteItem } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './inventory.module.scss'

const fmtINR = (n: number | null) => {
  if (n == null || n === 0) return '—'
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

function getStockClass(row: ItemRow): 'ok' | 'low' | 'out' {
  if (row.isOutOfStock) return 'out'
  if (row.isLowStock)   return 'low'
  return 'ok'
}

function getStockPct(row: ItemRow): number {
  if (row.isOutOfStock) return 0
  if (row.reorderLevel > 0) return Math.min(100, (row.stock / (row.reorderLevel * 2)) * 100)
  return 80
}

// ── Single card — Screenshot 4 design ─────────────────────────────────────────
function ItemCard({
  row,
  canEdit,
  canDelete,
  onDelete,
}: {
  row: ItemRow
  canEdit: boolean
  canDelete: boolean
  onDelete: (id: string, name: string) => void
}) {
  const sc  = getStockClass(row)
  const pct = getStockPct(row)

  const stockLabel = row.isOutOfStock
    ? 'Out of Stock'
    : `${new Intl.NumberFormat('en-IN').format(row.stock)} ${row.unit ?? ''}`

  return (
    <div className={styles.itemCard}>
      {/* Image area */}
      <div className={styles.cardImage}>
        {row.imageUrl ? (
          <img src={row.imageUrl} alt={row.name} />
        ) : (
          <div className={styles.noImage}>
            <Icon name="photo-off" />
            <span>No Image</span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className={styles.cardOverlay}>
          <Link href={`/inventory/items/${row.id}`} className={styles.cardOverlayBtn} title="View">
            <Icon name="eye" />
          </Link>
          {canEdit && (
            <Link href={`/inventory/items/${row.id}/edit`} className={styles.cardOverlayBtn} title="Edit">
              <Icon name="pencil" />
            </Link>
          )}
          {canDelete && (
            <button
              className={styles.cardOverlayBtn}
              title="Archive"
              onClick={() => onDelete(row.id, row.name)}
            >
              <Icon name="archive" />
            </button>
          )}
        </div>
      </div>

      {/* Card body */}
      <Link href={`/inventory/items/${row.id}`} style={{ textDecoration: 'none', display: 'contents' }}>
        <div className={styles.cardBody}>
          {/* SKU */}
          {row.sku && <div className={styles.cardSku}>{row.sku}</div>}

          {/* Name */}
          <div className={styles.cardName}>{row.name}</div>

          {/* Price */}
          <div className={styles.cardPrice}>
            <span className={styles.cardPriceValue}>
              {fmtINR(row.sellingPrice)}
            </span>
            {row.unit && row.sellingPrice && (
              <span className={styles.cardPriceUnit}>per {row.unit}</span>
            )}
          </div>

          {/* Stock */}
          <div>
            <div className={styles.cardStock}>
              <span className={styles.cardStockLabel}>Stock</span>
              <span className={`${styles.cardStockValue} ${styles[sc]}`}>
                {stockLabel}
              </span>
            </div>
            <div className={styles.cardStockBar}>
              <div
                className={`${styles.cardStockBarFill} ${styles[sc]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Tags */}
          <div className={styles.cardTags}>
            <span className={`${styles.cardTag} ${row.isImported ? styles.imported : styles.domestic}`}>
              {row.isImported ? 'Imported' : 'Domestic'}
            </span>
            {row.brand && (
              <span className={`${styles.cardTag} ${styles.brand}`}>{row.brand}</span>
            )}
            {row.isLowStock && !row.isOutOfStock && (
              <span className={`${styles.cardTag} ${styles.lowstock}`}>Low Stock</span>
            )}
            {row.isOutOfStock && (
              <span className={`${styles.cardTag} ${styles.outstock}`}>Out of Stock</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}

// ── Card grid + pagination ─────────────────────────────────────────────────────
interface Props {
  page: ItemPage
  canEdit: boolean
  canDelete: boolean
  currentPage: number
  onPageChange: (p: number) => void
}

export function ItemCards({ page, canEdit, canDelete, currentPage, onPageChange }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Archive "${name}"? It can be restored later.`)) return
    setDeletingId(id)
    start(async () => { await deleteItem(id); setDeletingId(null); router.refresh() })
  }

  const { rows, total, pageSize, totalPages } = page
  const start_ = (currentPage - 1) * pageSize + 1
  const end    = Math.min(currentPage * pageSize, total)

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="box" />
        <div className={styles.emptyTitle}>No items found</div>
        <div className={styles.emptyBody}>Try adjusting your search or filters</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className={styles.cardGrid}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{ opacity: deletingId === r.id ? 0.35 : 1, transition: 'opacity 150ms' }}
          >
            <ItemCard
              row={r}
              canEdit={canEdit}
              canDelete={canDelete}
              onDelete={handleDelete}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Showing {start_}–{end} of {total} items</span>
          <div className={styles.pageBtns}>
            <button className={styles.pageBtn} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
              <Icon name="chevron-left" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${p === currentPage ? styles.active : ''}`}
                onClick={() => onPageChange(p)}
              >
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
