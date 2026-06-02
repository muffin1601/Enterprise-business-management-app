import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getPurchaseOrder } from '@/features/purchase-orders/server/queries'
import { PoDetail } from '@/features/purchase-orders/components/po-detail'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const po = await getPurchaseOrder(id)
  return { title: po ? `${po.poNo} · Purchase Orders · Watcon` : 'Purchase Order · Watcon' }
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const po = await getPurchaseOrder(id)
  if (!po) notFound()

  return (
    <main style={{ fontFamily: 'var(--font-body)' }}>
      <PoDetail
        po={po}
        canEdit={ctx.has('purchase_orders.edit')}
        canApprove={ctx.has('purchase_orders.approve')}
        canDelete={ctx.has('purchase_orders.delete')}
        canReceive={ctx.has('purchase_orders.receive')}
      />
    </main>
  )
}
