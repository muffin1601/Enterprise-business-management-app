import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getPurchaseOrder } from '@/features/purchase-orders/server/queries'
import { getActiveOrganization } from '@/features/company/server/queries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PoPreview, PoPreviewPrintBar } from '@/features/purchase-orders/components/po-preview'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const po = await getPurchaseOrder(id)
  return { title: po ? `${po.poNo} · Preview · Watcon` : 'PO Preview · Watcon' }
}

export default async function PoPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('purchase_orders.view')) {
    return <div style={{ padding: 24, color: 'var(--c-danger)' }}>No permission.</div>
  }

  const [po, org] = await Promise.all([getPurchaseOrder(id), getActiveOrganization()])
  if (!po) notFound()

  // Fetch logo from vendor's linked quote chain as fallback
  let logoUrl: string | null = null
  if (po.invoiceId) {
    const supabase = await createSupabaseServerClient()
    const { data: inv } = await supabase.from('invoices').select('logo_url,so_id').eq('id', po.invoiceId).maybeSingle()
    logoUrl = (inv?.logo_url as string | null) ?? null
    if (!logoUrl && inv?.so_id) {
      const { data: so } = await supabase.from('sales_orders').select('logo_url,quote_id').eq('id', inv.so_id as string).maybeSingle()
      logoUrl = (so?.logo_url as string | null) ?? null
      if (!logoUrl && so?.quote_id) {
        const { data: q } = await supabase.from('quotes').select('logo_url').eq('id', so.quote_id as string).maybeSingle()
        logoUrl = (q?.logo_url as string | null) ?? null
      }
    }
  }

  const previewProps = {
    po,
    orgName:    org?.name    ?? '',
    orgAddress: org?.address ?? undefined,
    orgGstin:   org?.gstin   ?? undefined,
    logoUrl,
  }

  return (
    <>
      <div className="no-print" style={{ position:'fixed', inset:0, zIndex:9999, background:'#404040', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <PoPreviewPrintBar poId={po.id} poNo={po.poNo} />
        <div style={{ flex:1, overflowY:'auto', padding:'32px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
          <PoPreview {...previewProps} />
        </div>
      </div>
      <div id="po-print-area">
        <PoPreview {...previewProps} />
      </div>
    </>
  )
}
