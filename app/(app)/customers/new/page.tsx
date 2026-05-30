import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { CustomerForm } from '@/features/customers/components/customer-form'
import styles from '@/features/customers/components/customers.module.scss'

export const metadata = { title: 'New Customer · Watcon' }

export default async function NewCustomerPage() {
  const ctx = await getActionContext()
  if (!ctx.has('customers.create')) redirect('/customers')

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>New Customer</div>
          <div className={styles.subtitle}>Add a new customer to your CRM.</div>
        </div>
      </header>

      <CustomerForm mode="create" />
    </main>
  )
}
