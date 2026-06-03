import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { RiCreateFlow } from '@/features/running-invoices/components/ri-create-flow'

export const metadata = { title: 'New Running Invoice · Watcon' }

export default async function NewRunningInvoicePage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getActionContext()
  if (!ctx.has('running_bill.create')) redirect('/running-invoices')

  const sp = await searchParams
  const preSelectedSoId = sp.soId

  return (
    <main style={{ fontFamily:'var(--font-body)', display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <div style={{ fontSize:22, fontWeight:300, fontFamily:'var(--font-heading)', color:'var(--c-ink)', letterSpacing:'0.02em' }}>
          New Running Invoice
        </div>
        <div style={{ fontSize:12, color:'var(--c-tertiary)', marginTop:3 }}>
          Select a sales order → pick delivered challans → configure and create
        </div>
      </div>
      <RiCreateFlow preSelectedSoId={preSelectedSoId} />
    </main>
  )
}
