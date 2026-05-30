import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { listFamilies, listBrands, listUnits } from '@/features/inventory/server/queries'
import { ItemForm } from '@/features/inventory/components/item-form'
import styles from '@/features/inventory/components/inventory.module.scss'

export const metadata = { title: 'New Item · Watcon' }

export default async function NewItemPage() {
  const ctx = await getActionContext()
  if (!ctx.has('inventory.create') && !ctx.has('items.create')) redirect('/inventory/items')

  const [families, brands, units] = await Promise.all([listFamilies(), listBrands(), listUnits()])

  return (
    <main className={styles.page}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily:'var(--font-heading)', fontWeight:300, fontSize:28, letterSpacing:'0.02em', color:'var(--c-ink)' }}>New Item</div>
        <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-tertiary)', marginTop:4 }}>Add a new item to your inventory catalogue.</div>
      </div>
      <ItemForm mode="create" families={families} brands={brands} units={units} />
    </main>
  )
}
