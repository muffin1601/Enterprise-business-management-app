import Link from 'next/link'
import { getActionContext } from '@/lib/auth/action-context'
import { listMembers } from '@/features/admin/server/queries'
import { UserList } from '@/features/admin/components/user-list'
import { Alert } from '@/components/ui'
import styles from './page.module.scss'

export const metadata = { title: 'Users · Watcon' }

/** User List — org roster. Gated by `admin.users` (page + action defense-in-depth). */
export default async function UsersPage() {
  const ctx = await getActionContext()
  const canManage = ctx.has('admin.users')

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>Users</h1>
          <p className={styles.subtitle}>People in your organization.</p>
        </div>
        <div className={styles.headerActions}>
          {canManage && (
            <Link href="/settings/team" className={styles.back}>
              Invite members →
            </Link>
          )}
          <Link href="/dashboard" className={styles.back}>← Dashboard</Link>
        </div>
      </header>

      {canManage ? (
        <UserList members={await listMembers()} />
      ) : (
        <Alert tone="warning">You don&rsquo;t have permission to manage users.</Alert>
      )}
    </main>
  )
}
