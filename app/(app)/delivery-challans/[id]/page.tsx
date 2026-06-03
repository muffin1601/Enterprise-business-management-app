import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import { getChallan } from '@/features/delivery-challans/server/queries'
import { getLinkedRiForDc } from '@/features/running-invoices/server/queries'
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

  const [dc, linkedRi] = await Promise.all([
    getChallan(id),
    ctx.has('running_bill.view') ? getLinkedRiForDc(id) : null,
  ])
  if (!dc) notFound()

  return (
    <main style={{ fontFamily:'var(--font-body)' }}>
      <DcDetailView
        dc={dc}
        canEdit={ctx.has('challans.edit')}
        canPost={ctx.has('challans.post')}
        canDelete={ctx.has('challans.delete')}
      />

      {/* Running Invoice status banner */}
      {dc.status === 'delivered' && (
        <div style={{ margin:'16px 0', padding:'12px 16px', background:'var(--c-surface)', border:'1px solid var(--c-border)', borderRadius:'var(--radius-sm)', fontFamily:'var(--font-body)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          {linkedRi ? (
            <>
              <span style={{ color:'var(--c-success)' }}>✓ Invoiced via <Link href={`/running-invoices/${linkedRi.id}` as Route} style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--c-success)', textDecoration:'none', borderBottom:'1px solid var(--c-success)' }}>{linkedRi.riNo}</Link></span>
              <span style={{ fontFamily:'var(--font-body)', fontSize:11, padding:'2px 8px', background:'var(--c-success-bg)', color:'var(--c-success)', borderRadius:2, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>{linkedRi.status}</span>
            </>
          ) : (
            <>
              <span style={{ color:'var(--c-warning)' }}>⚠ Not yet invoiced</span>
              {ctx.has('running_bill.create') && dc.soId && (
                <Link href={`/running-invoices/new?soId=${dc.soId}` as Route} style={{
                  display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px',
                  background:'var(--c-ink)', color:'var(--c-inverse)', border:'none',
                  borderRadius:'var(--radius-sm)', textDecoration:'none', fontFamily:'var(--font-body)',
                  fontSize:11, fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase',
                }}>
                  Create Running Invoice
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </main>
  )
}
