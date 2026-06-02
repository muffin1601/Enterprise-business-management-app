import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listChallans } from '@/features/delivery-challans/server/queries'
import { dcFilterSchema } from '@/validations/delivery-challan'
import { DcListClient } from '@/features/delivery-challans/components/dc-list-client'
import { DcTopbarAction } from '@/features/delivery-challans/components/dc-topbar-action'

export const metadata = { title: 'Delivery Challans · Watcon' }

export default async function DeliveryChallansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = dcFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : dcFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('challans.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)' }}>
          You do not have permission to view delivery challans.
        </div>
      </main>
    )
  }

  const page = await listChallans(filter)

  return (
    <main style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:'var(--font-body)' }}>
      <DcTopbarAction canCreate={ctx.has('challans.create')} />
      <Suspense fallback={<div style={{ padding:'60px 0', textAlign:'center', color:'var(--c-tertiary)' }}>Loading…</div>}>
        <DcListClient page={page} canDelete={ctx.has('challans.delete')} />
      </Suspense>
    </main>
  )
}
