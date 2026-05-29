'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { organizationSettingsSchema, type OrganizationSettingsInput } from '@/validations/company'
import { updateOrganizationSettings } from '@/features/company/server/actions'
import { Alert, Button, Card, FormField, Input, Select } from '@/components/ui'
import styles from './company-forms.module.scss'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface OrganizationSettingsFormProps {
  defaultValues: OrganizationSettingsInput
  canEdit: boolean
}

export function OrganizationSettingsForm({ defaultValues, canEdit }: OrganizationSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<OrganizationSettingsInput>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues,
  })

  const onSubmit = (values: OrganizationSettingsInput) => {
    setStatus('idle')
    setFormError(null)
    startTransition(async () => {
      const res = await updateOrganizationSettings(values)
      if (res.ok) return setStatus('saved')
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof OrganizationSettingsInput, { message: msgs?.[0] })
        }
      }
      setStatus('error')
      setFormError(res.error.message)
    })
  }

  return (
    <Card>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Settings</h2>
        <p className={styles.cardSubtitle}>Financial year, default tax, and place of supply.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Financial year start" error={errors.financialYearStart?.message}>
          <Select disabled={!canEdit} {...register('financialYearStart')}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Default GST %" error={errors.defaultGstPct?.message}>
          <Input type="number" step="0.001" min="0" max="100" disabled={!canEdit} {...register('defaultGstPct')} />
        </FormField>

        <FormField label="Place of supply" error={errors.placeOfSupply?.message}>
          <Input disabled={!canEdit} {...register('placeOfSupply')} />
        </FormField>

        {status === 'saved' && <Alert tone="success">Settings saved.</Alert>}
        {status === 'error' && formError && <Alert tone="danger">{formError}</Alert>}

        {canEdit && (
          <div className={styles.actions}>
            <Button type="submit" variant="primary" loading={isPending} disabled={!isDirty}>
              Save settings
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}
