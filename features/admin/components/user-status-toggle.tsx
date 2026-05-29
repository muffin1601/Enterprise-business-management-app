'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setUserStatus } from '@/features/admin/server/actions'
import { Alert, Badge, Button, Card } from '@/components/ui'
import styles from './users.module.scss'

export interface UserStatusToggleProps {
  userId: string
  active: boolean
  /** Owner / self can't be deactivated — disable the control. */
  locked: boolean
  lockReason?: string
}

export function UserStatusToggle({ userId, active, locked, lockReason }: UserStatusToggleProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toggle = () => {
    setError(null)
    startTransition(async () => {
      const res = await setUserStatus({ userId, active: !active })
      if (!res.ok) setError(res.error.message)
      else router.refresh()
    })
  }

  return (
    <Card>
      <div className={styles.statusRow}>
        <div>
          <h2 className={styles.cardTitle}>Account status</h2>
          <p className={styles.cardSubtitle}>
            <Badge tone={active ? 'success' : 'danger'}>{active ? 'Active' : 'Inactive'}</Badge>
          </p>
        </div>
        <Button
          variant={active ? 'danger' : 'primary'}
          disabled={locked || isPending}
          loading={isPending}
          onClick={toggle}
        >
          {active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {locked && lockReason && <p className={styles.note}>{lockReason}</p>}
    </Card>
  )
}
