import { notFound, redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getCustomer } from '@/features/customers/server/queries'
import { CustomerForm } from '@/features/customers/components/customer-form'
import styles from '@/features/customers/components/customers.module.scss'

export const metadata = { title: 'Edit Customer · Watcon' }

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('customers.edit')) redirect(`/customers/${id}`)

  const customer = await getCustomer(id)
  if (!customer) notFound()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>Edit Customer</div>
          <div className={styles.subtitle}>{customer.name} · {customer.code}</div>
        </div>
      </header>

      <CustomerForm
        mode="edit"
        customerId={id}
        defaultValues={{
          name:             customer.name,
          contactPerson:    customer.contactPerson ?? undefined,
          phone:            customer.phone ?? undefined,
          email:            customer.email ?? undefined,
          website:          customer.website ?? undefined,
          gstin:            customer.gstin ?? undefined,
          pan:              customer.pan ?? undefined,
          industry:         customer.industry ?? undefined,
          type:             customer.type as any,
          status:           customer.status as any,
          creditLimit:      customer.creditLimit,
          paymentTerms:     customer.paymentTerms as any,
          postSaleDiscount: customer.postSaleDiscount,
          billingName:      customer.billingName ?? undefined,
          billingAddress:   customer.billingAddress ?? undefined,
          deliveryName:     customer.deliveryName ?? undefined,
          deliveryAddress:  customer.deliveryAddress ?? undefined,
          sameAsBilling:    customer.sameAsBilling,
          notes:            customer.notes ?? undefined,
        }}
      />
    </main>
  )
}
