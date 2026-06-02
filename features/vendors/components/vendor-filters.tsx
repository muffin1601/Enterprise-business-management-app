'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Route } from 'next'
import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'

const STATUSES = [
  { key: 'all',         label: 'All' },
  { key: 'active',      label: 'Active' },
  { key: 'inactive',    label: 'Inactive' },
  { key: 'blacklisted', label: 'Blacklisted' },
] as const

export function VendorFilters({ total }: { total: number }) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams() as ReturnType<typeof useSearchParams>
  const debounce = useRef<NodeJS.Timeout>(undefined)

  const [search, setSearch] = useState(sp.get('q') ?? '')
  const status = sp.get('status') ?? 'all'

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v === '' || v === 'all') next.delete(k)
      else next.set(k, v)
    })
    next.delete('page')
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  function onSearch(v: string) {
    setSearch(v)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => push({ q: v }), 350)
  }

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchWrap}>
        <Icon name="search" className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by name, phone, email, GSTIN..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <div className={styles.tabGroup}>
        {STATUSES.map(s => (
          <button
            key={s.key}
            className={styles.tab}
            data-active={status === s.key ? 'true' : undefined}
            onClick={() => push({ status: s.key })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <span className={styles.filterCount}>{total} vendors</span>
    </div>
  )
}
