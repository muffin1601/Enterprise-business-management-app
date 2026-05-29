import Link from 'next/link'
import type { Route } from 'next'
import type { Member } from '@/features/admin/server/queries'
import { Badge, Card } from '@/components/ui'
import styles from './users.module.scss'

export interface UserListProps {
  members: Member[]
}

/** Org roster table. Server-rendered; each row links to the member detail. */
export function UserList({ members }: UserListProps) {
  if (members.length === 0) {
    return (
      <Card>
        <p className={styles.empty}>No members yet.</p>
      </Card>
    )
  }

  return (
    <Card>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Member</th>
            <th>Roles</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className={styles.row}>
              <td>
                <div className={styles.name}>{m.fullName || '—'}</div>
                <div className={styles.sub}>{m.email}</div>
              </td>
              <td>
                <div className={styles.roleChips}>
                  {m.roles.length === 0 ? (
                    <span className={styles.sub}>No role</span>
                  ) : (
                    m.roles.map((r) => (
                      <Badge key={r.key} tone="neutral">
                        {r.name}
                      </Badge>
                    ))
                  )}
                </div>
              </td>
              <td>
                <Badge tone={m.status === 'active' ? 'success' : 'danger'}>
                  {m.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className={styles.linkCell}>
                <Link href={`/users/${m.userId}` as Route}>Manage</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
