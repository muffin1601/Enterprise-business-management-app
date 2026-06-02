'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createPurchaseOrder } from '../server/actions'
import styles from './po-create-form.module.scss'

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceOption = {
  id:           string
  invoiceNo:    string
  subject:      string | null
  customerName: string | null
  grandTotal:   number
  date:         string
}

type VendorOption = {
  id:   string
  code: string
  name: string
  type: string
  paymentTerms: string
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  expectedDelivery: z.string().optional(),
  paymentTerms:     z.string().optional(),
  isIgst:           z.boolean().default(false),
  transport:        z.coerce.number().min(0).default(0),
  transportNote:    z.string().optional(),
  notes:            z.string().optional(),
})

type FormData = z.infer<typeof schema>

const fmtINR = (n: number) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

// ── Invoice Picker ────────────────────────────────────────────────────────────

function InvoicePicker({ selected, onSelect }: {
  selected: InvoiceOption | null; onSelect: (i: InvoiceOption) => void
}) {
  const [items,   setItems]   = useState<InvoiceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PER = 20

  const load = useCallback((q: string, p: number) => {
    setLoading(true)
    fetch(`/api/purchase-orders/eligible-invoices?q=${encodeURIComponent(q)}&page=${p}&limit=${PER}`)
      .then(r => r.json())
      .then((d: { items: InvoiceOption[]; total: number }) => {
        setItems(d.items ?? []); setTotal(d.total ?? 0); setLoading(false)
      }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(search, page) }, [search, page, load])

  const totalPages = Math.ceil(total / PER)

  return (
    <div className={styles.pickerPanel}>
      <input
        className={styles.searchInput}
        placeholder="Search invoice number, customer, subject…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
      />
      <div className={styles.pickerList}>
        {loading ? (
          <div className={styles.pickerEmpty}>Loading invoices…</div>
        ) : items.length === 0 ? (
          <div className={styles.pickerEmpty}>No issued invoices available.</div>
        ) : (
          items.map(inv => (
            <button key={inv.id} type="button"
              className={`${styles.pickerRow} ${selected?.id === inv.id ? styles.pickerRowSelected : ''}`}
              onClick={() => onSelect(inv)}
            >
              <div className={styles.pickerRowLeft}>
                <span className={styles.pickerCode}>{inv.invoiceNo}</span>
                <span className={styles.pickerName}>{inv.customerName ?? '—'}</span>
                {inv.subject && <span className={styles.pickerSub}>{inv.subject}</span>}
                <span className={styles.pickerDate}>{fmtDate(inv.date)}</span>
              </div>
              <div className={styles.pickerRowRight}>
                <span className={styles.pickerAmount}>{fmtINR(inv.grandTotal)}</span>
                {selected?.id === inv.id && <span className={styles.checkmark}>✓</span>}
              </div>
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

// ── Vendor Picker ─────────────────────────────────────────────────────────────

function VendorPicker({ selected, onSelect }: {
  selected: VendorOption | null; onSelect: (v: VendorOption) => void
}) {
  const [items,   setItems]   = useState<VendorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/vendors/active?q=${encodeURIComponent(search)}&limit=100`)
      .then(r => r.json())
      .then((d: VendorOption[]) => { setItems(d ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [search])

  return (
    <div className={styles.pickerPanel}>
      <input
        className={styles.searchInput}
        placeholder="Search vendors by name or type…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className={styles.pickerList}>
        {loading ? (
          <div className={styles.pickerEmpty}>Loading vendors…</div>
        ) : items.length === 0 ? (
          <div className={styles.pickerEmpty}>No active vendors found.</div>
        ) : (
          items.map(v => (
            <button key={v.id} type="button"
              className={`${styles.pickerRow} ${selected?.id === v.id ? styles.pickerRowSelected : ''}`}
              onClick={() => onSelect(v)}
            >
              <div className={styles.pickerRowLeft}>
                <span className={styles.pickerCode}>{v.code}</span>
                <span className={styles.pickerName}>{v.name}</span>
                <span className={styles.pickerSub}>{v.type.replace('_', ' ')} · {v.paymentTerms.replace('_', ' ')}</span>
              </div>
              {selected?.id === v.id && <span className={styles.checkmark}>✓</span>}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────────────

type Step = 'invoice' | 'vendor' | 'details'

export function PoCreateForm({ preSelectedInvoiceId }: { preSelectedInvoiceId?: string }) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [step, setStep]         = useState<Step>('invoice')
  const [selInvoice, setSelInv] = useState<InvoiceOption | null>(null)
  const [selVendor, setSelVen]  = useState<VendorOption | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // Pre-load if coming from invoice page
  useEffect(() => {
    if (!preSelectedInvoiceId) return
    fetch(`/api/purchase-orders/eligible-invoices?q=&limit=500`)
      .then(r => r.json())
      .then((d: { items: InvoiceOption[] }) => {
        const found = (d.items ?? []).find(i => i.id === preSelectedInvoiceId)
        if (found) { setSelInv(found); setStep('vendor') }
      }).catch(() => {})
  }, [preSelectedInvoiceId])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isIgst: false, transport: 0 },
  })

  function onSubmit(data: FormData) {
    if (!selInvoice) { setError('Select an invoice.'); return }
    if (!selVendor)  { setError('Select a vendor.'); return }
    setError(null)
    startT(async () => {
      const res = await createPurchaseOrder({
        invoiceId:       selInvoice.id,
        vendorId:        selVendor.id,
        expectedDelivery:data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
        paymentTerms:    data.paymentTerms,
        isIgst:          data.isIgst,
        transport:       data.transport,
        transportNote:   data.transportNote,
        notes:           data.notes,
      })
      if (!res.ok) { setError(res.error?.message ?? 'Failed to create PO.'); return }
      router.push(`/purchase-orders/${res.data.id}`)
    })
  }

  return (
    <div className={styles.root}>
      {/* Step tabs */}
      <div className={styles.stepBar}>
        {(['invoice','vendor','details'] as Step[]).map((s, i) => (
          <button key={s} type="button"
            className={`${styles.stepBtn} ${step === s ? styles.stepActive : ''} ${
              (s === 'vendor' && !selInvoice) || (s === 'details' && (!selInvoice || !selVendor)) ? styles.stepDisabled : ''
            }`}
            onClick={() => {
              if (s === 'vendor' && !selInvoice) return
              if (s === 'details' && (!selInvoice || !selVendor)) return
              setStep(s)
            }}
          >
            <span className={styles.stepNum}>{i + 1}</span>
            {s === 'invoice' ? 'Select Invoice' : s === 'vendor' ? 'Select Vendor' : 'Order Details'}
          </button>
        ))}
      </div>

      {error && (
        <div className={styles.errorMsg}>{error}</div>
      )}

      {/* Step: Invoice */}
      {step === 'invoice' && (
        <div className={styles.stepContent}>
          <div className={styles.stepTitle}>Select an Issued Invoice</div>
          <div className={styles.stepHint}>Only invoices with status "Issued" are shown.</div>
          <InvoicePicker
            selected={selInvoice}
            onSelect={inv => { setSelInv(inv); setStep('vendor') }}
          />
        </div>
      )}

      {/* Step: Vendor */}
      {step === 'vendor' && (
        <div className={styles.stepContent}>
          {selInvoice && (
            <div className={styles.selectedBanner}>
              <div className={styles.selectedLabel}>Invoice</div>
              <div className={styles.selectedName}>{selInvoice.invoiceNo} — {selInvoice.customerName ?? '—'}</div>
              {selInvoice.subject && <div className={styles.selectedSub}>{selInvoice.subject}</div>}
              <div className={styles.selectedAmount}>{fmtINR(selInvoice.grandTotal)}</div>
            </div>
          )}
          <div className={styles.stepTitle}>Select Vendor</div>
          <div className={styles.stepHint}>Choose the vendor you're ordering from. One PO = one vendor.</div>
          <VendorPicker
            selected={selVendor}
            onSelect={v => { setSelVen(v); setStep('details') }}
          />
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.detailsForm}>
          <div className={styles.selectionSummary}>
            <button type="button" className={styles.changeBtn} onClick={() => setStep('invoice')}>
              Invoice: {selInvoice?.invoiceNo}
            </button>
            <span className={styles.arrowSep}>→</span>
            <button type="button" className={styles.changeBtn} onClick={() => setStep('vendor')}>
              Vendor: {selVendor?.name}
            </button>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label className={styles.label}>Expected Delivery Date</label>
              <input type="date" className={styles.input} {...register('expectedDelivery')} />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Payment Terms</label>
              <input type="text" className={styles.input} placeholder="e.g. Net 30, Advance" {...register('paymentTerms')} />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Transport Charges (₹)</label>
              <input type="number" min={0} step="any" className={styles.input} {...register('transport')} />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Transport Note</label>
              <input type="text" className={styles.input} placeholder="Optional" {...register('transportNote')} />
            </div>
          </div>

          <div className={styles.formRow}>
            <label className={styles.checkLabel}>
              <input type="checkbox" {...register('isIgst')} />
              <span>Inter-state purchase (apply IGST instead of CGST + SGST)</span>
            </label>
          </div>

          <div className={styles.formRow}>
            <label className={styles.label}>Notes</label>
            <textarea rows={3} className={styles.textarea} {...register('notes')} />
          </div>

          <div className={styles.infoBox}>
            <strong>Line items</strong> will be auto-populated from the invoice. Current stock will be checked for each item — quantities to order are pre-calculated. You can adjust rates, quantities, and HSN codes on the PO after creation.
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create Purchase Order'}
            </button>
            <Link href="/purchase-orders" className={styles.btnSecondary}>Cancel</Link>
          </div>
        </form>
      )}
    </div>
  )
}
