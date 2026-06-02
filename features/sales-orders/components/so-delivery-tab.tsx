'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SoDetail } from '../server/queries'
import { updateDeliveryDetails } from '../server/actions'
import styles from './sales-orders.module.scss'

const schema = z.object({
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  expectedDelivery: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

interface Props { so: SoDetail; canEdit: boolean }

export function SoDeliveryTab({ so, canEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [msg,     setMsg]     = useState<string | null>(null)
  const [,        startT]     = useTransition()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryAddress:  so.deliveryAddress ?? '',
      siteContactName:  so.siteContactName ?? '',
      siteContactPhone: so.siteContactPhone ?? '',
      expectedDelivery: so.expectedDelivery ?? '',
    },
  })

  function onSubmit(data: FormData) {
    startT(async () => {
      const res = await updateDeliveryDetails(so.id, {
        deliveryAddress:  data.deliveryAddress,
        siteContactName:  data.siteContactName,
        siteContactPhone: data.siteContactPhone,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
      })
      setMsg(res.ok ? 'Delivery details saved.' : (res.error?.message ?? 'Failed to save.'))
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
            <span className={styles.metaLabel}>Expected Delivery</span>
            <span className={styles.metaValue}>{fmtDate(so.expectedDelivery)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Delivery Address</span>
            <span className={styles.metaValue} style={{ whiteSpace: 'pre-line' }}>
              {so.deliveryAddress ?? '—'}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Site Contact</span>
            <span className={styles.metaValue}>{so.siteContactName ?? '—'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Contact Phone</span>
            <span className={styles.metaValue}>{so.siteContactPhone ?? '—'}</span>
          </div>
        </div>
        {canEdit && (
          <button className={styles.btnSecondary} onClick={() => setEditing(true)} type="button">
            Edit Delivery Details
          </button>
        )}
      </div>
    )
  }

  return (
    <form className={styles.advanceForm} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Expected Delivery Date</label>
        <input type="date" className={styles.formInput} {...register('expectedDelivery')} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Delivery Address</label>
        <textarea rows={4} className={styles.formTextarea} {...register('deliveryAddress')} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Site Contact Name</label>
        <input type="text" className={styles.formInput} {...register('siteContactName')} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Site Contact Phone</label>
        <input type="tel" className={styles.formInput} {...register('siteContactPhone')} />
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary}>Save</button>
        <button type="button" className={styles.btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  )
}
