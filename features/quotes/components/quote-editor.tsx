'use client'

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
} from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ActionResult } from '@/types/action'
import {
  updateQuote,
  upsertQuoteLocations,
  upsertQuoteItems,
  updateQuoteStatus,
  reviseQuote,
  type QuoteStatus,
} from '../server/actions'
import type { QuoteItemInput, QuoteLocationInput } from '@/validations/quote'
import { Icon } from '@/components/ui'
import styles from './quotes.module.scss'

// ── External Types (from queries) ─────────────────────────────────────────────

export type QuoteTermDetail = {
  id: string
  category: string
  text: string
  sortOrder: number
}

export type QuoteItemDetail = {
  id: string
  itemId: string | null
  name: string
  description: string | null
  brand: string | null
  unit: string | null
  rate: number
  qty: number
  discountPct: number
  total: number
  sortOrder: number
}

export type QuoteLocationDetail = {
  id: string
  name: string
  sortOrder: number
  isIncluded: boolean
  installationCharge: number
  installationNote: string | null
  materialSubtotal: number
  locationTotal: number
  items: QuoteItemDetail[]
}

export type QuoteDetail = {
  id: string
  quoteNo: string
  revision: number
  customerId: string | null
  subject: string | null
  date: string
  validUntil: string | null
  status: QuoteStatus
  gstMode: 'add' | 'inclusive' | 'none'
  gstPct: number
  transport: number
  transportNote: string | null
  logoUrl: string | null
  includeBoqSummary: boolean
  notes: string | null
  materialSubtotal: number
  gstAmount: number
  grandTotal: number
  locations: QuoteLocationDetail[]
  terms: QuoteTermDetail[]
}

// ── Local Prop Types ──────────────────────────────────────────────────────────

export type CustomerRef = {
  id: string
  code: string
  name: string
  contactPerson: string | null
  phone: string | null
}

export type ItemRef = {
  id: string
  sku: string
  name: string
  brand: string | null
  unit: string | null
  sellingPrice: number
  purchasePrice: number
}

// ── Local State Types ─────────────────────────────────────────────────────────

type LocalItem = QuoteItemInput & {
  id: string | null       // real DB id if persisted
  localId: string         // stable React key
}

type LocalLocation = QuoteLocationInput & {
  id: string | null
  localId: string
  items: LocalItem[]
}

type LocalTerm = {
  localId: string
  category: string
  text: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TERM_CATEGORIES = [
  'delivery',
  'gst',
  'payment',
  'warranty',
  'installation',
  'exclusion',
  'other',
] as const

type TermCategory = (typeof TERM_CATEGORIES)[number]

const TERM_CATEGORY_LABELS: Record<TermCategory, string> = {
  delivery: 'DELIVERY',
  gst: 'GST',
  payment: 'PAYMENT',
  warranty: 'WARRANTY',
  installation: 'INSTALLATION',
  exclusion: 'EXCLUSION',
  other: 'OTHER',
}

const STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'revised', label: 'Revised' },
  { value: 'cancelled', label: 'Cancelled' },
]

