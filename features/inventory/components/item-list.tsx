'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { ItemRow, ItemPage } from '../server/queries'
import { deleteItem } from '../server/actions'
import styles from './inventory.module.scss'

const fmtINR = (n: number | null) => {
  if (n == null || n === 0) return '—'
  if (n >= 100_000) return `₹${(n/100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

function StockCell({ row }: { row: ItemRow }) {
  const pct = row.reorderLevel > 0 ? Math.min(100, (row.stock / row.reorderLevel) * 50) : 100
  const cls = row.isOutOfStock ? 'out' : row.isLowStock ? 'low' : 'ok'
  return (
    <div>
      <span className={`${styles.stockBadge} ${styles[cls]}`}>
        {row.isOutOfStock ? 'Out' : row.isLowStock ? 'Low' : ''}
        {row.stock > 0 ? ` ${row.stock} ${row.unit ?? ''}` : row.isOutOfStock ? ' of stock' : ''}
      </span>
      {!row.isOutOfStock && row.reorderLevel > 0 && (
        <div className={styles.stockBar}>
          <div className={`${styles.stockBarFill} ${styles[cls]}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

interface Props {
  page: ItemPage
  canEdit: boolean
  canDelete: boolean
  currentPage: number
  sort: string
  order: string
  onSort: (col: string) => void
  onPageChange: (p: number) => void
}

export function ItemList({ page, canEdit, canDelete, currentPage, sort, order, onSort, onPageChange }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Archive "${name}"?`)) return
    setDeletingId(id)
    start(async () => { await deleteItem(id); setDeletingId(null); router.refresh() })
  }

  const { rows, total, pageSize, totalPages } = page
  const start_ = (currentPage - 1) * pageSize + 1
  const end    = Math.min(currentPage * pageSize, total)

  function SortTh({ col, label, right }: { col: string; label: string; right?: boolean }) {
    const active = sort === col
    return (
      <th className={`${styles.th} ${styles.sortable} ${right ? styles.right : ''}`} onClick={() => onSort(col)}>
        {label} {active ? (order === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={styles.tableWrap}>
        <div className={styles.emptyTable}>No items found — try adjusting filters</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <SortTh col="sku"            label="SKU" />
              <SortTh col="name"           label="Item" />
              <th className={styles.th}>Category</th>
              <th className={styles.th}>Brand</th>
              <th className={styles.th}>Unit</th>
              <th className={styles.th}>GST</th>
              <SortTh col="purchase_price" label="Purchase"  right />
              <SortTh col="selling_price"  label="Selling"   right />
              <SortTh col="stock"          label="Stock"     right />
              <th className={styles.th}>Status</th>
              <th className={`${styles.th} ${styles.right}`} />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={styles.row} style={{ opacity: deletingId === r.id ? 0.35 : 1 }}>
                <td className={`${styles.td} ${styles.mono}`}>
                  {r.sku ?? <span style={{ color: 'var(--c-border-2)' }}>—</span>}
                </td>
                <td className={styles.td}>
                  <Link href={`/inventory/items/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div className={styles.itemName}>{r.name}</div>
                    {r.variantLabel && <div className={styles.itemMeta}>{r.variantLabel}</div>}
                    {r.hsnCode && <div className={styles.itemMeta}>HSN: {r.hsnCode}</div>}
                  </Link>
                </td>
                <td className={styles.td}>{r.family ?? '—'}</td>
                <td className={styles.td}>{r.brand ?? '—'}</td>
                <td className={styles.td}>{r.unit ?? '—'}</td>
                <td className={`${styles.td} ${styles.mono}`}>{r.gstRate}%</td>
                <td className={`${styles.td} ${styles.right} ${styles.mono}`}>{fmtINR(r.purchasePrice)}</td>
                <td className={`${styles.td} ${styles.right} ${styles.mono}`}>{fmtINR(r.sellingPrice)}</td>
                <td className={`${styles.td} ${styles.right}`}><StockCell row={r} /></td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${styles[r.isActive ? 'active' : 'inactive']}`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {r.isImported && <span className={`${styles.badge} ${styles.imported}`} style={{ marginLeft: 4 }}>Import</span>}
                </td>
                <td className={`${styles.td} ${styles.right}`}>
                  <div className={styles.rowActions}>
                    <Link href={`/inventory/items/${r.id}`} className={styles.iconBtn} title="View"><i className="ti ti-eye" /></Link>
                    {canEdit && <Link href={`/inventory/items/${r.id}/edit`} className={styles.iconBtn} title="Edit"><i className="ti ti-pencil" /></Link>}
                    {canDelete && <button className={styles.iconBtn} onClick={() => handleDelete(r.id, r.name)} title="Archive"><i className="ti ti-archive" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Showing {start_}–{end} of {total} items</span>
          <div className={styles.pageBtns}>
            <button className={styles.pageBtn} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}><i className="ti ti-chevron-left" /></button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`${styles.pageBtn} ${p === currentPage ? styles.active : ''}`} onClick={() => onPageChange(p)}>{p}</button>
            ))}
            <button className={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}><i className="ti ti-chevron-right" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
