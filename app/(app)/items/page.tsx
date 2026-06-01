import { Suspense } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import { Icon } from '@/components/ui'
import {
  getOrgCurrency,
  listBrands,
  listFamilies,
  listItems,
} from '@/features/items/server/queries'
import { itemFilterSchema } from '@/validations/item'
import { ItemFilters } from '@/features/items/components/item-filters'
import { ItemListClient } from '@/features/items/components/item-list-client'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'Items · Watcon' }

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
        <div style={{
          padding: '14px 18px',
          background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to view items.
        </div>
      </main>
    )
  }

  const [page, families, brands, currency] = await Promise.all([
    listItems(filter),
    listFamilies(),
    listBrands(),
    getOrgCurrency(),
  ])

  const canDelete = ctx.has('items.delete')

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>Items</div>
          <div className={styles.subtitle}>Catalogue, pricing and stock.</div>
        </div>
        <div className={styles.headerActions}>
          <Link href={'/items/lookups' as Route}>
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent', color: 'var(--c-secondary)',
              border: '1px solid var(--c-border)', padding: '9px 16px',
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
            }}>
              <Icon name="settings" />
              Lookups
            </button>
          </Link>
          {ctx.has('items.create') && (
            <Link href={'/items/new' as Route}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--c-ink)', color: 'var(--c-inverse)',
                border: '1px solid var(--c-ink)', padding: '9px 16px',
                fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
                letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
              }}>
                <Icon name="plus" />
                New Item
              </button>
            </Link>
          )}
        </div>
      </header>

      <Suspense>
        <ItemFilters families={families} brands={brands} total={page.total} />
      </Suspense>

      <Suspense fallback={
        <div style={{
          padding: '60px 0', textAlign: 'center',
          fontFamily: 'var(--font-body)', fontSize: 'var(--fs-400)',
          color: 'var(--c-tertiary)', letterSpacing: '0.08em',
        }}>
          Loading…
        </div>
      }>
        <ItemListClient page={page} currency={currency} canDelete={canDelete} />
      </Suspense>
    </main>
  )
}
