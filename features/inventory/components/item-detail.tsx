'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import type { ItemDetail, StockMovementRow, StockAdjustmentRow } from '../server/queries'
import { AdjustModal } from './adjust-modal'
import styles from './inventory.module.scss'

const fmtINR = (n: number | null) => n != null && n > 0 ? `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}` : '—'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
const fmtDateTime = (d: string) => {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) + ' ' + dt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
}

function MovementRow({ m }: { m: StockMovementRow }) {
  const cls = m.direction === 'in' ? 'in' : 'out'
  const typeLabel: Record<string, string> = { receipt:'Receipt', issue:'Issue', transfer:'Transfer', adjustment:'Adj', opening:'Opening', return:'Return' }
  return (
    <div className={styles.movementRow}>
      <span className={styles.movementDate}>{fmtDate(m.date)}</span>
      <span className={`${styles.movementType} ${styles[cls]}`}>{typeLabel[m.movementType] ?? m.movementType}</span>
      <span className={styles.movementRef}>{m.reference ?? m.notes ?? '—'}</span>
      <span className={`${styles.movementQty}`} style={{ color: m.direction === 'in' ? 'var(--c-success)' : 'var(--c-danger)' }}>
        {m.direction === 'in' ? '+' : '−'}{m.qty}
      </span>
      <span className={styles.movementVal}>{m.value > 0 ? fmtINR(m.value) : '—'}</span>
    </div>
  )
}

interface Props {
  item:        ItemDetail
  movements:   StockMovementRow[]
  adjustments: StockAdjustmentRow[]
  canEdit:     boolean
  canDelete:   boolean
  canAdjust:   boolean
  activeTab:   string
}

