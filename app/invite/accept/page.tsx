import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getOptionalUser } from '@/lib/auth/session'
import { getInvitationPreview } from '@/features/admin/server/queries'
import { AcceptInvitation } from '@/features/admin/components/accept-invitation'
import { Alert } from '@/components/ui'
import styles from './page.module.scss'

export const metadata = { title: 'Accept invitation · Watcon' }

/**
 * Invitation accept screen. Reachable pre-membership (lives outside the (app)
 * group, so the no-org guard doesn't fire). Requires a session — if absent we
 * redirect to login, preserving the full path + ?token= so it survives the round
 * trip (middleware lets /invite through for exactly this reason).
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <main className={styles.main}>
        <div className={styles.inner}>
          <Alert tone="danger">This invitation link is missing its token.</Alert>
        </div>
      </main>
    )
  }

  const user = await getOptionalUser()
  if (!user) {
    const dest = `/invite/accept?token=${encodeURIComponent(token)}`
    redirect(`/login?redirectTo=${encodeURIComponent(dest)}` as Route)
  }

  const preview = await getInvitationPreview(token)

  return (
    <main className={styles.main}>
      <div className={styles.inner}>
        <div className={styles.brand}>Watcon</div>
        <AcceptInvitation token={token} preview={preview} />
      </div>
    </main>
  )
}
