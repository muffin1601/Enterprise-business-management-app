import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listVendors } from '@/features/vendors/server/queries'
import { vendorFilterSchema } from '@/validations/vendor'
import { VendorFilters } from '@/features/vendors/components/vendor-filters'
import { VendorListClient } from '@/features/vendors/components/vendor-list-client'
import { VendorTopbarAction } from '@/features/vendors/components/vendor-topbar-action'
import styles from '@/features/vendors/components/vendors.module.scss'

export const metadata = { title: 'Vendors · Watcon' }

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = vendorFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : vendorFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('vendors.view')) {
    return (
      <main className={styles.page}>
        <div style={{
          padding: '14px 18px', background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to view vendors.
        </div>
      </main>
    )
  }

  const page = await listVendors(filter)

  return (
    <main className={styles.page}>
      {ctx.has('vendors.create') && <VendorTopbarAction canCreate />}

      <Suspense>
        <VendorFilters total={page.total} />
      </Suspense>

      <Suspense fallback={
        <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-400)', color: 'var(--c-tertiary)', letterSpacing: '0.08em' }}>
          Loading…
        </div>
      }>
        <VendorListClient page={page} canEdit={ctx.has('vendors.edit')} canDelete={ctx.has('vendors.delete')} />
      </Suspense>
    </main>
  )
}
