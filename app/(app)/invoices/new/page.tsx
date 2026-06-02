import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { InvoiceCreateForm } from '@/features/invoices/components/invoice-create-form'

export const metadata = { title: 'New Invoice · Watcon' }

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await getActionContext()
  if (!ctx.has('invoices.create')) redirect('/invoices')

  const sp = await searchParams
  const preSelectedSoId = sp.soId

  return (
    <main style={{ fontFamily: 'var(--font-body)' }}>
      <div style={{
        padding: '0 0 20px 0',
        borderBottom: '1px solid var(--c-border)',
        marginBottom: 0,
      }}>
        <div style={{ fontSize: 22, fontWeight: 300, fontFamily: 'var(--font-heading)', color: 'var(--c-ink)', letterSpacing: '0.02em' }}>
          New Invoice
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-tertiary)', marginTop: 3 }}>
          Select a sales order, then set invoice details
        </div>
      </div>
      <InvoiceCreateForm preSelectedSoId={preSelectedSoId} />
    </main>
  )
}
