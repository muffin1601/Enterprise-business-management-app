'use client'

import { useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { itemSchema, CURRENCIES, type ItemInput } from '@/validations/item'
import { createItem, updateItem } from '@/features/items/server/actions'
import type { Lookup } from '@/features/items/server/queries'
import { computeLandedCost } from '@/lib/calc/costing'
import { formatMoney } from '@/lib/utils/format'
import styles from './items.module.scss'

export interface ItemFormProps {
  mode: 'create' | 'edit'
  itemId?: string
  defaultValues: Partial<ItemInput>
  families: Lookup[]
  brands: Lookup[]
  units: Lookup[]
  currency: string
}

export function ItemForm({
  mode, itemId, defaultValues, families, brands, units, currency,
}: ItemFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register, handleSubmit, control, setError,
    formState: { errors },
  } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '', sku: '', familyId: '', brandId: '', unitId: '',
      variantLabel: '', imageUrl: '', isImported: false, stock: 0,
      ...defaultValues,
    },
  })

  const isImported = useWatch({ control, name: 'isImported' })
  const imp = useWatch({
    control,
    name: ['importPrice', 'exchangeRate', 'importDiscountPct', 'transportType', 'transportValue', 'customDutyPct', 'profitMultiplier'],
  })
  const preview = computeLandedCost({
    importPrice:       Number(imp[0]) || 0,
    exchangeRate:      Number(imp[1]) || 0,
    importDiscountPct: Number(imp[2]) || 0,
    transportType:     imp[3] as 'lumpsum' | 'percent' | undefined,
    transportValue:    Number(imp[4]) || 0,
    customDutyPct:     Number(imp[5]) || 0,
    profitMultiplier:  Number(imp[6]) || 1,
  })

  const onSubmit = (values: ItemInput) => {
    setFormError(null)
    startTransition(async () => {
      const res = mode === 'create' ? await createItem(values) : await updateItem(itemId!, values)
      if (res.ok) {
        router.push(`/items/${res.data.id}` as Route)
        router.refresh()
        return
      }
      if (res.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(res.error.fieldErrors)) {
          setError(field as keyof ItemInput, { message: msgs?.[0] })
        }
      }
      setFormError(res.error.message)
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>

      {/* ── Details panel ─────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.sectionTitle}>Details</div>
        <div className={styles.formGrid}>
          <Field label="Name" required error={errors.name?.message}>
            <input className={styles.fieldInput} {...register('name')} placeholder="e.g. Kajaria Floor Tile" />
          </Field>
          <Field label="SKU" error={errors.sku?.message}>
            <input className={styles.fieldInput} {...register('sku')} placeholder="e.g. KAJ-FT-001" />
          </Field>
          <Field label="Category" error={errors.familyId?.message}>
            <select className={styles.fieldSelect} {...register('familyId')}>
              <option value="">— Select category</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Brand" error={errors.brandId?.message}>
            <select className={styles.fieldSelect} {...register('brandId')}>
              <option value="">— Select brand</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Unit of Measure" error={errors.unitId?.message}>
            <select className={styles.fieldSelect} {...register('unitId')}>
              <option value="">— Select unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Variant Label" error={errors.variantLabel?.message}>
            <input className={styles.fieldInput} {...register('variantLabel')} placeholder="e.g. 600×600, Matt" />
          </Field>
          <Field label="Image URL" error={errors.imageUrl?.message}>
            <input className={styles.fieldInput} type="url" {...register('imageUrl')} placeholder="https://…" />
          </Field>
          <Field label="Delivery Days" error={errors.deliveryDays?.message}>
            <input className={styles.fieldInput} type="number" min="0" {...register('deliveryDays')} placeholder="e.g. 7" />
          </Field>
          <Field label="Opening Stock" error={errors.stock?.message}>
            <input className={styles.fieldInput} type="number" step="0.001" min="0" {...register('stock')} placeholder="0" />
          </Field>
        </div>
      </div>

      {/* ── Pricing panel ─────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.sectionTitle}>Pricing</div>

        <label className={styles.checkRow} style={{ marginBottom: 20 }}>
          <input type="checkbox" {...register('isImported')} />
          This is an imported item — use the landed-cost calculator
        </label>

        {!isImported ? (
          <div className={styles.formGrid}>
            <Field label="Purchase Price" error={errors.purchasePrice?.message}>
              <input className={styles.fieldInput} type="number" step="0.01" min="0" {...register('purchasePrice')} placeholder="0.00" />
            </Field>
            <Field label="Selling Price" error={errors.sellingPrice?.message}>
              <input className={styles.fieldInput} type="number" step="0.01" min="0" {...register('sellingPrice')} placeholder="0.00" />
            </Field>
          </div>
        ) : (
          <>
            <div className={styles.formGrid3}>
              <Field label="Import Currency" error={errors.importCurrency?.message}>
                <select className={styles.fieldSelect} {...register('importCurrency')}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Import Price" required error={errors.importPrice?.message}>
                <input className={styles.fieldInput} type="number" step="0.01" min="0" {...register('importPrice')} placeholder="0.00" />
              </Field>
              <Field label="Exchange Rate" error={errors.exchangeRate?.message}>
                <input className={styles.fieldInput} type="number" step="0.000001" min="0" {...register('exchangeRate')} placeholder="e.g. 84.5" />
              </Field>
              <Field label="Discount %" error={errors.importDiscountPct?.message}>
                <input className={styles.fieldInput} type="number" step="0.001" min="0" max="100" {...register('importDiscountPct')} placeholder="0" />
              </Field>
              <Field label="Transport Type" error={errors.transportType?.message}>
                <select className={styles.fieldSelect} {...register('transportType')}>
                  <option value="">— Select</option>
                  <option value="lumpsum">Lump sum (₹)</option>
                  <option value="percent">Percent of cost</option>
                </select>
              </Field>
              <Field label="Transport Value" error={errors.transportValue?.message}>
                <input className={styles.fieldInput} type="number" step="0.01" min="0" {...register('transportValue')} placeholder="0.00" />
              </Field>
              <Field label="Custom Duty %" error={errors.customDutyPct?.message}>
                <input className={styles.fieldInput} type="number" step="0.001" min="0" max="100" {...register('customDutyPct')} placeholder="0" />
              </Field>
              <Field label="Profit Multiplier" error={errors.profitMultiplier?.message}>
                <input className={styles.fieldInput} type="number" step="0.0001" min="0" {...register('profitMultiplier')} placeholder="e.g. 1.35" />
              </Field>
            </div>

            {/* Cost trail */}
            <div style={{ marginTop: 24 }}>
              <div className={styles.sectionTitle}>Cost Trail</div>
              <div className={styles.trail}>
                <TrailRow label={`Base (price × rate)`}   value={formatMoney(preview.base, currency)} />
                <TrailRow label="After discount"           value={formatMoney(preview.afterDiscount, currency)} />
                <TrailRow label="Transport"                value={formatMoney(preview.transport, currency)} />
                <TrailRow label="With transport"           value={formatMoney(preview.withTransport, currency)} />
                <TrailRow label="Cost price (will store)"  value={formatMoney(preview.costPrice, currency)} total />
                <TrailRow label="Selling price (will store)" value={formatMoney(preview.sellingPrice, currency)} total />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {formError && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          {formError}
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className={styles.formActions}>
        <button
          type="button"
          disabled={isPending}
          onClick={() => router.back()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', color: 'var(--c-secondary)',
            border: '1px solid var(--c-border)', padding: '10px 20px',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
            letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer',
            borderRadius: 'var(--radius-sm)', opacity: isPending ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--c-ink)', color: 'var(--c-inverse)',
            border: '1px solid var(--c-ink)', padding: '10px 20px',
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
            letterSpacing: '0.10em', textTransform: 'uppercase', cursor: isPending ? 'not-allowed' : 'pointer',
            borderRadius: 'var(--radius-sm)', opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending
            ? (mode === 'create' ? 'Creating…' : 'Saving…')
            : (mode === 'create' ? '+ Create Item' : 'Save Changes')
          }
        </button>
      </div>
    </form>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <label className={styles.fieldLabel}>
        {label}{required && <span style={{ color: 'var(--c-danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-danger)', marginTop: 5 }}>
          {error}
        </span>
      )}
    </div>
  )
}

function TrailRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={`${styles.trailRow} ${total ? styles.trailTotal : ''}`}>
      <span className={styles.trailLabel}>{label}</span>
      <span className={styles.trailValue}>{value}</span>
    </div>
  )
}
