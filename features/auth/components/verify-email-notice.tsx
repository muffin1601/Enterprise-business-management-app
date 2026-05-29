'use client'

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { resendVerification } from '@/features/auth/server/actions'
import { AuthCard } from './auth-card'
import { Alert, Button } from '@/components/ui'
import form from './auth-form.module.scss'

/** Post-registration screen: tells the user to confirm their email + resend. */
export function VerifyEmailNotice() {
  const params = useSearchParams()
  const email = params.get('email') ?? ''
  const [isPending, startTransition] = useTransition()
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onResend = () => {
    if (!email) return
    setError(null)
    startTransition(async () => {
      const res = await resendVerification({ email })
      if (res.ok) setResent(true)
      else setError(res.error.message)
    })
  }

  return (
    <AuthCard
      title="Verify your email"
      footer={<Link href="/login">Back to sign in</Link>}
    >
      <p className={form.sent}>
        We sent a verification link{email ? <> to <strong>{email}</strong></> : ''}. Click it to
        activate your account, then sign in.
      </p>

      {resent && (
        <Alert tone="success">A new verification email is on its way.</Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <div className={form.actions}>
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={onResend}
          disabled={!email || resent}
          loading={isPending}
        >
          Resend verification email
        </Button>
      </div>
    </AuthCard>
  )
}
