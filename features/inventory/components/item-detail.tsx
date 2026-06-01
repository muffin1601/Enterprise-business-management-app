'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter, usePathname } from 'next/navigation'
import type { ItemDetail, StockMovementRow, StockAdjustmentRow, ItemVariantRow } from '../server/queries'
import { AdjustModal } from './adjust-modal'
import { ItemImageUpload } from './item-image-upload'
import { AddVariantForm } from './variations-panel'
import { Icon } from '@/components/ui'
import styles from './inventory.module.scss'

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtINR = (n: number | null) =>
  n != null && n > 0
    ? `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`
    : '—'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtDateTime = (d: string) => {
  const dt = new Date(d)
  return (
    dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 2,
      background: active ? 'var(--c-success-bg)' : 'var(--c-surface-2)',
      color: active ? 'var(--c-success)' : 'var(--c-tertiary)',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function StockBadge({ row }: { row: ItemDetail }) {
  const color = row.isOutOfStock ? 'var(--c-danger)' : row.isLowStock ? 'var(--c-warning)' : 'var(--c-success)'
  const bg    = row.isOutOfStock ? 'var(--c-danger-bg)' : row.isLowStock ? 'var(--c-warning-bg)' : 'var(--c-success-bg)'
  const label = row.isOutOfStock ? 'Out of stock' : row.isLowStock ? 'Low stock' : 'In stock'
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 2, background: bg, color,
    }}>
      {label} · {row.stock} {row.unit ?? ''}
    </span>
  )
}

function TypeBadge({ imported }: { imported: boolean }) {
  if (!imported) return null
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 2,
      background: 'var(--c-info-bg)', color: 'var(--c-info)',
    }}>
      Imported
    </span>
  )
}

