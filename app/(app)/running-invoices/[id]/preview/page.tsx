import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getRunningInvoice } from '@/features/running-invoices/server/queries'
import { getActiveOrganization } from '@/features/company/server/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RiPreview, RiPreviewPrintBar } from '@/features/running-invoices/components/ri-preview'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ri = await getRunningInvoice(id)
  return { title: ri ? `${ri.riNo} · Preview · Watcon` : 'Preview · Watcon' }
}

export default async function RiPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getActionContext()
  if (!ctx.has('running_bill.view')) return <div style={{ padding:24, color:'var(--c-danger)' }}>No permission.</div>

  const [ri, org] = await Promise.all([getRunningInvoice(id), getActiveOrganization()])
  if (!ri) notFound()

  // Fetch logo from SO → quote chain
  let logoUrl: string | null = null
  try {
    const supabase = await createSupabaseServerClient()
    const { data: so } = await supabase.from('sales_orders').select('logo_url,quote_id').eq('id', ri.soId).maybeSingle()
    logoUrl = (so?.logo_url as string | null) ?? null
    if (!logoUrl && so?.quote_id) {
      const { data: q } = await supabase.from('quotes').select('logo_url').eq('id', so.quote_id as string).maybeSingle()
      logoUrl = (q?.logo_url as string | null) ?? null
    }
  } catch {}

  const previewProps = {
    ri, orgName: org?.name ?? '', orgAddress: org?.address ?? undefined,
    orgGstin: org?.gstin ?? undefined, logoUrl,
  }

  return (
    <>
      <div className="no-print" style={{ position:'fixed', inset:0, zIndex:9999, background:'#404040', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <RiPreviewPrintBar riId={ri.id} riNo={ri.riNo} />
        <div style={{ flex:1, overflowY:'auto', padding:'32px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
          <RiPreview {...previewProps} />
        </div>
      </div>
      <div id="ri-print-area"><RiPreview {...previewProps} /></div>
    </>
  )
}
