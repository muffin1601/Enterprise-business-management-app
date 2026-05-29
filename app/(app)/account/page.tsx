import Link from 'next/link'
import { getMyProfile } from '@/features/account/server/queries'
import { ProfileForm } from '@/features/account/components/profile-form'
import { ChangePasswordForm } from '@/features/account/components/change-password-form'
import styles from './page.module.scss'

export const metadata = { title: 'Account · Watcon' }

/**
 * User Profile (self-service). Lives in the protected (app) group, so it
 * requires a session + active org (the (app) layout enforces both).
 */
export default async function AccountPage() {
  const profile = await getMyProfile()

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>Account</h1>
          <p className={styles.subtitle}>Manage your profile and password.</p>
        </div>
        <Link href="/dashboard" className={styles.back}>
          ← Dashboard
        </Link>
      </header>

      <div className={styles.grid}>
        <ProfileForm
          email={profile.email}
          defaultValues={{
            fullName: profile.fullName,
            phone: profile.phone,
            avatarUrl: profile.avatarUrl,
          }}
        />
        <ChangePasswordForm />
      </div>
    </main>
  )
}
