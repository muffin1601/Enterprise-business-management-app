'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useOverview } from '@/features/dashboard/hooks'
import { Card } from '@/components/ui'
import styles from './dashboard.module.scss'

type Action = { href: Route; title: string; desc: string; show: boolean }

/** Quick links to real, permission-gated destinations. */
export function QuickActions() {
  const { data } = useOverview()
  const canManage = data?.perms.canManageUsers ?? false

  const actions: Action[] = [
    { href: '/items' as Route, title: 'Catalogue', desc: 'Items, pricing & stock', show: true },
    { href: '/settings/team' as Route, title: 'Invite member', desc: 'Add someone to your org', show: canManage },
    { href: '/users' as Route, title: 'Manage users', desc: 'Roles & access', show: canManage },
    { href: '/settings/company' as Route, title: 'Company settings', desc: 'Profile & tax', show: true },
    { href: '/account' as Route, title: 'Your profile', desc: 'Name & password', show: true },
  ]

  return (
    <Card>
      <div className={styles.widgetHeader}>
        <h2 className={styles.widgetTitle}>Quick actions</h2>
      </div>
      <div className={styles.actions}>
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <Link key={a.href} href={a.href} className={styles.action}>
              <span className={styles.actionTitle}>{a.title}</span>
              <span className={styles.actionDesc}>{a.desc}</span>
            </Link>
          ))}
      </div>
    </Card>
  )
}
