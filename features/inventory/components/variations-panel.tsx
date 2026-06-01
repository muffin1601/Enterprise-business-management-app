'use client'

import { useState } from 'react'
import type { VariationInput } from '../server/queries'
import { Icon } from '@/components/ui'
import styles from './inventory.module.scss'

// ── Types ──────────────────────────────────────────────────────────────────────
type Draft = { size: string; finish: string; make: string; brand: string; stock: string; sellingPrice: string; purchasePrice: string }

const EMPTY_DRAFT: Draft = { size: '', finish: '', make: '', brand: '', stock: '', sellingPrice: '', purchasePrice: '' }

const ATTRS = [
  { key: 'size'  as const, label: 'Size',           placeholder: '600×600, 2×4ft…' },
  { key: 'finish'as const, label: 'Finish',          placeholder: 'Polished, Matte…' },
  { key: 'make'  as const, label: 'Make / Brand',    placeholder: 'Kajaria, RAK…' },
  { key: 'brand' as const, label: 'Grade / Variant', placeholder: 'A-Grade, Premium…' },
]

function draftLabel(d: Draft) {
  return [d.size, d.finish, d.make, d.brand].filter(Boolean).join(' · ')
}

function draftToInput(d: Draft): VariationInput {
  return {
    size: d.size.trim(), finish: d.finish.trim(),
    make: d.make.trim(), brand: d.brand.trim(),
    stock: Number(d.stock) || 0,
    sellingPrice: d.sellingPrice ? Number(d.sellingPrice) : null,
    purchasePrice: d.purchasePrice ? Number(d.purchasePrice) : null,
  }
}

function isDraftFilled(d: Draft) {
  return Boolean(d.size || d.finish || d.make || d.brand)
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  value: VariationInput[]
  onChange: (v: VariationInput[]) => void
  baseName?: string
  baseSellingPrice?: number | null
  basePurchasePrice?: number | null
  currency?: string
}

