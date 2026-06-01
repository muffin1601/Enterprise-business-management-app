import type { InventorySummary } from '@/features/items/server/queries'
import { formatMoney } from '@/lib/utils/format'
import styles from './items.module.scss'

const CARDS = (s: InventorySummary, currency: string) => [
  {
    label: 'Total Items',
    value: String(s.totalItems),
    icon: 'ti-package',
    accent: '',
  },
  {
    label: 'Stock Value',
    value: formatMoney(s.totalStockValue, currency),
    icon: 'ti-currency-rupee',
    accent: 'success',
    pct: s.totalItems ? 100 : 0,
  },
  {
    label: 'Low Stock',
    value: String(s.lowStockCount),
    icon: 'ti-alert-triangle',
    accent: s.lowStockCount > 0 ? 'warning' : 'neutral',
    pct: s.totalItems ? Math.round((s.lowStockCount / s.totalItems) * 100) : 0,
  },
  {
    label: 'Imported',
    value: String(s.importedCount),
    icon: 'ti-plane',
    accent: 'info',
    pct: s.totalItems ? Math.round((s.importedCount / s.totalItems) * 100) : 0,
  },
  {
    label: 'Domestic',
    value: String(s.totalItems - s.importedCount),
    icon: 'ti-building-factory',
    accent: 'neutral',
    pct: s.totalItems ? Math.round(((s.totalItems - s.importedCount) / s.totalItems) * 100) : 0,
  },
]

interface Props {
  summary: InventorySummary
  currency: string
}

export function InventorySummaryCards({ summary, currency }: Props) {
  const cards = CARDS(summary, currency)

  return (
    <div className={styles.kpiStrip}>
      {cards.map((c) => (
        <div
          key={c.label}
          className={`${styles.kpiCard} ${styles[`kpi_${c.accent}` as keyof typeof styles] ?? ''}`}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>{c.label}</span>
            <i className={`ti ${c.icon} ${styles.kpiIcon}`} />
          </div>
          <span className={styles.kpiNum}>{c.value}</span>
          {c.pct !== undefined && c.pct > 0 && (
            <div className={styles.kpiBar}>
              <div
                className={`${styles.kpiBarFill} ${styles[`kpiFill_${c.accent}` as keyof typeof styles] ?? ''}`}
                style={{ width: `${c.pct}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
