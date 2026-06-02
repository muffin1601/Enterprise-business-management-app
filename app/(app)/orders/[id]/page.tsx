import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getSalesOrder } from '@/features/sales-orders/server/queries'
import { getLinkedInvoiceForSo } from '@/features/invoices/server/queries'
import { SoDetail } from '@/features/sales-orders/components/so-detail'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const so = await getSalesOrder(id)
  return { title: so ? `${so.soNo} · Sales Orders · Watcon` : 'Sales Order · Watcon' }
}

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('sales_orders.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)', fontSize:'var(--fs-500)' }}>
          You do not have permission to view sales orders.
        </div>
      </main>
    )
  }

  const [so, linkedInvoice] = await Promise.all([
    getSalesOrder(id),
    ctx.has('invoices.view') ? getLinkedInvoiceForSo(id) : null,
  ])

  if (!so) notFound()

  return (
    <main style={{ fontFamily: 'var(--font-body)' }}>
      <SoDetail
        so={so}
        canEdit={ctx.has('sales_orders.edit')}
        canDelete={ctx.has('sales_orders.delete')}
        linkedInvoice={linkedInvoice}
        canCreateInvoice={ctx.has('invoices.create')}
      />
    </main>
  )
}
