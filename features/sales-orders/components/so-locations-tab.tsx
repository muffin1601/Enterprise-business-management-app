'use client'

import { useState, useTransition } from 'react'
import type { SoDetail } from '../server/queries'
import { updateItemQtyDelivered } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './sales-orders.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`

interface Props { so: SoDetail; canEdit: boolean }

export function SoLocationsTab({ so, canEdit }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(so.locations.map(l => l.id)))
  const [qtyEdits, setQtyEdits] = useState<Record<string, number>>({})
  const [saving,   startT] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const canUpdateDelivery = canEdit && ['dispatched', 'delivered'].includes(so.status)

  function toggle(locId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(locId)) next.delete(locId)
      else next.add(locId)
      return next
    })
  }

  function handleQtyChange(itemId: string, value: string) {
    setQtyEdits(prev => ({ ...prev, [itemId]: Number(value) }))
  }

  function handleSaveDelivered() {
    const allItems = so.locations.flatMap(l => l.items)
    const items = allItems.map(item => ({
      id:           item.id,
      qty:          item.qty,
      qtyDelivered: qtyEdits[item.id] ?? item.qtyDelivered,
    }))
    startT(async () => {
      const res = await updateItemQtyDelivered(so.id, { items })
      setMsg(res.ok ? 'Delivery quantities saved.' : (res.error?.message ?? 'Failed to save.'))
    })
  }

  return (
    <div className={styles.locationsTab}>
      {msg && (
        <div className={`${styles.flashMsg} ${msg.includes('Failed') ? styles.flashErr : styles.flashOk}`}>
          {msg}
          <button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      {so.locations.map(loc => (
        <div key={loc.id} className={`${styles.locationBlock} ${!loc.isIncluded ? styles.locExcluded : ''}`}>
          <button
            className={styles.locationHeader}
            onClick={() => toggle(loc.id)}
            type="button"
          >
            <span className={styles.locationName}>
              <Icon name={expanded.has(loc.id) ? 'chevron-down' : 'chevron-right'} size={14} />
              {loc.name}
              {!loc.isIncluded && <span className={styles.excludedBadge}>Excluded</span>}
            </span>
            <span className={styles.locationTotal}>{fmtINR(loc.locationTotal)}</span>
          </button>

          {expanded.has(loc.id) && (
            <div className={styles.locationItems}>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Brand</th>
                    <th>Unit</th>
                    <th className={styles.numCol}>Rate</th>
                    <th className={styles.numCol}>Qty</th>
                    <th className={styles.numCol}>Disc%</th>
                    <th className={styles.numCol}>Total</th>
                    {canUpdateDelivery && <th className={styles.numCol}>Delivered</th>}
                  </tr>
                </thead>
                <tbody>
                  {loc.items.map((item, i) => {
                    const delivered = qtyEdits[item.id] ?? item.qtyDelivered
                    const fullyDelivered = delivered >= item.qty
                    return (
                      <tr key={item.id} className={fullyDelivered ? styles.itemDelivered : ''}>
                        <td className={styles.numCol}>{i + 1}</td>
                        <td>
                          <div className={styles.itemName}>{item.name}</div>
                          {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                        </td>
                        <td>{item.brand ?? '—'}</td>
                        <td>{item.unit ?? '—'}</td>
                        <td className={styles.numCol}>{fmtINR(item.rate)}</td>
                        <td className={styles.numCol}>{item.qty}</td>
                        <td className={styles.numCol}>{item.discountPct > 0 ? `${item.discountPct}%` : '—'}</td>
                        <td className={styles.numCol}>{fmtINR(item.total)}</td>
                        {canUpdateDelivery && (
                          <td className={styles.numCol}>
                            <input
                              type="number"
                              min={0}
                              max={item.qty}
                              step="any"
                              value={delivered}
                              onChange={e => handleQtyChange(item.id, e.target.value)}
                              className={styles.qtyInput}
                            />
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {loc.installationCharge > 0 && (
                <div className={styles.installRow}>
                  <span>Installation Charge</span>
                  <span>{fmtINR(loc.installationCharge)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {canUpdateDelivery && Object.keys(qtyEdits).length > 0 && (
        <div className={styles.saveDeliveryBar}>
          <button
            className={styles.btnPrimary}
            onClick={handleSaveDelivered}
            disabled={saving}
            type="button"
          >
            {saving ? 'Saving…' : 'Save Delivered Quantities'}
          </button>
        </div>
      )}
    </div>
  )
}
