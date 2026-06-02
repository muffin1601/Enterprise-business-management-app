'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SoDetail } from '../server/queries'
import { recordAdvancePayment } from '../server/actions'
import styles from './sales-orders.module.scss'

const schema = z.object({
  advanceAmount:   z.coerce.number().min(0),
  advanceReceived: z.boolean(),
  advanceDate:     z.string().optional(),
  advanceNote:     z.string().optional(),
})

type FormData = z.infer<typeof schema>

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`

interface Props { so: SoDetail; canEdit: boolean }

export function SoAdvanceTab({ so, canEdit }: Props) {
  const [editing,  setEditing]  = useState(false)
  const [msg,      setMsg]      = useState<string | null>(null)
  const [,         startT]      = useTransition()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      advanceAmount:   so.advanceAmount,
      advanceReceived: so.advanceReceived,
      advanceDate:     so.advanceDate ?? '',
      advanceNote:     so.advanceNote ?? '',
    },
  })

  function onSubmit(data: FormData) {
    startT(async () => {
      const res = await recordAdvancePayment(so.id, {
        advanceAmount:   data.advanceAmount,
        advanceReceived: data.advanceReceived,
        advanceDate:     data.advanceDate ? new Date(data.advanceDate) : undefined,
        advanceNote:     data.advanceNote,
      })
      setMsg(res.ok ? 'Advance payment saved.' : (res.error?.message ?? 'Failed to save.'))
      if (res.ok) setEditing(false)
    })
  }

  if (!editing) {
    return (
      <div className={styles.advanceView}>
        {msg && (
          <div className={`${styles.flashMsg} ${styles.flashOk}`}>
            {msg} <button onClick={() => setMsg(null)}>×</button>
          </div>
        )}
        <div className={styles.advanceInfo}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Advance Amount</span>
            <span className={styles.metaValue}>{fmtINR(so.advanceAmount)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Status</span>
            <span className={`${styles.metaValue} ${so.advanceReceived ? styles.received : styles.pending}`}>
              {so.advanceReceived ? '✓ Received' : 'Pending'}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Date Received</span>
            <span className={styles.metaValue}>{fmtDate(so.advanceDate)}</span>
          </div>
          {so.advanceNote && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Note</span>
              <span className={styles.metaValue}>{so.advanceNote}</span>
            </div>
          )}
        </div>
        {canEdit && (
          <button className={styles.btnSecondary} onClick={() => setEditing(true)} type="button">
            Edit Advance Details
          </button>
        )}
      </div>
    )
  }

  return (
    <form className={styles.advanceForm} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Advance Amount (₹)</label>
        <input type="number" min={0} step="any" className={styles.formInput} {...register('advanceAmount')} />
        {errors.advanceAmount && <span className={styles.formError}>{errors.advanceAmount.message}</span>}
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          <input type="checkbox" {...register('advanceReceived')} className={styles.formCheckbox} />
          Mark as Received
        </label>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Date Received</label>
        <input type="date" className={styles.formInput} {...register('advanceDate')} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Note</label>
        <textarea className={styles.formTextarea} rows={3} {...register('advanceNote')} />
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary}>Save</button>
        <button type="button" className={styles.btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  )
}
