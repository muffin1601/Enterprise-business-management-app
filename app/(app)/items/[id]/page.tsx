import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getItem, getOrgCurrency, getItemActivity } from '@/features/items/server/queries'
import { ItemDetailView } from '@/features/items/components/item-detail'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'Item · Watcon' }

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const activeTab = (typeof sp.tab === 'string' ? sp.tab : null) ?? 'overview'

  const ctx = await getActionContext()
  if (!ctx.has('items.view')) {
    return (
      <main className={styles.page}>
        <div style={{
          padding: '14px 18px',
          background: 'var(--c-danger-bg)',
          color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)',
          borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to view items.
        </div>
      </main>
    )
  }

  const [item, currency, activity] = await Promise.all([
    getItem(id),
    getOrgCurrency(),
    getItemActivity(id),
  ])

  if (!item) notFound()

  return (
    <main className={styles.page}>
      <ItemDetailView
        item={item}
        currency={currency}
        activeTab={activeTab}
        activity={activity}
        canEdit={ctx.has('items.edit')}
        canDelete={ctx.has('items.delete')}
      />
    </main>
  )
}
