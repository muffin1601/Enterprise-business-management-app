'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import Link from 'next/link'
import { loginSchema, magicLinkSchema, type LoginInput } from '@/validations/auth'
import { signIn, signInWithMagicLink } from '@/features/auth/server/actions'
import { AuthCard } from './auth-card'
import { Alert, Button, FormField, Input } from '@/components/ui'
import form from './auth-form.module.scss'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (values: LoginInput) => {
    setFormError(null)
    startTransition(async () => {
      const res = await signIn(values)
      if (res.ok) {
        // redirectTo is an arbitrary string; only honor same-origin paths.
        const target = params.get('redirectTo')
        const safe = target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard'
        router.push(safe as Route)
        router.refresh()
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof LoginInput, { message: msgs?.[0] })
        }
      }
      setFormError(res.error.message)
    })
  }

  const onMagicLink = () => {
    setFormError(null)
    const email = getValues('email')
    const parsed = magicLinkSchema.safeParse({ email })
    if (!parsed.success) {
      setError('email', { message: 'Enter a valid email to get a magic link' })
      return
    }
    startTransition(async () => {
      const res = await signInWithMagicLink({ email })
      if (res.ok) setMagicSent(true)
      else setFormError(res.error.message)
    })
  }

  if (magicSent) {
    return (
      <AuthCard title="Check your inbox" footer={<Link href="/login">Back to sign in</Link>}>
        <p className={form.sent}>
          We sent a sign-in link to <strong>{getValues('email')}</strong>. Open it on this device to
          continue.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Sign in to Watcon"
      subtitle="Use your work email to continue."
      footer={
        <span>
          New to Watcon? <Link href="/register">Create an account</Link>
        </span>
      }
    >
      <form className={form.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </FormField>

        {formError && <Alert tone="danger">{formError}</Alert>}

        <div className={form.actions}>
          <Button type="submit" variant="primary" fullWidth loading={isPending}>
            Sign in
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={onMagicLink} disabled={isPending}>
            Email me a magic link
          </Button>
        </div>

        <p className={form.inlineLink}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </form>
    </AuthCard>
  )
}
