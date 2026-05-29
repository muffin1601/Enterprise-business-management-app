import Link from 'next/link'
import { getActionContext } from '@/lib/auth/action-context'
import { getAssignableRoles, listPendingInvitations } from '@/features/admin/server/queries'
import { InviteMemberForm } from '@/features/admin/components/invite-member-form'
import { InvitationsList } from '@/features/admin/components/invitations-list'
import { Alert } from '@/components/ui'
import styles from './page.module.scss'

export const metadata = { title: 'Team · Watcon' }

/** Invite users + pending invitations (Company Setup). Gated by `admin.users`. */
export default async function TeamPage() {
  const ctx = await getActionContext()
  const canManage = ctx.has('admin.users')

  if (!canManage) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Team</h1>
          <Link href="/dashboard" className={styles.back}>← Dashboard</Link>
        </header>
        <Alert tone="warning">You don&rsquo;t have permission to manage team members.</Alert>
      </main>
    )
  }

  const [roles, invitations] = await Promise.all([getAssignableRoles(), listPendingInvitations()])

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>Team</h1>
          <p className={styles.subtitle}>Invite people to your organization.</p>
        </div>
        <Link href="/dashboard" className={styles.back}>← Dashboard</Link>
      </header>

      <div className={styles.grid}>
        <InviteMemberForm roles={roles} />
        <InvitationsList invitations={invitations} />
      </div>
    </main>
  )
}
