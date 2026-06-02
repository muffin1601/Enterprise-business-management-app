import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listInvoices } from '@/features/invoices/server/queries'
import { invoiceFilterSchema } from '@/validations/invoice'
import { InvoiceListClient } from '@/features/invoices/components/invoice-list-client'
import { InvoiceTopbarAction } from '@/features/invoices/components/invoice-topbar-action'

export const metadata = { title: 'Invoices · Watcon' }

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = invoiceFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : invoiceFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('invoices.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)', fontSize:'var(--fs-500)' }}>
          You do not have permission to view invoices.
        </div>
      </main>
    )
  }

  const page = await listInvoices(filter)

  return (
    <main style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:'var(--font-body)' }}>
      <InvoiceTopbarAction canCreate={ctx.has('invoices.create')} />
      <Suspense fallback={
        <div style={{ padding:'60px 0', textAlign:'center', fontFamily:'var(--font-body)', fontSize:'var(--fs-400)', color:'var(--c-tertiary)' }}>Loading…</div>
      }>
        <InvoiceListClient page={page} canDelete={ctx.has('invoices.delete')} />
      </Suspense>
    </main>
  )
}
