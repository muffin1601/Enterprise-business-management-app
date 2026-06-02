'use client'

import { useState, useTransition } from 'react'
import type { DcDetail, DcItemRow } from '../server/queries'
import { updateDcItemQty } from '../server/actions'
import styles from './delivery-challans.module.scss'

function StockBadge({ item }: { item: DcItemRow }) {
  if (!item.itemId) return <span className={`${styles.stockBadge} ${styles.stockUnknown}`}>No Inventory</span>
  if (item.currentStock === 0) return <span className={`${styles.stockBadge} ${styles.stockOut}`}>Out of Stock</span>
  if (item.currentStock < item.invoiceQty) return <span className={`${styles.stockBadge} ${styles.stockLow}`}>Low ({item.currentStock})</span>
  return <span className={`${styles.stockBadge} ${styles.stockOk}`}>In Stock ({item.currentStock})</span>
}

interface Props { dc: DcDetail; canEdit: boolean }

export function DcItemsTab({ dc, canEdit }: Props) {
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [saving, startT] = useTransition()
  const [msg, setMsg]    = useState<string | null>(null)

  const isDraft = dc.status === 'draft'

  function handleSave(itemId: string, item: DcItemRow) {
    const qty = edits[itemId] ?? item.qtyDispatched
    startT(async () => {
      const res = await updateDcItemQty(dc.id, itemId, { qtyDispatched: qty })
      setMsg(res.ok ? 'Updated.' : (res.error?.message ?? 'Failed.'))
      if (res.ok) setEdits(prev => { const n = { ...prev }; delete n[itemId]; return n })
    })
  }

  return (
    <div className={styles.itemsTabWrap}>
      {msg && (
        <div className={`${styles.flashMsg} ${msg.includes('Failed') ? styles.flashErr : styles.flashOk}`}>
          {msg} <button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      {!isDraft && (
        <div className={styles.itemsLockedNote}>
          Challan is {dc.status} — items are locked.
          {dc.stockDeducted && ' Stock has been deducted from inventory.'}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.itemsTable} style={{ tableLayout:'fixed', width:'100%' }}>
          <colgroup>
            <col style={{ width:34 }} /><col style={{ width:'28%' }} /><col style={{ width:80 }} /><col style={{ width:55 }} /><col style={{ width:90 }} /><col style={{ width:100 }} /><col style={{ width:90 }} /><col style={{ width:90 }} />{isDraft && canEdit && <col style={{ width:55 }} />}
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign:'center' }}>#</th>
              <th style={{ textAlign:'left' }}>Description</th>
              <th style={{ textAlign:'left' }}>HSN</th>
              <th style={{ textAlign:'center' }}>Unit</th>
              <th className={styles.numCol}>Invoice Qty</th>
              <th style={{ textAlign:'center' }}>Live Stock</th>
              <th className={styles.numCol}>Stock at Creation</th>
              <th className={styles.numCol}>Qty Dispatched</th>
              {isDraft && canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {dc.items.map((item, i) => {
              const editQty = edits[item.id]
              const hasEdit = editQty !== undefined && editQty !== item.qtyDispatched
              return (
                <tr key={item.id}>
                  <td style={{ textAlign:'center', color:'var(--c-tertiary)', fontSize:11 }}>{i + 1}</td>
                  <td>
                    <div className={styles.itemName}>{item.name}</div>
                    {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                    {item.brand && <div className={styles.itemBrand}>{item.brand}</div>}
                  </td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--c-secondary)' }}>{item.hsnCode ?? '—'}</td>
                  <td style={{ textAlign:'center', color:'var(--c-secondary)' }}>{item.unit ?? '—'}</td>
                  <td className={styles.numCol}>{item.invoiceQty}</td>
                  <td style={{ textAlign:'center' }}><StockBadge item={item} /></td>
                  <td className={styles.numCol} style={{ color:'var(--c-tertiary)' }}>{item.stockAtCreation}</td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" min={0} max={item.invoiceQty} step="any"
                          className={`${styles.cellInput} ${styles.numInput}`}
                          value={editQty ?? item.qtyDispatched}
                          onChange={e => setEdits(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} />
                      : <span style={{ fontWeight:600, color:'var(--c-ink)' }}>{item.qtyDispatched}</span>}
                  </td>
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
        </table>
      </div>

      <div className={styles.itemsSummary}>
        <span>Total items: <strong>{dc.items.length}</strong></span>
        <span style={{ marginLeft:16 }}>
          Total dispatched: <strong>{dc.items.reduce((s, i) => s + i.qtyDispatched, 0)}</strong>
        </span>
      </div>
    </div>
  )
}
