'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSalesOrder } from '../server/actions'
import { getAcceptedQuotesWithoutSo } from '../server/queries'
import { SO_PRIORITY_LABELS } from '@/validations/sales-order'
import { Icon } from '@/components/ui'
import styles from './sales-orders.module.scss'

const schema = z.object({
  quoteId:          z.string().uuid({ message: 'Select a quote' }),
  priority:         z.enum(['low','normal','high','urgent']).default('normal'),
  expectedDelivery: z.string().optional(),
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  notes:            z.string().optional(),
})

type FormData = z.infer<typeof schema>

type QuoteOption = {
  id:           string
  quoteNo:      string
  subject:      string | null
  customerName: string | null
  grandTotal:   number
}

const fmtINR = (n: number) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

interface Props { onClose: () => void; preSelectedQuoteId?: string }

export function CreateSoFromQuote({ onClose, preSelectedQuoteId }: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [quotes,   setQuotes]   = useState<QuoteOption[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [search,   setSearch]   = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      quoteId:  preSelectedQuoteId ?? '',
      priority: 'normal',
    },
  })

  const selectedQuoteId = watch('quoteId')
  const selectedQuote   = quotes.find(q => q.id === selectedQuoteId)

  // Load accepted quotes without SO
  useEffect(() => {
    setLoading(true)
    // Client-side fetch via server action wrapper — use a direct API route pattern
    // We call the queries function from a server component, so here we use a fetch-based approach
    fetch(`/api/sales-orders/accepted-quotes?q=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then((data: QuoteOption[]) => { setQuotes(data); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [search])

  function onSubmit(data: FormData) {
    setError(null)
    startT(async () => {
      const res = await createSalesOrder({
        ...data,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
      })
      if (!res.ok) {
        setError(res.error?.message ?? 'Failed to create sales order.')
        return
      }
      router.push(`/orders/${res.data.id}`)
      onClose()
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Create Sales Order">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create Sales Order</h2>
          <button className={styles.modalClose} onClick={onClose} type="button" aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.modalBody}>
          {error && (
            <div className={`${styles.flashMsg} ${styles.flashErr}`}>
              {error}
            </div>
          )}

          {/* Quote selection */}
          <div className={styles.formSection}>
            <div className={styles.formSectionTitle}>Select Accepted Quote</div>
            <input
              className={styles.searchInput}
              placeholder="Search quotes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {loading ? (
              <div className={styles.loadingMsg}>Loading available quotes…</div>
            ) : quotes.length === 0 ? (
              <div className={styles.emptyMsg}>
                No accepted quotes without a sales order found.
              </div>
            ) : (
              <div className={styles.quotePickerList}>
                {quotes.map(q => (
                  <label
                    key={q.id}
                    className={`${styles.quotePickerItem} ${selectedQuoteId === q.id ? styles.quotePickerSelected : ''}`}
                  >
                    <input
                      type="radio"
                      value={q.id}
                      {...register('quoteId')}
                      className={styles.radioHidden}
                    />
                    <div className={styles.quotePickerInfo}>
                      <span className={styles.quotePickerNo}>{q.quoteNo}</span>
                      <span className={styles.quotePickerCustomer}>{q.customerName ?? 'Unknown'}</span>
                      {q.subject && <span className={styles.quotePickerSubject}>{q.subject}</span>}
                    </div>
                    <span className={styles.quotePickerAmount}>{fmtINR(q.grandTotal)}</span>
                  </label>
                ))}
              </div>
            )}
            {errors.quoteId && <span className={styles.formError}>{errors.quoteId.message}</span>}
          </div>

          {/* SO details */}
          {selectedQuote && (
            <div className={styles.formSection}>
              <div className={styles.formSectionTitle}>Order Details</div>

              <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Priority</label>
                  <select className={styles.formInput} {...register('priority')}>
                    {Object.entries(SO_PRIORITY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Expected Delivery</label>
                  <input type="date" className={styles.formInput} {...register('expectedDelivery')} />
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Delivery Address</label>
                <textarea rows={3} className={styles.formTextarea} {...register('deliveryAddress')} />
              </div>

              <div className={styles.formGrid}>
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
                <label className={styles.formLabel}>Notes</label>
                <textarea rows={2} className={styles.formTextarea} {...register('notes')} />
              </div>
            </div>
          )}

          <div className={styles.modalFooter}>
            <button type="submit" className={styles.btnPrimary} disabled={isSubmitting || !selectedQuoteId}>
              {isSubmitting ? 'Creating…' : 'Create Sales Order'}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
