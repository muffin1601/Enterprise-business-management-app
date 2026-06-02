'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import type { Route } from 'next'
import { createSalesOrder } from '../server/actions'
import { SO_PRIORITY_LABELS } from '@/validations/sales-order'
import styles from './so-create-form.module.scss'

// ── Types ─────────────────────────────────────────────────────────────────────

type QuoteOption = {
  id:           string
  quoteNo:      string
  subject:      string | null
  customerName: string | null
  grandTotal:   number
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  priority:         z.enum(['low','normal','high','urgent']).default('normal'),
  expectedDelivery: z.string().optional(),
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  notes:            z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtINR = (n: number) => {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

// ── Quote picker panel ────────────────────────────────────────────────────────

function QuotePicker({
  selected,
  onSelect,
}: {
  selected: QuoteOption | null
  onSelect: (q: QuoteOption) => void
}) {
  const [quotes,  setQuotes]  = useState<QuoteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PER_PAGE = 20

  const load = useCallback((q: string, p: number) => {
    setLoading(true)
    fetch(`/api/sales-orders/accepted-quotes?q=${encodeURIComponent(q)}&page=${p}&limit=${PER_PAGE}`)
      .then(r => r.json())
      .then((data: { quotes: QuoteOption[]; total: number }) => {
        setQuotes(data.quotes ?? data)
        setTotal(data.total ?? (data as unknown as QuoteOption[]).length ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(search, page) }, [search, page, load])

  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className={styles.pickerPanel}>
      <div className={styles.pickerSearch}>
        <input
          className={styles.searchInput}
          placeholder="Search by quote number, customer, or subject…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      <div className={styles.pickerList}>
        {loading ? (
          <div className={styles.pickerEmpty}>Loading quotes…</div>
        ) : quotes.length === 0 ? (
          <div className={styles.pickerEmpty}>
            No accepted quotes without a sales order found.
            {search && <> Try clearing the search.</>}
          </div>
        ) : (
          quotes.map(q => (
            <button
              key={q.id}
              type="button"
              className={`${styles.quoteRow} ${selected?.id === q.id ? styles.quoteRowSelected : ''}`}
              onClick={() => onSelect(q)}
            >
              <div className={styles.quoteRowLeft}>
                <span className={styles.quoteNo}>{q.quoteNo}</span>
                <span className={styles.quoteCustomer}>{q.customerName ?? '—'}</span>
                {q.subject && <span className={styles.quoteSubject}>{q.subject}</span>}
              </div>
              <span className={styles.quoteAmount}>{fmtINR(q.grandTotal)}</span>
              {selected?.id === q.id && <span className={styles.checkmark}>✓</span>}
            </button>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pickerPagination}>
          <button disabled={page <= 1}           onClick={() => setPage(p => p - 1)} type="button">← Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages}  onClick={() => setPage(p => p + 1)} type="button">Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function SoCreateForm({ preSelectedQuoteId }: { preSelectedQuoteId?: string }) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [selected, setSelected] = useState<QuoteOption | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  // Pre-load a quote if coming from quote page
  useEffect(() => {
    if (!preSelectedQuoteId) return
    fetch(`/api/sales-orders/accepted-quotes?q=`)
      .then(r => r.json())
      .then((data: { quotes: QuoteOption[] } | QuoteOption[]) => {
        const list: QuoteOption[] = Array.isArray(data) ? data : data.quotes ?? []
        const found = list.find(q => q.id === preSelectedQuoteId)
        if (found) setSelected(found)
      })
      .catch(() => {})
  }, [preSelectedQuoteId])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'normal' },
  })

  function onSubmit(data: FormData) {
    if (!selected) { setError('Please select an accepted quote.'); return }
    setError(null)
    startT(async () => {
      const res = await createSalesOrder({
        quoteId:         selected.id,
        priority:        data.priority,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
        deliveryAddress:  data.deliveryAddress,
        siteContactName:  data.siteContactName,
        siteContactPhone: data.siteContactPhone,
        notes:            data.notes,
      })
      if (!res.ok) {
        setError(res.error?.message ?? 'Failed to create sales order.')
        return
      }
      router.push(`/orders/${res.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.root}>

      {/* ── Left: quote picker ─────────────────── */}
      <div className={styles.left}>
        <div className={styles.sectionTitle}>Select Accepted Quote</div>
        <QuotePicker selected={selected} onSelect={setSelected} />
      </div>

      {/* ── Right: order details ───────────────── */}
      <div className={styles.right}>
        {selected ? (
          <div className={styles.selectedBanner}>
            <div className={styles.selectedNo}>{selected.quoteNo}</div>
            <div className={styles.selectedCustomer}>{selected.customerName ?? '—'}</div>
            {selected.subject && <div className={styles.selectedSubject}>{selected.subject}</div>}
            <div className={styles.selectedAmount}>{fmtINR(selected.grandTotal)}</div>
          </div>
        ) : (
          <div className={styles.noSelection}>← Select a quote to continue</div>
        )}

        <div className={styles.sectionTitle} style={{ marginTop: 24 }}>Order Details</div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label className={styles.label}>Priority</label>
            <select className={styles.select} {...register('priority')}>
              {Object.entries(SO_PRIORITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Expected Delivery Date</label>
            <input type="date" className={styles.input} {...register('expectedDelivery')} />
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Delivery Address</label>
          <textarea rows={4} className={styles.textarea} {...register('deliveryAddress')} />
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label className={styles.label}>Site Contact Name</label>
            <input type="text" className={styles.input} {...register('siteContactName')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Site Contact Phone</label>
            <input type="tel" className={styles.input} {...register('siteContactPhone')} />
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Notes</label>
          <textarea rows={3} className={styles.textarea} {...register('notes')} />
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={isSubmitting || !selected}
          >
            {isSubmitting ? 'Creating…' : 'Create Sales Order'}
          </button>
          <Link href="/orders" className={styles.btnSecondary}>Cancel</Link>
        </div>
      </div>
    </form>
  )
}