// ── Component ──────────────────────────────────────────────────────────────────
export function VariationsPanel({ value, onChange, baseName = 'Item', baseSellingPrice, basePurchasePrice, currency = 'INR' }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT)
  const [error, setError] = useState('')

  const currSymbol = currency === 'INR' ? '₹' : currency

  function addRow() {
    if (!isDraftFilled(draft)) { setError('Enter at least one attribute (Size, Finish, Make or Brand).'); return }
    setError('')
    onChange([...value, draftToInput(draft)])
    setDraft(EMPTY_DRAFT)
  }

  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function startEdit(i: number) {
    const v = value[i]!
    setEditIdx(i)
    setEditDraft({ size: v.size, finish: v.finish, make: v.make, brand: v.brand, stock: v.stock ? String(v.stock) : '', sellingPrice: v.sellingPrice ? String(v.sellingPrice) : '', purchasePrice: v.purchasePrice ? String(v.purchasePrice) : '' })
  }

  function saveEdit() {
    if (editIdx === null) return
    const next = [...value]
    next[editIdx] = draftToInput(editDraft)
    onChange(next)
    setEditIdx(null)
  }

  function cancelEdit() { setEditIdx(null) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Add-new row ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 110px 110px 110px auto', gap: 10, alignItems: 'end' }}>
        {ATTRS.map(a => (
          <div key={a.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className={styles.fieldLabel}>{a.label}</label>
            <input
              className={styles.fieldInput}
              placeholder={a.placeholder}
              value={draft[a.key]}
              onChange={e => setDraft(d => ({ ...d, [a.key]: e.target.value }))}
            />
          </div>
        ))}
        {([
          ['stock', 'Opening Stock', '0', 'number'],
          ['purchasePrice', `Cost (${currSymbol})`, basePurchasePrice ? String(basePurchasePrice) : '0.00', 'number'],
          ['sellingPrice', `Price (${currSymbol})`, baseSellingPrice ? String(baseSellingPrice) : '0.00', 'number'],
        ] as [keyof Draft, string, string, string][]).map(([field, label, placeholder, type]) => (
          <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className={styles.fieldLabel}>{label}</label>
            <input
              type={type}
              step="0.01"
              min="0"
              className={styles.fieldInput}
              placeholder={placeholder}
              value={draft[field]}
              onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
            />
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }}>
          <button
            type="button"
            onClick={addRow}
            style={{
              height: 42, width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-ink)', color: 'var(--c-inverse)',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0,
            }}
            title="Add variation (Enter)"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-danger)' }}>{error}</div>
      )}

      {/* ── Hint ─────────────────────────────────────────────────── */}
      {value.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>
          No variations added — item will be created as-is without variants.
        </div>
      ) : (
        <>
          {/* ── Summary pill ─────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-secondary)' }}>
              {value.length} variant{value.length > 1 ? 's' : ''} — will create {value.length + 1} items total (1 parent + {value.length} variants)
            </span>
          </div>

          {/* ── Variants table ───────────────────────────────────── */}
          <div style={{ border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 80px 90px 90px 80px', gap: 0, background: 'var(--c-bg)', padding: '9px 14px', borderBottom: '1px solid var(--c-border)' }}>
              {['Size', 'Finish', 'Make / Brand', 'Grade', 'Stock', 'Cost', 'Price', ''].map(h => (
                <span key={h} style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-tertiary)', fontWeight: 500 }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {value.map((v, i) => (
              editIdx === i ? (
                /* ── Inline edit row ──────────────────────────────── */
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 80px 90px 90px 80px', gap: 6, padding: '10px 14px', borderBottom: i < value.length - 1 ? '1px solid var(--c-border)' : 'none', background: 'var(--c-surface-2)', alignItems: 'center' }}>
                  {([['size','Size'],['finish','Finish'],['make','Make'],['brand','Brand']] as [keyof Draft, string][]).map(([field, lbl]) => (
                    <input key={field} className={styles.fieldInput} style={{ height: 34, padding: '0 8px', fontSize: 12 }} placeholder={lbl} value={editDraft[field]} onChange={e => setEditDraft(d => ({ ...d, [field]: e.target.value }))} />
                  ))}
                  {([['stock','Stock'],['purchasePrice','Cost'],['sellingPrice','Price']] as [keyof Draft, string][]).map(([field, lbl]) => (
                    <input key={field} type="number" min="0" step="0.01" className={styles.fieldInput} style={{ height: 34, padding: '0 8px', fontSize: 12 }} placeholder={lbl} value={editDraft[field]} onChange={e => setEditDraft(d => ({ ...d, [field]: e.target.value }))} />
                  ))}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" onClick={saveEdit} style={{ height: 34, padding: '0 8px', background: 'var(--c-ink)', color: 'var(--c-inverse)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11 }}>Save</button>
                    <button type="button" onClick={cancelEdit} style={{ height: 34, padding: '0 8px', background: 'transparent', color: 'var(--c-tertiary)', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                </div>
              ) : (
                /* ── Display row ──────────────────────────────────── */
                <div
                  key={i}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 80px 90px 90px 80px', gap: 0, padding: '11px 14px', borderBottom: i < value.length - 1 ? '1px solid var(--c-border)' : 'none', alignItems: 'center', transition: 'background 120ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {[v.size, v.finish, v.make, v.brand].map((val, ci) => (
                    <span key={ci} style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: val ? 'var(--c-ink)' : 'var(--c-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '—'}</span>
                  ))}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: v.stock > 0 ? 'var(--c-ink)' : 'var(--c-tertiary)' }}>{v.stock > 0 ? v.stock : '—'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-secondary)' }}>{v.purchasePrice ? `${currSymbol}${v.purchasePrice}` : <span style={{ color: 'var(--c-tertiary)' }}>inherit</span>}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-secondary)' }}>{v.sellingPrice ? `${currSymbol}${v.sellingPrice}` : <span style={{ color: 'var(--c-tertiary)' }}>inherit</span>}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" onClick={() => startEdit(i)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--c-tertiary)' }} title="Edit">
                      <Icon name="pencil" size={12} />
                    </button>
                    <button type="button" onClick={() => removeRow(i)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--c-tertiary)' }} title="Remove"
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-danger)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--c-danger)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--c-tertiary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--c-border)' }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>

          {/* ── Name preview ─────────────────────────────────────── */}
          <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-tertiary)', marginBottom: 8 }}>Items that will be created</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-secondary)' }}>
                <span style={{ color: 'var(--c-tertiary)', marginRight: 8 }}>①</span>
                {baseName} <span style={{ color: 'var(--c-tertiary)', fontSize: 11 }}>(parent / template)</span>
              </div>
              {value.map((v, i) => {
                const label = [v.size, v.finish, v.make, v.brand].filter(Boolean).join(' · ')
                return (
                  <div key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-ink)' }}>
                    <span style={{ color: 'var(--c-tertiary)', marginRight: 8 }}>↳</span>
                    {baseName}{label ? ` — ${label}` : ''}
                    {v.stock > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-tertiary)', marginLeft: 8 }}>Stock: {v.stock}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── AddVariantForm — used on detail page to add a variant to existing item ────
interface AddVariantFormProps {
  parentId: string
  parentName: string
  onSuccess: () => void
  onCancel: () => void
}

export function AddVariantForm({ parentId, parentName, onSuccess, onCancel }: AddVariantFormProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!isDraftFilled(draft)) { setError('Fill at least one attribute.'); return }
    setError('')
    setPending(true)
    const { addVariantToItem } = await import('../server/actions')
    const res = await addVariantToItem(parentId, draftToInput(draft), {})
    setPending(false)
    if (!res.ok) { setError(res.error.message); return }
    onSuccess()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {ATTRS.map(a => (
          <div key={a.key}>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-tertiary)', fontWeight: 500, display: 'block', marginBottom: 6 }}>{a.label}</label>
            <input
              className={styles.fieldInput}
              placeholder={a.placeholder}
              value={draft[a.key]}
              onChange={e => setDraft(d => ({ ...d, [a.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {([['stock','Opening Stock','0'],['purchasePrice','Cost Price (₹)','0.00'],['sellingPrice','Selling Price (₹)','0.00']] as [keyof Draft, string, string][]).map(([field, lbl, ph]) => (
          <div key={field}>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-tertiary)', fontWeight: 500, display: 'block', marginBottom: 6 }}>{lbl}</label>
            <input type="number" min="0" step="0.01" className={styles.fieldInput} placeholder={ph} value={draft[field]} onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))} />
          </div>
        ))}
      </div>

      {draft.size || draft.finish || draft.make || draft.brand ? (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-secondary)', padding: '8px 12px', background: 'var(--c-surface-2)', borderRadius: 'var(--radius-sm)' }}>
          Will create: <strong>{parentName}{draftLabel(draft) ? ` — ${draftLabel(draft)}` : ''}</strong>
        </div>
      ) : null}

      {error && <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-danger)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--c-secondary)' }}>Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={pending} style={{ padding: '9px 18px', background: 'var(--c-ink)', color: 'var(--c-inverse)', border: '1px solid var(--c-ink)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Creating…' : '+ Add Variant'}
        </button>
      </div>
    </div>
  )
}
