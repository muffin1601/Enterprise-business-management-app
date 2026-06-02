'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Member } from '../server/queries'
import { setUserStatus } from '@/features/admin/server/actions'
import { removeMember } from '../server/team-actions'
import { Icon } from '@/components/ui'
import styles from './team.module.scss'

function getInitials(name: string, email: string) {
  const n = name.trim()
  if (!n) return (email[0] ?? 'U').toUpperCase()
  return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function RoleBadge({ role }: { role: string }) {
  const isOwner   = role.toLowerCase().includes('owner')
  const isManager = role.toLowerCase().includes('manager')
  return (
    <span className={`${styles.roleBadge} ${isOwner ? styles.roleOwner : isManager ? styles.roleManager : styles.roleDefault}`}>
      {role}
    </span>
  )
}

function MemberCard({ member, canManage }: { member: Member; canManage: boolean }) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleToggle() {
    startT(async () => {
      await setUserStatus({ userId: member.userId, active: member.status !== 'active' })
      router.refresh()
    })
  }

  function handleRemove() {
    if (!confirm(`Remove ${member.fullName || member.email} from the organisation? This cannot be undone.`)) return
    startT(async () => {
      const res = await removeMember(member.userId)
      if (!res.ok) alert(res.error?.message ?? 'Failed to remove member.')
      else router.refresh()
    })
  }

  return (
    <div className={`${styles.memberCard} ${member.status !== 'active' ? styles.memberInactive : ''}`}>
      <Link href={`/users/${member.userId}` as Route} className={styles.memberLink}>
        {/* Avatar */}
        <div className={`${styles.memberAvatar} ${member.status !== 'active' ? styles.memberAvatarInactive : ''}`}>
          {getInitials(member.fullName, member.email)}
        </div>

        {/* Info */}
        <div className={styles.memberInfo}>
          <div className={styles.memberName}>
            {member.fullName || <span style={{ color:'var(--c-tertiary)' }}>—</span>}
          </div>
          <div className={styles.memberEmail}>{member.email}</div>
          <div className={styles.memberRoles}>
            {member.roles.length === 0
              ? <span className={styles.noRole}>No role assigned</span>
              : member.roles.map(r => <RoleBadge key={r.key} role={r.name} />)
            }
          </div>
        </div>

        {/* Status */}
        <div className={styles.memberStatusCol}>
          <span className={`${styles.statusDot} ${member.status === 'active' ? styles.dotActive : styles.dotInactive}`} />
          <span className={styles.statusLabel}>{member.status === 'active' ? 'Active' : 'Inactive'}</span>
          <div className={styles.joinedDate}>
            Joined {new Date(member.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </div>
        </div>
      </Link>

      {/* Actions — outside the link */}
      {canManage && (
        <div className={styles.memberActions}>
          <Link href={`/users/${member.userId}` as Route} className={styles.actionBtn} title="Manage">
            <Icon name="settings" size={14} />
          </Link>
          <button className={styles.actionBtn} onClick={handleToggle} title={member.status === 'active' ? 'Deactivate' : 'Activate'}>
            <Icon name={member.status === 'active' ? 'user-off' : 'user-check'} size={14} />
          </button>
          {!member.roles.some(r => r.key === 'company_owner') && (
            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={handleRemove} title="Remove member">
              <Icon name="user-minus" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface Props { members: Member[]; canManage: boolean }

export function MemberCards({ members, canManage }: Props) {
  if (members.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Icon name="users" size={36} />
        <div className={styles.emptyTitle}>No members yet</div>
        <div className={styles.emptySub}>Invite your first team member to get started</div>
      </div>
    )
  }

  return (
    <div className={styles.memberGrid}>
      {members.map(m => <MemberCard key={m.userId} member={m} canManage={canManage} />)}
    </div>
  )
}
