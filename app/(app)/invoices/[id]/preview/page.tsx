import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getInvoice } from '@/features/invoices/server/queries'
import { getActiveOrganization } from '@/features/company/server/queries'
import { InvoicePreview, InvoicePreviewPrintBar } from '@/features/invoices/components/invoice-preview'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inv = await getInvoice(id)
  return { title: inv ? `${inv.invoiceNo} · Preview · Watcon` : 'Invoice Preview · Watcon' }
}

export default async function InvoicePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('invoices.view')) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: 'var(--c-danger)' }}>You do not have permission to view this page.</div>
      </div>
    )
  }

  const [inv, org] = await Promise.all([getInvoice(id), getActiveOrganization()])
  if (!inv) notFound()

  // Fallback: fetch logo from the originating SO's quote
  let logoUrl = inv.logoUrl ?? null
  if (!logoUrl && inv.soId) {
    const supabase = await createSupabaseServerClient()
    const { data: so } = await supabase
      .from('sales_orders')
      .select('logo_url,quote_id')
      .eq('id', inv.soId)
      .maybeSingle()
    logoUrl = (so?.logo_url as string | null) ?? null
    if (!logoUrl && so?.quote_id) {
      const { data: q } = await supabase
        .from('quotes')
        .select('logo_url')
        .eq('id', so.quote_id as string)
        .maybeSingle()
      logoUrl = (q?.logo_url as string | null) ?? null
    }
  }

  const previewProps = {
    inv:        { ...inv, logoUrl },
    orgName:    org?.name    ?? '',
    orgAddress: org?.address ?? undefined,
    orgGstin:   org?.gstin   ?? undefined,
  }

  return (
    <>
      <div className="no-print" style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#404040', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <InvoicePreviewPrintBar invId={inv.id} invNo={inv.invoiceNo} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <InvoicePreview {...previewProps} />
        </div>
      </div>
      {/* Print-only: flows naturally across A4 pages — shown by @media print */}
      <div id="invoice-print-area">
        <InvoicePreview {...previewProps} />
      </div>
    </>
  )
}
