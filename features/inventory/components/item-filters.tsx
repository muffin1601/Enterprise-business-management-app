'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Lookup } from '../server/queries'
import { Icon } from '@/components/ui'
import styles from './inventory.module.scss'

const STATUS_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'active',       label: 'Active' },
  { key: 'low_stock',    label: 'Low Stock' },
  { key: 'out_of_stock', label: 'Out of Stock' },
  { key: 'inactive',     label: 'Inactive' },
] as const

interface Props {
  total:    number
  families: Lookup[]
  brands:   Lookup[]
}

export function ItemFilters({ total, families, brands }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const debounce = useRef<NodeJS.Timeout>()

  const [search, setSearch] = useState(sp.get('q') ?? '')
  const status   = sp.get('status') ?? 'all'
  const familyId = sp.get('familyId') ?? ''
  const brandId  = sp.get('brandId')  ?? ''
  const imported = sp.get('imported') ?? 'all'

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v === '' || v === 'all') next.delete(k)
      else next.set(k, v)
    })
    next.delete('page')
    router.push(`${pathname}?${next.toString()}`)
  }

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => push({ q: v }), 350)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className={styles.filterBar}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <Icon name="search" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by name, SKU, HSN, barcode…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        {/* Category */}
        <select className={styles.filterSelect} value={familyId} onChange={(e) => push({ familyId: e.target.value })}>
          <option value="">All categories</option>
          {families.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        {/* Brand */}
        <select className={styles.filterSelect} value={brandId} onChange={(e) => push({ brandId: e.target.value })}>
          <option value="">All brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>

        {/* Import */}
        <select className={styles.filterSelect} style={{ minWidth: 130 }} value={imported} onChange={(e) => push({ imported: e.target.value })}>
          <option value="all">All items</option>
          <option value="domestic">Domestic</option>
          <option value="imported">Imported</option>
        </select>

        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-tertiary)', whiteSpace: 'nowrap', marginLeft: 4 }}>
          {total} item{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status tabs */}
      <div className={styles.tabGroup} style={{ alignSelf: 'flex-start' }}>
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            className={styles.tab}
            data-active={status === t.key ? 'true' : undefined}
            onClick={() => push({ status: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
