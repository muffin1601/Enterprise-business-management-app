'use client'

import { useState, useTransition } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { PoDetail, GrnRow } from '../server/queries'
import { createGrn } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './purchase-orders.module.scss'

const schema = z.object({
  date:         z.string().min(1),
  deliveryNote: z.string().optional(),
  notes:        z.string().optional(),
  items:        z.array(z.object({
    poItemId:    z.string(),
    qtyReceived: z.coerce.number().min(0),
    batchNo:     z.string().optional(),
    itemName:    z.string(),
    remaining:   z.number(),
    include:     z.boolean().default(false),
  })),
})

type FormData = z.infer<typeof schema>

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

interface Props { po: PoDetail; canReceive: boolean }

export function PoGrnTab({ po, canReceive }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg]           = useState<string | null>(null)
  const [, startT]              = useTransition()

  const canRecord = canReceive && ['sent','partially_received'].includes(po.status)

  // Build items with remaining qty
  const grnableItems = po.items
    .filter(i => i.qtyOrdered > 0)
    .map(i => ({
      poItemId:    i.id,
      itemName:    i.name,
      qtyOrdered:  i.qtyOrdered,
      qtyReceived: i.qtyReceived,
      remaining:   Math.max(0, i.qtyOrdered - i.qtyReceived),
    }))
    .filter(i => i.remaining > 0)

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:  new Date().toISOString().split('T')[0],
      items: grnableItems.map(i => ({
        poItemId: i.poItemId, qtyReceived: i.remaining,
        batchNo: '', itemName: i.itemName, remaining: i.remaining, include: true,
      })),
    },
  })

  const { fields } = useFieldArray({ control, name: 'items' })

  function onSubmit(data: FormData) {
    const activeItems = data.items.filter(i => i.include && i.qtyReceived > 0)
    if (activeItems.length === 0) { setMsg('Select at least one item to receive.'); return }
    startT(async () => {
      const res = await createGrn(po.id, {
        date:         new Date(data.date),
        deliveryNote: data.deliveryNote,
        notes:        data.notes,
        items:        activeItems.map(i => ({ poItemId: i.poItemId, qtyReceived: i.qtyReceived, batchNo: i.batchNo || undefined })),
      })
      if (!res.ok) { setMsg(res.error?.message ?? 'Failed to create GRN.'); return }
      setMsg(`GRN ${res.data.grnNo} created successfully.`)
      setShowForm(false)
      reset()
    })
  }

  return (
    <div className={styles.grnTab}>
      {msg && (
        <div className={`${styles.flashMsg} ${msg.includes('Failed') || msg.includes('Select') ? styles.flashErr : styles.flashOk}`}>
          {msg} <button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      {/* GRN History */}
      {po.grns.length === 0 ? (
        <div className={styles.empty} style={{ padding: '32px 0' }}>No goods receipts recorded yet.</div>
      ) : (
        <div className={styles.grnList}>
          {po.grns.map(grn => (
            <div key={grn.id} className={styles.grnCard}>
              <div className={styles.grnHeader}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Icon name="package" size={16} />
                  <span className={styles.grnNo}>{grn.grnNo}</span>
                  <span className={styles.grnDate}>{fmtDate(grn.date)}</span>
                  {grn.deliveryNote && <span className={styles.grnDeliveryNote}>DN: {grn.deliveryNote}</span>}
                </div>
              </div>
              <table className={styles.grnItemsTable}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className={styles.numCol}>Qty Received</th>
                    <th>Batch No.</th>
                  </tr>
                </thead>
                <tbody>
                  {grn.items.map(gi => (
                    <tr key={gi.id}>
                      <td>{gi.itemName}</td>
                      <td className={styles.numCol} style={{ fontWeight:600 }}>{gi.qtyReceived}</td>
                      <td style={{ color:'var(--c-tertiary)', fontFamily:'var(--font-mono)', fontSize:11 }}>{gi.batchNo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {grn.notes && <div className={styles.grnNotes}>{grn.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Record GRN button */}
      {canRecord && !showForm && grnableItems.length > 0 && (
        <button className={styles.btnPrimary} onClick={() => setShowForm(true)} type="button" style={{ marginTop: 16 }}>
          <Icon name="package" size={14} /> Record Goods Receipt (GRN)
        </button>
      )}

      {/* GRN Form */}
      {showForm && (
        <form className={styles.grnForm} onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.sectionTitle}>New Goods Receipt</div>

          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Receipt Date <span style={{ color:'var(--c-danger)' }}>*</span></label>
              <input type="date" className={styles.formInput} {...register('date')} />
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Delivery Note No.</label>
              <input type="text" className={styles.formInput} placeholder="Vendor delivery note" {...register('deliveryNote')} />
            </div>
          </div>

          <div className={styles.grnItemsForm}>
            <div className={styles.sectionTitle} style={{ marginBottom: 10 }}>Items Received</div>
            <table className={styles.grnItemsTable}>
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" onChange={e => {}} title="Toggle all" /></th>
                  <th>Item</th>
                  <th className={styles.numCol}>Pending</th>
                  <th className={styles.numCol}>Qty Received</th>
                  <th>Batch No.</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.id}>
                    <td style={{ textAlign:'center' }}>
                      <input type="checkbox" {...register(`items.${i}.include`)} />
                    </td>
                    <td className={styles.itemName}>{field.itemName}</td>
                    <td className={styles.numCol} style={{ color:'var(--c-tertiary)' }}>{field.remaining}</td>
                    <td className={styles.numCol}>
                      <input type="number" min={0} max={field.remaining} step="any"
                        className={`${styles.cellInput} ${styles.numInput}`}
                        {...register(`items.${i}.qtyReceived`)} />
                    </td>
                    <td>
                      <input type="text" className={styles.cellInput} placeholder="Optional"
                        {...register(`items.${i}.batchNo`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Notes</label>
            <textarea rows={2} className={styles.formTextarea} {...register('notes')} />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save GRN'}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
