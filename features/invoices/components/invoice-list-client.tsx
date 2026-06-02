'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { InvoicePage } from '../server/queries'
import { InvoiceCards } from './invoice-cards'
import { InvoiceFilters } from './invoice-filters'

interface Props { page: InvoicePage; canDelete: boolean }

export function InvoiceListClient({ page, canDelete }: Props) {
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
      <InvoiceFilters />
      <InvoiceCards
        page={page}
        canDelete={canDelete}
        currentPage={Number(sp.get('page') ?? '1')}
        onPageChange={p => push({ page: String(p) })}
      />
    </>
  )
}