export function ItemDetailView({ item: it, movements, adjustments, canEdit, canDelete, canAdjust, activeTab }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showAdjust, setShowAdjust] = useState(false)

  const TABS = [
    { key: 'overview',    label: 'Overview' },
    { key: 'stock',       label: 'Stock',       badge: it.stock > 0 ? String(it.stock) : undefined },
    { key: 'movements',   label: 'Movements',   badge: movements.length > 0 ? String(movements.length) : undefined },
    { key: 'adjustments', label: 'Adjustments', badge: adjustments.length > 0 ? String(adjustments.length) : undefined },
  ]

  function goTab(key: string) {
    router.push(key === 'overview' ? pathname : `${pathname}?tab=${key}`)
  }

  const stockCls = it.isOutOfStock ? 'out' : it.isLowStock ? 'low' : 'ok'
  const stockLabel = it.isOutOfStock ? 'Out of stock' : it.isLowStock ? 'Low stock' : 'In stock'

  return (
    <div className={styles.page}>
      {showAdjust && canAdjust && (
        <AdjustModal
          itemId={it.id} itemName={it.name}
          currentStock={it.stock} unit={it.unit}
          onClose={() => setShowAdjust(false)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.detailHeader}>
        <div>
          <div className={styles.backRow}>
            <Link href="/inventory/items">← Inventory</Link>
            <span>/</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{it.sku ?? it.id.slice(0,8)}</span>
          </div>
          <div className={styles.detailTitle}>{it.name}</div>
          {it.variantLabel && <div className={styles.detailSku}>{it.variantLabel}</div>}
          <div className={styles.detailMeta}>
            <span className={`${styles.badge} ${styles[it.isActive ? 'active' : 'inactive']}`}>
              {it.isActive ? 'Active' : 'Inactive'}
            </span>
            {it.isImported && <span className={`${styles.badge} ${styles.imported}`}>Imported</span>}
            <span className={`${styles.stockBadge} ${styles[stockCls]}`}>{stockLabel} · {it.stock} {it.unit ?? ''}</span>
            {it.family && <span style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-tertiary)' }}>{it.family}</span>}
            {it.brand  && <span style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-tertiary)' }}>· {it.brand}</span>}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, flexShrink:0, flexWrap:'wrap' }}>
          {canAdjust && (
            <button className={styles.btnGhost} onClick={() => setShowAdjust(true)}>
              <i className="ti ti-adjustments-horizontal" /> Adjust Stock
            </button>
          )}
          {canEdit && (
            <Link href={`/inventory/items/${it.id}/edit`} className={styles.btnPrimary}>
              <i className="ti ti-pencil" /> Edit
            </Link>
          )}
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {[
          { l:'Purchase Price', v:fmtINR(it.purchasePrice), mono:true },
          { l:'Cost Price',     v:fmtINR(it.costPrice ?? it.purchasePrice), mono:true },
          { l:'Selling Price',  v:fmtINR(it.sellingPrice), mono:true },
          { l:'GST Rate',       v:`${it.gstRate}%`, mono:true },
          { l:'Lead Time',      v:it.leadTimeDays ? `${it.leadTimeDays} days` : '—', mono:false },
        ].map(s => (
          <div key={s.l} className={styles.kpiCard}>
            <div className={styles.kpiTop}><span className={styles.kpiLabel}>{s.l}</span></div>
            <span style={{ fontFamily: s.mono ? 'var(--font-mono)' : 'var(--font-body)', fontWeight:700, fontSize:16, color:'var(--c-ink)' }}>{s.v}</span>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.key} className={styles.tabItem} data-active={activeTab === t.key ? 'true' : undefined} onClick={() => goTab(t.key)}>
            {t.label}
            {t.badge && (
              <span style={{ marginLeft:6, fontFamily:'var(--font-mono)', fontSize:10, background: activeTab===t.key ? 'rgba(255,255,255,0.18)' : 'var(--c-surface-2)', color: activeTab===t.key ? 'inherit' : 'var(--c-tertiary)', padding:'1px 5px', borderRadius:2 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className={styles.detailLayout}>
          <div className={styles.sidebar}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}><span className={styles.panelTitle}>Identification</span></div>
              <div className={styles.facts}>
                {[
                  { l:'SKU',      v:it.sku,      mono:true },
                  { l:'Barcode',  v:it.barcode,  mono:true },
                  { l:'HSN Code', v:it.hsnCode,  mono:true },
                  { l:'Category', v:it.family },
                  { l:'Brand',    v:it.brand },
                  { l:'Unit',     v:it.unit,     mono:true },
                ].filter(f => f.v).map(f => (
                  <div key={f.l} className={styles.fact}>
                    <span className={styles.factLabel}>{f.l}</span>
                    <span className={f.mono ? styles.factMono : styles.factValue}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}><span className={styles.panelTitle}>Stock Levels</span></div>
              <div className={styles.facts}>
                {[
                  { l:'Current',  v:`${it.stock} ${it.unit ?? ''}` },
                  { l:'Minimum',  v:it.minStock > 0 ? `${it.minStock}` : '—' },
                  { l:'Reorder',  v:it.reorderLevel > 0 ? `${it.reorderLevel}` : '—' },
                  { l:'Maximum',  v:it.maxStock > 0 ? `${it.maxStock}` : '—' },
                ].map(f => (
                  <div key={f.l} className={styles.fact}>
                    <span className={styles.factLabel}>{f.l}</span>
                    <span className={styles.factMono}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {(it.weightKg || it.dimensions) && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Physical</span></div>
                <div className={styles.facts}>
                  {it.weightKg && <div className={styles.fact}><span className={styles.factLabel}>Weight</span><span className={styles.factMono}>{it.weightKg} kg</span></div>}
                  {it.dimensions && <div className={styles.fact}><span className={styles.factLabel}>Dimensions</span><span className={styles.factMono}>{it.dimensions.l}×{it.dimensions.w}×{it.dimensions.h} {it.dimensions.unit}</span></div>}
                </div>
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {it.description && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Description</span></div>
                <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--c-secondary)', lineHeight:1.7 }}>{it.description}</p>
              </div>
            )}

            <div className={styles.panel}>
              <div className={styles.panelHeader}><span className={styles.panelTitle}>Pricing</span></div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[
                  { l:'Purchase', v:fmtINR(it.purchasePrice) },
                  { l:'Cost / Landed', v:fmtINR(it.costPrice ?? it.purchasePrice) },
                  { l:'Selling', v:fmtINR(it.sellingPrice) },
                ].map(p => (
                  <div key={p.l} style={{ padding:'12px 14px', background:'var(--c-bg)', border:'1px solid var(--c-border)', borderRadius:'var(--radius-sm)' }}>
                    <div style={{ fontFamily:'var(--font-body)', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--c-tertiary)', marginBottom:6 }}>{p.l}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16, color:'var(--c-ink)' }}>{p.v}</div>
                  </div>
                ))}
              </div>
              {it.sellingPrice && it.purchasePrice && it.purchasePrice > 0 && (
                <div style={{ marginTop:10, fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-tertiary)' }}>
                  Margin: <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--c-success)' }}>
                    {(((it.sellingPrice - it.purchasePrice) / it.purchasePrice) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {it.notes && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Notes</span></div>
                <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--c-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{it.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Stock Movements</span>
            <span style={{ fontFamily:'var(--font-body)', fontSize:11, color:'var(--c-tertiary)' }}>{movements.length} records</span>
          </div>
          {movements.length === 0 ? (
            <div style={{ padding:'32px 0', textAlign:'center', fontFamily:'var(--font-body)', fontSize:13, color:'var(--c-tertiary)' }}>No movements recorded</div>
          ) : (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 1fr auto auto', gap:12, padding:'8px 0', borderBottom:'1px solid var(--c-border)' }}>
                {['Date','Type','Reference','Qty','Value'].map(h => (
                  <span key={h} style={{ fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--c-tertiary)' }}>{h}</span>
                ))}
              </div>
              <div className={styles.movementList}>
                {movements.map(m => <MovementRow key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'adjustments' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Stock Adjustments</span>
            {canAdjust && <button className={styles.btnGhost} onClick={() => setShowAdjust(true)} style={{ padding:'6px 12px', fontSize:10 }}>+ Adjust</button>}
          </div>
          {adjustments.length === 0 ? (
            <div style={{ padding:'32px 0', textAlign:'center', fontFamily:'var(--font-body)', fontSize:13, color:'var(--c-tertiary)' }}>No adjustments recorded</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--font-body)', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--c-bg)' }}>
                  {['Date & Time','Type','Quantity','Reason','Ref No.','By'].map((h, i) => (
                    <th key={h} style={{ padding:'9px 12px', textAlign: i >= 2 && i < 4 ? 'left' : i === 2 ? 'right' : 'left', fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--c-tertiary)', borderBottom:'1px solid var(--c-border)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adjustments.map(a => (
                  <tr key={a.id} onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--c-border)', color:'var(--c-tertiary)', whiteSpace:'nowrap' }}>{fmtDateTime(a.at)}</td>
                    <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--c-border)' }}>
                      <span style={{ fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.10em', textTransform:'uppercase', padding:'2px 8px', borderRadius:2, background: a.type==='add' ? 'var(--c-success-bg)' : 'var(--c-danger-bg)', color: a.type==='add' ? 'var(--c-success)' : 'var(--c-danger)' }}>
                        {a.type === 'add' ? '+ Add' : '− Reduce'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--c-border)', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13, color: a.type==='add' ? 'var(--c-success)' : 'var(--c-danger)' }}>{a.type==='add' ? '+' : '−'}{a.qty} {it.unit ?? ''}</td>
                    <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--c-border)', color:'var(--c-secondary)' }}>{a.reason}</td>
                    <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--c-border)', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--c-tertiary)' }}>{a.refNo ?? '—'}</td>
                    <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--c-border)', color:'var(--c-tertiary)', fontSize:11 }}>{a.adjusterName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'stock' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { l:'Current Stock',   v:`${it.stock} ${it.unit ?? ''}`, accent: it.isOutOfStock ? 'danger' : it.isLowStock ? 'warning' : 'success' },
            { l:'Reorder Level',   v:it.reorderLevel > 0 ? `${it.reorderLevel} ${it.unit ?? ''}` : 'Not set', accent:'' },
            { l:'Max Stock',       v:it.maxStock > 0 ? `${it.maxStock} ${it.unit ?? ''}` : 'Not set', accent:'' },
            { l:'Inventory Value', v:it.stock > 0 && it.purchasePrice ? `₹${new Intl.NumberFormat('en-IN',{minimumFractionDigits:2}).format(it.stock * (it.costPrice ?? it.purchasePrice ?? 0))}` : '—', accent:'' },
            { l:'Selling Value',   v:it.stock > 0 && it.sellingPrice ? `₹${new Intl.NumberFormat('en-IN',{minimumFractionDigits:2}).format(it.stock * it.sellingPrice)}` : '—', accent:'success' },
            { l:'Last Purchase',   v:it.lastPurchaseDate ? fmtDate(it.lastPurchaseDate) : '—', accent:'' },
          ].map(s => (
            <div key={s.l} className={`${styles.kpiCard} ${s.accent ? styles[s.accent] : ''}`}>
              <div className={styles.kpiTop}><span className={styles.kpiLabel}>{s.l}</span></div>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16, color:'var(--c-ink)' }}>{s.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
