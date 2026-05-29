'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { Button } from '@/components/ui'
import styles from './items.module.scss'

export function ItemPagination({
  page,
  totalPages,
  total,
}: {
  page: number
  totalPages: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const go = (p: number) => {
    const sp = new URLSearchParams(params.toString())
    if (p <= 1) sp.delete('page')
    else sp.set('page', String(p))
    router.push(`${pathname}?${sp.toString()}` as Route)
  }

  if (total === 0) return null

  return (
    <div className={styles.pagination}>
      <span className={styles.pageInfo}>
        Page {page} of {Math.max(1, totalPages)} · {total} item{total === 1 ? '' : 's'}
      </span>
      <div className={styles.pageBtns}>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => go(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
