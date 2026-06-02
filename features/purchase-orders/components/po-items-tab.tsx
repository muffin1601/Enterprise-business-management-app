'use client'

import { useState, useTransition } from 'react'
import type { PoDetail, PoItemRow } from '../server/queries'
import { updatePoItem } from '../server/actions'
import styles from './purchase-orders.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`

function StockBadge({ item }: { item: PoItemRow }) {
  const { stockStatus, currentStock, invoiceQty } = item
  if (stockStatus === 'unknown') {
    return <span className={`${styles.stockBadge} ${styles.stockUnknown}`}>No Inventory</span>
  }
  if (stockStatus === 'sufficient') {
    return <span className={`${styles.stockBadge} ${styles.stockSufficient}`}>In Stock ({currentStock})</span>
  }
  if (stockStatus === 'low') {
    return <span className={`${styles.stockBadge} ${styles.stockLow}`}>Low Stock ({currentStock})</span>
  }
  return <span className={`${styles.stockBadge} ${styles.stockOut}`}>Out of Stock</span>
}

interface Props { po: PoDetail; canEdit: boolean }

export function PoItemsTab({ po, canEdit }: Props) {
  const [edits, setEdits] = useState<Record<string, Partial<{ qtyOrdered: number; rate: number; discountPct: number; hsnCode: string; gstPct: number }>>>({})
  const [saving, startT] = useTransition()
  const [msg, setMsg]    = useState<string | null>(null)

  const isDraft = po.status === 'draft'

  function handleChange(itemId: string, field: string, value: string) {
    setEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: field === 'hsnCode' ? value : Number(value) },
    }))
  }

  function handleSave(itemId: string, item: PoItemRow) {
    const edit = edits[itemId]
    if (!edit) return
    const payload = {
      qtyOrdered:  edit.qtyOrdered  ?? item.qtyOrdered,
      rate:        edit.rate        ?? item.rate,
      discountPct: edit.discountPct ?? item.discountPct,
      hsnCode:     edit.hsnCode     ?? item.hsnCode,
      gstPct:      edit.gstPct      ?? item.gstPct,
    }
    startT(async () => {
      const res = await updatePoItem(po.id, itemId, payload)
      setMsg(res.ok ? 'Item updated.' : (res.error?.message ?? 'Failed to save.'))
      if (res.ok) setEdits(prev => { const n = { ...prev }; delete n[itemId]; return n })
    })
  }

  const totalOrdered = po.items.reduce((s, i) => s + i.qtyOrdered, 0)
  const totalReceived = po.items.reduce((s, i) => s + i.qtyReceived, 0)

  return (
    <div className={styles.itemsTabWrap}>
      {msg && (
        <div className={`${styles.flashMsg} ${msg.includes('Failed') ? styles.flashErr : styles.flashOk}`}>
          {msg} <button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      {/* Summary bar */}
      <div className={styles.itemsSummaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Items</span>
          <span className={styles.summaryValue}>{po.items.length}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Ordered</span>
          <span className={styles.summaryValue}>{totalOrdered}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Received</span>
          <span className={styles.summaryValue}>{totalReceived}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Sufficient Stock</span>
          <span className={styles.summaryValue} style={{ color: 'var(--c-success)' }}>
            {po.items.filter(i => i.stockStatus === 'sufficient').length} items
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Needs Ordering</span>
          <span className={styles.summaryValue} style={{ color: 'var(--c-danger)' }}>
            {po.items.filter(i => i.qtyOrdered > 0).length} items
          </span>
        </div>
      </div>

      {!isDraft && (
        <div className={styles.itemsLockedNote}>
          PO is {po.status} — items are locked.
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.itemsTable} style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 34 }} /><col style={{ width: '20%' }} /><col style={{ width: 80 }} /><col style={{ width: 55 }} /><col style={{ width: 70 }} /><col style={{ width: 90 }} /><col style={{ width: 75 }} /><col style={{ width: 85 }} /><col style={{ width: 70 }} /><col style={{ width: 55 }} /><col style={{ width: 85 }} /><col style={{ width: 90 }} />{isDraft && canEdit && <col style={{ width: 55 }} />}
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign:'center' }}>#</th>
              <th style={{ textAlign:'left' }}>Description</th>
              <th style={{ textAlign:'left' }}>HSN</th>
              <th style={{ textAlign:'center' }}>Unit</th>
              <th className={styles.numCol}>Invoice Qty</th>
              <th style={{ textAlign:'center' }}>Stock Status</th>
              <th className={styles.numCol}>Current Stock</th>
              <th className={styles.numCol}>Qty to Order</th>
              <th className={styles.numCol}>Rate</th>
              <th className={styles.numCol}>GST%</th>
              <th className={styles.numCol}>Taxable</th>
              <th className={styles.numCol}>Total</th>
              {isDraft && canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, i) => {
              const edit    = edits[item.id] ?? {}
              const hasEdit = Object.keys(edit).length > 0
              const rowClass = item.stockStatus === 'out' ? styles.rowStockOut
                : item.stockStatus === 'low' ? styles.rowStockLow
                : item.stockStatus === 'sufficient' && item.qtyOrdered === 0 ? styles.rowStockOk
                : ''
              return (
                <tr key={item.id} className={rowClass}>
                  <td style={{ textAlign:'center', color:'var(--c-tertiary)', fontSize:11 }}>{i + 1}</td>
                  <td>
                    <div className={styles.itemName}>{item.name}</div>
                    {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                    {item.brand && <div className={styles.itemBrand}>{item.brand}</div>}
                  </td>
                  <td>
                    {isDraft && canEdit
                      ? <input className={styles.cellInput} value={edit.hsnCode ?? (item.hsnCode ?? '')} onChange={e => handleChange(item.id, 'hsnCode', e.target.value)} placeholder="HSN" />
                      : <span style={{ fontFamily:'var(--font-mono)', fontSize:10 }}>{item.hsnCode ?? '—'}</span>}
                  </td>
                  <td style={{ textAlign:'center', color:'var(--c-secondary)' }}>{item.unit ?? '—'}</td>
                  <td className={styles.numCol}>{item.invoiceQty}</td>
                  <td style={{ textAlign:'center' }}><StockBadge item={item} /></td>
                  <td className={styles.numCol} style={{ fontFamily:'var(--font-mono)' }}>{item.itemId ? item.currentStock : '—'}</td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" min={0} className={`${styles.cellInput} ${styles.numInput}`} value={edit.qtyOrdered ?? item.qtyOrdered} onChange={e => handleChange(item.id, 'qtyOrdered', e.target.value)} />
                      : <span style={{ fontWeight: item.qtyOrdered > 0 ? 600 : 400, color: item.qtyOrdered > 0 ? 'var(--c-ink)' : 'var(--c-tertiary)' }}>{item.qtyOrdered}</span>}
                  </td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" min={0} className={`${styles.cellInput} ${styles.numInput}`} value={edit.rate ?? item.rate} onChange={e => handleChange(item.id, 'rate', e.target.value)} />
                      : fmtINR(item.rate)}
                  </td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" min={0} max={100} className={`${styles.cellInput} ${styles.numInput}`} value={edit.gstPct ?? item.gstPct} onChange={e => handleChange(item.id, 'gstPct', e.target.value)} />
                      : `${item.gstPct}%`}
                  </td>
                  <td className={styles.numCol}>{fmtINR(item.taxableValue)}</td>
                  <td className={styles.numCol} style={{ fontWeight:600 }}>{fmtINR(item.total)}</td>
                  {isDraft && canEdit && (
                    <td style={{ textAlign:'center' }}>
                      {hasEdit && (
                        <button className={styles.btnSaveCell} onClick={() => handleSave(item.id, item)} disabled={saving} type="button">
                          Save
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={styles.tfootTotal}>
              <td colSpan={po.isIgst ? 11 : 10} style={{ textAlign:'right', fontWeight:600, fontSize:12, paddingRight:10 }}>Totals</td>
              <td className={styles.numCol} style={{ fontWeight:700 }}>
                {fmtINR(po.grandTotal)}
              </td>
              {isDraft && canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
