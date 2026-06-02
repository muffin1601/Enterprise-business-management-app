import { Suspense } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import {
  listMembers, listAllInvitations, getAssignableRoles, getTeamStats,
} from '@/features/admin/server/queries'
import { TeamStats }        from '@/features/admin/components/team-stats'
import { MemberCards }      from '@/features/admin/components/member-cards'
import { InvitationsPanel } from '@/features/admin/components/invitations-panel'
import { BulkInviteForm }   from '@/features/admin/components/bulk-invite-form'
import { PageActions }      from '@/components/app-shell/page-actions'
import styles from '@/features/admin/components/team.module.scss'

export const metadata = { title: 'Team & Users · Watcon' }

export default async function UsersPage() {
  const ctx       = await getActionContext()
  const canManage = ctx.has('admin.users')

  const [members, stats, invitations, roles] = await Promise.all([
    listMembers(),
    getTeamStats(),
    canManage ? listAllInvitations() : Promise.resolve([]),
    canManage ? getAssignableRoles() : Promise.resolve([]),
  ])

  return (
    <main className={styles.page}>
      {canManage && (
        <PageActions>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {roles.length > 0 && <BulkInviteForm roles={roles} />}
            <Link
              href="/settings/team"
              style={{
                display:'inline-flex', alignItems:'center', gap:6,
                background:'var(--c-ink)', color:'var(--c-inverse)',
                border:'1px solid var(--c-ink)', padding:'8px 18px',
                fontFamily:'var(--font-body)', fontSize:11, fontWeight:500,
                letterSpacing:'0.10em', textTransform:'uppercase',
                textDecoration:'none', borderRadius:'var(--radius-sm)',
              }}
            >
              + Invite Member
            </Link>
          </div>
        </PageActions>
      )}

      <TeamStats stats={stats} />

      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Team Members</div>
        {canManage && (
          <Link href={'/users/roles' as Route} className={styles.rolesLink}>
            Manage Roles →
          </Link>
        )}
      </div>

      <Suspense>
        <MemberCards members={members} canManage={canManage} />
      </Suspense>

      {canManage && invitations.length > 0 && (
        <InvitationsPanel invitations={invitations} canManage={canManage} />
      )}
    </main>
  )
}
