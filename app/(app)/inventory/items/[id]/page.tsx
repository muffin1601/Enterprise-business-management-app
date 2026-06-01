import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getItem, getStockMovements, getAdjustments, getItemVariants } from '@/features/inventory/server/queries'
import { ItemDetailView } from '@/features/inventory/components/item-detail'
import styles from '@/features/inventory/components/inventory.module.scss'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await getItem(id)
  return { title: item ? `${item.name} · Watcon` : 'Item · Watcon' }
}

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const activeTab = sp.tab ?? 'overview'

  const ctx = await getActionContext()
  if (!ctx.has('inventory.view') && !ctx.has('items.view')) {
    return <main className={styles.page}><div style={{ color:'var(--c-danger)', fontFamily:'var(--font-body)' }}>Access denied.</div></main>
  }

  const item = await getItem(id)
  if (!item) notFound()

  const [movements, adjustments, variants] = await Promise.all([
    getStockMovements(id),
    getAdjustments(id),
    getItemVariants(id),
  ])

  return (
    <ItemDetailView
      item={item}
      movements={movements}
      adjustments={adjustments}
      variants={variants}
      activeTab={activeTab}
      orgId={ctx.orgId}
      canEdit={ctx.has('inventory.edit') || ctx.has('items.edit')}
      canDelete={ctx.has('inventory.delete') || ctx.has('items.delete')}
      canAdjust={ctx.has('inventory.adjust') || ctx.has('stock.adjust')}
    />
  )
}
