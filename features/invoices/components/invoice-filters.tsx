'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { INV_STATUS_LABELS } from '@/validations/invoice'
import styles from './invoices.module.scss'

const ALL_STATUSES = Object.keys(INV_STATUS_LABELS)

export function InvoiceFilters() {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const status  = sp.get('status') ?? 'all'
  const overdue = sp.get('overdue') === '1'
  const q       = sp.get('q') ?? ''
  const sort    = sp.get('sort') ?? 'date'
  const order   = sp.get('order') ?? 'desc'

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all' && v !== '') next.set(k, v)
      else next.delete(k)
    })
    next.delete('page')
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  return (
    <div className={styles.filtersBar}>
      <input
        className={styles.searchInput}
        placeholder="Search invoice number, subject…"
        defaultValue={q}
        onKeyDown={e => { if (e.key === 'Enter') push({ q: (e.target as HTMLInputElement).value }) }}
        onBlur={e => push({ q: e.target.value })}
      />

      <div className={styles.filterTabs}>
        <button className={`${styles.filterTab} ${status === 'all' ? styles.active : ''}`} onClick={() => push({ status: 'all' })}>All</button>
        {ALL_STATUSES.map(s => (
          <button key={s} className={`${styles.filterTab} ${status === s ? styles.active : ''}`} onClick={() => push({ status: s })}>
            {INV_STATUS_LABELS[s]}
          </button>
        ))}
        <button
          className={`${styles.filterTab} ${overdue ? styles.active : ''} ${styles.filterTabOverdue}`}
          onClick={() => push({ overdue: overdue ? '' : '1', status: 'all' })}
        >
          Overdue
        </button>
      </div>

      <select
        className={styles.filterSelect}
        value={`${sort}_${order}`}
        onChange={e => {
          const [s, o] = e.target.value.split('_')
          push({ sort: s!, order: o! })
        }}
      >
        <option value="date_desc">Date (Newest)</option>
        <option value="date_asc">Date (Oldest)</option>
        <option value="due_date_asc">Due Date (Soonest)</option>
        <option value="grand_total_desc">Value (High)</option>
        <option value="grand_total_asc">Value (Low)</option>
        <option value="invoice_no_asc">Invoice No.</option>
      </select>
    </div>
  )
}
