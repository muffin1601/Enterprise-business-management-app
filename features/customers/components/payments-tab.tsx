'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { paymentSchema, PAYMENT_MODES, PAYMENT_MODE_LABELS, type PaymentInput } from '@/validations/customer'
import { recordPayment } from '../server/actions'
import type { PaymentRow } from '../server/queries'
import { Icon } from '@/components/ui'
import styles from './customers.module.scss'

const fmtINR  = (n: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Record Payment modal ──────────────────────────────────────────────────────
function RecordPaymentModal({
  customerId,
  onClose,
}: {
  customerId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const { register, handleSubmit, setError, formState: { errors } } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      mode: 'neft',
    },
  })

  function onSubmit(data: PaymentInput) {
    start(async () => {
      const res = await recordPayment(customerId, data)
      if (!res.ok) {
        setError('root', { message: res.error.message })
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Record Payment</span>
          <button className={styles.modalClose} onClick={onClose}><Icon name="x" /></button>
        </div>

        <div className={styles.modalBody}>
          {errors.root && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--c-danger-bg)', color: 'var(--c-danger)', border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 12 }}>
              {errors.root.message}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Date */}
                <div>
                  <label className={styles.fieldLabel}>Date <span className={styles.fieldRequired}>*</span></label>
                  <input type="date" className={styles.fieldInput} {...register('date')} />
                  {errors.date && <div className={styles.fieldError}>{errors.date.message}</div>}
                </div>

                {/* Mode */}
                <div>
                  <label className={styles.fieldLabel}>Mode <span className={styles.fieldRequired}>*</span></label>
                  <select className={styles.fieldSelect} {...register('mode')}>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className={styles.fieldLabel}>Amount (₹) <span className={styles.fieldRequired}>*</span></label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.fieldInput}
                  placeholder="0.00"
                  style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  {...register('amount')}
                />
                {errors.amount && <div className={styles.fieldError}>{errors.amount.message}</div>}
              </div>

              {/* Reference */}
              <div>
                <label className={styles.fieldLabel}>Reference / UTR / Cheque No.</label>
                <input type="text" className={styles.fieldInput} placeholder="e.g. UTR12345678" {...register('reference')} />
              </div>

              {/* Notes */}
              <div>
                <label className={styles.fieldLabel}>Notes</label>
                <textarea className={styles.fieldTextarea} rows={2} placeholder="Optional notes…" {...register('notes')} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid var(--c-border)' }}>
                <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
                <button type="submit" disabled={pending} style={primaryBtn(pending)}>
                  {pending ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── PaymentsTab ───────────────────────────────────────────────────────────────
interface Props {
  customerId: string
  payments:   PaymentRow[]
  canEdit:    boolean
}

export function PaymentsTab({ customerId, payments, canEdit }: Props) {
  const [modal, setModal] = useState(false)
  const totalReceived = payments.reduce((s, p) => s + p.amount, 0)

  const modeIcon: Record<string, string> = {
    neft: 'building-bank', rtgs: 'building-bank', upi: 'device-mobile',
    cheque: 'writing', cash: 'cash', card: 'credit-card', other: 'receipt',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {modal && <RecordPaymentModal customerId={customerId} onClose={() => setModal(false)} />}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 22, color: 'var(--c-ink)', letterSpacing: '0.03em' }}>
            {payments.length > 0 ? fmtINR(totalReceived) : '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--c-tertiary)', marginTop: 4 }}>
            Total Received · {payments.length} payment{payments.length !== 1 ? 's' : ''}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)} style={primaryBtn(false)}>
            <Icon name="plus" style={{ marginRight: 6 }} />
            Record Payment
          </button>
        )}
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <div className={styles.panel} style={{ textAlign: 'center', padding: '48px 0' }}>
          <Icon name="cash" size={40} style={{ color: 'var(--c-border-2)', display: 'block', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--c-secondary)', fontWeight: 500 }}>No payments recorded</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-tertiary)', marginTop: 4 }}>
            {canEdit ? 'Use "Record Payment" to add the first payment.' : 'Payments will appear here once recorded.'}
          </div>
        </div>
      ) : (
        <div className={styles.panel}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--c-bg)' }}>
                  {['Date', 'Mode', 'Reference', 'Amount', 'Notes', 'By'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: h === 'Amount' ? 'right' : 'left',
                      fontSize: 9, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase',
                      color: 'var(--c-tertiary)', borderBottom: '1px solid var(--c-border)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-bg)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-secondary)', whiteSpace: 'nowrap' }}>
                      {fmtDate(p.date)}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Icon name={modeIcon[p.mode] ?? 'receipt'} size={14} style={{ color: 'var(--c-tertiary)' }} />
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, color: 'var(--c-ink)', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
                          {PAYMENT_MODE_LABELS[p.mode as keyof typeof PAYMENT_MODE_LABELS] ?? p.mode}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: p.reference ? 'var(--c-ink)' : 'var(--c-tertiary)' }}>
                      {p.reference || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--c-success)' }}>
                      {fmtINR(p.amount)}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-tertiary)', fontSize: 12, maxWidth: 200 }}>
                      {p.notes || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-tertiary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {p.creatorName || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--c-secondary)',
  border: '1px solid var(--c-border)', padding: '9px 18px',
  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
  letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer',
  borderRadius: 'var(--radius-sm)',
}

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  background: 'var(--c-ink)', color: 'var(--c-inverse)',
  border: '1px solid var(--c-ink)', padding: '9px 18px',
  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  borderRadius: 'var(--radius-sm)',
})
