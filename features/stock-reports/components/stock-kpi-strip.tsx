import type { StockDashboardStats } from '../server/queries'
import styles from './stock-reports.module.scss'

const fmtINR = (n: number) => {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(Math.round(n))}`
}

export function StockKpiStrip({ stats }: { stats: StockDashboardStats }) {
  const cards = [
    {
      label: 'Total Items',
      value: stats.totalItems,
      sub:   null,
      accent:'',
    },
    {
      label: 'In Stock',
      value: stats.inStockCount,
      sub:   `${stats.totalItems ? Math.round((stats.inStockCount / stats.totalItems) * 100) : 0}% of catalogue`,
      accent:'success',
    },
    {
      label: 'Low Stock',
      value: stats.lowStockCount,
      sub:   'Below reorder level',
      accent: stats.lowStockCount > 0 ? 'warning' : 'neutral',
    },
    {
      label: 'Out of Stock',
      value: stats.outOfStockCount,
      sub:   'Zero stock',
      accent: stats.outOfStockCount > 0 ? 'danger' : 'neutral',
    },
    {
      label: 'Portfolio Value',
      value: fmtINR(stats.totalPurchaseValue),
      sub:   'At purchase price',
      accent:'',
      isStr: true,
    },
    {
      label: 'Selling Value',
      value: fmtINR(stats.totalSellingValue),
      sub:   `Margin: ${fmtINR(stats.totalMargin)}`,
      accent:'info',
      isStr: true,
    },
  ]

  return (
    <div className={styles.kpiStrip}>
      {cards.map(c => (
        <div key={c.label} className={`${styles.kpiCard} ${c.accent ? styles[`kpi_${c.accent}` as keyof typeof styles] : ''}`}>
          <div className={styles.kpiLabel}>{c.label}</div>
          <div className={styles.kpiValue}>{c.value}</div>
          {c.sub && <div className={styles.kpiSub}>{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}
