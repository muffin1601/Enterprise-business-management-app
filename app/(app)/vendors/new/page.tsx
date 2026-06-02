import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { VendorForm } from '@/features/vendors/components/vendor-form'
import styles from '@/features/vendors/components/vendors.module.scss'

export const metadata = { title: 'New Vendor · Watcon' }

export default async function NewVendorPage() {
  const ctx = await getActionContext()
  if (!ctx.has('vendors.create')) redirect('/vendors')

  return (
    <main className={styles.page}>
      <div className={styles.formPageHeader}>
        <div className={styles.formPageTitle}>New Vendor</div>
        <div className={styles.formPageSubtitle}>Add a new vendor to your procurement directory</div>
      </div>
      <VendorForm mode="create" />
    </main>
  )
}