const GST_MODE_OPTIONS = [
  { value: 'add' as const, label: 'Add GST' },
  { value: 'inclusive' as const, label: 'Incl. in Price' },
  { value: 'none' as const, label: 'No GST' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

let _idCounter = 0
function uid() {
  return `local-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

function calcItemTotal(rate: number, qty: number, discountPct: number): number {
  return rate * qty * (1 - discountPct / 100)
}

interface Totals {
  locationTotals: { localId: string; materialSubtotal: number; locationTotal: number }[]
  materialSubtotal: number   // sum of included locations (materials only, no install)
  includedSubtotal: number   // sum of included location totals (materials + install)
  gstAmount: number
  grandTotal: number
}

function calculateTotals(
  locations: LocalLocation[],
  gstMode: 'add' | 'inclusive' | 'none',
  gstPct: number,
  transport: number,
): Totals {
  const locationTotals = locations.map((loc) => {
    const materialSubtotal = loc.items.reduce(
      (sum, item) => sum + calcItemTotal(item.rate, item.qty, item.discountPct ?? 0),
      0,
    )
    const locationTotal = materialSubtotal + (loc.installationCharge ?? 0)
    return { localId: loc.localId, materialSubtotal, locationTotal }
  })

  const includedTotals = locationTotals.filter((lt) => {
    const loc = locations.find((l) => l.localId === lt.localId)
    return loc?.isIncluded ?? true
  })

  const materialSubtotal = includedTotals.reduce((sum, lt) => sum + lt.materialSubtotal, 0)
  const includedSubtotal = includedTotals.reduce((sum, lt) => sum + lt.locationTotal, 0)

  const base = includedSubtotal + (transport ?? 0)
  let gstAmount = 0
  let grandTotal = 0

  if (gstMode === 'add') {
    gstAmount = base * (gstPct / 100)
    grandTotal = base + gstAmount
  } else if (gstMode === 'inclusive') {
    gstAmount = base - base / (1 + gstPct / 100)
    grandTotal = base
  } else {
    gstAmount = 0
    grandTotal = base
  }

  return { locationTotals, materialSubtotal, includedSubtotal, gstAmount, grandTotal }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SaveStatus({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null
  if (status === 'saving') return <span className={styles.saveStatus}>Saving…</span>
  if (status === 'saved') return <span className={`${styles.saveStatus} ${styles.saveStatusOk}`}>Saved</span>
  return <span className={`${styles.saveStatus} ${styles.saveStatusErr}`}>Save failed</span>
}

interface ItemRowProps {
  item: LocalItem
  itemRefs: ItemRef[]
  onChange: (updated: LocalItem) => void
  onRemove: () => void
  disabled: boolean
}

function ItemRow({ item, itemRefs, onChange, onRemove, disabled }: ItemRowProps) {
  const listId = `items-${item.localId}`
  const total = calcItemTotal(item.rate, item.qty, item.discountPct ?? 0)

  function handleNameChange(value: string) {
    // Try to auto-fill from item catalog
    const matched = itemRefs.find(
      (r) => r.name.toLowerCase() === value.toLowerCase() || r.sku.toLowerCase() === value.toLowerCase(),
    )
    if (matched) {
      onChange({
        ...item,
        name: matched.name,
        itemId: matched.id,
        brand: matched.brand ?? item.brand,
        unit: matched.unit ?? item.unit,
        rate: matched.sellingPrice ?? item.rate,
      })
    } else {
      onChange({ ...item, name: value, itemId: undefined })
    }
  }

  return (
    <tr className={styles.itemRow}>
      <td className={styles.itemNameCell}>
        <input
          list={listId}
          className={styles.itemInput}
          value={item.name}
          placeholder="Item / description"
          disabled={disabled}
          onChange={(e) => handleNameChange(e.target.value)}
        />
        <datalist id={listId}>
          {itemRefs.map((r) => (
            <option key={r.id} value={r.name} data-sku={r.sku} />
          ))}
        </datalist>
      </td>
      <td>
        <input
          className={styles.itemInput}
          value={item.brand ?? ''}
          placeholder="Brand"
          disabled={disabled}
          onChange={(e) => onChange({ ...item, brand: e.target.value })}
        />
      </td>
      <td>
        <input
          className={styles.itemInput}
          value={item.unit ?? ''}
          placeholder="Unit"
          disabled={disabled}
          onChange={(e) => onChange({ ...item, unit: e.target.value })}
        />
      </td>
      <td>
        <input
          type="number"
          className={`${styles.itemInput} ${styles.textRight}`}
          value={item.rate === 0 ? '' : item.rate}
          placeholder="0"
          min={0}
          disabled={disabled}
          onChange={(e) => onChange({ ...item, rate: parseFloat(e.target.value) || 0 })}
        />
      </td>
      <td>
        <input
          type="number"
          className={`${styles.itemInput} ${styles.textRight}`}
          value={item.qty === 1 ? item.qty : item.qty || ''}
          placeholder="1"
          min={0}
          disabled={disabled}
          onChange={(e) => onChange({ ...item, qty: parseFloat(e.target.value) || 1 })}
        />
      </td>
      <td>
        <input
          type="number"
          className={`${styles.itemInput} ${styles.textRight}`}
          value={(item.discountPct ?? 0) === 0 ? '' : (item.discountPct ?? 0)}
          placeholder="0"
          min={0}
          max={100}
          disabled={disabled}
          onChange={(e) => onChange({ ...item, discountPct: parseFloat(e.target.value) || 0 })}
        />
      </td>
      <td className={`${styles.itemTotalCell} ${styles.textRight}`}>
        {fmtINR(total)}
      </td>
      <td className={styles.itemDeleteCell}>
        {!disabled && (
          <button
            className={styles.rowDeleteBtn}
            title="Remove item"
            type="button"
            onClick={onRemove}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface QuoteEditorProps {
  quote: QuoteDetail
  customers: CustomerRef[]
  items: ItemRef[]
  canEdit: boolean
}

export function QuoteEditor({ quote, customers, items: itemRefs, canEdit }: QuoteEditorProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── Meta state ──────────────────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState(quote.customerId ?? '')
  const [subject, setSubject] = useState(quote.subject ?? '')
  const [date, setDate] = useState(quote.date ?? new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<QuoteStatus>(quote.status)
  const [gstMode, setGstMode] = useState<'add' | 'inclusive' | 'none'>(quote.gstMode)
  const [gstPct, setGstPct] = useState(quote.gstPct ?? 18)
  const [transport, setTransport] = useState(quote.transport ?? 0)
  const [transportNote, setTransportNote] = useState(quote.transportNote ?? '')
  const [includeBoqSummary, setIncludeBoqSummary] = useState(quote.includeBoqSummary ?? true)

  // ── Locations/items state ───────────────────────────────────────────────────
  const [locations, setLocations] = useState<LocalLocation[]>(() =>
    quote.locations.map((loc) => ({
      id: loc.id,
      localId: uid(),
      name: loc.name,
      sortOrder: loc.sortOrder,
      isIncluded: loc.isIncluded,
      installationCharge: loc.installationCharge,
      installationNote: loc.installationNote ?? '',
      items: loc.items.map((item) => ({
        id: item.id,
        localId: uid(),
        itemId: item.itemId ?? undefined,
        name: item.name,
        description: item.description ?? undefined,
        brand: item.brand ?? undefined,
        unit: item.unit ?? undefined,
        rate: item.rate,
        qty: item.qty,
        discountPct: item.discountPct,
      })),
    })),
  )

  // ── Terms state ─────────────────────────────────────────────────────────────
  const [terms, setTerms] = useState<LocalTerm[]>(() =>
    quote.terms.map((t) => ({
      localId: uid(),
      category: t.category,
      text: t.text,
    })),
  )

  // ── Auto-save state ─────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debounceRef = useRef<NodeJS.Timeout>(undefined)
  const isFirstRender = useRef(true)

  // ── Totals (derived) ────────────────────────────────────────────────────────
  const totals = calculateTotals(locations, gstMode, gstPct, transport)

  // ── Save logic ──────────────────────────────────────────────────────────────
  const saveAll = useCallback(async () => {
    setSaveStatus('saving')
    try {
      // 1. Save meta
      const metaResult = await updateQuote(quote.id, {
        customerId: customerId || undefined,
        subject: subject || undefined,
        date: new Date(date),
        status,
        gstMode,
        gstPct,
        transport,
        transportNote: transportNote || undefined,
        includeBoqSummary,
        terms: terms.map((t) => ({ category: t.category as TermCategory, text: t.text })),
      })

      if (!metaResult.ok) {
        setSaveStatus('error')
        return
      }

      // 2. Upsert locations (returns new ids)
      const locResult = await upsertQuoteLocations(
        quote.id,
        locations.map((loc, i) => ({
          name: loc.name,
          sortOrder: i,
          isIncluded: loc.isIncluded,
          installationCharge: loc.installationCharge ?? 0,
          installationNote: loc.installationNote ?? undefined,
        })),
      )

      if (!locResult.ok) {
        setSaveStatus('error')
        return
      }

      const locationIds = locResult.data.locationIds

      // 3. Upsert items per location
      const itemPromises = locations.map((loc, i) => {
        const locationId = locationIds[i]
        if (!locationId) return Promise.resolve()
        return upsertQuoteItems(
          locationId,
          quote.id,
          loc.items.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            description: item.description,
            brand: item.brand,
            unit: item.unit,
            rate: item.rate,
            qty: item.qty,
            discountPct: item.discountPct ?? 0,
          })),
        )
      })

      await Promise.all(itemPromises)

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    }
  }, [
    quote.id,
    customerId,
    subject,
    date,
    status,
    gstMode,
    gstPct,
    transport,
    transportNote,
    includeBoqSummary,
    terms,
    locations,
  ])

  // ── Debounced auto-save ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!canEdit) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveAll()
    }, 1500)

    return () => clearTimeout(debounceRef.current)
  }, [
    customerId,
    subject,
    date,
    status,
    gstMode,
    gstPct,
    transport,
    transportNote,
    includeBoqSummary,
    terms,
    locations,
    saveAll,
    canEdit,
  ])

  // ── Save & Exit ──────────────────────────────────────────────────────────────
  async function handleSaveAndExit() {
    if (canEdit) {
      clearTimeout(debounceRef.current)
      await saveAll()
    }
    router.push('/quotes')
  }

  // ── Revise ──────────────────────────────────────────────────────────────────
  function handleRevise() {
    if (!confirm('Create a new revision of this quote?')) return
    startTransition(async () => {
      const result = await reviseQuote(quote.id)
      if (result.ok) {
        router.push(`/quotes/${result.data.id}/edit`)
      }
    })
  }

  // ── Status change ────────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus: QuoteStatus) {
    const result = await updateQuoteStatus(quote.id, newStatus)
    if (result.ok) {
      setStatus(newStatus)
    }
  }

  // ── Location helpers ─────────────────────────────────────────────────────────
  function addLocation() {
    const n = locations.length + 1
    setLocations((prev) => [
      ...prev,
      {
        id: null,
        localId: uid(),
        name: `Location ${n}`,
        sortOrder: n - 1,
        isIncluded: true,
        installationCharge: 0,
        installationNote: '',
        items: [],
      },
    ])
  }

  function removeLocation(localId: string) {
    setLocations((prev) => prev.filter((l) => l.localId !== localId))
  }

  function updateLocation(localId: string, patch: Partial<LocalLocation>) {
    setLocations((prev) =>
      prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)),
    )
  }

  // ── Item helpers ──────────────────────────────────────────────────────────────
  function addItem(locationLocalId: string) {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.localId === locationLocalId
          ? {
              ...loc,
              items: [
                ...loc.items,
                {
                  id: null,
                  localId: uid(),
                  itemId: undefined,
                  name: '',
                  description: undefined,
                  brand: undefined,
                  unit: undefined,
                  rate: 0,
                  qty: 1,
                  discountPct: 0,
                },
              ],
            }
          : loc,
      ),
    )
  }

  function updateItem(locationLocalId: string, itemLocalId: string, updated: LocalItem) {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.localId === locationLocalId
          ? {
              ...loc,
              items: loc.items.map((item) =>
                item.localId === itemLocalId ? updated : item,
              ),
            }
          : loc,
      ),
    )
  }

  function removeItem(locationLocalId: string, itemLocalId: string) {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.localId === locationLocalId
          ? { ...loc, items: loc.items.filter((i) => i.localId !== itemLocalId) }
          : loc,
      ),
    )
  }

  // ── Term helpers ──────────────────────────────────────────────────────────────
  function addTerm(category: string) {
    setTerms((prev) => [
      ...prev,
      { localId: uid(), category, text: '' },
    ])
  }

  function updateTerm(localId: string, text: string) {
    setTerms((prev) =>
      prev.map((t) => (t.localId === localId ? { ...t, text } : t)),
    )
  }

  function removeTerm(localId: string) {
    setTerms((prev) => prev.filter((t) => t.localId !== localId))
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.editorRoot}>
      {/* ── TOPBAR ── */}
      <div className={styles.editorTopbar}>
        <div className={styles.editorTopbarLeft}>
          <button
            className={styles.saveExitBtn}
            onClick={handleSaveAndExit}
            type="button"
          >
            <Icon name="arrow-left" size={15} />
            SAVE &amp; EXIT
          </button>
          <span className={styles.quoteRefDisplay}>{quote.quoteNo}</span>
          {quote.revision > 0 && (
            <span className={styles.revBadgeEditor}>REV {quote.revision}</span>
          )}
          <SaveStatus status={saveStatus} />
        </div>
        <div className={styles.editorTopbarRight}>
          {canEdit && (
            <button
              className={styles.reviseBtn}
              onClick={handleRevise}
              type="button"
            >
              <Icon name="rotate-ccw" size={14} />
              REVISE
            </button>
          )}
          <Link
            href={`/quotes/${quote.id}/preview`}
            className={styles.previewBtn}
            target="_blank"
          >
            <Icon name="eye" size={14} />
            PREVIEW
          </Link>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className={styles.editorBody}>
        {/* ── LEFT COLUMN ── */}
        <div className={styles.editorMain}>

          {/* Panel 1: Quote Details */}
          <section className={styles.editorPanel}>
            <h2 className={styles.panelTitle}>QUOTE DETAILS</h2>
            <div className={styles.formGrid}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Quote Ref</label>
                <span className={styles.formReadOnly}>{quote.quoteNo}</span>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Revision</label>
                <span className={styles.formReadOnly}>{quote.revision === 0 ? 'Original' : `Rev ${quote.revision}`}</span>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={date}
                  disabled={!canEdit}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Subject / Project</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={subject}
                  placeholder="Enter project name or subject…"
                  disabled={!canEdit}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Customer */}
              <div className={styles.formRow}>
                <div className={styles.formLabelRow}>
                  <label className={styles.formLabel}>CUSTOMER</label>
                  {canEdit && (
                    <Link href="/customers/new" className={styles.addLink}>
                      + NEW CUSTOMER
                    </Link>
                  )}
                </div>
                <select
                  className={styles.formSelect}
                  value={customerId}
                  disabled={!canEdit}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">— Select customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                      {c.contactPerson ? ` · ${c.contactPerson}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Panel 2: Locations */}
          {locations.map((loc, locIdx) => {
            const locTotals = totals.locationTotals.find((lt) => lt.localId === loc.localId)
            const materialSubtotal = locTotals?.materialSubtotal ?? 0
            const locationTotal = locTotals?.locationTotal ?? 0
            const hasInstallation = (loc.installationCharge ?? 0) > 0 || loc.installationNote

            return (
              <section key={loc.localId} className={styles.locationBlock}>
                {/* Location header */}
                <div className={styles.locationHeader}>
                  <span className={styles.locationLabel}>LOCATION {locIdx + 1}</span>
                  <input
                    className={styles.locationNameInput}
                    value={loc.name}
                    disabled={!canEdit}
                    onChange={(e) => updateLocation(loc.localId, { name: e.target.value })}
                    aria-label={`Location ${locIdx + 1} name`}
                  />
                  <span className={styles.locationHeaderTotal}>{fmtINR(locationTotal)}</span>
                  {canEdit && locations.length > 1 && (
                    <button
                      className={styles.locationRemoveBtn}
                      title={`Remove location ${locIdx + 1}`}
                      type="button"
                      onClick={() => removeLocation(loc.localId)}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>

                {/* Items table */}
                <div className={styles.itemsTableWrap}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th className={styles.thName}>ITEM / DESCRIPTION</th>
                        <th>BRAND</th>
                        <th>UNIT</th>
                        <th className={styles.textRight}>RATE (₹)</th>
                        <th className={styles.textRight}>QTY</th>
                        <th className={styles.textRight}>DISC %</th>
                        <th className={styles.textRight}>TOTAL (₹)</th>
                        <th className={styles.thAction} />
                      </tr>
                    </thead>
                    <tbody>
                      {loc.items.map((item) => (
                        <ItemRow
                          key={item.localId}
                          item={item}
                          itemRefs={itemRefs}
                          disabled={!canEdit}
                          onChange={(updated) => updateItem(loc.localId, item.localId, updated)}
                          onRemove={() => removeItem(loc.localId, item.localId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Material subtotal row */}
                <div className={styles.subtotalRow}>
                  <span>Material Subtotal — Location {locIdx + 1}</span>
                  <span>{fmtINR(materialSubtotal)}</span>
                </div>

                {/* Add item button */}
                {canEdit && (
                  <button
                    className={styles.addItemBtn}
                    type="button"
                    onClick={() => addItem(loc.localId)}
                  >
                    <Icon name="plus" size={14} />
                    ADD ITEM
                  </button>
                )}

                {/* Installation */}
                {!hasInstallation && canEdit ? (
                  <button
                    className={styles.addInstallBtn}
                    type="button"
                    onClick={() => updateLocation(loc.localId, { installationCharge: 0, installationNote: '' })}
                  >
                    <Icon name="plus" size={14} />
                    ADD INSTALLATION CHARGE FOR THIS LOCATION
                  </button>
                ) : hasInstallation ? (
                  <div className={styles.installationRow}>
                    <span className={styles.installLabel}>Installation</span>
                    <span className={styles.installDash}>—</span>
                    <input
                      className={styles.installNoteInput}
                      placeholder="Note…"
                      value={loc.installationNote ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => updateLocation(loc.localId, { installationNote: e.target.value })}
                    />
                    <input
                      type="number"
                      className={`${styles.installAmountInput} ${styles.textRight}`}
                      value={loc.installationCharge === 0 ? '' : loc.installationCharge}
                      placeholder="0"
                      min={0}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateLocation(loc.localId, { installationCharge: parseFloat(e.target.value) || 0 })
                      }
                    />
                    {canEdit && (
                      <button
                        className={styles.rowDeleteBtn}
                        type="button"
                        title="Remove installation charge"
                        onClick={() =>
                          updateLocation(loc.localId, { installationCharge: 0, installationNote: '' })
                        }
                      >
                        <Icon name="x" size={13} />
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Location total dark bar */}
                <div className={styles.locationTotalBar}>
                  <span>TOTAL — LOCATION {locIdx + 1} (INCL. INSTALLATION)</span>
                  <span>{fmtINR(locationTotal)}</span>
                </div>
              </section>
            )
          })}

          {/* Add location button */}
          {canEdit && (
            <button
              className={styles.addLocationBtn}
              type="button"
              onClick={addLocation}
            >
              <Icon name="plus" size={15} />
              ADD LOCATION / AREA
            </button>
          )}

          {/* Areas Included section */}
          <section className={styles.editorPanel}>
            <h2 className={styles.panelTitle}>AREAS INCLUDED IN THIS QUOTE</h2>
            <p className={styles.hintText}>
              Tick the areas the client wishes to proceed with. Only ticked areas are included in the total.
            </p>
            <div className={styles.areasList}>
              {locations.map((loc, i) => {
                const lt = totals.locationTotals.find((lt) => lt.localId === loc.localId)
                return (
                  <label key={loc.localId} className={styles.areaRow}>
                    <input
                      type="checkbox"
                      className={styles.areaCheckbox}
                      checked={loc.isIncluded}
                      disabled={!canEdit}
                      onChange={(e) => updateLocation(loc.localId, { isIncluded: e.target.checked })}
                    />
                    <span className={styles.areaName}>
                      Location {i + 1} — {loc.name}
                    </span>
                    <span className={styles.areaTotal}>{fmtINR(lt?.locationTotal ?? 0)}</span>
                  </label>
                )
              })}
            </div>
          </section>

          {/* BOQ Summary toggle */}
          <section className={styles.editorPanel}>
            <div className={styles.boqSummaryRow}>
              <div className={styles.boqSummaryText}>
                <span className={styles.boqSummaryTitle}>BOQ Summary prints as a separate cover page</span>
                <span className={styles.boqSummarySubtitle}>
                  Client · Project · Address · Quote no. · Area-wise totals · Grand Total · GST @ {gstPct}%
                </span>
              </div>
              <div className={styles.boqSummaryRight}>
                <button
                  type="button"
                  className={`${styles.toggle} ${includeBoqSummary ? styles.toggleOn : ''}`}
                  disabled={!canEdit}
                  onClick={() => setIncludeBoqSummary((v) => !v)}
                  aria-label="Toggle BOQ summary"
                >
                  <span className={styles.toggleKnob} />
                </button>
                <span className={styles.boqSummaryWillPrint}>
                  {includeBoqSummary ? 'Will print' : "Won't print"}
                </span>
              </div>
            </div>
          </section>

          {/* Quote Totals */}
          <section className={styles.editorPanel}>
            <h2 className={styles.panelTitle}>QUOTE TOTALS — WORKING REFERENCE</h2>
            <p className={styles.hintText}>Area breakdown shown in BOQ Summary</p>
            <div className={styles.totalsGrid}>
              <div className={styles.totalsRow}>
                <span>Material Subtotal</span>
                <span>{fmtINR(totals.materialSubtotal)}</span>
              </div>
              {gstMode !== 'none' && (
                <div className={styles.totalsRow}>
                  <span>GST @ {gstPct}%</span>
                  <span>{fmtINR(totals.gstAmount)}</span>
                </div>
              )}
              <div className={styles.totalsRow}>
                <span>Transport</span>
                <span>{fmtINR(transport)}</span>
              </div>
              <div className={`${styles.totalsRow} ${styles.grandTotalRow}`}>
                <span>Grand Total</span>
                <span>{fmtINR(totals.grandTotal)}</span>
              </div>
            </div>
          </section>

          {/* Terms & Conditions */}
          <section className={styles.editorPanel}>
            <h2 className={styles.panelTitle}>TERMS &amp; CONDITIONS</h2>

            {/* Category tab buttons */}
            {canEdit && (
              <div className={styles.termsCategoryTabs}>
                {TERM_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={styles.termCategoryBtn}
                    onClick={() => addTerm(cat)}
                  >
                    + {TERM_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            )}

            {/* Terms list */}
            <div className={styles.termsList}>
              {terms.length === 0 && (
                <p className={styles.hintText}>No terms added yet. Click a category above to add.</p>
              )}
              {terms.map((term) => (
                <div key={term.localId} className={styles.termRow}>
                  <span className={`${styles.termBadge} ${styles[`term_${term.category}`] ?? ''}`}>
                    {TERM_CATEGORY_LABELS[term.category as TermCategory] ?? term.category.toUpperCase()}
                  </span>
                  <input
                    className={styles.termInput}
                    value={term.text}
                    placeholder="Enter term text…"
                    disabled={!canEdit}
                    onChange={(e) => updateTerm(term.localId, e.target.value)}
                  />
                  {canEdit && (
                    <button
                      className={styles.rowDeleteBtn}
                      type="button"
                      title="Remove term"
                      onClick={() => removeTerm(term.localId)}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className={styles.editorSidebar}>

          {/* Status */}
          <div className={styles.sidebarPanel}>
            <label className={styles.sidebarLabel}>STATUS</label>
            <select
              className={styles.sidebarSelect}
              value={status}
              disabled={!canEdit}
              onChange={(e) => handleStatusChange(e.target.value as QuoteStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Company Logo */}
          <div className={styles.sidebarPanel}>
            <label className={styles.sidebarLabel}>COMPANY LOGO</label>
            <div className={styles.logoPlaceholder}>
              <Icon name="camera" size={28} className={styles.logoIcon} />
              <span className={styles.logoHint}>Upload logo</span>
            </div>
          </div>

          {/* GST Mode */}
          <div className={styles.sidebarPanel}>
            <label className={styles.sidebarLabel}>GST MODE</label>
            <div className={styles.gstModeToggle}>
              {GST_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.gstModeBtn} ${gstMode === opt.value ? styles.gstModeBtnActive : ''}`}
                  disabled={!canEdit}
                  onClick={() => setGstMode(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {gstMode !== 'none' && (
              <div className={styles.sidebarField}>
                <label className={styles.sidebarFieldLabel}>GST %</label>
                <input
                  type="number"
                  className={styles.sidebarInput}
                  value={gstPct}
                  min={0}
                  max={100}
                  disabled={!canEdit}
                  onChange={(e) => setGstPct(parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          {/* Transport */}
          <div className={styles.sidebarPanel}>
            <label className={styles.sidebarLabel}>TRANSPORT</label>
            <div className={styles.sidebarField}>
              <label className={styles.sidebarFieldLabel}>Amount (₹)</label>
              <input
                type="number"
                className={styles.sidebarInput}
                value={transport === 0 ? '' : transport}
                placeholder="0"
                min={0}
                disabled={!canEdit}
                onChange={(e) => setTransport(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className={styles.sidebarField}>
              <label className={styles.sidebarFieldLabel}>Note</label>
              <input
                type="text"
                className={styles.sidebarInput}
                value={transportNote}
                placeholder="Transport note…"
                disabled={!canEdit}
                onChange={(e) => setTransportNote(e.target.value)}
              />
            </div>
          </div>

          {/* Grand Total Summary */}
          <div className={`${styles.sidebarPanel} ${styles.sidebarTotals}`}>
            <div className={styles.sidebarTotalRow}>
              <span>Subtotal</span>
              <span>{fmtINR(totals.includedSubtotal)}</span>
            </div>
            {gstMode !== 'none' && (
              <div className={styles.sidebarTotalRow}>
                <span>GST {gstPct}%</span>
                <span>{fmtINR(totals.gstAmount)}</span>
              </div>
            )}
            <div className={styles.sidebarTotalRow}>
              <span>Transport</span>
              <span>{fmtINR(transport)}</span>
            </div>
            <div className={`${styles.sidebarTotalRow} ${styles.sidebarGrandTotal}`}>
              <span>Grand Total</span>
              <span>{fmtINR(totals.grandTotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default QuoteEditor
