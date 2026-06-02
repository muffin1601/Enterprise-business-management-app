'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './delivery-challans.module.scss'
import { Icon } from '@/components/ui'

type InvoiceOption = {
  id:           string
  invoiceNo:    string
  subject:      string | null
  customerName: string | null
  grandTotal:   number
  date:         string
}

const fmtINR = (n: number) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export function DcInvoicePicker() {
  const router = useRouter()
  const [items,   setItems]   = useState<InvoiceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PER = 20

  const load = useCallback((q: string, p: number) => {
    setLoading(true)
    fetch(`/api/delivery-challans/eligible-invoices?q=${encodeURIComponent(q)}&page=${p}&limit=${PER}`)
      .then(r => r.json())
      .then((d: { items: InvoiceOption[]; total: number }) => {
        setItems(d.items ?? [])
        setTotal(d.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(search, page) }, [search, page, load])

  const totalPages = Math.ceil(total / PER)

  function handleSelect(inv: InvoiceOption) {
    router.push(`/delivery-challans/new?invoiceId=${inv.id}`)
  }

  return (
    <div className={styles.invoicePickerWrap}>
      <div className={styles.pickerSearchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search by invoice number, customer, or subject…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          autoFocus
        />
        <span className={styles.pickerCount}>{total} issued invoice{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className={styles.pickerLoading}>Loading invoices…</div>
      ) : items.length === 0 ? (
        <div className={styles.pickerEmpty}>
          <Icon name="file-invoice" size={32} />
          <div>No issued invoices found</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Only invoices with status <strong>Issued</strong> can have delivery challans.
          </div>
        </div>
      ) : (
        <div className={styles.pickerList}>
          {items.map(inv => (
            <button
              key={inv.id}
              type="button"
              className={styles.pickerRow}
              onClick={() => handleSelect(inv)}
            >
              <div className={styles.pickerRowLeft}>
                <span className={styles.pickerCode}>{inv.invoiceNo}</span>
                <span className={styles.pickerName}>{inv.customerName ?? '—'}</span>
                {inv.subject && <span className={styles.pickerSub}>{inv.subject}</span>}
                <span className={styles.pickerDate}>{fmtDate(inv.date)}</span>
              </div>
              <div className={styles.pickerRowRight}>
                <span className={styles.pickerAmount}>{fmtINR(inv.grandTotal)}</span>
                <Icon name="chevron-right" size={14} style={{ color: 'var(--c-tertiary)' }} />
              </div>
            </button>
          ))}
        </div>
      )}

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
