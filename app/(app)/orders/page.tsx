import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listSalesOrders } from '@/features/sales-orders/server/queries'
import { soFilterSchema } from '@/validations/sales-order'
import { SoListClient } from '@/features/sales-orders/components/so-list-client'
import { SoTopbarAction } from '@/features/sales-orders/components/so-topbar-action'

export const metadata = { title: 'Sales Orders · Watcon' }

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = soFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : soFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('sales_orders.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)', fontSize:'var(--fs-500)' }}>
          You do not have permission to view sales orders.
        </div>
      </main>
    )
  }

  const page = await listSalesOrders(filter)

  return (
    <main style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:'var(--font-body)' }}>
      <SoTopbarAction canCreate={ctx.has('sales_orders.create')} />

      <Suspense fallback={
        <div style={{ padding:'60px 0', textAlign:'center', fontFamily:'var(--font-body)', fontSize:'var(--fs-400)', color:'var(--c-tertiary)', letterSpacing:'0.08em' }}>Loading…</div>
      }>
        <SoListClient
          page={page}
          canDelete={ctx.has('sales_orders.delete')}
        />
      </Suspense>
    </main>
  )
}
