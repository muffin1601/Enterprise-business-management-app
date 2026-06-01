'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { itemSchema, GST_RATES, type ItemInput } from '@/validations/inventory'
import { createItemWithVariations, updateItem } from '../server/actions'
import type { Lookup, VariationInput } from '../server/queries'
import { Icon } from '@/components/ui'
import { VariationsPanel } from './variations-panel'
import styles from './inventory.module.scss'

const CURRENCIES = ['INR', 'USD', 'EUR', 'CNY'] as const

interface Props {
  mode: 'create' | 'edit'
  itemId?: string
  families: Lookup[]
  brands: Lookup[]
  units: Lookup[]
  defaultValues?: Partial<ItemInput>
}

export function ItemForm({ mode, itemId, families, brands, units, defaultValues }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [variations, setVariations] = useState<VariationInput[]>([])

  const { register, handleSubmit, setError, watch, setValue, formState: { errors } } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      gstRate: 18, isActive: true, isImported: false,
      stock: 0, minStock: 0, reorderLevel: 0, maxStock: 0,
      leadTimeDays: 0, tags: [],
      ...defaultValues,
    },
  })

  const isImported = watch('isImported')

  async function onSubmit(data: ItemInput) {
    start(async () => {
      if (mode === 'edit') {
        const result = await updateItem(itemId!, data)
        if (!result.ok) {
          if (result.error.fieldErrors) Object.entries(result.error.fieldErrors).forEach(([f, m]) => setError(f as keyof ItemInput, { message: m[0] }))
          setError('root', { message: result.error.message })
          return
        }
        router.push(`/inventory/items/${itemId}`)
        router.refresh()
        return
      }

      const result = await createItemWithVariations(data, variations)
      if (!result.ok) {
        if (result.error.fieldErrors) Object.entries(result.error.fieldErrors).forEach(([f, m]) => setError(f as keyof ItemInput, { message: m[0] }))
        setError('root', { message: result.error.message })
        return
      }
      router.push(`/inventory/items/${result.data.parentId}`)
      router.refresh()
    })
  }

  // Field helpers
  const F = ({ name, label, required, type = 'text', placeholder = '', step }: {
    name: keyof ItemInput; label: string; required?: boolean
    type?: string; placeholder?: string; step?: string
  }) => (
    <div>
      <label className={styles.fieldLabel}>
        {label}{required && <span className={styles.fieldRequired}>*</span>}
      </label>
      <input
        type={type} step={step}
        className={styles.fieldInput}
        placeholder={placeholder}
        aria-invalid={errors[name] ? 'true' : undefined}
        {...register(name)}
      />
      {errors[name] && <div className={styles.fieldError}>{(errors[name]?.message as string)}</div>}
    </div>
  )

  const Sel = ({ name, label, options, placeholder = '' }: {
    name: keyof ItemInput; label: string
    options: { value: string; label: string }[]; placeholder?: string
  }) => (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <select className={styles.fieldSelect} {...register(name)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {errors[name] && <div className={styles.fieldError}>{(errors[name]?.message as string)}</div>}
    </div>
  )

  // Combobox — free-text input with datalist suggestions; resolves to UUID if matched
  const Combo = ({ name, label, options, placeholder = '' }: {
    name: keyof ItemInput; label: string
    options: { value: string; label: string }[]; placeholder?: string
  }) => {
    const listId = `combo-${name}`
    const currentId = watch(name) as string | undefined
    const currentLabel = options.find(o => o.value === currentId)?.label ?? (currentId ?? '')

    return (
      <div>
        <label className={styles.fieldLabel}>{label}</label>
        <input
          type="text"
          list={listId}
          className={styles.fieldInput}
          placeholder={placeholder}
          defaultValue={currentLabel}
          onChange={(e) => {
            const typed = e.target.value.trim()
            const match = options.find(o => o.label.toLowerCase() === typed.toLowerCase())
            setValue(name, (match ? match.value : typed) as never)
          }}
          autoComplete="off"
        />
        <datalist id={listId}>
          {options.map(o => <option key={o.value} value={o.label} />)}
        </datalist>
        {errors[name] && <div className={styles.fieldError}>{(errors[name]?.message as string)}</div>}
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      {errors.root && (
        <div style={{ padding: '11px 14px', background: 'var(--c-danger-bg)', color: 'var(--c-danger)', border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
          {errors.root.message}
        </div>
      )}

      {/* ── Basic Information ───────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}><span className={styles.panelTitle}>Basic Information</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.spanFull}>
            <label className={styles.fieldLabel}>Item Name <span className={styles.fieldRequired}>*</span></label>
            <input type="text" className={styles.fieldInput} placeholder="Full item name" style={{ fontSize: 16 }} aria-invalid={errors.name ? 'true' : undefined} {...register('name')} />
            {errors.name && <div className={styles.fieldError}>{errors.name.message}</div>}
          </div>
          <div className={styles.formGrid3}>
            <F name="sku"         label="SKU / Item Code"  placeholder="Auto-generated if blank" />
            <F name="barcode"     label="Barcode"          placeholder="EAN/UPC" />
            <F name="variantLabel" label="Variant Label"   placeholder="e.g. 600×600 · Matte" />
          </div>
          <div className={styles.formGrid3}>
            <Combo name="familyId" label="Category" options={families.map(f => ({ value: f.id, label: f.label }))} placeholder="Type or select category" />
            <Combo name="brandId"  label="Brand / Make" options={brands.map(b => ({ value: b.id, label: b.label }))} placeholder="Type or select brand" />
            <Combo name="unitId"   label="Unit" options={units.map(u => ({ value: u.id, label: u.label }))} placeholder="Type or select unit" />
          </div>
          <div>
            <label className={styles.fieldLabel}>Description</label>
            <textarea className={styles.fieldTextarea} rows={3} placeholder="Item description, specifications…" {...register('description')} />
          </div>
          <div className={styles.formGrid3}>
            <F name="hsnCode"     label="HSN Code"    placeholder="e.g. 69079000" />
            <Sel name="gstRate"  label="GST Rate"   options={GST_RATES.map(r => ({ value: String(r), label: `${r}%` }))} />
            <div>
              <label className={styles.fieldLabel}>Status</label>
              <div className={styles.toggle}>
                <button type="button" className={styles.toggleBtn} data-active={!watch('isActive') ? undefined : 'true'} onClick={() => setValue('isActive', true)}>Active</button>
                <button type="button" className={styles.toggleBtn} data-active={!watch('isActive') ? 'true' : undefined} onClick={() => setValue('isActive', false)}>Inactive</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Pricing</span>
          <div className={styles.toggle} style={{ minWidth: 200 }}>
            <button type="button" className={styles.toggleBtn} data-active={!isImported ? 'true' : undefined} onClick={() => setValue('isImported', false)}>Domestic</button>
            <button type="button" className={styles.toggleBtn} data-active={isImported ? 'true' : undefined} onClick={() => setValue('isImported', true)}>Imported</button>
          </div>
        </div>

        {!isImported ? (
          <div className={styles.formGrid3}>
            <F name="purchasePrice" label="Purchase Price (₹)" type="number" step="0.01" placeholder="0.00" />
            <F name="costPrice"     label="Cost / Landed Price (₹)" type="number" step="0.01" placeholder="0.00" />
            <F name="sellingPrice"  label="Selling Price (₹)"  type="number" step="0.01" placeholder="0.00" />
          </div>
        ) : (
          <div className={styles.formGrid3}>
            <Sel name="importCurrency" label="Currency" options={CURRENCIES.map(c => ({ value: c, label: c }))} />
            <F name="importPrice"      label="Import Price"      type="number" step="0.01" placeholder="0.00" />
            <F name="exchangeRate"     label="Exchange Rate (₹)" type="number" step="0.000001" placeholder="83.50" />
            <F name="importDiscountPct" label="Discount %" type="number" step="0.01" placeholder="0" />
            <Sel name="transportType" label="Transport" options={[{ value: 'lumpsum', label: 'Lump Sum (₹)' }, { value: 'percent', label: 'Percent (%)' }]} />
            <F name="transportValue"  label="Transport Value"   type="number" step="0.01" placeholder="0" />
            <F name="customDutyPct"   label="Custom Duty %"     type="number" step="0.01" placeholder="0" />
            <F name="profitMultiplier" label="Profit Multiplier" type="number" step="0.01" placeholder="1.30" />
            <F name="sellingPrice"    label="Selling Price (₹)" type="number" step="0.01" placeholder="Auto-calculated" />
          </div>
        )}
      </div>

      {/* ── Stock ───────────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}><span className={styles.panelTitle}>Stock Settings</span></div>
        <div className={styles.formGrid4}>
          <F name="stock"        label="Opening Stock"   type="number" step="0.001" placeholder="0" />
          <F name="minStock"     label="Minimum Stock"   type="number" step="0.001" placeholder="0" />
          <F name="reorderLevel" label="Reorder Level"   type="number" step="0.001" placeholder="0" />
          <F name="maxStock"     label="Maximum Stock"   type="number" step="0.001" placeholder="0" />
          <F name="leadTimeDays" label="Lead Time (days)" type="number" placeholder="0" />
          <F name="deliveryDays" label="Delivery Days"   type="number" placeholder="0" />
        </div>
      </div>

      {/* ── Physical ────────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}><span className={styles.panelTitle}>Physical Attributes</span></div>
        <div className={styles.formGrid4}>
          <F name="weightKg" label="Weight (kg)" type="number" step="0.001" placeholder="0.000" />
          <div>
            <label className={styles.fieldLabel}>Length</label>
            <input type="number" step="0.1" placeholder="0" className={styles.fieldInput}
              {...register('dimensions', { setValueAs: (v) => v })}
              onChange={e => setValue('dimensions', { unit: (watch('dimensions') as any)?.unit ?? 'cm' as const, ...(watch('dimensions') ?? {}), l: parseFloat(e.target.value) || undefined })}
              value={(watch('dimensions') as any)?.l ?? ''} />
          </div>
          <div>
            <label className={styles.fieldLabel}>Width</label>
            <input type="number" step="0.1" placeholder="0" className={styles.fieldInput}
              onChange={e => setValue('dimensions', { unit: (watch('dimensions') as any)?.unit ?? 'cm' as const, ...(watch('dimensions') ?? {}), w: parseFloat(e.target.value) || undefined })}
              value={(watch('dimensions') as any)?.w ?? ''} />
          </div>
          <div>
            <label className={styles.fieldLabel}>Height</label>
            <input type="number" step="0.1" placeholder="0" className={styles.fieldInput}
              onChange={e => setValue('dimensions', { unit: (watch('dimensions') as any)?.unit ?? 'cm' as const, ...(watch('dimensions') ?? {}), h: parseFloat(e.target.value) || undefined })}
              value={(watch('dimensions') as any)?.h ?? ''} />
          </div>
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}><span className={styles.panelTitle}>Internal Notes</span></div>
        <textarea className={styles.fieldTextarea} rows={3} placeholder="Private notes about this item…" {...register('notes')} />
      </div>

      {/* ── Variations ──────────────────────────────────────────── */}
      {mode === 'create' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Variations &nbsp;
              <span style={{ color: 'var(--c-info)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                — each becomes a separate item
              </span>
            </span>
            {variations.length > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-tertiary)' }}>
                {variations.length} variant{variations.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <VariationsPanel
            value={variations}
            onChange={setVariations}
            baseName={watch('name') || 'Item'}
            baseSellingPrice={watch('sellingPrice') ?? undefined}
            basePurchasePrice={watch('purchasePrice') ?? undefined}
          />
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className={styles.formActions}>
        <button type="button" className={styles.btnGhost} onClick={() => router.back()} disabled={pending}>Cancel</button>
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create Item →' : 'Save Changes →'}
        </button>
      </div>
    </form>
  )
}
