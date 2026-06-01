'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Route } from 'next'
import type { Lookup } from '@/features/items/server/queries'
import { Icon } from '@/components/ui'
import styles from './items.module.scss'

const SOURCES = [
  { key: 'all',      label: 'All' },
  { key: 'domestic', label: 'Domestic' },
  { key: 'imported', label: 'Imported' },
] as const

interface Props {
  families: Lookup[]
  brands: Lookup[]
  total: number
}

export function ItemFilters({ families, brands, total }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams() as ReturnType<typeof useSearchParams>
  const debounce = useRef<NodeJS.Timeout>(undefined)

  const [search, setSearch] = useState(sp.get('search') ?? '')
  const source    = sp.get('imported') ?? 'all'
  const familyId  = sp.get('familyId') ?? ''
  const brandId   = sp.get('brandId') ?? ''
  const lowStock  = sp.get('lowStock') === 'true'

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v === '' || v === 'all' || v === 'false') next.delete(k)
      else next.set(k, v)
    })
    next.delete('page')
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => push({ search: v }), 350)
  }

  return (
    <div className={styles.filterBar}>
      {/* Search */}
      <div className={styles.searchWrap}>
        <Icon name="search" className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      {/* Family select */}
      <select
        className={styles.filterSelect}
        value={familyId}
        onChange={(e) => push({ familyId: e.target.value })}
        aria-label="Filter by family"
      >
        <option value="">All categories</option>
        {families.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      {/* Brand select */}
      <select
        className={styles.filterSelect}
        value={brandId}
        onChange={(e) => push({ brandId: e.target.value })}
        aria-label="Filter by brand"
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>

      {/* Source tabs */}
      <div className={styles.tabGroup}>
        {SOURCES.map((s) => (
          <button
            key={s.key}
            className={styles.tab}
            data-active={source === s.key ? 'true' : undefined}
            onClick={() => push({ imported: s.key })}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Low stock toggle */}
      <div className={styles.tabGroup}>
        <button
          className={styles.tab}
          data-active={lowStock ? 'true' : undefined}
          onClick={() => push({ lowStock: lowStock ? 'false' : 'true' })}
        >
          <Icon name="alert-triangle" size={12} style={{ marginRight: 5 }} />
          Low stock
        </button>
      </div>

      <span className={styles.filterCount}>{total} items</span>
    </div>
  )
}
