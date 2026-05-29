import { redirect } from 'next/navigation'
import { getOptionalUser, getActiveOrgId } from '@/lib/auth/session'
import { CompanySetupForm } from '@/features/company/components/company-setup-form'
import styles from './page.module.scss'

export const metadata = { title: 'Company setup · Watcon' }

/**
 * Onboarding lives outside the (app) group so the "no org → redirect here"
 * guard can't loop. Requires a session (middleware); if the user already has an
 * org, skip straight to the dashboard.
 */
export default async function CompanySetupPage() {
  const user = await getOptionalUser()
  if (!user) redirect('/login')

  const orgId = await getActiveOrgId()
  if (orgId) redirect('/dashboard')

  return (
    <main className={styles.main}>
      <CompanySetupForm />
    </main>
  )
}
