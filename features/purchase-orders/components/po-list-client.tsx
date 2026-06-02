'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { PoPage } from '../server/queries'
import { PoCards } from './po-cards'
import { PoFilters } from './po-filters'

interface Props { page: PoPage; canDelete: boolean }

export function PoListClient({ page, canDelete }: Props) {
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
      <PoFilters />
      <PoCards
        page={page}
        canDelete={canDelete}
        currentPage={Number(sp.get('page') ?? '1')}
        onPageChange={p => push({ page: String(p) })}
      />
    </>
  )
}
