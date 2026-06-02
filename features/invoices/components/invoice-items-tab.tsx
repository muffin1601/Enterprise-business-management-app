'use client'

import { useState, useTransition } from 'react'
import type { InvoiceDetail } from '../server/queries'
import { updateInvoiceItem } from '../server/actions'
import styles from './invoices.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`

interface Props { inv: InvoiceDetail; canEdit: boolean }

export function InvoiceItemsTab({ inv, canEdit }: Props) {
  const [edits, setEdits] = useState<Record<string, Partial<{
    hsnCode: string; qty: number; rate: number; discountPct: number; gstPct: number
  }>>>({})
  const [saving, startT] = useTransition()
  const [msg, setMsg]    = useState<string | null>(null)

  const isDraft    = inv.status === 'draft'
  const showSave   = isDraft && canEdit
  // Column count for colSpan in footer
  // # | Desc | HSN | Brand | Rate | Qty | Disc% | GST% | Taxable | IGST or CGST+SGST | Total | [Save]
  const fixedCols  = 9  // # Desc HSN Brand Rate Qty Disc% GST% Taxable
  const gstCols    = inv.isIgst ? 1 : 2
  const totalCols  = fixedCols + gstCols + 1 + (showSave ? 1 : 0)
  const footerSpan = fixedCols  // colspan up to (but not including) Taxable col

  function handleChange(itemId: string, field: string, value: string) {
    setEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: field === 'hsnCode' ? value : Number(value) },
    }))
  }

  function handleSave(itemId: string) {
    const edit = edits[itemId]
    if (!edit) return
    startT(async () => {
      const res = await updateInvoiceItem(inv.id, itemId, edit)
      setMsg(res.ok ? 'Item updated.' : (res.error?.message ?? 'Failed to save.'))
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
        <div className={styles.itemsIssuedNote}>
          Invoice is {inv.status} — items are locked.
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.itemsTable} style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 34 }} /><col style={{ width: '24%' }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: 100 }} /><col style={{ width: 52 }} /><col style={{ width: 58 }} /><col style={{ width: 58 }} /><col style={{ width: 110 }} />{inv.isIgst ? <col style={{ width: 110 }} /> : <><col style={{ width: 100 }} /><col style={{ width: 100 }} /></>}<col style={{ width: 110 }} />{showSave && <col style={{ width: 60 }} />}
          </colgroup>

          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>#</th>
              <th style={{ textAlign: 'left' }}>Description</th>
              <th style={{ textAlign: 'left' }}>HSN/SAC</th>
              <th style={{ textAlign: 'left' }}>Brand</th>
              <th className={styles.numCol}>Rate</th>
              <th className={styles.numCol}>Qty</th>
              <th className={styles.numCol}>Disc%</th>
              <th className={styles.numCol}>GST%</th>
              <th className={styles.numCol}>Taxable</th>
              {inv.isIgst
                ? <th className={styles.numCol}>IGST</th>
                : <><th className={styles.numCol}>CGST</th><th className={styles.numCol}>SGST</th></>}
              <th className={styles.numCol}>Total</th>
              {showSave && <th />}
            </tr>
          </thead>

          <tbody>
            {inv.items.map((item, i) => {
              const edit    = edits[item.id] ?? {}
              const hasEdit = Object.keys(edit).length > 0
              return (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center', color: 'var(--c-tertiary)', fontSize: 11 }}>{i + 1}</td>
                  <td>
                    <div className={styles.itemName}>{item.name}</div>
                    {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                  </td>
                  <td>
                    {isDraft && canEdit
                      ? <input className={styles.cellInput} value={edit.hsnCode ?? (item.hsnCode ?? '')} onChange={e => handleChange(item.id, 'hsnCode', e.target.value)} placeholder="HSN" />
                      : <span className={styles.hsnCode}>{item.hsnCode ?? '—'}</span>}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--c-secondary)' }}>{item.brand ?? '—'}</td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" className={`${styles.cellInput} ${styles.numInput}`} value={edit.rate ?? item.rate} onChange={e => handleChange(item.id, 'rate', e.target.value)} />
                      : fmtINR(item.rate)}
                  </td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" className={`${styles.cellInput} ${styles.numInput}`} value={edit.qty ?? item.qty} onChange={e => handleChange(item.id, 'qty', e.target.value)} />
                      : item.qty}
                  </td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" className={`${styles.cellInput} ${styles.numInput}`} value={edit.discountPct ?? item.discountPct} onChange={e => handleChange(item.id, 'discountPct', e.target.value)} />
                      : item.discountPct > 0 ? `${item.discountPct}%` : '—'}
                  </td>
                  <td className={styles.numCol}>
                    {isDraft && canEdit
                      ? <input type="number" className={`${styles.cellInput} ${styles.numInput}`} value={edit.gstPct ?? item.gstPct} onChange={e => handleChange(item.id, 'gstPct', e.target.value)} />
                      : `${item.gstPct}%`}
                  </td>
                  <td className={styles.numCol}>{fmtINR(item.taxableValue)}</td>
                  {inv.isIgst
                    ? <td className={styles.numCol}>{fmtINR(item.igstAmount)}</td>
                    : <><td className={styles.numCol}>{fmtINR(item.cgstAmount)}</td><td className={styles.numCol}>{fmtINR(item.sgstAmount)}</td></>}
                  <td className={styles.numCol} style={{ fontWeight: 600 }}>{fmtINR(item.total)}</td>
                  {showSave && (
                    <td style={{ textAlign: 'center' }}>
                      {hasEdit && (
                        <button className={styles.btnSaveCell} onClick={() => handleSave(item.id)} disabled={saving} type="button">
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
              {/* colspan = fixedCols (9) so "Totals" label ends right before Taxable column */}
              <td
                colSpan={fixedCols}
                style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, paddingRight: 10 }}
              >
                Totals
              </td>
              <td className={styles.numCol}>{fmtINR(inv.taxableValue)}</td>
              {inv.isIgst
                ? <td className={styles.numCol}>{fmtINR(inv.igstAmount)}</td>
                : <><td className={styles.numCol}>{fmtINR(inv.cgstAmount)}</td><td className={styles.numCol}>{fmtINR(inv.sgstAmount)}</td></>}
              <td className={styles.numCol} style={{ fontWeight: 700 }}>{fmtINR(inv.grandTotal)}</td>
              {showSave && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
