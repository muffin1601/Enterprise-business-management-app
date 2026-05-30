import type { CustomerStats } from '../server/queries'
import styles from './customers.module.scss'

const CARDS = (s: CustomerStats) => [
  {
    label: 'Total Customers',
    value: s.total,
    icon:  'ti-users',
    accent:'',
  },
  {
    label: 'Active',
    value: s.active,
    icon:  'ti-circle-check',
    accent:'success',
    pct:   s.total ? Math.round((s.active / s.total) * 100) : 0,
  },
  {
    label: 'Inactive',
    value: s.inactive,
    icon:  'ti-circle-x',
    accent:'neutral',
  },
  {
    label: 'Blocked',
    value: s.blocked,
    icon:  'ti-ban',
    accent: s.blocked > 0 ? 'danger' : 'neutral',
  },
  {
    label: 'On Credit',
    value: s.withCredit,
    icon:  'ti-credit-card',
    accent:'info',
    pct:   s.total ? Math.round((s.withCredit / s.total) * 100) : 0,
  },
]

interface Props { stats: CustomerStats }

export function CustomerStatCards({ stats }: Props) {
  const cards = CARDS(stats)

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
