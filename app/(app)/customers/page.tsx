import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listCustomers } from '@/features/customers/server/queries'
import { customerFilterSchema } from '@/validations/customer'
import { CustomerFilters } from '@/features/customers/components/customer-filters'
import { CustomerListClient } from '@/features/customers/components/customer-list-client'
import { CustomerTopbarAction } from '@/features/customers/components/customer-topbar-action'
import styles from '@/features/customers/components/customers.module.scss'

export const metadata = { title: 'Customers · Watcon' }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = customerFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : customerFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('customers.view')) {
    return (
      <main className={styles.page}>
        <div style={{
          padding: '14px 18px',
          background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to view customers.
        </div>
      </main>
    )
  }

  const page = await listCustomers(filter)

  const canEdit   = ctx.has('customers.edit')
  const canDelete = ctx.has('customers.delete')

  return (
    <main className={styles.page}>
      {ctx.has('customers.create') && <CustomerTopbarAction />}

      <Suspense>
        <CustomerFilters total={page.total} />
      </Suspense>

      <Suspense fallback={
        <div style={{
          padding: '60px 0', textAlign: 'center',
          fontFamily: 'var(--font-body)', fontSize: 'var(--fs-400)',
          color: 'var(--c-tertiary)', letterSpacing: '0.08em',
        }}>
          Loading…
        </div>
      }>
        <CustomerListClient page={page} canEdit={canEdit} canDelete={canDelete} />
      </Suspense>
    </main>
  )
}
