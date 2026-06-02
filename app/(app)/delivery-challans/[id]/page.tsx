import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getChallan } from '@/features/delivery-challans/server/queries'
import { DcDetailView } from '@/features/delivery-challans/components/dc-detail'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dc = await getChallan(id)
  return { title: dc ? `${dc.dcNo} · Delivery Challans · Watcon` : 'Delivery Challan · Watcon' }
}

export default async function DeliveryChallanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('challans.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)' }}>
          You do not have permission to view delivery challans.
        </div>
      </main>
    )
  }

  const dc = await getChallan(id)
  if (!dc) notFound()

  return (
    <main style={{ fontFamily: 'var(--font-body)' }}>
      <DcDetailView
        dc={dc}
        canEdit={ctx.has('challans.edit')}
        canPost={ctx.has('challans.post')}
        canDelete={ctx.has('challans.delete')}
      />
    </main>
  )
}
