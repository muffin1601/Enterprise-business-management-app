import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import { getOrgCurrency, listBrands, listFamilies, listUnits } from '@/features/items/server/queries'
import { ItemForm } from '@/features/items/components/item-form'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'New Item · Watcon' }

export default async function NewItemPage() {
  const ctx = await getActionContext()

  if (!ctx.has('items.create')) {
    return (
      <main className={styles.page}>
        <div style={{
          padding: '14px 18px',
          background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to create items.
        </div>
      </main>
    )
  }

  const [families, brands, units, currency] = await Promise.all([
    listFamilies(), listBrands(), listUnits(), getOrgCurrency(),
  ])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Link href="/items" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', textDecoration: 'none' }}>
              ← Items
            </Link>
          </div>
          <div className={styles.title}>New Item</div>
          <div className={styles.subtitle}>Add a new item to the catalogue.</div>
        </div>
      </header>
      <ItemForm
        mode="create"
        defaultValues={{}}
        families={families}
        brands={brands}
        units={units}
        currency={currency}
      />
    </main>
  )
}
