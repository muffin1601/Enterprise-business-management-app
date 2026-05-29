'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { inviteMemberSchema, type InviteMemberInput } from '@/validations/company'
import { inviteMember } from '@/features/admin/server/actions'
import type { AssignableRole } from '@/features/admin/server/queries'
import { Alert, Button, Card, FormField, Input, Select } from '@/components/ui'
import styles from './admin.module.scss'

export interface InviteMemberFormProps {
  roles: AssignableRole[]
}

export function InviteMemberForm({ roles }: InviteMemberFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', roleId: roles[0]?.id ?? '' },
  })

  const onSubmit = (values: InviteMemberInput) => {
    setFormError(null)
    setAcceptUrl(null)
    startTransition(async () => {
      const res = await inviteMember(values)
      if (res.ok) {
        setAcceptUrl(res.data.acceptUrl)
        reset({ email: '', roleId: values.roleId })
        router.refresh()
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof InviteMemberInput, { message: msgs?.[0] })
        }
      }
      setFormError(res.error.message)
    })
  }

  return (
    <Card>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Invite a member</h2>
        <p className={styles.cardSubtitle}>They&rsquo;ll join with the role you choose.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="off" {...register('email')} />
        </FormField>

        <FormField label="Role" required error={errors.roleId?.message}>
          <Select {...register('roleId')}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>

        {formError && <Alert tone="danger">{formError}</Alert>}

        {acceptUrl && (
          <Alert tone="success" title="Invitation created">
            <div className={styles.inviteLink}>
              <span>Email delivery arrives with the Notifications module — share this link for now:</span>
              <code>{acceptUrl}</code>
            </div>
          </Alert>
        )}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={isPending}>
            Send invite
          </Button>
        </div>
      </form>
    </Card>
  )
}
