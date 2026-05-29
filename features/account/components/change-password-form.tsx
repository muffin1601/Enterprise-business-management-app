'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { changePasswordSchema, type ChangePasswordInput } from '@/validations/user'
import { changePassword } from '@/features/account/server/actions'
import { Alert, Button, Card, FormField, Input } from '@/components/ui'
import styles from './account-forms.module.scss'

/** Set a new password for the current session. */
export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = (values: ChangePasswordInput) => {
    setStatus('idle')
    setFormError(null)
    startTransition(async () => {
      const res = await changePassword(values)
      if (res.ok) {
        setStatus('saved')
        reset({ password: '', confirmPassword: '' })
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof ChangePasswordInput, { message: msgs?.[0] })
        }
      }
      setStatus('error')
      setFormError(res.error.message)
    })
  }

  return (
    <Card>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Password</h2>
        <p className={styles.cardSubtitle}>Choose a strong password you don&rsquo;t use elsewhere.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="New password" required error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </FormField>

        <FormField label="Confirm password" required error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>

        {status === 'saved' && <Alert tone="success">Password updated.</Alert>}
        {status === 'error' && formError && <Alert tone="danger">{formError}</Alert>}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={isPending}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  )
}
