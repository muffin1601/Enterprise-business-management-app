'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { CustomerPage } from '../server/queries'
import { CustomerCards } from './customer-cards'

interface Props {
  page: CustomerPage
  canEdit: boolean
  canDelete: boolean
}

export function CustomerListClient({ page, canEdit, canDelete }: Props) {
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
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <CustomerCards
      page={page}
      canEdit={canEdit}
      canDelete={canDelete}
      currentPage={currentPage}
      onPageChange={(p) => push({ page: String(p) })}
    />
  )
}
