'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { resetPasswordSchema, type ResetPasswordInput } from '@/validations/auth'
import { resetPassword } from '@/features/auth/server/actions'
import { AuthCard } from './auth-card'
import { Alert, Button, FormField, Input } from '@/components/ui'
import form from './auth-form.module.scss'

export function ResetPasswordForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = (values: ResetPasswordInput) => {
    setFormError(null)
    startTransition(async () => {
      const res = await resetPassword(values)
      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof ResetPasswordInput, { message: msgs?.[0] })
        }
      }
      setFormError(res.error.message)
    })
  }

  return (
    <AuthCard title="Choose a new password">
      <form className={form.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="New password" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </FormField>

        <FormField label="Confirm password" error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>

        {formError && <Alert tone="danger">{formError}</Alert>}

        <div className={form.actions}>
          <Button type="submit" variant="primary" fullWidth loading={isPending}>
            Update password
          </Button>
        </div>
      </form>
    </AuthCard>
  )
}
