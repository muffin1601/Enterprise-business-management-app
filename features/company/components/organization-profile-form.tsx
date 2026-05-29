'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateOrganizationSchema, type UpdateOrganizationInput } from '@/validations/company'
import { updateOrganization } from '@/features/company/server/actions'
import { Alert, Button, Card, FormField, Input, Textarea } from '@/components/ui'
import styles from './company-forms.module.scss'

export interface OrganizationProfileFormProps {
  defaultValues: UpdateOrganizationInput
  /** Owners edit the profile; others see it read-only. */
  canEdit: boolean
}

export function OrganizationProfileForm({ defaultValues, canEdit }: OrganizationProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues,
  })

  const onSubmit = (values: UpdateOrganizationInput) => {
    setStatus('idle')
    setFormError(null)
    startTransition(async () => {
      const res = await updateOrganization(values)
      if (res.ok) return setStatus('saved')
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof UpdateOrganizationInput, { message: msgs?.[0] })
        }
      }
      setStatus('error')
      setFormError(res.error.message)
    })
  }

  return (
    <Card>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Company profile</h2>
        <p className={styles.cardSubtitle}>
          {canEdit ? 'Editable by the company owner.' : 'Only the company owner can edit these.'}
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Company name" required error={errors.name?.message}>
          <Input disabled={!canEdit} {...register('name')} />
        </FormField>
        <FormField label="Legal name" error={errors.legalName?.message}>
          <Input disabled={!canEdit} {...register('legalName')} />
        </FormField>
        <FormField label="GSTIN" error={errors.gstin?.message}>
          <Input disabled={!canEdit} {...register('gstin')} />
        </FormField>
        <FormField label="PAN" error={errors.pan?.message}>
          <Input disabled={!canEdit} {...register('pan')} />
        </FormField>
        <FormField label="Address" error={errors.address?.message}>
          <Textarea rows={3} disabled={!canEdit} {...register('address')} />
        </FormField>

        {status === 'saved' && <Alert tone="success">Company profile saved.</Alert>}
        {status === 'error' && formError && <Alert tone="danger">{formError}</Alert>}

        {canEdit && (
          <div className={styles.actions}>
            <Button type="submit" variant="primary" loading={isPending} disabled={!isDirty}>
              Save profile
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}
