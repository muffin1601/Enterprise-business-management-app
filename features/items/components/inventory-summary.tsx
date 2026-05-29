import type { InventorySummary } from '@/features/items/server/queries'
import { formatMoney } from '@/lib/utils/format'
import { Card } from '@/components/ui'
import styles from './items.module.scss'

/** Inventory KPI cards (stock value = stock × purchase price, low-stock flag). */
export function InventorySummaryCards({
  summary,
  currency,
}: {
  summary: InventorySummary
  currency: string
}) {
  const cards = [
    { label: 'Items', value: String(summary.totalItems) },
    { label: 'Stock value', value: formatMoney(summary.totalStockValue, currency) },
    { label: 'Low stock', value: String(summary.lowStockCount) },
    { label: 'Imported', value: String(summary.importedCount) },
  ]
  return (
    <div className={styles.kpis}>
      {cards.map((c) => (
        <Card key={c.label} className={styles.kpi}>
          <span className={styles.kpiValue}>{c.value}</span>
          <span className={styles.kpiLabel}>{c.label}</span>
        </Card>
      ))}
    </div>
  )
}
