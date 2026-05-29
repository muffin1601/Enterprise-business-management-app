import Link from 'next/link'
import type { Route } from 'next'
import type { ItemDetail } from '@/features/items/server/queries'
import { computeLandedCost } from '@/lib/calc/costing'
import { formatMoney, formatQty } from '@/lib/utils/format'
import { Badge, Button, Card } from '@/components/ui'
import { DeleteItemButton } from './delete-item-button'
import { LOW_STOCK_THRESHOLD } from '@/validations/item'
import styles from './items.module.scss'

export function ItemDetailView({
  item,
  currency,
  canEdit,
  canDelete,
}: {
  item: ItemDetail
  currency: string
  canEdit: boolean
  canDelete: boolean
}) {
  const low = item.stock < LOW_STOCK_THRESHOLD
  const trail = item.isImported
    ? computeLandedCost({
        importPrice: item.importPrice ?? 0,
        exchangeRate: item.exchangeRate ?? 0,
        importDiscountPct: item.importDiscountPct ?? 0,
        transportType: item.transportType ?? undefined,
        transportValue: item.transportValue ?? 0,
        customDutyPct: item.customDutyPct ?? 0,
        profitMultiplier: item.profitMultiplier ?? 1,
      })
    : null

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>{item.name}</h1>
          <p className={styles.subtitle}>
            {item.sku || 'No SKU'} {item.isImported && <Badge tone="info">Imported</Badge>}
          </p>
        </div>
        <div className={styles.headerActions}>
          {canEdit && (
            <Link href={`/items/${item.id}/edit` as Route}>
              <Button variant="secondary" size="sm">Edit</Button>
            </Link>
          )}
          {canDelete && <DeleteItemButton id={item.id} />}
          <Link href={'/items' as Route} className={styles.back}>← Items</Link>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <Card>
          <h2 className={styles.cardTitle}>Overview</h2>
          <div className={styles.facts}>
            <Fact label="Family" value={item.family ?? '—'} />
            <Fact label="Brand" value={item.brand ?? '—'} />
            <Fact label="Unit" value={item.unit ?? '—'} />
            <Fact label="Variant" value={item.variantLabel ?? '—'} />
            <Fact label="Delivery" value={item.deliveryDays != null ? `${item.deliveryDays} days` : '—'} />
            <div className={styles.fact}>
              <span className={styles.factLabel}>Stock</span>
              <span>{low ? <Badge tone="danger">{formatQty(item.stock)}</Badge> : formatQty(item.stock)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className={styles.cardTitle}>Pricing</h2>
          <div className={styles.facts}>
            <Fact label="Purchase / cost" value={formatMoney(item.purchasePrice, currency)} />
            <Fact label="Selling price" value={formatMoney(item.sellingPrice, currency)} />
            <Fact label="Last purchase" value={formatMoney(item.lastPurchasePrice, currency)} />
          </div>

          {trail && (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <h3 className={styles.sectionTitle}>Landed-cost breakdown</h3>
              <div className={styles.trail}>
                <Trail label={`Base (${item.importCurrency} × rate)`} value={formatMoney(trail.base, currency)} />
                <Trail label="After discount" value={formatMoney(trail.afterDiscount, currency)} />
                <Trail label="Transport" value={formatMoney(trail.transport, currency)} />
                <Trail label="Cost price" value={formatMoney(trail.costPrice, currency)} total />
                <Trail label="Selling price" value={formatMoney(trail.sellingPrice, currency)} total />
              </div>
            </div>
          )}
        </Card>
      </div>

      {item.variations.length > 0 && (
        <Card>
          <h2 className={styles.cardTitle}>Variations</h2>
          <div className={styles.facts}>
            {item.variations.map((v) => (
              <div key={v.id} className={styles.fact}>
                <span>{[v.size, v.finish, v.make, v.brand].filter(Boolean).join(' · ') || '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
function Trail({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={styles.trailRow}>
      <span className={styles.trailLabel}>{label}</span>
      <span className={`${styles.trailValue} ${total ? styles.trailTotal : ''}`}>{value}</span>
    </div>
  )
}
