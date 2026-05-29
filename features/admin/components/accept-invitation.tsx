'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { acceptInvitation } from '@/features/admin/server/actions'
import type { InvitationPreview } from '@/features/admin/server/queries'
import { Alert, Button, Card } from '@/components/ui'
import styles from './admin.module.scss'

export interface AcceptInvitationProps {
  token: string
  preview: InvitationPreview
}

/** Confirm screen for an invitation link. The user must already be signed in. */
export function AcceptInvitation({ token, preview }: AcceptInvitationProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const invalid =
    !preview || preview.status !== 'pending' || preview.expired
      ? 'This invitation is invalid, already used, or expired.'
      : null

  const onAccept = () => {
    setError(null)
    startTransition(async () => {
      const res = await acceptInvitation({ token })
      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
        return
      }
      setError(res.error.message)
    })
  }

  return (
    <Card>
      {invalid ? (
        <>
          <Alert tone="danger">{invalid}</Alert>
          <div className={styles.actions}>
            <Link href="/dashboard">
              <Button variant="secondary">Go to dashboard</Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className={styles.acceptMeta}>
            <span>You&rsquo;ve been invited to join</span>
            <span className={styles.acceptOrg}>{preview!.orgName}</span>
            <span className={styles.meta}>
              as {preview!.roleName} · for {preview!.email}
            </span>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className={styles.actions}>
            <Button variant="primary" loading={isPending} onClick={onAccept}>
              Accept invitation
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
