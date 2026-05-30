import { Suspense } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import {
  getInventorySummary,
  getOrgCurrency,
  listBrands,
  listFamilies,
  listItems,
} from '@/features/items/server/queries'
import { itemFilterSchema } from '@/validations/item'
import { InventorySummaryCards } from '@/features/items/components/inventory-summary'
import { ItemFilters } from '@/features/items/components/item-filters'
import { ItemList } from '@/features/items/components/item-list'
import { ItemPagination } from '@/features/items/components/item-pagination'
import { Alert, Button } from '@/components/ui'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'Inventory · Watcon' }

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const parsed = itemFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : itemFilterSchema.parse({})

  const ctx = await getActionContext()
  if (!ctx.has('items.view')) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <div className={styles.title}>Inventory</div>
            <div className={styles.subtitle}>Item catalogue, pricing and stock.</div>
          </div>
        </header>
        <Alert tone="warning">You don&apos;t have permission to view the catalogue.</Alert>
      </main>
    )
  }

  const [summary, page, families, brands, currency] = await Promise.all([
    getInventorySummary(),
    listItems(filter),
    listFamilies(),
    listBrands(),
    getOrgCurrency(),
  ])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Inventory</div>
          <div className={styles.subtitle}>Catalogue, pricing and stock. {page.total} items.</div>
        </div>
        <div className={styles.headerActions}>
          <Link href={'/items/lookups' as Route}>
            <Button variant="ghost" size="sm">Categories &amp; brands</Button>
          </Link>
          {ctx.has('items.create') && (
            <Link href={'/items/new' as Route}>
              <Button variant="primary" size="sm">+ New item</Button>
            </Link>
          )}
        </div>
      </header>

      <InventorySummaryCards summary={summary} currency={currency} />

      <Suspense>
        <ItemFilters families={families} brands={brands} />
      </Suspense>

      <ItemList rows={page.rows} currency={currency} />

      <Suspense>
        <ItemPagination page={page.page} totalPages={page.totalPages} total={page.total} />
      </Suspense>
    </main>
  )
}
