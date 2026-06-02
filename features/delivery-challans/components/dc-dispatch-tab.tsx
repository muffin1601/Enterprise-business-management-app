'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { DcDetail } from '../server/queries'
import { updateDeliveryChallan } from '../server/actions'
import styles from './delivery-challans.module.scss'

const schema = z.object({
  vehicleNo:        z.string().optional(),
  driverName:       z.string().optional(),
  lrNo:             z.string().optional(),
  transporterName:  z.string().optional(),
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  dispatchDate:     z.string().optional(),
  expectedDelivery: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

interface Props { dc: DcDetail; canEdit: boolean }

export function DcDispatchTab({ dc, canEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const [msg, setMsg]         = useState<string | null>(null)
  const [, startT]            = useTransition()

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleNo:        dc.vehicleNo ?? '',
      driverName:       dc.driverName ?? '',
      lrNo:             dc.lrNo ?? '',
      transporterName:  dc.transporterName ?? '',
      deliveryAddress:  dc.deliveryAddress ?? '',
      siteContactName:  dc.siteContactName ?? '',
      siteContactPhone: dc.siteContactPhone ?? '',
      dispatchDate:     dc.dispatchDate ?? '',
      expectedDelivery: dc.expectedDelivery ?? '',
    },
  })

  function onSubmit(data: FormData) {
    startT(async () => {
      const res = await updateDeliveryChallan(dc.id, {
        vehicleNo:        data.vehicleNo,
        driverName:       data.driverName,
        lrNo:             data.lrNo,
        transporterName:  data.transporterName,
        deliveryAddress:  data.deliveryAddress,
        siteContactName:  data.siteContactName,
        siteContactPhone: data.siteContactPhone,
        dispatchDate:     data.dispatchDate ? new Date(data.dispatchDate) : null,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
      })
      setMsg(res.ok ? 'Dispatch details saved.' : (res.error?.message ?? 'Failed.'))
      if (res.ok) setEditing(false)
    })
  }

  if (!editing) {
    return (
      <div className={styles.dispatchView}>
        {msg && <div className={`${styles.flashMsg} ${styles.flashOk}`}>{msg} <button onClick={() => setMsg(null)}>×</button></div>}
        <div className={styles.dispatchGrid}>
          {[
            ['Dispatch Date',      fmtDate(dc.dispatchDate)],
            ['Expected Delivery',  fmtDate(dc.expectedDelivery)],
            ['Vehicle No.',        dc.vehicleNo],
            ['Driver Name',        dc.driverName],
            ['LR / Bilty No.',     dc.lrNo],
            ['Transporter',        dc.transporterName],
            ['Site Contact',       dc.siteContactName],
            ['Contact Phone',      dc.siteContactPhone],
          ].map(([l, v]) => v && (
            <div key={l as string} className={styles.metaItem}>
              <span className={styles.metaLabel}>{l}</span>
              <span className={styles.metaValue}>{v}</span>
            </div>
          ))}
          {dc.deliveryAddress && (
            <div className={styles.metaItemFull}>
              <span className={styles.metaLabel}>Delivery Address</span>
              <span className={styles.metaValue} style={{ whiteSpace:'pre-line' }}>{dc.deliveryAddress}</span>
            </div>
          )}
        </div>
        {canEdit && dc.status === 'draft' && (
          <button className={styles.btnSecondary} onClick={() => setEditing(true)} type="button" style={{ marginTop:16 }}>
            Edit Dispatch Details
          </button>
        )}
      </div>
    )
  }

  return (
    <form className={styles.dispatchForm} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Dispatch Date</label>
          <input type="date" className={styles.formInput} {...register('dispatchDate')} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Expected Delivery</label>
          <input type="date" className={styles.formInput} {...register('expectedDelivery')} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Vehicle No.</label>
          <input type="text" className={styles.formInput} placeholder="MH-01-AB-1234" {...register('vehicleNo')} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Driver Name</label>
          <input type="text" className={styles.formInput} {...register('driverName')} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>LR / Bilty No.</label>
          <input type="text" className={styles.formInput} {...register('lrNo')} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Transporter</label>
          <input type="text" className={styles.formInput} {...register('transporterName')} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Site Contact Name</label>
          <input type="text" className={styles.formInput} {...register('siteContactName')} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Site Contact Phone</label>
          <input type="tel" className={styles.formInput} {...register('siteContactPhone')} />
        </div>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Delivery Address</label>
        <textarea rows={4} className={styles.formTextarea} {...register('deliveryAddress')} />
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={isSubmitting}>Save</button>
        <button type="button" className={styles.btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  )
}
