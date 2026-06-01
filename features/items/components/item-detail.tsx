'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRouter, usePathname } from 'next/navigation'
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ItemDetail, ItemActivityItem } from '../server/queries'
import { Icon } from '@/components/ui'
import { computeLandedCost } from '@/lib/calc/costing'
import { formatMoney, formatQty } from '@/lib/utils/format'
import { LOW_STOCK_THRESHOLD } from '@/validations/item'
import styles from './items.module.scss'

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Stock badge ────────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return <span className={`${styles.stockBadge} ${styles.outStock}`}>Out of stock</span>
  if (stock < LOW_STOCK_THRESHOLD)
    return <span className={`${styles.stockBadge} ${styles.lowStock}`}>Low stock</span>
  return <span className={`${styles.stockBadge} ${styles.inStock}`}>In stock</span>
}

// ── Overview tab ───────────────────────────────────────────────────────────────
function OverviewTab({ item }: { item: ItemDetail }) {
  return (
    <div className={styles.detailLayout}>
      {/* Left sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Classification</span></div>
          <div className={styles.facts}>
            {[
              { l: 'Family',   v: item.family },
              { l: 'Brand',    v: item.brand },
              { l: 'Unit',     v: item.unit },
              { l: 'Variant',  v: item.variantLabel },
            ].map(({ l, v }) => v ? (
              <div key={l} className={styles.fact}>
                <span className={styles.factLabel}>{l}</span>
                <span className={styles.factValue}>{v}</span>
              </div>
            ) : null)}
            {!item.family && !item.brand && !item.unit && !item.variantLabel && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', padding: '4px 0' }}>
                No classification details
              </div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Sourcing</span></div>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Source</span>
              <span className={styles.factValue}>{item.isImported ? 'Imported' : 'Domestic'}</span>
            </div>
            {item.isImported && item.importCurrency && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>Currency</span>
                <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.importCurrency}</span>
              </div>
            )}
            {item.deliveryDays != null && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>Lead time</span>
                <span className={styles.factValue}>{item.deliveryDays} days</span>
              </div>
            )}
            {item.lastPurchaseDate && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>Last purchase</span>
                <span className={styles.factValue}>{fmtDate(item.lastPurchaseDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Stock panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Stock</span></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 40, color: 'var(--c-ink)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {formatQty(item.stock)}
            </span>
            <StockBadge stock={item.stock} />
          </div>
          <div className={styles.stockBarWrap}>
            <div
              className={styles.stockBarFill}
              style={{ width: `${Math.min(100, (item.stock / Math.max(item.stock, 50)) * 100)}%` }}
              data-low={item.stock < LOW_STOCK_THRESHOLD && item.stock > 0 ? 'true' : undefined}
              data-out={item.stock === 0 ? 'true' : undefined}
            />
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-tertiary)', marginTop: 8 }}>
            Reorder threshold: {LOW_STOCK_THRESHOLD} units
          </div>
        </div>

        {/* Image */}
        {item.imageUrl && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Image</span></div>
            <div className={styles.imageBox}>
              <img src={item.imageUrl} alt={item.name} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pricing tab ────────────────────────────────────────────────────────────────
function PricingTab({ item, currency }: { item: ItemDetail; currency: string }) {
  const trail = item.isImported
    ? computeLandedCost({
        importPrice: item.importPrice ?? 0,
        exchangeRate: item.exchangeRate ?? 0,
        importDiscountPct: item.importDiscountPct ?? 0,
        transportType: item.transportType ?? undefined,
        transportValue: item.transportValue ?? 0,
        customDutyPct: item.customDutyPct ?? 0,
        profitMultiplier: item.profitMultiplier ?? 1,
      })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Price cards */}
      <div className={styles.metricsRow}>
        {[
          { label: 'Purchase / Cost', value: formatMoney(item.purchasePrice, currency) },
          { label: 'Selling Price',   value: formatMoney(item.sellingPrice, currency) },
          { label: 'Last Purchase',   value: formatMoney(item.lastPurchasePrice, currency) },
          { label: 'Margin',          value: item.purchasePrice && item.sellingPrice && item.purchasePrice > 0
            ? `${(((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(1)}%`
            : '—' },
        ].map((m) => (
          <div key={m.label} className={styles.metric}>
            <span className={styles.metricLabel}>{m.label}</span>
            <span className={styles.metricValue}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Landed cost breakdown for imported items */}
      {trail && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Landed-cost Breakdown</span></div>
          <div className={styles.facts} style={{ marginBottom: 14 }}>
            {[
              { l: 'Import currency',  v: item.importCurrency },
              { l: 'Import price',     v: item.importPrice != null ? String(item.importPrice) : null },
              { l: 'Exchange rate',    v: item.exchangeRate != null ? String(item.exchangeRate) : null },
              { l: 'Discount %',       v: item.importDiscountPct != null ? `${item.importDiscountPct}%` : null },
              { l: 'Transport',        v: item.transportType ? `${item.transportType} — ${item.transportValue}` : null },
              { l: 'Custom duty %',    v: item.customDutyPct != null ? `${item.customDutyPct}%` : null },
              { l: 'Profit multiplier',v: item.profitMultiplier != null ? `×${item.profitMultiplier}` : null },
            ].map(({ l, v }) => v ? (
              <div key={l} className={styles.fact}>
                <span className={styles.factLabel}>{l}</span>
                <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span>
              </div>
            ) : null)}
          </div>
          <div className={styles.trail}>
            <TrailRow label={`Base (${item.importCurrency} × rate)`} value={formatMoney(trail.base, currency)} />
            <TrailRow label="After discount" value={formatMoney(trail.afterDiscount, currency)} />
            <TrailRow label="Transport" value={formatMoney(trail.transport, currency)} />
            <TrailRow label="With transport" value={formatMoney(trail.withTransport, currency)} />
            <TrailRow label="Cost price (stored)" value={formatMoney(trail.costPrice, currency)} total />
            <TrailRow label="Selling price (stored)" value={formatMoney(trail.sellingPrice, currency)} total />
          </div>
        </div>
      )}

      {!item.isImported && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Domestic Pricing</span></div>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Purchase price</span>
              <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(item.purchasePrice, currency)}</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Selling price</span>
              <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(item.sellingPrice, currency)}</span>
            </div>
          </div>
        </div>
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

// ── Variations tab ─────────────────────────────────────────────────────────────
function VariationsTab({ item }: { item: ItemDetail }) {
  if (item.variations.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="versions" className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>No variations</div>
        <div className={styles.emptyBody}>This item has no size/make/finish variants</div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}><span className={styles.panelTitle}>Variations ({item.variations.length})</span></div>
      <table className={styles.varTable}>
        <thead>
          <tr>
            <th className={styles.varTh}>Size</th>
            <th className={styles.varTh}>Make</th>
            <th className={styles.varTh}>Finish</th>
            <th className={styles.varTh}>Brand</th>
          </tr>
        </thead>
        <tbody>
          {item.variations.map((v) => (
            <tr key={v.id} className={styles.varRow}>
              <td className={styles.varTd}>{v.size ?? '—'}</td>
              <td className={styles.varTd}>{v.make ?? '—'}</td>
              <td className={styles.varTd}>{v.finish ?? '—'}</td>
              <td className={styles.varTd}>{v.brand ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Activity tab ───────────────────────────────────────────────────────────────
function ActivityTab({ items }: { items: ItemActivityItem[] }) {
  if (!items.length) {
    return (
      <div className={styles.empty}>
        <Icon name="history" className={styles.emptyIcon} />
        <div className={styles.emptyTitle}>No activity yet</div>
        <div className={styles.emptyBody}>Changes to this item will appear here</div>
      </div>
    )
  }

  const label: Record<string, string> = {
    insert: 'Created', update: 'Updated', delete: 'Deleted', restore: 'Restored',
  }
  const dotColor: Record<string, string> = {
    insert: 'var(--c-success)', update: 'var(--c-info)',
    delete: 'var(--c-danger)', restore: 'var(--c-warning)',
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}><span className={styles.panelTitle}>Activity ({items.length})</span></div>
      <div className={styles.actList}>
        {items.map((a) => (
          <div key={a.id} className={styles.actItem}>
            <div
              className={styles.actDot}
              style={{ background: dotColor[a.action] ?? 'var(--c-border-2)' }}
              data-type={a.action}
            />
            <div className={styles.actMain}>
              <div className={styles.actLabel}>
                {label[a.action] ?? a.action}
                <span style={{ fontFamily: 'var(--font-body)', color: 'var(--c-tertiary)', fontWeight: 400 }}>
                  {' '}· {a.entityType}
                </span>
              </div>
              {a.actorName && (
                <div className={styles.actMeta}>by {a.actorName}</div>
              )}
            </div>
            <span className={styles.actTime}>{relTime(a.at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  item:      ItemDetail
  currency:  string
  activeTab: string
  activity:  ItemActivityItem[]
  canEdit:   boolean
  canDelete: boolean
}

export function ItemDetailView({ item, currency, activeTab, activity, canEdit, canDelete }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const TABS = [
    { key: 'overview',   label: 'Overview' },
    { key: 'pricing',    label: 'Pricing' },
    { key: 'variations', label: 'Variations', badge: item.variations.length > 0 ? String(item.variations.length) : undefined },
    { key: 'activity',   label: 'Activity', badge: activity.length > 0 ? String(activity.length) : undefined },
  ]

  function goTab(key: string) {
    const url = key === 'overview' ? pathname : `${pathname}?tab=${key}`
    router.push(url as Route)
  }

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link href="/items" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', textDecoration: 'none' }}>
              ← Items
            </Link>
            {item.sku && (
              <>
                <span style={{ color: 'var(--c-border-2)' }}>/</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-tertiary)' }}>{item.sku}</span>
              </>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 32, letterSpacing: '0.02em', color: 'var(--c-ink)', lineHeight: 1.1 }}>
            {item.name}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.isImported && (
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
                letterSpacing: '0.10em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 2,
                background: 'var(--c-info-bg)', color: 'var(--c-info)',
              }}>Imported</span>
            )}
            {item.family && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)' }}>
                {item.family}{item.brand ? ` · ${item.brand}` : ''}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {canEdit && (
            <Link href={`/items/${item.id}/edit` as Route}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', color: 'var(--c-secondary)',
                border: '1px solid var(--c-border)', padding: '9px 16px',
                fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
                letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
              }}>
                <Icon name="pencil" />
                Edit
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ── 4-stat strip ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {[
          { label: 'Cost Price',    value: formatMoney(item.purchasePrice, currency) },
          { label: 'Selling Price', value: formatMoney(item.sellingPrice, currency),   color: item.sellingPrice ? 'var(--c-success)' : undefined },
          { label: 'Stock',         value: formatQty(item.stock),                      color: item.stock === 0 ? 'var(--c-danger)' : item.stock < LOW_STOCK_THRESHOLD ? 'var(--c-warning)' : undefined },
          { label: 'Unit',          value: item.unit ?? '—' },
        ].map((s) => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statLabel}>{s.label}</span>
            <span style={{
              fontFamily: s.label === 'Unit' ? 'var(--font-body)' : 'var(--font-mono)',
              fontWeight: 700, fontSize: 16, color: s.color ?? 'var(--c-ink)',
              display: 'block', marginTop: 4, lineHeight: 1,
            }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div className={styles.tabBar} style={{ marginBottom: 0 }}>
        {TABS.map((t) => (
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
                background: activeTab === t.key ? 'rgba(255,255,255,0.18)' : 'var(--c-surface-2)',
                color: activeTab === t.key ? 'inherit' : 'var(--c-tertiary)',
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', borderRadius: 2,
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div>
        {activeTab === 'overview'   && <OverviewTab   item={item} />}
        {activeTab === 'pricing'    && <PricingTab    item={item} currency={currency} />}
        {activeTab === 'variations' && <VariationsTab item={item} />}
        {activeTab === 'activity'   && <ActivityTab   items={activity} />}
      </div>
    </div>
  )
}
