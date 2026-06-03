'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createRunningInvoice } from '../server/actions'
import type { DeliverableChallan } from '../server/queries'
import styles from './running-invoices.module.scss'
import { Icon } from '@/components/ui'

type SoOption = {
  id: string; soNo: string; customerName: string | null
  status: string; dcCount: number
}

type Step = 'so' | 'challans' | 'details'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

// ── SO Picker ─────────────────────────────────────────────────────────────────

function SoPicker({ selected, onSelect }: { selected: SoOption | null; onSelect: (s: SoOption) => void }) {
  const [items,   setItems]   = useState<SoOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  const load = useCallback((q: string) => {
    setLoading(true)
    fetch(`/api/running-invoices/eligible-sos?q=${encodeURIComponent(q)}`)
      .then(r => r.json()).then((d: SoOption[]) => { setItems(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(search) }, [search, load])

  return (
    <div className={styles.pickerPanel}>
      <input className={styles.searchInput} placeholder="Search sales orders…" value={search}
        onChange={e => setSearch(e.target.value)} autoFocus />
      <div className={styles.pickerList}>
        {loading ? <div className={styles.pickerEmpty}>Loading…</div>
          : items.length === 0 ? <div className={styles.pickerEmpty}>No eligible sales orders with undelivered challans.</div>
          : items.map(so => (
            <button key={so.id} type="button"
              className={`${styles.pickerRow} ${selected?.id === so.id ? styles.pickerRowSelected : ''}`}
              onClick={() => onSelect(so)}
            >
              <div className={styles.pickerRowLeft}>
                <span className={styles.pickerCode}>{so.soNo}</span>
                <span className={styles.pickerName}>{so.customerName ?? '—'}</span>
                <span className={styles.pickerSub}>{so.dcCount} undelivered challan{so.dcCount !== 1 ? 's' : ''} · Status: {so.status}</span>
              </div>
              {selected?.id === so.id && <span className={styles.checkmark}>✓</span>}
            </button>
          ))}
      </div>
    </div>
  )
}

// ── DC Selector ───────────────────────────────────────────────────────────────

function DcSelector({
  soId, selected, onToggle, onSelectAll,
}: {
  soId: string; selected: Set<string>; onToggle: (id: string) => void; onSelectAll: (ids: string[]) => void
}) {
  const [challans, setChallans] = useState<DeliverableChallan[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/running-invoices/deliverable-challans?soId=${soId}`)
      .then(r => r.json()).then((d: DeliverableChallan[]) => { setChallans(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [soId])

  if (loading) return <div className={styles.pickerEmpty}>Loading challans…</div>
  if (challans.length === 0) return <div className={styles.pickerEmpty}>No delivered, unbilled challans for this sales order.</div>

  return (
    <div className={styles.challanSelector}>
      <div className={styles.challanSelectorHeader}>
        <span>{challans.length} delivered challan{challans.length !== 1 ? 's' : ''} available</span>
        <button type="button" className={styles.selectAllBtn}
          onClick={() => onSelectAll(challans.map(c => c.id))}>
          Select All
        </button>
      </div>
      {challans.map(c => (
        <label key={c.id} className={`${styles.challanCheckRow} ${selected.has(c.id) ? styles.challanCheckSelected : ''}`}>
          <input type="checkbox" checked={selected.has(c.id)} onChange={() => onToggle(c.id)} />
          <div className={styles.challanCheckInfo}>
            <span className={styles.challanNo}>{c.dcNo}</span>
            <span className={styles.challanMeta}>
              {fmtDate(c.dispatchDate || c.date)} · {c.itemCount} items · {c.unbilledLines} unbilled line{c.unbilledLines !== 1 ? 's' : ''}
            </span>
          </div>
          {selected.has(c.id) && <span className={styles.checkmark}>✓</span>}
        </label>
      ))}
    </div>
  )
}

// ── Main flow ─────────────────────────────────────────────────────────────────

export function RiCreateFlow({ preSelectedSoId }: { preSelectedSoId?: string }) {
  const router    = useRouter()
  const [, startT] = useTransition()
  const [step, setStep] = useState<Step>(preSelectedSoId ? 'challans' : 'so')
  const [selSo,   setSelSo]     = useState<SoOption | null>(null)
  const [selDcs,  setSelDcs]    = useState<Set<string>>(new Set())
  const [isIgst,  setIsIgst]    = useState(false)
  const [dueDate, setDueDate]   = useState('')
  const [notes,   setNotes]     = useState('')
  const [error,   setError]     = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pre-load SO
  useEffect(() => {
    if (!preSelectedSoId) return
    fetch(`/api/running-invoices/eligible-sos?q=&soId=${preSelectedSoId}`)
      .then(r => r.json()).then((d: SoOption[]) => {
        const found = d.find(s => s.id === preSelectedSoId)
        if (found) { setSelSo(found); setStep('challans') }
      }).catch(() => {})
  }, [preSelectedSoId])

  function toggleDc(id: string) {
    setSelDcs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAll(ids: string[]) { setSelDcs(new Set(ids)) }

  function handleSubmit() {
    if (!selSo) { setError('Select a sales order.'); return }
    if (selDcs.size === 0) { setError('Select at least one delivery challan.'); return }
    setError(null); setSubmitting(true)
    startT(async () => {
      const res = await createRunningInvoice({
        soId:     selSo.id,
        dcIds:    [...selDcs],
        isIgst,
        dueDate:  dueDate ? new Date(dueDate) : undefined,
        notes:    notes || undefined,
      })
      setSubmitting(false)
      if (!res.ok) { setError(res.error?.message ?? 'Failed.'); return }
      router.push(`/running-invoices/${res.data.id}`)
    })
  }

  const steps: Step[] = ['so', 'challans', 'details']
  const stepLabels = ['Sales Order', 'Challans', 'Details']

  return (
    <div className={styles.createFlow}>
      {/* Step bar */}
      <div className={styles.stepBar}>
        {steps.map((s, i) => (
          <button key={s} type="button"
            className={`${styles.stepBtn} ${step === s ? styles.stepActive : ''} ${
              (s === 'challans' && !selSo) || (s === 'details' && selDcs.size === 0) ? styles.stepDisabled : ''
            }`}
            onClick={() => {
              if (s === 'challans' && !selSo) return
              if (s === 'details' && selDcs.size === 0) return
              setStep(s)
            }}
          >
            <span className={styles.stepNum}>{i + 1}</span> {stepLabels[i]}
          </button>
        ))}
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* Step 1: SO */}
      {step === 'so' && (
        <div>
          <div className={styles.stepTitle}>Select Sales Order</div>
          <div className={styles.stepHint}>Choose a sales order with delivered challans ready to invoice.</div>
          <SoPicker selected={selSo} onSelect={so => { setSelSo(so); setSelDcs(new Set()); setStep('challans') }} />
        </div>
      )}

      {/* Step 2: Challans */}
      {step === 'challans' && selSo && (
        <div>
          {selSo && (
            <div className={styles.selectedBanner}>
              <div className={styles.selectedLabel}>Sales Order</div>
              <div className={styles.selectedName}>{selSo.soNo} — {selSo.customerName}</div>
              <button type="button" className={styles.changeLinkBtn} onClick={() => setStep('so')}>Change ↗</button>
            </div>
          )}
          <div className={styles.stepTitle} style={{ marginTop:16 }}>Select Delivery Challans</div>
          <div className={styles.stepHint}>Select one or more delivered challans to consolidate into this invoice.</div>
          <DcSelector soId={selSo.id} selected={selDcs} onToggle={toggleDc} onSelectAll={selectAll} />
          {selDcs.size > 0 && (
            <button className={styles.btnPrimary} onClick={() => setStep('details')} type="button" style={{ marginTop:16 }}>
              Next: Set Details ({selDcs.size} challan{selDcs.size !== 1 ? 's' : ''}) →
            </button>
          )}
        </div>
      )}

      {/* Step 3: Details */}
      {step === 'details' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className={styles.selectedBanner}>
            <div className={styles.selectedName}>{selSo?.soNo} — {selSo?.customerName}</div>
            <div className={styles.selectedLabel}>{selDcs.size} challan{selDcs.size !== 1 ? 's' : ''} selected</div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Due Date</label>
              <input type="date" className={styles.formInput} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={isIgst} onChange={e => setIsIgst(e.target.checked)} />
              <span>Inter-state sale (use IGST instead of CGST + SGST)</span>
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Notes</label>
            <textarea rows={3} className={styles.formTextarea} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className={styles.infoBox}>
            <Icon name="info-circle" size={13} />
            <div>Line items will be assembled from the selected challans using quantities from DC and prices from the Sales Order. Items already billed in previous invoices are automatically excluded.</div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting} type="button">
              {submitting ? 'Creating…' : 'Create Running Invoice (Draft)'}
            </button>
            <Link href="/running-invoices" className={styles.btnSecondary}>Cancel</Link>
          </div>
        </div>
      )}
    </div>
  )
}
