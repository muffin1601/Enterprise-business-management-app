import { getActionContext } from '@/lib/auth/action-context'
import { listMembers } from '@/features/admin/server/queries'
import { UserList } from '@/features/admin/components/user-list'
import { Alert, Button } from '@/components/ui'
import Link from 'next/link'
import styles from './page.module.scss'

export const metadata = { title: 'Users · Watcon' }

export default async function UsersPage() {
  const ctx = await getActionContext()
  const canManage = ctx.has('admin.users')

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>Users</div>
          <div className={styles.subtitle}>People in your organization.</div>
        </div>
        <div className={styles.headerActions}>
          {canManage && (
            <Link href="/settings/team">
              <Button variant="ghost" size="sm">Invite member</Button>
            </Link>
          )}
        </div>
      </header>

      {canManage ? (
        <UserList members={await listMembers()} />
      ) : (
        <Alert tone="warning">You don&apos;t have permission to manage users.</Alert>
      )}
    </main>
  )
}
