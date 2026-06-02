'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { VendorPage } from '../server/queries'
import { VendorCards } from './vendor-cards'

interface Props { page: VendorPage; canEdit: boolean; canDelete: boolean }

export function VendorListClient({ page, canEdit, canDelete }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams() as ReturnType<typeof useSearchParams>

  const currentPage = Number(sp.get('page') ?? '1')

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k) })
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  return (
    <VendorCards
      page={page}
      canEdit={canEdit}
      canDelete={canDelete}
      currentPage={currentPage}
      onPageChange={p => push({ page: String(p) })}
    />
  )
}
