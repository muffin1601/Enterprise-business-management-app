'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { RiPage } from '../server/queries'
import { RiCards } from './ri-cards'
import { RiFilters } from './ri-filters'

interface Props { page: RiPage; canDelete: boolean }

export function RiListClient({ page, canDelete }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k) })
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  return (
    <>
      <RiFilters />
      <RiCards
        page={page} canDelete={canDelete}
        currentPage={Number(sp.get('page') ?? '1')}
        onPageChange={p => push({ page: String(p) })}
      />
    </>
  )
}