// ── Overview tab ───────────────────────────────────────────────────────────────
function OverviewTab({
  it, canEdit, orgId,
}: { it: ItemDetail; canEdit: boolean; orgId: string }) {
  return (
    <div className={styles.detailLayout}>
      {/* Left sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Image */}
        <ItemImageUpload
          itemId={it.id}
          imageUrl={it.imageUrl}
          orgId={orgId}
          canEdit={canEdit}
        />

        {/* Identification */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Identification</span></div>
          <div className={styles.facts}>
            {([
              { l: 'SKU',      v: it.sku,      mono: true },
              { l: 'Barcode',  v: it.barcode,  mono: true },
              { l: 'HSN Code', v: it.hsnCode,  mono: true },
              { l: 'Category', v: it.family,   mono: false },
              { l: 'Brand',    v: it.brand,    mono: false },
              { l: 'Unit',     v: it.unit,     mono: true },
            ] as const).filter(f => f.v).map(f => (
              <div key={f.l} className={styles.fact}>
                <span className={styles.factLabel}>{f.l}</span>
                <span className={f.mono ? styles.factMono : styles.factValue}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stock levels */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Stock Levels</span></div>
          <div className={styles.facts}>
            {[
              { l: 'Current',  v: `${it.stock} ${it.unit ?? ''}` },
              { l: 'Minimum',  v: it.minStock > 0 ? `${it.minStock}` : '—' },
              { l: 'Reorder',  v: it.reorderLevel > 0 ? `${it.reorderLevel}` : '—' },
              { l: 'Maximum',  v: it.maxStock > 0 ? `${it.maxStock}` : '—' },
            ].map(f => (
              <div key={f.l} className={styles.fact}>
                <span className={styles.factLabel}>{f.l}</span>
                <span className={styles.factMono}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Physical */}
        {(it.weightKg || it.dimensions) && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Physical</span></div>
            <div className={styles.facts}>
              {it.weightKg && (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Weight</span>
                  <span className={styles.factMono}>{it.weightKg} kg</span>
                </div>
              )}
              {it.dimensions && (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Dimensions</span>
                  <span className={styles.factMono}>{it.dimensions.l}×{it.dimensions.w}×{it.dimensions.h} {it.dimensions.unit}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {it.description && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Description</span></div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, margin: 0 }}>{it.description}</p>
          </div>
        )}

        {/* Pricing */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Pricing</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { l: 'Purchase',     v: fmtINR(it.purchasePrice) },
              { l: 'Cost / Landed',v: fmtINR(it.costPrice ?? it.purchasePrice) },
              { l: 'Selling',      v: fmtINR(it.sellingPrice) },
            ].map(p => (
              <div key={p.l} style={{
                padding: '14px 16px',
                background: 'var(--c-bg)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-tertiary)', marginBottom: 8 }}>{p.l}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 22, color: 'var(--c-ink)', lineHeight: 1 }}>{p.v}</div>
              </div>
            ))}
          </div>
          {it.sellingPrice && it.purchasePrice && it.purchasePrice > 0 && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-secondary)' }}>
              Margin:{' '}
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13,
                color: it.sellingPrice > it.purchasePrice ? 'var(--c-success)' : 'var(--c-danger)',
              }}>
                {(((it.sellingPrice - it.purchasePrice) / it.purchasePrice) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Delivery & sourcing */}
        {(it.deliveryDays || it.leadTimeDays || it.gstRate) && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Sourcing & Tax</span></div>
            <div className={styles.facts}>
              {it.gstRate > 0 && <div className={styles.fact}><span className={styles.factLabel}>GST Rate</span><span className={styles.factMono}>{it.gstRate}%</span></div>}
              {it.leadTimeDays > 0 && <div className={styles.fact}><span className={styles.factLabel}>Lead Time</span><span className={styles.factMono}>{it.leadTimeDays} days</span></div>}
              {it.deliveryDays && <div className={styles.fact}><span className={styles.factLabel}>Delivery</span><span className={styles.factMono}>{it.deliveryDays} days</span></div>}
              {it.lastPurchaseDate && <div className={styles.fact}><span className={styles.factLabel}>Last Purchase</span><span className={styles.factMono}>{fmtDate(it.lastPurchaseDate)}</span></div>}
            </div>
          </div>
        )}

        {it.notes && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Internal Notes</span></div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{it.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stock tab ──────────────────────────────────────────────────────────────────
function StockTab({ it }: { it: ItemDetail }) {
  const cards = [
    { l: 'Current Stock',   v: `${it.stock} ${it.unit ?? ''}`,   accent: it.isOutOfStock ? 'danger' : it.isLowStock ? 'warning' : 'success' },
    { l: 'Reorder Level',   v: it.reorderLevel > 0 ? `${it.reorderLevel} ${it.unit ?? ''}` : 'Not set', accent: '' },
    { l: 'Minimum Stock',   v: it.minStock > 0 ? `${it.minStock} ${it.unit ?? ''}` : 'Not set', accent: '' },
    { l: 'Maximum Stock',   v: it.maxStock > 0 ? `${it.maxStock} ${it.unit ?? ''}` : 'Not set', accent: '' },
    { l: 'Inventory Value', v: it.stock > 0 && it.purchasePrice ? fmtINR(it.stock * (it.costPrice ?? it.purchasePrice ?? 0)) : '—', accent: '' },
    { l: 'Selling Value',   v: it.stock > 0 && it.sellingPrice ? fmtINR(it.stock * it.sellingPrice) : '—', accent: 'success' },
  ]

  const accentBorder: Record<string, string> = {
    danger: 'var(--c-danger)', warning: 'var(--c-warning)', success: 'var(--c-success)',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {cards.map(s => (
        <div key={s.l} style={{
          background: 'var(--c-surface)',
          border: `1px solid var(--c-border)`,
          borderLeft: s.accent ? `3px solid ${accentBorder[s.accent]}` : '1px solid var(--c-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '18px 20px',
        }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-tertiary)', marginBottom: 10 }}>{s.l}</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 28, color: 'var(--c-ink)', lineHeight: 1, letterSpacing: '-0.01em' }}>{s.v}</div>
        </div>
      ))}
    </div>
  )
}

// ── Movements tab ─────────────────────────────────────────────────────────────
function MovementsTab({ movements, unit }: { movements: StockMovementRow[]; unit: string | null }) {
  const typeLabel: Record<string, string> = {
    receipt: 'Receipt', issue: 'Issue', transfer: 'Transfer',
    adjustment: 'Adjustment', opening: 'Opening', return: 'Return',
  }

  if (movements.length === 0) {
    return (
      <div className={styles.panel} style={{ textAlign: 'center', padding: '48px 24px' }}>
        <Icon name="arrows-exchange" size={36} style={{ color: 'var(--c-border-2)', display: 'block', marginBottom: 12 }} />
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', fontWeight: 500 }}>No movements recorded</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', marginTop: 4 }}>Stock movements from receipts, issues and adjustments appear here</div>
      </div>
    )
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Date</th>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Reference / Notes</th>
            <th className={`${styles.th} ${styles.right}`}>Qty</th>
            <th className={`${styles.th} ${styles.right}`}>Value</th>
          </tr>
        </thead>
        <tbody>
          {movements.map(m => (
            <tr key={m.id} className={styles.tableRow}>
              <td className={`${styles.td} ${styles.mono}`} style={{ whiteSpace: 'nowrap' }}>{fmtDate(m.date)}</td>
              <td className={styles.td}>
                <span style={{
                  display: 'inline-block', fontFamily: 'var(--font-body)',
                  fontSize: 8, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: 2,
                  background: m.direction === 'in' ? 'var(--c-success-bg)' : 'var(--c-danger-bg)',
                  color: m.direction === 'in' ? 'var(--c-success)' : 'var(--c-danger)',
                }}>
                  {typeLabel[m.movementType] ?? m.movementType}
                </span>
              </td>
              <td className={styles.td} style={{ color: 'var(--c-secondary)', maxWidth: 240 }}>
                {m.reference ?? m.notes ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}
              </td>
              <td className={`${styles.td} ${styles.right} ${styles.mono}`} style={{
                color: m.direction === 'in' ? 'var(--c-success)' : 'var(--c-danger)',
                fontWeight: 600,
              }}>
                {m.direction === 'in' ? '+' : '−'}{m.qty} {unit ?? ''}
              </td>
              <td className={`${styles.td} ${styles.right} ${styles.mono}`} style={{ color: 'var(--c-tertiary)' }}>
                {m.value > 0 ? fmtINR(m.value) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Adjustments tab ───────────────────────────────────────────────────────────
function AdjustmentsTab({
  adjustments, unit, canAdjust, itemId, itemName, currentStock,
  onOpenAdjust,
}: {
  adjustments: StockAdjustmentRow[]
  unit: string | null
  canAdjust: boolean
  itemId: string
  itemName: string
  currentStock: number
  onOpenAdjust: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {canAdjust && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className={styles.btnPrimary} onClick={onOpenAdjust}>
            <Icon name="adjustments-horizontal" />
            Adjust Stock
          </button>
        </div>
      )}

      {adjustments.length === 0 ? (
        <div className={styles.panel} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Icon name="adjustments-horizontal" size={36} style={{ color: 'var(--c-border-2)', display: 'block', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', fontWeight: 500 }}>No adjustments yet</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', marginTop: 4 }}>Use "Adjust Stock" to add or reduce inventory manually</div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Date & Time</th>
                <th className={styles.th}>Type</th>
                <th className={`${styles.th} ${styles.right}`}>Quantity</th>
                <th className={styles.th}>Reason</th>
                <th className={styles.th}>Ref No.</th>
                <th className={styles.th}>By</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map(a => (
                <tr key={a.id} className={styles.tableRow}>
                  <td className={`${styles.td} ${styles.mono}`} style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDateTime(a.at)}</td>
                  <td className={styles.td}>
                    <span style={{
                      display: 'inline-block', fontFamily: 'var(--font-body)',
                      fontSize: 8, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase',
                      padding: '2px 9px', borderRadius: 2,
                      background: a.type === 'add' ? 'var(--c-success-bg)' : 'var(--c-danger-bg)',
                      color: a.type === 'add' ? 'var(--c-success)' : 'var(--c-danger)',
                    }}>
                      {a.type === 'add' ? '+ Add' : '− Reduce'}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.right} ${styles.mono}`} style={{
                    fontWeight: 700, fontSize: 13,
                    color: a.type === 'add' ? 'var(--c-success)' : 'var(--c-danger)',
                  }}>
                    {a.type === 'add' ? '+' : '−'}{a.qty} {unit ?? ''}
                  </td>
                  <td className={styles.td}>{a.reason}</td>
                  <td className={`${styles.td} ${styles.mono}`} style={{ fontSize: 11, color: 'var(--c-tertiary)' }}>{a.refNo ?? '—'}</td>
                  <td className={styles.td} style={{ fontSize: 11, color: 'var(--c-tertiary)' }}>{a.adjusterName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
// ── Variants tab ──────────────────────────────────────────────────────────────
function VariantsTab({ it, variants, canEdit }: { it: ItemDetail; variants: ItemVariantRow[]; canEdit: boolean }) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)

  const fmtINR = (n: number | null) => n ? `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}` : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {canEdit && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--c-ink)', color: 'var(--c-inverse)', border: '1px solid var(--c-ink)', padding: '9px 18px', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
          >
            <Icon name="plus" size={14} />
            Add Variant
          </button>
        )}
      </div>

      {/* Add variant inline form */}
      {showAdd && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>New Variant</span></div>
          <AddVariantForm
            parentId={it.id}
            parentName={it.name}
            onSuccess={() => { setShowAdd(false); router.refresh() }}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {variants.length === 0 && !showAdd ? (
        <div className={styles.panel} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Icon name="layers" size={36} style={{ color: 'var(--c-border-2)', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', fontWeight: 500 }}>No variants yet</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', marginTop: 4 }}>Click "Add Variant" to create size/finish/make variants of this item</div>
        </div>
      ) : variants.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>SKU</th>
                <th className={styles.th}>Variant Name</th>
                <th className={styles.th}>Size</th>
                <th className={styles.th}>Finish</th>
                <th className={styles.th}>Make / Brand</th>
                <th className={styles.th}>Grade</th>
                <th className={`${styles.th} ${styles.right}`}>Stock</th>
                <th className={`${styles.th} ${styles.right}`}>Cost</th>
                <th className={`${styles.th} ${styles.right}`}>Price</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th} />
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.id} className={styles.tableRow}>
                  <td className={`${styles.td} ${styles.mono}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{v.sku ?? '—'}</td>
                  <td className={styles.td}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, color: 'var(--c-ink)', fontSize: 13 }}>{v.variantLabel || '—'}</div>
                  </td>
                  <td className={styles.td}>{v.size ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}</td>
                  <td className={styles.td}>{v.finish ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}</td>
                  <td className={styles.td}>{v.make ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}</td>
                  <td className={styles.td}>{v.brand ?? <span style={{ color: 'var(--c-tertiary)' }}>—</span>}</td>
                  <td className={`${styles.td} ${styles.right} ${styles.mono}`} style={{ color: v.stock > 0 ? 'var(--c-ink)' : 'var(--c-tertiary)' }}>{v.stock > 0 ? `${v.stock} ${it.unit ?? ''}` : '—'}</td>
                  <td className={`${styles.td} ${styles.right} ${styles.mono}`}>{fmtINR(v.purchasePrice)}</td>
                  <td className={`${styles.td} ${styles.right} ${styles.mono}`}>{fmtINR(v.sellingPrice)}</td>
                  <td className={styles.td}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 2, background: v.isActive ? 'var(--c-success-bg)' : 'var(--c-surface-2)', color: v.isActive ? 'var(--c-success)' : 'var(--c-tertiary)' }}>
                      {v.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.right}`}>
                    <Link href={`/inventory/items/${v.id}` as Route} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--c-tertiary)', textDecoration: 'none', fontSize: 11, fontFamily: 'var(--font-body)', transition: 'color 120ms' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-ink)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-tertiary)')}>
                      <Icon name="eye" size={13} /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

interface Props {
  item:        ItemDetail
  movements:   StockMovementRow[]
  adjustments: StockAdjustmentRow[]
  variants:    ItemVariantRow[]
  canEdit:     boolean
  canDelete:   boolean
  canAdjust:   boolean
  activeTab:   string
  orgId:       string
}

export function ItemDetailView({ item: it, movements, adjustments, variants, canEdit, canAdjust, activeTab, orgId }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showAdjust, setShowAdjust] = useState(false)

  const TABS = [
    { key: 'overview',    label: 'Overview' },
    { key: 'variants',    label: 'Variants',    badge: variants.length > 0 ? String(variants.length) : undefined },
    { key: 'stock',       label: 'Stock',       badge: it.stock > 0 ? String(it.stock) : undefined },
    { key: 'movements',   label: 'Movements',   badge: movements.length > 0 ? String(movements.length) : undefined },
    { key: 'adjustments', label: 'Adjustments', badge: adjustments.length > 0 ? String(adjustments.length) : undefined },
  ]

  function goTab(key: string) {
    const url = key === 'overview' ? pathname : `${pathname}?tab=${key}`
    router.push(url as Route)
  }

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
        <div style={{ minWidth: 0 }}>
          {/* Breadcrumb */}
          <div className={styles.detailBreadcrumb}>
            <Link href="/inventory/items">
              <Icon name="arrow-left" />
              Inventory
            </Link>
            <span>/</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{it.sku ?? it.id.slice(0, 8)}</span>
          </div>

          {/* Title */}
          <div className={styles.detailTitle}>{it.name}</div>

          {/* Variant */}
          {it.variantLabel && (
            <div className={styles.detailVariant}>{it.variantLabel}</div>
          )}

          {/* Meta badges */}
          <div className={styles.detailMeta}>
            <StatusBadge active={it.isActive} />
            <TypeBadge imported={it.isImported} />
            <StockBadge row={it} />
            {it.family && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)' }}>
                {it.family}{it.brand ? ` · ${it.brand}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions top-right */}
        <div className={styles.detailActions}>
          {canEdit && (
            <Link href={`/inventory/items/${it.id}/edit`} className={styles.btnPrimary}>
              <Icon name="pencil" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* ── Metric strip ───────────────────────────────────────── */}
      <div className={styles.metricStrip}>
        {[
          { l: 'Purchase Price', v: fmtINR(it.purchasePrice) },
          { l: 'Cost Price',     v: fmtINR(it.costPrice ?? it.purchasePrice) },
          { l: 'Selling Price',  v: fmtINR(it.sellingPrice) },
          { l: 'GST Rate',       v: `${it.gstRate}%` },
          { l: 'Lead Time',      v: it.leadTimeDays ? `${it.leadTimeDays} days` : '—' },
        ].map(s => (
          <div key={s.l} className={styles.metricCard}>
            <span className={styles.metricLabel}>{s.l}</span>
            <span className={styles.metricValue}>{s.v}</span>
          </div>
        ))}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={styles.tabItem}
            data-active={activeTab === t.key ? 'true' : undefined}
            onClick={() => goTab(t.key)}
          >
            {t.label}
            {t.badge && (
              <span style={{
                marginLeft: 7,
                fontFamily: 'var(--font-mono)', fontSize: 10,
                background: activeTab === t.key ? 'rgba(255,255,255,0.18)' : 'var(--c-surface-2)',
                color: activeTab === t.key ? 'inherit' : 'var(--c-tertiary)',
                padding: '1px 6px', borderRadius: 2,
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab it={it} canEdit={canEdit} orgId={orgId} />
      )}

      {activeTab === 'variants' && (
        <VariantsTab it={it} variants={variants} canEdit={canEdit} />
      )}

      {activeTab === 'stock' && (
        <StockTab it={it} />
      )}

      {activeTab === 'movements' && (
        <MovementsTab movements={movements} unit={it.unit} />
      )}

      {activeTab === 'adjustments' && (
        <AdjustmentsTab
          adjustments={adjustments}
          unit={it.unit}
          canAdjust={canAdjust}
          itemId={it.id}
          itemName={it.name}
          currentStock={it.stock}
          onOpenAdjust={() => setShowAdjust(true)}
        />
      )}
    </div>
  )
}
