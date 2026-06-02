'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import type { StockCheckResult } from '../server/stock-check'
import { DcStockCheck } from './dc-stock-check'
import { createDeliveryChallan } from '../server/actions'
import styles from './delivery-challans.module.scss'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  date:             z.string().optional(),
  dispatchDate:     z.string().optional(),
  expectedDelivery: z.string().optional(),
  vehicleNo:        z.string().optional(),
  driverName:       z.string().optional(),
  lrNo:             z.string().optional(),
  transporterName:  z.string().optional(),
  deliveryAddress:  z.string().optional(),
  siteContactName:  z.string().optional(),
  siteContactPhone: z.string().optional(),
  notes:            z.string().optional(),
  items:            z.array(z.object({
    invoiceItemId: z.string(),
    name:          z.string(),
    invoiceQty:    z.number(),
    currentStock:  z.number(),
    qtyDispatched: z.coerce.number().min(0),
    include:       z.boolean().default(true),
  })),
})

type FormData = z.infer<typeof schema>

type Phase = 'stock_check' | 'form'

interface Props {
  stockResult:    StockCheckResult
  invoiceId:      string
  canCreatePo:    boolean
  // Pre-filled from SO if available
  deliveryAddress?: string | null
  siteContactName?: string | null
  siteContactPhone?: string | null
}

