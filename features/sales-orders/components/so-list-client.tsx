'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { SoPage } from '../server/queries'
import { SoCards } from './so-cards'
import { SoFilters } from './so-filters'

interface Props {
  page:      SoPage
  canDelete: boolean
}

export function SoListClient({ page, canDelete }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k) })
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  const currentPage = Number(sp.get('page') ?? '1')

  return (
    <>
      <SoFilters />
      <SoCards
        page={page}
        canDelete={canDelete}
        currentPage={currentPage}
        onPageChange={p => push({ page: String(p) })}
      />
    </>
  )
}
