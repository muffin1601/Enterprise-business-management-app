import type { VendorStats } from '../server/queries'
import styles from './vendors.module.scss'

const CARDS = (s: VendorStats) => [
  { label: 'Total Vendors',  value: s.total,       icon: 'ti-building',      accent: '' },
  { label: 'Active',         value: s.active,       icon: 'ti-circle-check',  accent: 'success',
    pct: s.total ? Math.round((s.active / s.total) * 100) : 0 },
  { label: 'Inactive',       value: s.inactive,     icon: 'ti-circle-x',      accent: 'neutral' },
  { label: 'Blacklisted',    value: s.blacklisted,  icon: 'ti-ban',
    accent: s.blacklisted > 0 ? 'danger' : 'neutral' },
  { label: 'Manufacturers',  value: s.byType['manufacturer'] ?? 0, icon: 'ti-package', accent: 'info' },
]

export function VendorStatCards({ stats }: { stats: VendorStats }) {
  return (
    <div className={styles.kpiStrip}>
      {CARDS(stats).map(c => (
        <div key={c.label} className={`${styles.kpiCard} ${styles[`kpi_${c.accent}` as keyof typeof styles] ?? ''}`}>
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
