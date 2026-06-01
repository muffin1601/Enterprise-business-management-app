'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { ItemPage } from '../server/queries'
import { ItemCards } from './item-cards'

interface Props { page: ItemPage; canEdit: boolean; canDelete: boolean }

export function ItemListClient({ page, canEdit, canDelete }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const currentPage = Number(sp.get('page') ?? '1')

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k))
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  return (
    <ItemCards
      page={page}
      canEdit={canEdit}
      canDelete={canDelete}
      currentPage={currentPage}
      onPageChange={(p) => push({ page: String(p) })}
    />
  )
}
