'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import Link from 'next/link'
import { registerSchema, type RegisterInput } from '@/validations/auth'
import { signUp } from '@/features/auth/server/actions'
import { AuthCard } from './auth-card'
import { Alert, Button, FormField, Input } from '@/components/ui'
import form from './auth-form.module.scss'

export function RegisterForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = (values: RegisterInput) => {
    setFormError(null)
    startTransition(async () => {
      const res = await signUp(values)
      if (res.ok) {
        if (res.data.needsVerification) {
          router.push(`/verify-email?email=${encodeURIComponent(res.data.email)}` as Route)
        } else {
          // Email confirmation disabled in Supabase → already signed in.
          router.push('/onboarding/company-setup')
        }
        router.refresh()
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof RegisterInput, { message: msgs?.[0] })
        }
      }
      setFormError(res.error.message)
    })
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start managing your business in minutes."
      footer={
        <span>
          Already have an account? <Link href="/login">Sign in</Link>
        </span>
      }
    >
      <form className={form.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Full name" required error={errors.fullName?.message}>
          <Input autoComplete="name" {...register('fullName')} />
        </FormField>

        <FormField label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField
          label="Password"
          required
          hint="At least 8 characters."
          error={errors.password?.message}
        >
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </FormField>

        <FormField label="Confirm password" required error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>

        {formError && <Alert tone="danger">{formError}</Alert>}

        <div className={form.actions}>
          <Button type="submit" variant="primary" fullWidth loading={isPending}>
            Create account
          </Button>
        </div>
      </form>
    </AuthCard>
  )
}
