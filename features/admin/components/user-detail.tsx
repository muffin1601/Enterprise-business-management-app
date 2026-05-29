import type { AssignableRole, MemberDetail } from '@/features/admin/server/queries'
import { Badge, Card } from '@/components/ui'
import { RoleManager } from './role-manager'
import { UserStatusToggle } from './user-status-toggle'
import styles from './users.module.scss'

export interface UserDetailProps {
  member: MemberDetail
  assignableRoles: AssignableRole[]
  /** Caller holds admin.users. */
  canManage: boolean
  /** The member is the signed-in user (can't deactivate self). */
  isSelf: boolean
}

export function UserDetail({ member, assignableRoles, canManage, isSelf }: UserDetailProps) {
  const statusLocked = !canManage || isSelf || member.isOwner
  const lockReason = isSelf
    ? 'You can’t change your own status.'
    : member.isOwner
      ? 'The company owner can’t be deactivated.'
      : undefined

  return (
    <>
      <Card>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>{member.fullName || member.email}</h2>
            <p className={styles.cardSubtitle}>{member.email}</p>
          </div>
          {member.isOwner && <Badge tone="info">Owner</Badge>}
        </header>

        <div className={styles.facts}>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Phone</span>
            <span>{member.phone || '—'}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Status</span>
            <Badge tone={member.status === 'active' ? 'success' : 'danger'}>
              {member.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Joined</span>
            <span>{new Date(member.joinedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </Card>

      {canManage && (
        <RoleManager
          userId={member.userId}
          currentRoles={member.roles}
          assignableRoles={assignableRoles}
          locked={member.isOwner}
        />
      )}

      {canManage && (
        <UserStatusToggle
          userId={member.userId}
          active={member.status === 'active'}
          locked={statusLocked}
          lockReason={lockReason}
        />
      )}
    </>
  )
}
