import { Suspense } from 'react'
import { VerifyEmailNotice } from '@/features/auth/components/verify-email-notice'

export const metadata = { title: 'Verify email · Watcon' }

// VerifyEmailNotice reads ?email= via useSearchParams() → wrap in Suspense.
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailNotice />
    </Suspense>
  )
}