export function DcCreateFlow({
  stockResult, invoiceId, canCreatePo,
  deliveryAddress: preDeliveryAddress,
  siteContactName: preSiteContact,
  siteContactPhone: preSitePhone,
}: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [phase, setPhase]   = useState<Phase>('stock_check')
  const [partial, setPartial] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Items for the form — filtered by partial or full
  function buildFormItems(isPartial: boolean) {
    return stockResult.items.map(item => ({
      invoiceItemId: item.invoiceItemId,
      name:          item.name,
      invoiceQty:    item.invoiceQty,
      currentStock:  item.currentStock,
      qtyDispatched: isPartial && item.stockStatus !== 'sufficient' ? 0 : item.invoiceQty,
      include:       isPartial ? item.stockStatus === 'sufficient' : true,
    }))
  }

  const { register, handleSubmit, control, watch, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:             new Date().toISOString().split('T')[0],
      deliveryAddress:  preDeliveryAddress ?? '',
      siteContactName:  preSiteContact ?? '',
      siteContactPhone: preSitePhone ?? '',
      items:            buildFormItems(false),
    },
  })

  const { fields } = useFieldArray({ control, name: 'items' })
  const watchItems = watch('items')

  function handleProceed(isPartial: boolean) {
    setPartial(isPartial)
    // Reset items based on partial flag
    setPhase('form')
  }

  function onSubmit(data: FormData) {
    const activeItems = data.items
      .filter(i => i.include && i.qtyDispatched > 0)
      .map(i => ({ invoiceItemId: i.invoiceItemId, qtyDispatched: i.qtyDispatched }))

    if (activeItems.length === 0) { setError('At least one item with qty > 0 must be included.'); return }

    setError(null)
    startT(async () => {
      const res = await createDeliveryChallan({
        invoiceId,
        date:             data.date ? new Date(data.date) : undefined,
        dispatchDate:     data.dispatchDate ? new Date(data.dispatchDate) : undefined,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
        vehicleNo:        data.vehicleNo,
        driverName:       data.driverName,
        lrNo:             data.lrNo,
        transporterName:  data.transporterName,
        deliveryAddress:  data.deliveryAddress,
        siteContactName:  data.siteContactName,
        siteContactPhone: data.siteContactPhone,
        notes:            data.notes,
        items:            activeItems,
      })
      if (!res.ok) { setError(res.error?.message ?? 'Failed to create challan.'); return }
      router.push(`/delivery-challans/${res.data.id}`)
    })
  }

  // ── Phase: Stock Check ─────────────────────────────────────────────────────
  if (phase === 'stock_check') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:300, fontFamily:'var(--font-heading)', color:'var(--c-ink)', letterSpacing:'0.02em' }}>
            Stock Check — {stockResult.invoiceNo}
          </div>
          <div style={{ fontSize:12, color:'var(--c-tertiary)', marginTop:3 }}>
            {stockResult.customerName ?? ''} · Checking inventory before generating delivery challan
          </div>
        </div>
        <DcStockCheck
          result={stockResult}
          onProceed={handleProceed}
          canCreatePo={canCreatePo}
        />
      </div>
    )
  }

  // ── Phase: Create Form ─────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:300, fontFamily:'var(--font-heading)', color:'var(--c-ink)', letterSpacing:'0.02em' }}>
            Create Delivery Challan
          </div>
          <div style={{ fontSize:12, color:'var(--c-tertiary)', marginTop:3 }}>
            {stockResult.invoiceNo} · {stockResult.customerName}
            {partial && <span style={{ color:'var(--c-warning)', marginLeft:8 }}>· Partial dispatch</span>}
          </div>
        </div>
        <button type="button" className={styles.btnSecondary} onClick={() => setPhase('stock_check')}>
          ← Back to Stock Check
        </button>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* Items table */}
      <div>
        <div className={styles.sectionTitle}>Items to Dispatch</div>
        <div style={{ overflowX:'auto', marginTop:10 }}>
          <table className={styles.itemsTable} style={{ tableLayout:'fixed', width:'100%' }}>
            <colgroup>
              <col style={{ width:32 }} /><col style={{ width:'30%' }} /><col style={{ width:55 }} /><col style={{ width:90 }} /><col style={{ width:90 }} /><col style={{ width:90 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign:'center' }}>✓</th>
                <th style={{ textAlign:'left' }}>Item</th>
                <th style={{ textAlign:'center' }}>Unit</th>
                <th className={styles.numCol}>Invoice Qty</th>
                <th className={styles.numCol}>In Stock</th>
                <th className={styles.numCol}>Qty to Dispatch</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => {
                const stockItem = stockResult.items[i]
                const isIncluded = watchItems[i]?.include
                return (
                  <tr key={field.id} style={{ opacity: isIncluded ? 1 : 0.4 }}>
                    <td style={{ textAlign:'center' }}>
                      <input type="checkbox" {...register(`items.${i}.include`)} />
                    </td>
                    <td>
                      <div className={styles.itemName}>{field.name}</div>
                    </td>
                    <td style={{ textAlign:'center', color:'var(--c-secondary)', fontSize:11 }}>
                      {stockItem?.unit ?? '—'}
                    </td>
                    <td className={styles.numCol}>{field.invoiceQty}</td>
                    <td className={styles.numCol} style={{
                      color: !stockItem?.itemId ? 'var(--c-tertiary)'
                        : stockItem.currentStock === 0 ? 'var(--c-danger)'
                        : stockItem.currentStock < field.invoiceQty ? 'var(--c-warning)'
                        : 'var(--c-success)',
                      fontWeight: 600,
                    }}>
                      {stockItem?.itemId ? stockItem.currentStock : '—'}
                    </td>
                    <td className={styles.numCol}>
                      <input
                        type="number" min={0} max={Math.min(field.invoiceQty, stockItem?.currentStock ?? field.invoiceQty)} step="any"
                        className={`${styles.cellInput} ${styles.numInput}`}
                        disabled={!isIncluded}
                        {...register(`items.${i}.qtyDispatched`)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DC Details */}
      <div>
        <div className={styles.sectionTitle}>Delivery Details</div>
        <div className={styles.formGrid} style={{ marginTop:10 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>DC Date</label>
            <input type="date" className={styles.formInput} {...register('date')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Expected Delivery Date</label>
            <input type="date" className={styles.formInput} {...register('expectedDelivery')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Vehicle No.</label>
            <input type="text" className={styles.formInput} placeholder="MH-01-AB-1234" {...register('vehicleNo')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Driver Name</label>
            <input type="text" className={styles.formInput} {...register('driverName')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>LR / Bilty No.</label>
            <input type="text" className={styles.formInput} {...register('lrNo')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Transporter</label>
            <input type="text" className={styles.formInput} {...register('transporterName')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Site Contact</label>
            <input type="text" className={styles.formInput} {...register('siteContactName')} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Contact Phone</label>
            <input type="tel" className={styles.formInput} {...register('siteContactPhone')} />
          </div>
        </div>
        <div className={styles.formRow} style={{ marginTop:16 }}>
          <label className={styles.formLabel}>Delivery Address</label>
          <textarea rows={4} className={styles.formTextarea} {...register('deliveryAddress')} />
        </div>
        <div className={styles.formRow} style={{ marginTop:12 }}>
          <label className={styles.formLabel}>Notes</label>
          <textarea rows={2} className={styles.formTextarea} {...register('notes')} />
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Delivery Challan (Draft)'}
        </button>
        <Link href="/delivery-challans" className={styles.btnSecondary}>Cancel</Link>
      </div>
    </form>
  )
}
