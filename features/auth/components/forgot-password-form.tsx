'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { requestPasswordResetSchema, type RequestPasswordResetInput } from '@/validations/auth'
import { requestPasswordReset } from '@/features/auth/server/actions'
import { AuthCard } from './auth-card'
import { Alert, Button, FormField, Input } from '@/components/ui'
import form from './auth-form.module.scss'

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = (values: RequestPasswordResetInput) => {
    setFormError(null)
    startTransition(async () => {
      const res = await requestPasswordReset(values)
      if (res.ok) setSent(true)
      else setFormError(res.error.message)
    })
  }

  if (sent) {
    return (
      <AuthCard title="Check your inbox" footer={<Link href="/login">Back to sign in</Link>}>
        <p className={form.sent}>
          If an account exists for that email, a password reset link is on its way.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={<Link href="/login">Back to sign in</Link>}
    >
      <form className={form.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>

        {formError && <Alert tone="danger">{formError}</Alert>}

        <div className={form.actions}>
          <Button type="submit" variant="primary" fullWidth loading={isPending}>
            Send reset link
          </Button>
        </div>
      </form>
    </AuthCard>
  )
}
