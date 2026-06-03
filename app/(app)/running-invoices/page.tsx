import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listRunningInvoices, getUnbilledDcWorklist } from '@/features/running-invoices/server/queries'
import { riFilterSchema } from '@/validations/running-invoice'
import { RiListClient }   from '@/features/running-invoices/components/ri-list-client'
import { RiTopbarAction } from '@/features/running-invoices/components/ri-topbar-action'
import { RiWorklist }     from '@/features/running-invoices/components/ri-worklist'

export const metadata = { title: 'Running Invoices · Watcon' }

export default async function RunningInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = riFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : riFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('running_bill.view')) {
    return (
      <main style={{ padding:24, fontFamily:'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)' }}>
          You do not have permission to view running invoices.
        </div>
      </main>
    )
  }

  const canCreate = ctx.has('running_bill.create')

  const [page, worklist] = await Promise.all([
    listRunningInvoices(filter),
    canCreate ? getUnbilledDcWorklist() : [],
  ])

  return (
    <main style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:'var(--font-body)' }}>
      <RiTopbarAction canCreate={canCreate} />

      {worklist.length > 0 && (
        <RiWorklist rows={worklist} canCreate={canCreate} />
      )}

      <Suspense fallback={<div style={{ padding:'60px 0', textAlign:'center', color:'var(--c-tertiary)' }}>Loading…</div>}>
        <RiListClient page={page} canDelete={ctx.has('running_bill.delete')} />
      </Suspense>
    </main>
  )
}
