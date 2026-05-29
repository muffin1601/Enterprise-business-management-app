import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import { listBrands, listFamilies, listUnits } from '@/features/items/server/queries'
import { LookupsManager } from '@/features/items/components/lookups-manager'
import { Alert } from '@/components/ui'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'Catalogue settings · Watcon' }

export default async function LookupsPage() {
  const ctx = await getActionContext()
  const canManage = ctx.has('items.create') || ctx.has('items.edit')
  if (!canManage) {
    return (
      <main className={styles.page}>
        <h1>Categories & brands</h1>
        <Alert tone="warning">You don&rsquo;t have permission to manage catalogue settings.</Alert>
      </main>
    )
  }

  const [families, brands, units] = await Promise.all([listFamilies(), listBrands(), listUnits()])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Categories &amp; brands</h1>
          <p className={styles.subtitle}>Families, brands, and units for your catalogue.</p>
        </div>
        <Link href={'/items' as Route} className={styles.back}>← Items</Link>
      </header>
      <LookupsManager families={families} brands={brands} units={units} />
    </main>
  )
}
