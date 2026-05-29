'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { revokeInvitation } from '@/features/admin/server/actions'
import type { PendingInvitation } from '@/features/admin/server/queries'
import { Button, Card } from '@/components/ui'
import styles from './admin.module.scss'

export interface InvitationsListProps {
  invitations: PendingInvitation[]
}

export function InvitationsList({ invitations }: InvitationsListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const onRevoke = (id: string) => {
    startTransition(async () => {
      await revokeInvitation({ id })
      router.refresh()
    })
  }

  return (
    <Card>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Pending invitations</h2>
      </header>

      {invitations.length === 0 ? (
        <p className={styles.empty}>No pending invitations.</p>
      ) : (
        <div className={styles.list}>
          {invitations.map((inv) => (
            <div key={inv.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.email}>{inv.email}</span>
                <span className={styles.meta}>
                  {inv.roleName} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
              </div>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => onRevoke(inv.id)}>
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
