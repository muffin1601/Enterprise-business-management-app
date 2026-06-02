import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getSalesOrder } from '@/features/sales-orders/server/queries'
import { getActiveOrganization } from '@/features/company/server/queries'
import { SoPreview, SoPreviewPrintBar } from '@/features/sales-orders/components/so-preview'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const so = await getSalesOrder(id)
  return { title: so ? `${so.soNo} · Preview · Watcon` : 'Preview · Watcon' }
}

export default async function SoPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('sales_orders.view')) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ color: 'var(--c-danger)' }}>You do not have permission to view this page.</div>
      </div>
    )
  }

  const [so, org] = await Promise.all([getSalesOrder(id), getActiveOrganization()])
  if (!so) notFound()

  const previewProps = {
    so,
    orgName:    org?.name    ?? '',
    orgAddress: org?.address ?? undefined,
    orgGstin:   org?.gstin   ?? undefined,
  }

  return (
    <>
      {/* Screen: dark viewer overlay — hidden when printing via .no-print */}
      <div className="no-print" style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#404040', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <SoPreviewPrintBar soId={so.id} soNo={so.soNo} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <SoPreview {...previewProps} />
        </div>
      </div>

      {/* Print-only: flows naturally across A4 pages — shown by @media print */}
      <div id="so-print-area">
        <SoPreview {...previewProps} />
      </div>
    </>
  )
}
