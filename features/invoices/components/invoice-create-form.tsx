'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createInvoice } from '../server/actions'
import styles from './invoice-create-form.module.scss'

// ── Types ─────────────────────────────────────────────────────────────────────

type SoOption = {
  id:           string
  soNo:         string
  subject:      string | null
  customerName: string | null
  grandTotal:   number
  status:       string
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  dueDate:       z.string().optional(),
  placeOfSupply: z.string().optional(),
  isIgst:        z.boolean().default(false),
  paymentTerms:  z.string().optional(),
  notes:         z.string().optional(),
})

type FormData = z.infer<typeof schema>

const fmtINR = (n: number) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

const SO_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready',
  dispatched: 'Dispatched', delivered: 'Delivered',
}

// ── SO Picker ─────────────────────────────────────────────────────────────────

function SoPicker({ selected, onSelect }: { selected: SoOption | null; onSelect: (s: SoOption) => void }) {
  const [items,   setItems]   = useState<SoOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PER_PAGE = 20

  const load = useCallback((q: string, p: number) => {
    setLoading(true)
    fetch(`/api/invoices/eligible-sos?q=${encodeURIComponent(q)}&page=${p}&limit=${PER_PAGE}`)
      .then(r => r.json())
      .then((data: { items: SoOption[]; total: number }) => {
        setItems(data.items ?? [])
        setTotal(data.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(search, page) }, [search, page, load])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className={styles.pickerPanel}>
      <input
        className={styles.searchInput}
        placeholder="Search by SO number, customer, or subject…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
      />

      <div className={styles.pickerList}>
        {loading ? (
          <div className={styles.pickerEmpty}>Loading sales orders…</div>
        ) : items.length === 0 ? (
          <div className={styles.pickerEmpty}>No eligible sales orders found.</div>
        ) : (
          items.map(s => (
            <button
              key={s.id}
              type="button"
              className={`${styles.soRow} ${selected?.id === s.id ? styles.soRowSelected : ''}`}
              onClick={() => onSelect(s)}
            >
              <div className={styles.soRowLeft}>
                <span className={styles.soNo}>{s.soNo}</span>
                <span className={styles.soCustomer}>{s.customerName ?? '—'}</span>
                {s.subject && <span className={styles.soSubject}>{s.subject}</span>}
              </div>
              <div className={styles.soRowRight}>
                <span className={styles.soStatus}>{SO_STATUS_LABELS[s.status] ?? s.status}</span>
                <span className={styles.soAmount}>{fmtINR(s.grandTotal)}</span>
              </div>
              {selected?.id === s.id && <span className={styles.checkmark}>✓</span>}
            </button>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pickerPagination}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} type="button">← Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} type="button">Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function InvoiceCreateForm({ preSelectedSoId }: { preSelectedSoId?: string }) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [selected, setSelected] = useState<SoOption | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  // Pre-load SO if coming from SO detail page
  useEffect(() => {
    if (!preSelectedSoId) return
    fetch(`/api/invoices/eligible-sos?q=&limit=500`)
      .then(r => r.json())
      .then((data: { items: SoOption[] }) => {
        const found = (data.items ?? []).find(s => s.id === preSelectedSoId)
        if (found) setSelected(found)
      })
      .catch(() => {})
  }, [preSelectedSoId])

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isIgst: false },
  })

  function onSubmit(data: FormData) {
    if (!selected) { setError('Please select a sales order.'); return }
    setError(null)
    startT(async () => {
      const res = await createInvoice({
        soId:          selected.id,
        dueDate:       data.dueDate ? new Date(data.dueDate) : undefined,
        placeOfSupply: data.placeOfSupply,
        isIgst:        data.isIgst,
        paymentTerms:  data.paymentTerms,
        notes:         data.notes,
      })
      if (!res.ok) { setError(res.error?.message ?? 'Failed to create invoice.'); return }
      router.push(`/invoices/${res.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.root}>

      {/* Left: SO picker */}
      <div className={styles.left}>
        <div className={styles.sectionTitle}>Select Sales Order</div>
        <SoPicker selected={selected} onSelect={setSelected} />
      </div>

      {/* Right: invoice details */}
      <div className={styles.right}>
        {selected ? (
          <div className={styles.selectedBanner}>
            <div className={styles.selectedNo}>{selected.soNo}</div>
            <div className={styles.selectedCustomer}>{selected.customerName ?? '—'}</div>
            {selected.subject && <div className={styles.selectedSubject}>{selected.subject}</div>}
            <div className={styles.selectedAmount}>{fmtINR(selected.grandTotal)}</div>
            <div className={styles.selectedStatus}>{SO_STATUS_LABELS[selected.status] ?? selected.status}</div>
          </div>
        ) : (
          <div className={styles.noSelection}>← Select a sales order to continue</div>
        )}

        <div className={styles.sectionTitle} style={{ marginTop: 24 }}>Invoice Details</div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label className={styles.label}>Due Date</label>
            <input type="date" className={styles.input} {...register('dueDate')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Payment Terms</label>
            <input type="text" className={styles.input} placeholder="e.g. Net 30" {...register('paymentTerms')} />
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Place of Supply</label>
          <input type="text" className={styles.input} placeholder="e.g. Delhi, Maharashtra" {...register('placeOfSupply')} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.checkLabel}>
            <input type="checkbox" {...register('isIgst')} />
            <span>Inter-state sale (use IGST instead of CGST + SGST)</span>
          </label>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>Notes</label>
          <textarea rows={3} className={styles.textarea} {...register('notes')} />
        </div>

        <div className={styles.infoBox}>
          <strong>Line items</strong> will be copied from the sales order. You can edit HSN codes, quantities, rates, and GST% on the invoice before issuing it.
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={isSubmitting || !selected}>
            {isSubmitting ? 'Creating…' : 'Create Invoice'}
          </button>
          <Link href="/invoices" className={styles.btnSecondary}>Cancel</Link>
        </div>
      </div>
    </form>
  )
}
