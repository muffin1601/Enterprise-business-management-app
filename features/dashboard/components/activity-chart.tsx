'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useActivity } from '@/features/dashboard/hooks'
import { Card } from '@/components/ui'
import styles from './dashboard.module.scss'

/** Audit-event volume over the last 14 days (real audit_logs data). */
export function ActivityChart() {
  const { data, isLoading } = useActivity()
  const series = (data?.series ?? []).map((d) => ({
    ...d,
    // short axis label e.g. "05-29"
    label: d.date.slice(5),
  }))

  return (
    <Card>
      <div className={styles.widgetHeader}>
        <h2 className={styles.widgetTitle}>Activity (14 days)</h2>
      </div>

      {isLoading ? (
        <div className={styles.skeleton} style={{ height: 220 }} />
      ) : !data?.canView ? (
        <p className={styles.empty}>Activity is visible to admins with audit access.</p>
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="actFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--color-text-subtle)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                allowDecimals={false}
                width={28}
                tick={{ fontSize: 11, fill: 'var(--color-text-subtle)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: 'var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--color-text-muted)' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Events"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#actFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
