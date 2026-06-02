import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getChallan } from '@/features/delivery-challans/server/queries'
import { getActiveOrganization } from '@/features/company/server/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DcPreview, DcPreviewPrintBar } from '@/features/delivery-challans/components/dc-preview'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dc = await getChallan(id)
  return { title: dc ? `${dc.dcNo} · Preview · Watcon` : 'DC Preview · Watcon' }
}

export default async function DcPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getActionContext()
  if (!ctx.has('challans.view')) {
    return <div style={{ padding:24, color:'var(--c-danger)' }}>No permission.</div>
  }

  const [dc, org] = await Promise.all([getChallan(id), getActiveOrganization()])
  if (!dc) notFound()

  // Fetch logo from invoice → SO → quote chain
  let logoUrl: string | null = null
  try {
    const supabase = await createSupabaseServerClient()
    const { data: inv } = await supabase.from('invoices').select('logo_url,so_id').eq('id', dc.invoiceId).maybeSingle()
    logoUrl = (inv?.logo_url as string | null) ?? null
    if (!logoUrl && inv?.so_id) {
      const { data: so } = await supabase.from('sales_orders').select('logo_url,quote_id').eq('id', inv.so_id as string).maybeSingle()
      logoUrl = (so?.logo_url as string | null) ?? null
      if (!logoUrl && so?.quote_id) {
        const { data: q } = await supabase.from('quotes').select('logo_url').eq('id', so.quote_id as string).maybeSingle()
        logoUrl = (q?.logo_url as string | null) ?? null
      }
    }
  } catch {}

  const previewProps = {
    dc, orgName: org?.name ?? '', orgAddress: org?.address ?? undefined,
    orgGstin: org?.gstin ?? undefined, logoUrl,
  }

  return (
    <>
      <div className="no-print" style={{ position:'fixed', inset:0, zIndex:9999, background:'#404040', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <DcPreviewPrintBar dcId={dc.id} dcNo={dc.dcNo} />
        <div style={{ flex:1, overflowY:'auto', padding:'32px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
          <DcPreview {...previewProps} />
        </div>
      </div>
      <div id="dc-print-area"><DcPreview {...previewProps} /></div>
    </>
  )
}
