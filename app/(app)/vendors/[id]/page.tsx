import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import {
  getVendor, getVendorNotes, getVendorDocuments, getVendorActivity,
} from '@/features/vendors/server/queries'
import { VendorDetailView } from '@/features/vendors/components/vendor-detail'
import styles from '@/features/vendors/components/vendors.module.scss'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vendor = await getVendor(id)
  return { title: vendor ? `${vendor.name} · Vendors · Watcon` : 'Vendor · Watcon' }
}

export default async function VendorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const activeTab = sp.tab ?? 'overview'

  const ctx = await getActionContext()
  if (!ctx.has('vendors.view')) {
    return (
      <main className={styles.page}>
        <div style={{ padding: '14px 18px', background: 'var(--c-danger-bg)', color: 'var(--c-danger)', border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)' }}>
          You do not have permission to view vendors.
        </div>
      </main>
    )
  }

  const vendor = await getVendor(id)
  if (!vendor) notFound()

  const [notes, documents, activity] = await Promise.all([
    getVendorNotes(id),
    getVendorDocuments(id),
    getVendorActivity(id),
  ])

  return (
    <VendorDetailView
      vendor={vendor}
      activeTab={activeTab}
      notes={notes}
      documents={documents}
      activity={activity}
      canEdit={ctx.has('vendors.edit')}
      canDelete={ctx.has('vendors.delete')}
    />
  )
}
