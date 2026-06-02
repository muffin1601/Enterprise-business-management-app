import type { TeamStats } from '../server/queries'
import styles from './team.module.scss'

export function TeamStats({ stats }: { stats: TeamStats }) {
  const cards = [
    { label: 'Total Members',   value: stats.total,          accent: '' },
    { label: 'Active',          value: stats.active,         accent: 'success' },
    { label: 'Inactive',        value: stats.inactive,       accent: stats.inactive > 0 ? 'warning' : 'neutral' },
    { label: 'Pending Invites', value: stats.pendingInvites, accent: stats.pendingInvites > 0 ? 'info' : 'neutral' },
    { label: 'Custom Roles',    value: stats.roles,          accent: '' },
  ]

  return (
    <div className={styles.statsStrip}>
      {cards.map(c => (
        <div key={c.label} className={`${styles.statCard} ${c.accent ? styles[`stat_${c.accent}` as keyof typeof styles] : ''}`}>
          <div className={styles.statLabel}>{c.label}</div>
          <div className={styles.statValue}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}
