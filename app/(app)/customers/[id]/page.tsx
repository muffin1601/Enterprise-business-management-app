import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import {
  getCustomer,
  getCustomerActivity,
  getCustomerBillingKPIs,
  getCustomerInvoices,
  getCustomerPayments,
  getCustomerAging,
  getCustomerLedger,
  getCustomerNotes,
} from '@/features/customers/server/queries'
import { CustomerDetailView } from '@/features/customers/components/customer-detail'
import styles from '@/features/customers/components/customers.module.scss'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await getCustomer(id)
  return { title: customer ? `${customer.name} · Watcon` : 'Customer · Watcon' }
}

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const activeTab = sp.tab ?? 'overview'

  const ctx = await getActionContext()
  if (!ctx.has('customers.view')) {
    return (
      <main className={styles.page}>
        <div style={{
          padding: '14px 18px', background: 'var(--c-danger-bg)',
          color: 'var(--c-danger)', border: '1px solid var(--c-danger)',
          borderLeft: '3px solid var(--c-danger)', borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to view customers.
        </div>
      </main>
    )
  }

  const customer = await getCustomer(id)
  if (!customer) notFound()

  // Fetch tab-specific data in parallel — only what the active tab needs
  const [activity, kpis, invoices, payments, aging, ledger, notes] = await Promise.all([
    getCustomerActivity(id),
    getCustomerBillingKPIs(id),
    getCustomerInvoices(id),
    getCustomerPayments(id),
    getCustomerAging(id),
    getCustomerLedger(id),
    getCustomerNotes(id),
  ])

  return (
    <CustomerDetailView
      customer={customer}
      activeTab={activeTab}
      activity={activity}
      kpis={kpis}
      invoices={invoices}
      payments={payments}
      aging={aging}
      ledger={ledger}
      notes={notes}
      canEdit={ctx.has('customers.edit')}
      canDelete={ctx.has('customers.delete')}
    />
  )
}
