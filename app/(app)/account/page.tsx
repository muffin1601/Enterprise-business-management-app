import { getMyProfile } from '@/features/account/server/queries'
import { ProfileForm } from '@/features/account/components/profile-form'
import { ChangePasswordForm } from '@/features/account/components/change-password-form'
import styles from './page.module.scss'

export const metadata = { title: 'Account · Watcon' }

export default async function AccountPage() {
  const profile = await getMyProfile()

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Account</div>
          <div className={styles.subtitle}>Manage your profile and password.</div>
        </div>
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
