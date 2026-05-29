import Link from 'next/link'
import type { Route } from 'next'
import type { ItemRow } from '@/features/items/server/queries'
import { Badge, Card } from '@/components/ui'
import { formatMoney, formatQty } from '@/lib/utils/format'
import styles from './items.module.scss'

/** Item catalogue table (presentational; rows from a paged, filtered query). */
export function ItemList({ rows, currency }: { rows: ItemRow[]; currency: string }) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className={styles.empty}>No items match your filters.</p>
      </Card>
    )
  }
  return (
    <Card>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Family</th>
              <th>Brand</th>
              <th className={styles.num}>Stock</th>
              <th className={styles.num}>Cost</th>
              <th className={styles.num}>Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={styles.row}>
                <td>
                  <div className={styles.itemName}>{r.name}</div>
                  <div className={styles.itemSub}>
                    {r.sku || 'No SKU'}
                    {r.isImported ? ' · Imported' : ''}
                    {r.variantLabel ? ` · ${r.variantLabel}` : ''}
                  </div>
                </td>
                <td>{r.family ?? '—'}</td>
                <td>{r.brand ?? '—'}</td>
                <td className={styles.num}>
                  {r.lowStock ? (
                    <Badge tone="danger">{formatQty(r.stock)}</Badge>
                  ) : (
                    formatQty(r.stock)
                  )}
                </td>
                <td className={styles.num}>{formatMoney(r.purchasePrice, currency)}</td>
                <td className={styles.num}>{formatMoney(r.sellingPrice, currency)}</td>
                <td className={styles.linkCell}>
                  <Link href={`/items/${r.id}` as Route}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
