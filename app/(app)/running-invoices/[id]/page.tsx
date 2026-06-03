import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getRunningInvoice } from '@/features/running-invoices/server/queries'
import { RiDetailView } from '@/features/running-invoices/components/ri-detail'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ri = await getRunningInvoice(id)
  return { title: ri ? `${ri.riNo} · Running Invoices · Watcon` : 'Running Invoice · Watcon' }
}

export default async function RunningInvoiceDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id }  = await params
  const ctx      = await getActionContext()

  if (!ctx.has('running_bill.view')) {
    return (
      <main style={{ padding:24, fontFamily:'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)' }}>
          You do not have permission to view running invoices.
        </div>
      </main>
    )
  }

  const ri = await getRunningInvoice(id)
  if (!ri) notFound()

  return (
    <main style={{ fontFamily:'var(--font-body)' }}>
      <RiDetailView
        ri={ri}
        canEdit={ctx.has('running_bill.edit')}
        canPost={ctx.has('running_bill.post')}
        canDelete={ctx.has('running_bill.delete')}
      />
    </main>
  )
}
