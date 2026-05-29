'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { Lookup } from '@/features/items/server/queries'
import { Card, Input, Select } from '@/components/ui'
import styles from './items.module.scss'

/** Search + filter controls that drive the list via URL query params (RSC re-query). */
export function ItemFilters({ families, brands }: { families: Lookup[]; brands: Lookup[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')

  const update = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    sp.delete('page') // any filter change resets to page 1
    router.push(`${pathname}?${sp.toString()}` as Route)
  }

  // Debounce free-text search; skip the initial render (no redundant push).
  useEffect(() => {
    const current = params.get('search') ?? ''
    if (search === current) return
    const t = setTimeout(() => update({ search: search || undefined }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <Card>
      <div className={styles.filters}>
        <div className={styles.filterSearch}>
          <Input
            placeholder="Search name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search items"
          />
        </div>

        <div className={styles.filterSel}>
          <Select
            value={params.get('familyId') ?? ''}
            onChange={(e) => update({ familyId: e.target.value || undefined })}
            aria-label="Filter by family"
          >
            <option value="">All families</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.filterSel}>
          <Select
            value={params.get('brandId') ?? ''}
            onChange={(e) => update({ brandId: e.target.value || undefined })}
            aria-label="Filter by brand"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.filterSel}>
          <Select
            value={params.get('imported') ?? 'all'}
            onChange={(e) => update({ imported: e.target.value === 'all' ? undefined : e.target.value })}
            aria-label="Filter by source"
          >
            <option value="all">All sources</option>
            <option value="imported">Imported</option>
            <option value="domestic">Domestic</option>
          </Select>
        </div>

        <label className={styles.filterCheck}>
          <input
            type="checkbox"
            checked={params.get('lowStock') === 'true'}
            onChange={(e) => update({ lowStock: e.target.checked ? 'true' : undefined })}
          />
          Low stock only
        </label>
      </div>
    </Card>
  )
}
