'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { RI_STATUS_LABELS } from '@/validations/running-invoice'
import styles from './running-invoices.module.scss'

export function RiFilters() {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const status   = sp.get('status') ?? 'all'

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== 'all' && v !== '') next.set(k, v); else next.delete(k)
    })
    next.delete('page')
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  return (
    <div className={styles.filtersBar}>
      <input
        className={styles.searchInput}
        placeholder="Search RI number, subject…"
        defaultValue={sp.get('q') ?? ''}
        onKeyDown={e => { if (e.key === 'Enter') push({ q: (e.target as HTMLInputElement).value }) }}
        onBlur={e => push({ q: e.target.value })}
      />
      <div className={styles.filterTabs}>
        <button className={`${styles.filterTab} ${status === 'all' ? styles.active : ''}`} onClick={() => push({ status: 'all' })}>All</button>
        {Object.entries(RI_STATUS_LABELS).map(([s, l]) => (
          <button key={s} className={`${styles.filterTab} ${status === s ? styles.active : ''}`} onClick={() => push({ status: s })}>
            {l}
          </button>
        ))}
      </div>
      <select className={styles.filterSelect}
        value={`${sp.get('sort') ?? 'date'}_${sp.get('order') ?? 'desc'}`}
        onChange={e => { const [s, o] = e.target.value.split('_'); push({ sort: s!, order: o! }) }}>
        <option value="date_desc">Date (Newest)</option>
        <option value="date_asc">Date (Oldest)</option>
        <option value="due_date_asc">Due Date (Soonest)</option>
        <option value="grand_total_desc">Value (High)</option>
        <option value="ri_no_asc">RI Number</option>
      </select>
    </div>
  )
}
