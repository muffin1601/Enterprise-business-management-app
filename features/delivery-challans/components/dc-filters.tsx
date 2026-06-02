'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { DC_STATUS_LABELS } from '@/validations/delivery-challan'
import styles from './delivery-challans.module.scss'

export function DcFilters() {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const status = sp.get('status') ?? 'all'
  const q      = sp.get('q') ?? ''
  const sort   = sp.get('sort') ?? 'date'
  const order  = sp.get('order') ?? 'desc'

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
        placeholder="Search DC number, customer, subject…"
        defaultValue={q}
        onKeyDown={e => { if (e.key === 'Enter') push({ q: (e.target as HTMLInputElement).value }) }}
        onBlur={e => push({ q: e.target.value })}
      />
      <div className={styles.filterTabs}>
        <button className={`${styles.filterTab} ${status === 'all' ? styles.active : ''}`} onClick={() => push({ status: 'all' })}>All</button>
        {Object.entries(DC_STATUS_LABELS).map(([s, l]) => (
          <button key={s} className={`${styles.filterTab} ${status === s ? styles.active : ''}`} onClick={() => push({ status: s })}>
            {l}
          </button>
        ))}
      </div>
      <select className={styles.filterSelect} value={`${sort}_${order}`}
        onChange={e => { const [s, o] = e.target.value.split('_'); push({ sort: s!, order: o! }) }}>
        <option value="date_desc">Date (Newest)</option>
        <option value="date_asc">Date (Oldest)</option>
        <option value="dispatch_date_desc">Dispatch Date</option>
        <option value="dc_no_asc">DC Number</option>
      </select>
    </div>
  )
}
