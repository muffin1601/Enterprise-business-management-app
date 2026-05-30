import type { InventoryKPIs } from '../server/queries'
import styles from './inventory.module.scss'

const fmtINR = (n: number) => {
  if (n >= 10_000_000) return `₹${(n/10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n/100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

export function InventoryKpiCards({ kpis }: { kpis: InventoryKPIs }) {
  const cards = [
    { label:'Total Items',      value:kpis.totalItems,                       icon:'ti-box',            accent:'' },
    { label:'Active Items',     value:kpis.activeItems,                      icon:'ti-circle-check',   accent:'success' },
    { label:'Out of Stock',     value:kpis.outOfStock,                       icon:'ti-alert-circle',   accent: kpis.outOfStock > 0 ? 'danger' : '' },
    { label:'Low Stock',        value:kpis.lowStock,                         icon:'ti-alert-triangle', accent: kpis.lowStock > 0 ? 'warning' : '' },
    { label:'Reorder Required', value:kpis.reorderRequired,                  icon:'ti-truck',          accent: kpis.reorderRequired > 0 ? 'warning' : '' },
    { label:'Inventory Value',  value:fmtINR(kpis.inventoryValue),           icon:'ti-currency-rupee', accent:'', isStr:true },
    { label:'Selling Value',    value:fmtINR(kpis.sellingValue),             icon:'ti-chart-line',     accent:'success', isStr:true },
  ]

  return (
    <div className={styles.kpiStrip}>
      {cards.map(c => (
        <div key={c.label} className={`${styles.kpiCard} ${c.accent ? styles[c.accent] : ''}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>{c.label}</span>
            <i className={`ti ${c.icon} ${styles.kpiIcon}`} />
          </div>
          <span className={styles.kpiNum} style={c.isStr ? { fontSize: 22 } : {}}>
            {c.isStr ? String(c.value) : Number(c.value)}
          </span>
        </div>
      ))}
    </div>
  )
}
