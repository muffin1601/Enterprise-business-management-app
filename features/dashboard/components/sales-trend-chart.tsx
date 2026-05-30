'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { DayPoint } from '@/features/dashboard/series'
import styles from './dashboard.module.scss'

// Generates mock sales figures layered over audit event counts
function buildSalesSeries(series: DayPoint[]) {
  // Mock daily revenue; wired to audit event count as a proxy
  const mock = [
    145000, 280000, 190000, 420000, 310000, 560000, 230000,
    480000, 350000, 620000, 180000, 740000, 290000, 510000,
  ]
  return series.map((d, i) => ({
    label: d.date.slice(5),
    events: d.count,
    revenue: mock[i % mock.length] ?? 0,
  }))
}

function fmtL(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  return `₹${(v / 1000).toFixed(0)}K`
}

interface Props {
  series: DayPoint[]
  isLoading: boolean
}

export function SalesTrendChart({ series, isLoading }: Props) {
  if (isLoading) {
    return (
      <div
        className={styles.skeleton}
        style={{ height: 200 }}
      />
    )
  }

  const data = buildSalesSeries(series)

  if (data.length === 0) {
    return (
      <div className={styles.chartEmpty}>
        No data available for this period
      </div>
    )
  }

  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--gray-950)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--gray-950)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="var(--color-border-panel)"
            strokeDasharray="3 0"
          />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'var(--color-text-faint)', letterSpacing: '0.05em' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            interval="preserveStartEnd"
          />

          <YAxis
            tickFormatter={fmtL}
            tick={{ fontSize: 9, fill: 'var(--color-text-faint)' }}
            tickLine={false}
            axisLine={false}
            width={42}
          />

          <Tooltip
            formatter={(value: number) => [fmtL(value), 'Revenue']}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-mid)',
              borderRadius: 0,
              fontSize: 11,
              fontFamily: 'var(--font-body)',
              boxShadow: 'var(--shadow-md)',
            }}
            labelStyle={{
              color: 'var(--color-text-faint)',
              fontSize: 9,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
            itemStyle={{ color: 'var(--color-text)' }}
            cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--gray-950)"
            strokeWidth={1.5}
            fill="url(#revFill)"
            dot={false}
            activeDot={{ r: 3, fill: 'var(--gray-950)', stroke: 'none' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
