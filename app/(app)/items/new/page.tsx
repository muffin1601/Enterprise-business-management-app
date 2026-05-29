import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import { getOrgCurrency, listBrands, listFamilies, listUnits } from '@/features/items/server/queries'
import { ItemForm } from '@/features/items/components/item-form'
import { Alert } from '@/components/ui'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'New item · Watcon' }

export default async function NewItemPage() {
  const ctx = await getActionContext()
  if (!ctx.has('items.create')) {
    return (
      <main className={styles.page}>
        <h1>New item</h1>
        <Alert tone="warning">You don&rsquo;t have permission to create items.</Alert>
      </main>
    )
  }

  const [families, brands, units, currency] = await Promise.all([
    listFamilies(),
    listBrands(),
    listUnits(),
    getOrgCurrency(),
  ])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>New item</h1>
        <Link href={'/items' as Route} className={styles.back}>← Items</Link>
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
