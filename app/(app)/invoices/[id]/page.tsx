import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getInvoice } from '@/features/invoices/server/queries'
import { getLinkedPosForInvoice } from '@/features/purchase-orders/server/queries'
import { getLinkedChallansForInvoice } from '@/features/delivery-challans/server/queries'
import { InvoiceDetailView } from '@/features/invoices/components/invoice-detail'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inv = await getInvoice(id)
  return { title: inv ? `${inv.invoiceNo} · Invoices · Watcon` : 'Invoice · Watcon' }
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('invoices.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)' }}>
          You do not have permission to view invoices.
        </div>
      </main>
    )
  }

  const [inv, linkedPos, linkedChallans] = await Promise.all([
    getInvoice(id),
    ctx.has('purchase_orders.view') ? getLinkedPosForInvoice(id) : [],
    ctx.has('challans.view') ? getLinkedChallansForInvoice(id) : [],
  ])
  if (!inv) notFound()

  return (
    <main style={{ fontFamily: 'var(--font-body)' }}>
      <InvoiceDetailView
        inv={inv}
        canEdit={ctx.has('invoices.edit')}
        canIssue={ctx.has('invoices.issue')}
        canDelete={ctx.has('invoices.delete')}
        linkedPos={linkedPos}
        canCreatePo={ctx.has('purchase_orders.create') && inv.status === 'issued'}
        linkedChallans={linkedChallans}
        canCreateDc={ctx.has('challans.create') && inv.status === 'issued'}
      />
    </main>
  )
}
