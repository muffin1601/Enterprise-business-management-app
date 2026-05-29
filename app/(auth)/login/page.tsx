import { Suspense } from 'react'
import { LoginForm } from '@/features/auth/components/login-form'

export const metadata = { title: 'Sign in · Watcon' }

// LoginForm uses useSearchParams() → wrap in Suspense per Next 15 requirement.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
