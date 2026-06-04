import type { SoStats } from '../server/queries'
import styles from './sales-orders.module.scss'

const fmtINR = (n: number) => {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

interface StatCardProps { label: string; value: number | string; color?: string }

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={styles.statCard} style={color ? { '--stat-color': color } as React.CSSProperties : undefined}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

export function SoStats({ stats }: { stats: SoStats }) {
  return (
    <div className={styles.statsRow}>
      <StatCard label="Total Orders"   value={stats.total}     color="var(--c-blue)" />
      <StatCard label="Draft"          value={stats.draft}     color="var(--c-orange)" />
      <StatCard label="Sent"           value={stats.sent}      color="var(--c-purple)" />
      <StatCard label="Accepted"       value={stats.accepted}  color="var(--c-green)" />
      <StatCard label="Cancelled"      value={stats.cancelled} color="var(--c-red)" />
      <StatCard label="Total Value"    value={fmtINR(stats.totalValue)} color="var(--c-indigo)" />
    </div>
  )
}
