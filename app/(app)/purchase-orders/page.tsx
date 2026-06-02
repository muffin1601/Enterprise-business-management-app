import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listPurchaseOrders } from '@/features/purchase-orders/server/queries'
import { poFilterSchema } from '@/validations/purchase-order'
import { PoListClient } from '@/features/purchase-orders/components/po-list-client'
import { PoTopbarAction } from '@/features/purchase-orders/components/po-topbar-action'

export const metadata = { title: 'Purchase Orders · Watcon' }

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = poFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : poFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('purchase_orders.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)' }}>
          You do not have permission to view purchase orders.
        </div>
      </main>
    )
  }

  const page = await listPurchaseOrders(filter)

  return (
    <main style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:'var(--font-body)' }}>
      <PoTopbarAction canCreate={ctx.has('purchase_orders.create')} />
      <Suspense fallback={<div style={{ padding:'60px 0', textAlign:'center', color:'var(--c-tertiary)' }}>Loading…</div>}>
        <PoListClient page={page} canDelete={ctx.has('purchase_orders.delete')} />
      </Suspense>
    </main>
  )
}
