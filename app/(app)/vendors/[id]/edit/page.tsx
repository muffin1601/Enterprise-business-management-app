import { notFound, redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getVendor } from '@/features/vendors/server/queries'
import { VendorForm } from '@/features/vendors/components/vendor-form'
import styles from '@/features/vendors/components/vendors.module.scss'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vendor = await getVendor(id)
  return { title: vendor ? `Edit ${vendor.name} · Watcon` : 'Edit Vendor · Watcon' }
}

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getActionContext()
  if (!ctx.has('vendors.edit')) redirect(`/vendors/${id}`)

  const vendor = await getVendor(id)
  if (!vendor) notFound()

  return (
    <main className={styles.page}>
      <div className={styles.formPageHeader}>
        <div className={styles.formPageTitle}>Edit Vendor</div>
        <div className={styles.formPageSubtitle}>{vendor.name} · {vendor.code}</div>
      </div>
      <VendorForm
        mode="edit"
        vendorId={id}
        defaultValues={{
          name:            vendor.name,
          type:            vendor.type as 'supplier' | 'manufacturer' | 'trader' | 'service_provider' | 'contractor' | 'importer' | 'other',
          status:          vendor.status as 'active' | 'inactive' | 'blacklisted',
          contactPerson:   vendor.contactPerson ?? undefined,
          phone:           vendor.phone ?? undefined,
          email:           vendor.email ?? undefined,
          website:         vendor.website ?? undefined,
          gstin:           vendor.gstin ?? undefined,
          pan:             vendor.pan ?? undefined,
          msmeNo:          vendor.msmeNo ?? undefined,
          billingAddress:  vendor.billingAddress ?? undefined,
          shippingAddress: vendor.shippingAddress ?? undefined,
          city:            vendor.city ?? undefined,
          state:           vendor.state ?? undefined,
          pincode:         vendor.pincode ?? undefined,
          country:         vendor.country,
          paymentTerms:    vendor.paymentTerms as 'immediate' | 'net_7' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'net_90' | 'advance',
          creditLimit:     vendor.creditLimit,
          currency:        vendor.currency,
          industry:        vendor.industry ?? undefined,
          notes:           vendor.notes ?? undefined,
        }}
      />
    </main>
  )
}
