'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { ItemPage } from '../server/queries'
import { ItemCards } from './item-cards'

interface Props {
  page: ItemPage
  currency: string
  canDelete: boolean
}

export function ItemListClient({ page, currency, canDelete }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const currentPage = Number(sp.get('page') ?? '1')

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v) next.set(k, v)
      else next.delete(k)
    })
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  return (
    <ItemCards
      page={page}
      currency={currency}
      canDelete={canDelete}
      currentPage={currentPage}
      onPageChange={(p) => push({ page: String(p) })}
    />
  )
}
