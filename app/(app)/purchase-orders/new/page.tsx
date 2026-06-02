import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { PoCreateForm } from '@/features/purchase-orders/components/po-create-form'

export const metadata = { title: 'New Purchase Order · Watcon' }

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await getActionContext()
  if (!ctx.has('purchase_orders.create')) redirect('/purchase-orders')

  const sp = await searchParams
  const preSelectedInvoiceId = sp.invoiceId

  return (
    <main style={{ fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 300, fontFamily: 'var(--font-heading)', color: 'var(--c-ink)', letterSpacing: '0.02em' }}>
          New Purchase Order
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-tertiary)', marginTop: 3 }}>
          Select an issued invoice → pick a vendor → set order details
        </div>
      </div>
      <PoCreateForm preSelectedInvoiceId={preSelectedInvoiceId} />
    </main>
  )
}
