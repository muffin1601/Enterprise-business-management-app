'use client'

import { useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { ReportView } from '@/validations/stock-report'
import { Icon } from '@/components/ui'
import styles from './stock-reports.module.scss'

interface Props {
  view:        ReportView
  families:    { id: string; name: string }[]
  brands:      { id: string; name: string }[]
  showStatus?: boolean
  showDates?:  boolean
  total:       number
}

export function StockFilters({ view, families, brands, showStatus = false, showDates = false, total }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const debounce = useRef<NodeJS.Timeout>(undefined)
  const [search, setSearch] = useState(sp.get('search') ?? '')

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v) next.set(k, v); else next.delete(k)
    })
    next.delete('page')
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => push({ search: v }), 350)
  }

  const familyId  = sp.get('familyId') ?? ''
  const brandId   = sp.get('brandId') ?? ''
  const status    = sp.get('status') ?? 'all'
  const dateFrom  = sp.get('dateFrom') ?? ''
  const dateTo    = sp.get('dateTo') ?? ''

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchWrap}>
        <Icon name="search" className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search items…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      {families.length > 0 && (
        <select className={styles.filterSelect} value={familyId} onChange={e => push({ familyId: e.target.value })}>
          <option value="">All Families</option>
          {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      )}

      {brands.length > 0 && (
        <select className={styles.filterSelect} value={brandId} onChange={e => push({ brandId: e.target.value })}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      {showStatus && (
        <select className={styles.filterSelect} value={status} onChange={e => push({ status: e.target.value })}>
          <option value="all">All Status</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
          <option value="over">Overstock</option>
        </select>
      )}

      {showDates && (
        <>
          <input type="date" className={styles.dateInput} value={dateFrom} onChange={e => push({ dateFrom: e.target.value })} title="From date" />
          <input type="date" className={styles.dateInput} value={dateTo}   onChange={e => push({ dateTo:   e.target.value })} title="To date" />
        </>
      )}

      <span className={styles.filterCount}>{total} row{total !== 1 ? 's' : ''}</span>
    </div>
  )
}
