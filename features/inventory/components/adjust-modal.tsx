'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { adjustmentSchema, type AdjustmentInput } from '@/validations/inventory'
import { adjustStock } from '../server/actions'
import styles from './inventory.module.scss'

interface Props {
  itemId: string
  itemName: string
  currentStock: number
  unit: string | null
  onClose: () => void
}

export function AdjustModal({ itemId, itemName, currentStock, unit, onClose }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [adjType, setAdjType] = useState<'add' | 'sub'>('add')

  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm<AdjustmentInput>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { type: 'add', qty: 0, reason: '' },
  })

  const qty = watch('qty')
  const preview = adjType === 'add'
    ? currentStock + Number(qty || 0)
    : Math.max(0, currentStock - Number(qty || 0))

  function onSubmit(data: AdjustmentInput) {
    start(async () => {
      const res = await adjustStock(itemId, { ...data, type: adjType })
      if (!res.ok) { setError('root', { message: res.error.message }); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Adjust Stock</span>
          <button className={styles.modalClose} onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className={styles.modalBody}>
          {/* Item info */}
          <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>{itemName}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', marginTop: 4 }}>
              Current stock: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--c-ink)' }}>{currentStock} {unit ?? ''}</span>
            </div>
          </div>

          {errors.root && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--c-danger-bg)', color: 'var(--c-danger)', border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 12 }}>
              {errors.root.message}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Add/Sub toggle */}
              <div>
                <label className={styles.fieldLabel}>Adjustment Type</label>
                <div className={styles.toggle}>
                  <button type="button" className={styles.toggleBtn} data-active={adjType === 'add' ? 'true' : undefined} onClick={() => setAdjType('add')}>
                    <i className="ti ti-plus" style={{ marginRight: 6 }} /> Add Stock
                  </button>
                  <button type="button" className={styles.toggleBtn} data-active={adjType === 'sub' ? 'true' : undefined} onClick={() => setAdjType('sub')}>
                    <i className="ti ti-minus" style={{ marginRight: 6 }} /> Reduce Stock
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className={styles.fieldLabel}>Quantity {unit ? `(${unit})` : ''} <span className={styles.fieldRequired}>*</span></label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className={styles.fieldInput}
                  placeholder="0"
                  style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  {...register('qty')}
                />
                {errors.qty && <div className={styles.fieldError}>{errors.qty.message}</div>}
                {/* Preview */}
                <div style={{ marginTop: 6, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)' }}>
                  New stock: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: preview < 0 ? 'var(--c-danger)' : 'var(--c-ink)' }}>{preview} {unit ?? ''}</span>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className={styles.fieldLabel}>Reason <span className={styles.fieldRequired}>*</span></label>
                <input
                  type="text"
                  className={styles.fieldInput}
                  placeholder="e.g. Physical count correction, damage write-off…"
                  {...register('reason')}
                />
                {errors.reason && <div className={styles.fieldError}>{errors.reason.message}</div>}
              </div>

              {/* Ref No */}
              <div>
                <label className={styles.fieldLabel}>Reference No. (optional)</label>
                <input type="text" className={styles.fieldInput} placeholder="e.g. PO-2026-001" {...register('refNo')} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid var(--c-border)' }}>
                <button type="button" onClick={onClose} className={styles.btnGhost}>Cancel</button>
                <button type="submit" disabled={pending} className={styles.btnPrimary}>
                  {pending ? 'Saving…' : `Confirm ${adjType === 'add' ? 'Addition' : 'Reduction'}`}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
