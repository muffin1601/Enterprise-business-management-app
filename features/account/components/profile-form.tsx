'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateProfileSchema, type UpdateProfileInput } from '@/validations/user'
import { updateProfile } from '@/features/account/server/actions'
import { Alert, Button, Card, FormField, Input } from '@/components/ui'
import styles from './account-forms.module.scss'

export interface ProfileFormProps {
  email: string
  defaultValues: UpdateProfileInput
}

/** Edit display profile (name, phone, avatar URL). Email is shown read-only. */
export function ProfileForm({ email, defaultValues }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues,
  })

  const onSubmit = (values: UpdateProfileInput) => {
    setStatus('idle')
    setFormError(null)
    startTransition(async () => {
      const res = await updateProfile(values)
      if (res.ok) {
        setStatus('saved')
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof UpdateProfileInput, { message: msgs?.[0] })
        }
      }
      setStatus('error')
      setFormError(res.error.message)
    })
  }

  return (
    <Card>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Profile</h2>
        <p className={styles.cardSubtitle}>Your personal details.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email">
          <Input value={email} readOnly disabled />
        </FormField>

        <FormField label="Full name" required error={errors.fullName?.message}>
          <Input autoComplete="name" {...register('fullName')} />
        </FormField>

        <FormField label="Phone" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" {...register('phone')} />
        </FormField>

        <FormField label="Avatar URL" error={errors.avatarUrl?.message}>
          <Input type="url" {...register('avatarUrl')} />
        </FormField>

        {status === 'saved' && <Alert tone="success">Profile saved.</Alert>}
        {status === 'error' && formError && <Alert tone="danger">{formError}</Alert>}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={isPending} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  )
}
