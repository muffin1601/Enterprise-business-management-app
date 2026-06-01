'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { ItemRow, ItemPage } from '../server/queries'
import { deleteItem } from '../server/actions'
import { LOW_STOCK_THRESHOLD } from '@/validations/item'
import { Icon } from '@/components/ui'
import styles from './items.module.scss'

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtPrice(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}
function fmtStock(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)
}

// ── Single item card ───────────────────────────────────────────────────────────
function ItemCard({
  row, currency, canDelete, onDelete,
}: {
  row: ItemRow; currency: string; canDelete: boolean; onDelete: (id: string, name: string) => void
}) {
  const [imgErr, setImgErr] = useState(false)
  const isLow = row.stock > 0 && row.stock < LOW_STOCK_THRESHOLD
  const isOut = row.stock <= 0

  const stockPct = Math.min(100, (row.stock / Math.max(row.stock, 500)) * 100)

  return (
    <div className={styles.itemCard}>
      {/* delete btn */}
      {canDelete && (
        <button
          className={styles.cardDeleteBtn}
          onClick={(e) => { e.preventDefault(); onDelete(row.id, row.name) }}
          title="Delete"
        >
          <Icon name="trash" />
        </button>
      )}

      <Link href={`/items/${row.id}` as Route} className={styles.itemCardLink}>
        {/* Image */}
        <div className={styles.itemCardImg}>
          {row.imageUrl && !imgErr ? (
            <img src={row.imageUrl} alt={row.name} onError={() => setImgErr(true)} />
          ) : (
            <span className={styles.itemCardNoImg}>NO IMAGE</span>
          )}
        </div>

        {/* Body */}
        <div className={styles.itemCardBody}>
          <div className={styles.itemCardSku}>{row.sku ?? '—'}</div>
          <div className={styles.itemCardName}>{row.name}</div>

          {/* Price */}
          <div className={styles.itemCardPrice}>
            <span className={styles.itemCardPriceVal}>
              ₹ {fmtPrice(row.sellingPrice ?? row.purchasePrice)}
            </span>
            {row.unit && <span className={styles.itemCardPriceUnit}>per {row.unit}</span>}
          </div>

          {/* Stock */}
          <div className={styles.itemCardStockRow}>
            <span className={styles.itemCardStockLabel}>Stock</span>
            <span className={`${styles.itemCardStockVal} ${isOut ? styles.stockOut : isLow ? styles.stockLow : ''}`}>
              {fmtStock(row.stock)}{row.unit ? ` ${row.unit}` : ''}
            </span>
          </div>
          <div className={styles.itemCardStockBar}>
            <div
              className={styles.itemCardStockFill}
              style={{ width: `${stockPct}%` }}
              data-low={isLow ? 'true' : undefined}
              data-out={isOut ? 'true' : undefined}
            />
          </div>

          {/* Tags */}
          <div className={styles.itemCardTags}>
            <span className={`${styles.itemCardTag} ${row.isImported ? styles.tagImported : styles.tagDomestic}`}>
              {row.isImported ? 'Imported' : 'Domestic'}
            </span>
            {row.brand && <span className={styles.itemCardTag}>{row.brand}</span>}
            {row.family && <span className={`${styles.itemCardTag} ${styles.tagFamily}`}>{row.family}</span>}
          </div>
        </div>
      </Link>
    </div>
  )
}

// ── Grid ───────────────────────────────────────────────────────────────────────
interface Props {
  page: ItemPage; currency: string; canDelete: boolean
  currentPage: number; onPageChange: (p: number) => void
}

export function ItemCards({ page, currency, canDelete, currentPage, onPageChange }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    setDeletingId(id)
    start(async () => {
      await deleteItem(id)
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
        <Icon name="package" className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>No items found</div>
        <div className={styles.emptyBody}>Try adjusting your search or filters</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.itemCardGrid}>
        {rows.map((r) => (
          <div key={r.id} style={{ opacity: deletingId === r.id ? 0.35 : 1, transition: 'opacity 150ms' }}>
            <ItemCard row={r} currency={currency} canDelete={canDelete} onDelete={handleDelete} />
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
