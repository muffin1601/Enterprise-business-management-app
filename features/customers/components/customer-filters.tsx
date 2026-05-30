'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import styles from './customers.module.scss'

const STATUSES = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'blocked',  label: 'Blocked' },
] as const

export function CustomerFilters({ total }: { total: number }) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const debounce = useRef<NodeJS.Timeout>()

  const [search, setSearch] = useState(sp.get('q') ?? '')
  const status = sp.get('status') ?? 'all'

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
    <div className={styles.filterBar}>
      {/* Search */}
      <div className={styles.searchWrap}>
        <i className={`ti ti-search ${styles.searchIcon}`} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by name, phone, email, ID..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      {/* Status tabs — matching screenshot */}
      <div className={styles.tabGroup}>
        {STATUSES.map((s) => (
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

      <span className={styles.filterCount}>{total} customers</span>
    </div>
  )
}
