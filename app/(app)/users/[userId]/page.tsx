import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import {
  getAssignableRoles, getMemberDetailEnriched, getMemberActivity,
} from '@/features/admin/server/queries'
import { MemberDetailView } from '@/features/admin/components/member-detail-view'
import styles from '@/features/admin/components/team.module.scss'

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const member = await getMemberDetailEnriched(userId)
  return { title: member ? `${member.fullName || member.email} · Users · Watcon` : 'User · Watcon' }
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ userId }, sp] = await Promise.all([params, searchParams])
  const activeTab = (sp.tab ?? 'profile') as 'profile' | 'access' | 'activity'

  const ctx        = await getActionContext()
  const canManage  = ctx.has('admin.users')
  const isSelf     = ctx.userId === userId

  const [member, assignableRoles, activity] = await Promise.all([
    getMemberDetailEnriched(userId),
    canManage ? getAssignableRoles() : [],
    activeTab === 'activity' ? getMemberActivity(userId) : [],
  ])

  if (!member) notFound()

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/users" className={styles.breadcrumbLink}>Team & Users</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{member.fullName || member.email}</span>
      </nav>

      <MemberDetailView
        member={member}
        assignableRoles={assignableRoles}
        activity={activity}
        activeTab={activeTab}
        canManage={canManage}
        isSelf={isSelf}
      />
    </main>
  )
}
