'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import styles from './stock-reports.module.scss'

const fmtINR = (v: number) => {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`
  return `₹${v}`
}

interface ChartItem { name: string; purchaseValue: number; sellingValue: number }

export function StockValueChart({ data }: { data: ChartItem[] }) {
  if (data.length === 0) return null

  // Truncate long names
  const chartData = data.map(d => ({
    ...d,
    shortName: d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name,
  }))

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartTitle}>Top Items by Stock Value</div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
          <XAxis
            dataKey="shortName"
            tick={{ fontFamily:'var(--font-body)', fontSize: 10, fill: 'var(--c-tertiary)' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={fmtINR}
            tick={{ fontFamily:'var(--font-mono)', fontSize: 10, fill: 'var(--c-tertiary)' }}
            width={60}
          />
          <Tooltip
            formatter={(value: number, name: string) => [fmtINR(value), name === 'purchaseValue' ? 'Purchase Value' : 'Selling Value']}
            labelFormatter={(label: string) => label}
            contentStyle={{ fontFamily:'var(--font-body)', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 4 }}
          />
          <Legend
            formatter={v => v === 'purchaseValue' ? 'Purchase Value' : 'Selling Value'}
            wrapperStyle={{ fontFamily:'var(--font-body)', fontSize: 11 }}
          />
          <Bar dataKey="purchaseValue" fill="var(--c-ink)"    radius={[3,3,0,0]} maxBarSize={40} />
          <Bar dataKey="sellingValue"  fill="var(--c-success)" radius={[3,3,0,0]} maxBarSize={40} opacity={0.75} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
