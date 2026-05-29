import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'

export const metadata = { title: 'New password · Watcon' }

// Reached via the recovery link → /auth/callback (establishes session) → here.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
