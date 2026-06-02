'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { InvoiceDetail } from '../server/queries'
import { recordPayment, deletePayment } from '../server/actions'
import { PAYMENT_MODE_LABELS } from '@/validations/invoice'
import { Icon } from '@/components/ui'
import styles from './invoices.module.scss'

const schema = z.object({
  amount:      z.coerce.number().positive({ message: 'Amount must be > 0' }),
  paymentDate: z.string().min(1, 'Required'),
  paymentMode: z.enum(['cash','bank_transfer','cheque','upi','other']).default('bank_transfer'),
  referenceNo: z.string().optional(),
  note:        z.string().optional(),
})

type FormData = z.infer<typeof schema>

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

interface Props { inv: InvoiceDetail; canEdit: boolean }

export function InvoicePaymentsTab({ inv, canEdit }: Props) {
  const [showForm, setShowForm]   = useState(false)
  const [msg,      setMsg]        = useState<string | null>(null)
  const [,         startT]        = useTransition()

  const canRecord = canEdit && ['issued','partially_paid'].includes(inv.status)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'bank_transfer',
    },
  })

  function onSubmit(data: FormData) {
    startT(async () => {
      const res = await recordPayment(inv.id, {
        amount:      data.amount,
        paymentDate: new Date(data.paymentDate),
        paymentMode: data.paymentMode,
        referenceNo: data.referenceNo,
        note:        data.note,
      })
      if (res.ok) { reset(); setShowForm(false); setMsg('Payment recorded.') }
      else setMsg(res.error?.message ?? 'Failed to record payment.')
    })
  }

  function handleDelete(paymentId: string, amount: number) {
    if (!confirm(`Remove payment of ${fmtINR(amount)}? This will update the balance.`)) return
    startT(async () => {
      const res = await deletePayment(inv.id, paymentId)
      setMsg(res.ok ? 'Payment removed.' : (res.error?.message ?? 'Failed to remove.'))
    })
  }

  return (
    <div className={styles.paymentsTab}>
      {msg && (
        <div className={`${styles.flashMsg} ${msg.includes('Failed') ? styles.flashErr : styles.flashOk}`}>
          {msg} <button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      {/* Payment history */}
      {inv.payments.length === 0 ? (
        <div className={styles.empty} style={{ padding: '32px 0' }}>No payments recorded yet.</div>
      ) : (
        <div className={styles.paymentList}>
          {inv.payments.map(p => (
            <div key={p.id} className={styles.paymentRow}>
              <div className={styles.paymentLeft}>
                <span className={styles.paymentMode}>{PAYMENT_MODE_LABELS[p.paymentMode] ?? p.paymentMode}</span>
                <span className={styles.paymentDate}>{fmtDate(p.paymentDate)}</span>
                {p.referenceNo && <span className={styles.paymentRef}>Ref: {p.referenceNo}</span>}
                {p.note && <span className={styles.paymentNote}>{p.note}</span>}
              </div>
              <div className={styles.paymentRight}>
                <span className={styles.paymentAmount}>{fmtINR(p.amount)}</span>
                {canEdit && inv.status !== 'paid' && (
                  <button className={styles.btnDeleteSmall} onClick={() => handleDelete(p.id, p.amount)} type="button" title="Remove">
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className={styles.paymentSummary}>
            <span>Total Paid</span>
            <span style={{ color: 'var(--c-success)', fontWeight: 600 }}>{fmtINR(inv.amountPaid)}</span>
          </div>
          <div className={styles.paymentSummary}>
            <span>Balance Due</span>
            <span style={{ color: inv.balanceDue > 0 ? 'var(--c-danger)' : 'var(--c-success)', fontWeight: 700, fontSize: 15 }}>
              {fmtINR(inv.balanceDue)}
            </span>
          </div>
        </div>
      )}

      {/* Record payment form */}
      {canRecord && !showForm && (
        <button className={styles.btnPrimary} onClick={() => setShowForm(true)} type="button" style={{ marginTop: 16 }}>
          + Record Payment
        </button>
      )}

      {showForm && (
        <form className={styles.paymentForm} onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Record Payment</div>
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Amount (₹)</label>
              <input type="number" min={0.01} step="any" className={styles.formInput} {...register('amount')} />
              {errors.amount && <span className={styles.formError}>{errors.amount.message}</span>}
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Payment Date</label>
              <input type="date" className={styles.formInput} {...register('paymentDate')} />
            </div>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Payment Mode</label>
              <select className={styles.formSelect} {...register('paymentMode')}>
                {Object.entries(PAYMENT_MODE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Reference No.</label>
              <input type="text" className={styles.formInput} placeholder="Bank ref / Cheque no / UPI ID" {...register('referenceNo')} />
            </div>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Note</label>
            <textarea rows={2} className={styles.formTextarea} {...register('note')} />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Payment'}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
