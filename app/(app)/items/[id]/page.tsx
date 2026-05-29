import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getItem, getOrgCurrency } from '@/features/items/server/queries'
import { ItemDetailView } from '@/features/items/components/item-detail'
import { Alert } from '@/components/ui'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'Item · Watcon' }

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getActionContext()
  if (!ctx.has('items.view')) {
    return (
      <main className={styles.page}>
        <h1>Item</h1>
        <Alert tone="warning">You don&rsquo;t have permission to view items.</Alert>
      </main>
    )
  }

  const [item, currency] = await Promise.all([getItem(id), getOrgCurrency()])
  if (!item) notFound()

  return (
    <main className={styles.page}>
      <ItemDetailView
        item={item}
        currency={currency}
        canEdit={ctx.has('items.edit')}
        canDelete={ctx.has('items.delete')}
      />
    </main>
  )
}
