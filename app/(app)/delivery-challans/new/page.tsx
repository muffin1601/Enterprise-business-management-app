import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { checkStockForInvoice } from '@/features/delivery-challans/server/stock-check'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DcCreateFlow } from '@/features/delivery-challans/components/dc-create-flow'
import { DcInvoicePicker } from '@/features/delivery-challans/components/dc-invoice-picker'

export const metadata = { title: 'New Delivery Challan · Watcon' }

export default async function NewDeliveryChallanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await getActionContext()
  if (!ctx.has('challans.create')) redirect('/delivery-challans')

  const sp        = await searchParams
  const invoiceId = sp.invoiceId

  if (!invoiceId) {
    return (
      <main style={{ fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 300, fontFamily: 'var(--font-heading)', color: 'var(--c-ink)', letterSpacing: '0.02em' }}>
            New Delivery Challan
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-tertiary)', marginTop: 3 }}>
            Select an issued invoice to check stock and generate a delivery challan
          </div>
        </div>
        <DcInvoicePicker />
      </main>
    )
  }

  const stockResult = await checkStockForInvoice(invoiceId)
  if (!stockResult) notFound()

  if (stockResult.invoiceStatus !== 'issued') redirect(`/invoices/${invoiceId}`)

  let deliveryAddress: string | null = null
  let siteContactName: string | null = null
  let siteContactPhone: string | null = null

  try {
    const supabase = await createSupabaseServerClient()
    const { data: inv } = await supabase.from('invoices').select('so_id').eq('id', invoiceId).maybeSingle()
    if (inv?.so_id) {
      const { data: so } = await supabase.from('sales_orders')
        .select('delivery_address,site_contact_name,site_contact_phone')
        .eq('id', inv.so_id as string).maybeSingle()
      deliveryAddress  = (so?.delivery_address as string | null) ?? null
      siteContactName  = (so?.site_contact_name as string | null) ?? null
      siteContactPhone = (so?.site_contact_phone as string | null) ?? null
    }
  } catch {}

  return (
    <main style={{ fontFamily: 'var(--font-body)' }}>
      <DcCreateFlow
        stockResult={stockResult}
        invoiceId={invoiceId}
        canCreatePo={ctx.has('purchase_orders.create')}
        deliveryAddress={deliveryAddress}
        siteContactName={siteContactName}
        siteContactPhone={siteContactPhone}
      />
    </main>
  )
}
