import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { SoCreateForm } from '@/features/sales-orders/components/so-create-form'

export const metadata = { title: 'New Sales Order · Watcon' }

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await getActionContext()
  if (!ctx.has('sales_orders.create')) redirect('/orders')

  const sp = await searchParams
  const preSelectedQuoteId = sp.quoteId

  return (
    <main style={{ fontFamily: 'var(--font-body)' }}>
      <div style={{
        padding: '0px 0px 20px 0px',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 300, fontFamily: 'var(--font-heading)', color: 'var(--c-ink)', letterSpacing: '0.02em' }}>
            New Sales Order
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-tertiary)', marginTop: 3 }}>
            Select an accepted quote, then fill in delivery details
          </div>
        </div>
      </div>
      <SoCreateForm preSelectedQuoteId={preSelectedQuoteId} />
    </main>
  )
}
