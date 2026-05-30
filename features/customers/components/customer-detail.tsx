'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type {
  CustomerDetail, ActivityItem,
  BillingKPIs, AgingBucket,
  InvoiceRow, PaymentRow,
  LedgerEntry, CustomerNote,
} from '../server/queries'
import { BillingTab }  from './billing-tab'
import { PaymentsTab } from './payments-tab'
import { ContactsSection } from './contacts-section'
import { NotesSection } from './notes-section'
import { CUSTOMER_TYPE_LABELS, PAYMENT_TERMS_LABELS } from '@/validations/customer'
import styles from './customers.module.scss'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtINR = (n: number) => n ? `₹${new Intl.NumberFormat('en-IN').format(n)}` : '—'
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls = styles[status as keyof typeof styles] as string | undefined
  return <span className={`${styles.statusBadge} ${cls ?? ''}`}>{status}</span>
}

// ── Activity timeline ─────────────────────────────────────────────────────────
function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (!items.length) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <i className="ti ti-history" style={{ fontSize: 40, color: 'var(--c-border-2)', display: 'block', marginBottom: 12 }} />
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--c-secondary)', fontWeight: 500 }}>No activity yet</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-tertiary)', marginTop: 4 }}>Changes to this customer will appear here</div>
      </div>
    )
  }
  const label: Record<string, string> = {
    insert: 'Created', update: 'Updated', delete: 'Deleted',
    restore: 'Restored', permission_change: 'Permission changed',
  }
  const dotColor: Record<string, string> = {
    insert: 'var(--c-success)', update: 'var(--c-info)',
    delete: 'var(--c-danger)', restore: 'var(--c-warning)',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((a) => (
        <div key={a.id} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
            background: dotColor[a.action] ?? 'var(--c-border-2)',
          }} />
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-ink)', fontWeight: 500 }}>
              {label[a.action] ?? a.action}
              <span style={{ color: 'var(--c-tertiary)', fontWeight: 400 }}> · {a.entityType}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', marginTop: 2 }}>
              {a.actorName ? `by ${a.actorName} · ` : ''}
              {new Date(a.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' '}
              {new Date(a.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ c }: { c: CustomerDetail }) {
  return (
    <div className={styles.detailLayout}>
      {/* Left sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Contact</span></div>
          <div className={styles.facts}>
            {[
              { l: 'Person',  v: c.contactPerson },
              { l: 'Phone',   v: c.phone },
              { l: 'Email',   v: c.email },
              { l: 'Website', v: c.website },
            ].map(({ l, v }) => v ? (
              <div key={l} className={styles.fact}>
                <span className={styles.factLabel}>{l}</span>
                <span className={styles.factValue}>{v}</span>
              </div>
            ) : null)}
            {!c.contactPerson && !c.phone && !c.email && !c.website && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', padding: '4px 0' }}>No contact details</div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Tax</span></div>
          <div className={styles.facts}>
            {c.gstin && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>GSTIN</span>
                <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.gstin}</span>
              </div>
            )}
            {c.pan && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>PAN</span>
                <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.pan}</span>
              </div>
            )}
            {!c.gstin && !c.pan && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', padding: '4px 0' }}>No tax details</div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Terms</span></div>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Payment</span>
              <span className={styles.factValue}>{PAYMENT_TERMS_LABELS[c.paymentTerms as keyof typeof PAYMENT_TERMS_LABELS] ?? c.paymentTerms}</span>
            </div>
            {c.creditLimit > 0 && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>Credit Limit</span>
                <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)' }}>{fmtINR(c.creditLimit)}</span>
              </div>
            )}
            {c.postSaleDiscount > 0 && (
              <div className={styles.fact}>
                <span className={styles.factLabel}>Discount</span>
                <span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)' }}>{fmtINR(c.postSaleDiscount)}</span>
              </div>
            )}
            <div className={styles.fact}>
              <span className={styles.factLabel}>Since</span>
              <span className={styles.factValue}>{fmtDate(c.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(c.billingName || c.billingAddress) && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Billing Address</span></div>
            {c.billingName && <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 6, color: 'var(--c-ink)' }}>{c.billingName}</div>}
            {c.billingAddress && <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.billingAddress}</div>}
          </div>
        )}

        {!c.sameAsBilling && (c.deliveryName || c.deliveryAddress) && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Delivery Address</span></div>
            {c.deliveryName && <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 6, color: 'var(--c-ink)' }}>{c.deliveryName}</div>}
            {c.deliveryAddress && <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.deliveryAddress}</div>}
          </div>
        )}

        {c.notes && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Internal Notes</span></div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.notes}</div>
          </div>
        )}

        {!c.billingAddress && !c.deliveryAddress && !c.notes && (
          <div className={styles.panel} style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-tertiary)' }}>No additional details</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  customer:   CustomerDetail
  activeTab:  string
  activity:   ActivityItem[]
  kpis:       BillingKPIs
  invoices:   InvoiceRow[]
  payments:   PaymentRow[]
  aging:      AgingBucket[]
  ledger:     LedgerEntry[]
  notes:      CustomerNote[]
  canEdit:    boolean
  canDelete:  boolean
}

// ── CustomerDetailView ────────────────────────────────────────────────────────
export function CustomerDetailView({
  customer: c, activeTab,
  activity, kpis, invoices, payments, aging, ledger, notes,
  canEdit, canDelete,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const TABS = [
    { key: 'overview',  label: 'Overview' },
    { key: 'billing',   label: 'Running Bill', badge: kpis.outstanding > 0 ? fmtAmount(kpis.outstanding) : undefined },
    { key: 'payments',  label: 'Payments',   badge: payments.length > 0 ? String(payments.length) : undefined },
    { key: 'contacts',  label: 'Contacts',   badge: c.contacts.length > 0 ? String(c.contacts.length) : undefined },
    { key: 'notes',     label: 'Notes' },
    { key: 'activity',  label: 'Activity',   badge: activity.length > 0 ? String(activity.length) : undefined },
  ]

  function goTab(key: string) {
    const url = key === 'overview' ? pathname : `${pathname}?tab=${key}`
    router.push(url)
  }

  return (
    <div className={styles.page}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link href="/customers" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', textDecoration: 'none' }}>
              ← Customers
            </Link>
            <span style={{ color: 'var(--c-border-2)' }}>/</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-tertiary)' }}>{c.code}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 32, letterSpacing: '0.02em', color: 'var(--c-ink)', lineHeight: 1.1 }}>
            {c.name}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={c.status} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)' }}>
              {CUSTOMER_TYPE_LABELS[c.type as keyof typeof CUSTOMER_TYPE_LABELS] ?? c.type}
              {c.industry ? ` · ${c.industry}` : ''}
            </span>
          </div>
        </div>

        {canEdit && (
          <Link href={`/customers/${c.id}/edit`}>
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent', color: 'var(--c-secondary)',
              border: '1px solid var(--c-border)', padding: '9px 16px',
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
            }}>
              <i className="ti ti-pencil" />
              Edit
            </button>
          </Link>
        )}
      </div>

      {/* ── 4-stat strip ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Total Billed',    value: fmtINR(kpis.totalBilled),   color: kpis.totalBilled > 0 ? 'var(--c-ink)' : undefined },
          { label: 'Total Received',  value: fmtINR(kpis.totalReceived), color: kpis.totalReceived > 0 ? 'var(--c-success)' : undefined },
          { label: 'Outstanding',     value: fmtINR(kpis.outstanding),   color: kpis.outstanding > 0 ? 'var(--c-danger)' : 'var(--c-tertiary)' },
          { label: 'Payment Terms',   value: PAYMENT_TERMS_LABELS[c.paymentTerms as keyof typeof PAYMENT_TERMS_LABELS] ?? c.paymentTerms },
        ].map((s) => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statLabel}>{s.label}</span>
            <span style={{
              fontFamily: s.label === 'Payment Terms' ? 'var(--font-body)' : 'var(--font-mono)',
              fontWeight: 700, fontSize: 16, color: s.color ?? 'var(--c-ink)',
              display: 'block', marginTop: 4, lineHeight: 1,
            }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────── */}
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

      {/* ── Tab content ───────────────────────────────────────────── */}
      <div>
        {activeTab === 'overview' && <OverviewTab c={c} />}

        {activeTab === 'billing' && (
          <BillingTab kpis={kpis} aging={aging} invoices={invoices} ledger={ledger} />
        )}

        {activeTab === 'payments' && (
          <PaymentsTab customerId={c.id} payments={payments} canEdit={canEdit} />
        )}

        {activeTab === 'contacts' && (
          <ContactsSection customerId={c.id} contacts={c.contacts} canEdit={canEdit} />
        )}

        {activeTab === 'notes' && (
          <NotesSection customerId={c.id} notes={notes} canEdit={canEdit} />
        )}

        {activeTab === 'activity' && <ActivityTimeline items={activity} />}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAmount(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n}`
}
