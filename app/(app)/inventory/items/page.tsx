import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listItems, getInventoryKPIs, listFamilies, listBrands } from '@/features/inventory/server/queries'
import { inventoryFilterSchema } from '@/validations/inventory'
import { InventoryKpiCards } from '@/features/inventory/components/inventory-kpis'
import { ItemFilters } from '@/features/inventory/components/item-filters'
import { ItemListClient } from '@/features/inventory/components/item-list-client'
import { InventoryTopbarAction } from '@/features/inventory/components/inventory-topbar-action'
import styles from '@/features/inventory/components/inventory.module.scss'

export const metadata = { title: 'Inventory · Watcon' }

export default async function InventoryItemsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp     = await searchParams
  const parsed = inventoryFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : inventoryFilterSchema.parse({})

  const ctx = await getActionContext()
  if (!ctx.has('inventory.view') && !ctx.has('items.view')) {
    return (
      <main className={styles.page}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)', fontFamily:'var(--font-body)', fontSize:13 }}>
          You do not have permission to view inventory.
        </div>
      </main>
    )
  }

  const [kpis, page, families, brands] = await Promise.all([
    getInventoryKPIs(),
    listItems(filter),
    listFamilies(),
    listBrands(),
  ])

  return (
    <main className={styles.page}>
      {(ctx.has('inventory.create') || ctx.has('items.create')) && <InventoryTopbarAction />}

      <InventoryKpiCards kpis={kpis} />

      <Suspense>
        <ItemFilters total={page.total} families={families} brands={brands} />
      </Suspense>

      <Suspense fallback={
        <div style={{ padding:'48px 0', textAlign:'center', fontFamily:'var(--font-body)', fontSize:13, color:'var(--c-tertiary)', letterSpacing:'0.08em' }}>Loading…</div>
      }>
        <ItemListClient
          page={page}
          canEdit={ctx.has('inventory.edit') || ctx.has('items.edit')}
          canDelete={ctx.has('inventory.delete') || ctx.has('items.delete')}
        />
      </Suspense>
    </main>
  )
}
