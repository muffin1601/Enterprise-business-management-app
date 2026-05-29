import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getAssignableRoles, getMemberDetail } from '@/features/admin/server/queries'
import { UserDetail } from '@/features/admin/components/user-detail'
import { Alert } from '@/components/ui'
import styles from './page.module.scss'

export const metadata = { title: 'User · Watcon' }

/** User Detail + Edit (roles, status). Gated by `admin.users`. */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const ctx = await getActionContext()
  const canManage = ctx.has('admin.users')

  if (!canManage) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>User</h1>
          <Link href={'/users' as Route} className={styles.back}>← Users</Link>
        </header>
        <Alert tone="warning">You don&rsquo;t have permission to manage users.</Alert>
      </main>
    )
  }

  const [member, assignableRoles] = await Promise.all([getMemberDetail(userId), getAssignableRoles()])
  if (!member) notFound()

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>Manage member</h1>
        <Link href={'/users' as Route} className={styles.back}>← Users</Link>
      </header>

      <div className={styles.grid}>
        <UserDetail
          member={member}
          assignableRoles={assignableRoles}
          canManage={canManage}
          isSelf={member.userId === ctx.userId}
        />
      </div>
    </main>
  )
}
