'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SoDetail } from '../server/queries'
import { updateSoBilling } from '../server/actions'
import styles from './sales-orders.module.scss'

const schema = z.object({
  billToName:    z.string().optional(),
  billToAddress: z.string().optional(),
  billToPhone:   z.string().optional(),
  billToEmail:   z.string().email('Enter a valid email.').optional().or(z.literal('')),
  billToGstin:   z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props { so: SoDetail; canEdit: boolean }

export function SoBillingTab({ so, canEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [msg,     setMsg]     = useState<string | null>(null)
  const [,        startT]     = useTransition()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      billToName:    so.billToName    ?? '',
      billToAddress: so.billToAddress ?? '',
      billToPhone:   so.billToPhone   ?? '',
      billToEmail:   so.billToEmail   ?? '',
      billToGstin:   so.billToGstin   ?? '',
    },
  })

  function onSubmit(data: FormData) {
    startT(async () => {
      const res = await updateSoBilling(so.id, data)
      setMsg(res.ok ? 'Billing details saved.' : (res.error?.message ?? 'Failed to save.'))
      if (res.ok) setEditing(false)
    })
  }

  if (!editing) {
    return (
      <div className={styles.deliveryView}>
        {msg && (
          <div className={`${styles.flashMsg} ${styles.flashOk}`}>
            {msg} <button onClick={() => setMsg(null)}>×</button>
          </div>
        )}
        <div className={styles.advanceInfo}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Bill To</span>
            <span className={styles.metaValue}>{so.billToName ?? '—'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Billing Address</span>
            <span className={styles.metaValue} style={{ whiteSpace: 'pre-line' }}>
              {so.billToAddress ?? '—'}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Contact Phone</span>
            <span className={styles.metaValue}>{so.billToPhone ?? '—'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Contact Email</span>
            <span className={styles.metaValue}>{so.billToEmail ?? '—'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>GSTIN</span>
            <span className={styles.metaValue}>{so.billToGstin ?? '—'}</span>
          </div>
        </div>
        {canEdit && (
          <button className={styles.btnSecondary} onClick={() => setEditing(true)} type="button">
            Edit Billing Details
          </button>
        )}
      </div>
    )
  }

  return (
    <form className={styles.advanceForm} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Bill To (Name / Company)</label>
        <input type="text" className={styles.formInput} {...register('billToName')} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Billing Address</label>
        <textarea rows={4} className={styles.formTextarea} {...register('billToAddress')} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Contact Phone</label>
        <input type="tel" className={styles.formInput} {...register('billToPhone')} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Contact Email</label>
        <input type="email" className={styles.formInput} {...register('billToEmail')} />
        {errors.billToEmail && <span className={styles.formError}>{errors.billToEmail.message}</span>}
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>GSTIN</label>
        <input type="text" className={styles.formInput} {...register('billToGstin')} />
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary}>Save</button>
        <button type="button" className={styles.btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  )
}
