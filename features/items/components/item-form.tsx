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
import { Alert, Button, Card, FormField, Input, Select } from '@/components/ui'
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

export function ItemForm({ mode, itemId, defaultValues, families, brands, units, currency }: ItemFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '',
      sku: '',
      familyId: '',
      brandId: '',
      unitId: '',
      variantLabel: '',
      imageUrl: '',
      isImported: false,
      stock: 0,
      ...defaultValues,
    },
  })

  const isImported = useWatch({ control, name: 'isImported' })
  const imp = useWatch({
    control,
    name: ['importPrice', 'exchangeRate', 'importDiscountPct', 'transportType', 'transportValue', 'customDutyPct', 'profitMultiplier'],
  })
  const preview = computeLandedCost({
    importPrice: Number(imp[0]) || 0,
    exchangeRate: Number(imp[1]) || 0,
    importDiscountPct: Number(imp[2]) || 0,
    transportType: imp[3] as 'lumpsum' | 'percent' | undefined,
    transportValue: Number(imp[4]) || 0,
    customDutyPct: Number(imp[5]) || 0,
    profitMultiplier: Number(imp[6]) || 1,
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
      <Card>
        <h2 className={styles.sectionTitle}>Details</h2>
        <div className={styles.formGrid}>
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
          <FormField label="SKU" error={errors.sku?.message}>
            <Input {...register('sku')} />
          </FormField>
          <FormField label="Family" error={errors.familyId?.message}>
            <Select {...register('familyId')}>
              <option value="">—</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Brand" error={errors.brandId?.message}>
            <Select {...register('brandId')}>
              <option value="">—</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Unit" error={errors.unitId?.message}>
            <Select {...register('unitId')}>
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Variant label" error={errors.variantLabel?.message}>
            <Input {...register('variantLabel')} />
          </FormField>
          <FormField label="Image URL" error={errors.imageUrl?.message}>
            <Input type="url" {...register('imageUrl')} />
          </FormField>
          <FormField label="Delivery days" error={errors.deliveryDays?.message}>
            <Input type="number" min="0" {...register('deliveryDays')} />
          </FormField>
          <FormField label="Stock" error={errors.stock?.message}>
            <Input type="number" step="0.001" min="0" {...register('stock')} />
          </FormField>
        </div>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Pricing</h2>
        <label className={styles.checkRow}>
          <input type="checkbox" {...register('isImported')} />
          This is an imported item (use the landed-cost calculator)
        </label>

        {!isImported ? (
          <div className={styles.formGrid} style={{ marginTop: 'var(--space-4)' }}>
            <FormField label="Purchase price" error={errors.purchasePrice?.message}>
              <Input type="number" step="0.01" min="0" {...register('purchasePrice')} />
            </FormField>
            <FormField label="Selling price" error={errors.sellingPrice?.message}>
              <Input type="number" step="0.01" min="0" {...register('sellingPrice')} />
            </FormField>
          </div>
        ) : (
          <>
            <div className={styles.formGrid} style={{ marginTop: 'var(--space-4)' }}>
              <FormField label="Import currency" error={errors.importCurrency?.message}>
                <Select {...register('importCurrency')}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Import price" required error={errors.importPrice?.message}>
                <Input type="number" step="0.01" min="0" {...register('importPrice')} />
              </FormField>
              <FormField label="Exchange rate" error={errors.exchangeRate?.message}>
                <Input type="number" step="0.000001" min="0" {...register('exchangeRate')} />
              </FormField>
              <FormField label="Discount %" error={errors.importDiscountPct?.message}>
                <Input type="number" step="0.001" min="0" max="100" {...register('importDiscountPct')} />
              </FormField>
              <FormField label="Transport type" error={errors.transportType?.message}>
                <Select {...register('transportType')}>
                  <option value="lumpsum">Lump sum (₹)</option>
                  <option value="percent">Percent of cost</option>
                </Select>
              </FormField>
              <FormField label="Transport value" error={errors.transportValue?.message}>
                <Input type="number" step="0.01" min="0" {...register('transportValue')} />
              </FormField>
              <FormField label="Custom duty %" error={errors.customDutyPct?.message}>
                <Input type="number" step="0.001" min="0" max="100" {...register('customDutyPct')} />
              </FormField>
              <FormField label="Profit multiplier" error={errors.profitMultiplier?.message}>
                <Input type="number" step="0.0001" min="0" {...register('profitMultiplier')} />
              </FormField>
            </div>

            <div style={{ marginTop: 'var(--space-5)' }}>
              <h3 className={styles.sectionTitle}>Cost trail</h3>
              <div className={styles.trail}>
                <Trail label="Base (price × rate)" value={formatMoney(preview.base, currency)} />
                <Trail label="After discount" value={formatMoney(preview.afterDiscount, currency)} />
                <Trail label="Transport" value={formatMoney(preview.transport, currency)} />
                <Trail label="With transport" value={formatMoney(preview.withTransport, currency)} />
                <Trail label="Cost price (stored)" value={formatMoney(preview.costPrice, currency)} total />
                <Trail label="Selling price (stored)" value={formatMoney(preview.sellingPrice, currency)} total />
              </div>
            </div>
          </>
        )}
      </Card>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" loading={isPending}>
          {mode === 'create' ? 'Create item' : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Trail({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={styles.trailRow}>
      <span className={styles.trailLabel}>{label}</span>
      <span className={`${styles.trailValue} ${total ? styles.trailTotal : ''}`}>{value}</span>
    </div>
  )
}
