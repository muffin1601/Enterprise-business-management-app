'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createOrganizationSchema, type CreateOrganizationInput } from '@/validations/company'
import { createOrganization } from '@/features/company/server/actions'
import { Alert, Button, Card, FormField, Input, Textarea, toast } from '@/components/ui'
import styles from './company-setup-form.module.scss'

/** Onboarding — create the first company (creator becomes Company Owner). */
export function CompanySetupForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: '', slug: '', legalName: '', gstin: '', address: '' },
  })

  const onSubmit = (values: CreateOrganizationInput) => {
    setFormError(null)
    startTransition(async () => {
      const res = await createOrganization(values)
      if (res.ok) {
        toast('Company created', 'success')
        router.push('/dashboard')
        router.refresh()
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof CreateOrganizationInput, { message: msgs?.[0] })
        }
      }
      // Show the exact failure both inline and as a toast.
      setFormError(res.error.message)
      toast(res.error.message, 'danger')
    })
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Set up your company</h1>
        <p className={styles.subtitle}>You&rsquo;ll be the owner of this organization.</p>
      </header>

      <Card>
        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Company name" required error={errors.name?.message}>
            <Input autoComplete="organization" {...register('name')} />
          </FormField>

          <FormField
            label="Legal name"
            hint="As registered, if different from the trading name."
            error={errors.legalName?.message}
          >
            <Input {...register('legalName')} />
          </FormField>

          <FormField label="GSTIN" hint="15-character GST identification number." error={errors.gstin?.message}>
            <Input {...register('gstin')} />
          </FormField>

          <FormField label="Address" error={errors.address?.message}>
            <Textarea rows={3} {...register('address')} />
          </FormField>

          {formError && <Alert tone="danger">{formError}</Alert>}

          <div className={styles.actions}>
            <Button type="submit" variant="primary" loading={isPending}>
              Create company
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
