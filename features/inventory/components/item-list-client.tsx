'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { ItemPage } from '../server/queries'
import { ItemList } from './item-list'

interface Props { page: ItemPage; canEdit: boolean; canDelete: boolean }

export function ItemListClient({ page, canEdit, canDelete }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const currentPage = Number(sp.get('page') ?? '1')
  const sort        = sp.get('sort')  ?? 'name'
  const order       = sp.get('order') ?? 'asc'

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k))
    router.push(`${pathname}?${next.toString()}`)
  }

  function handleSort(col: string) {
    if (sort === col) push({ sort: col, order: order === 'asc' ? 'desc' : 'asc', page: '1' })
    else push({ sort: col, order: 'asc', page: '1' })
  }

  return (
    <ItemList
      page={page} canEdit={canEdit} canDelete={canDelete}
      currentPage={currentPage} sort={sort} order={order}
      onSort={handleSort}
      onPageChange={(p) => push({ page: String(p) })}
    />
  )
}
