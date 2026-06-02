'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import type { VendorDetail, VendorNote, VendorDocument, ActivityItem } from '../server/queries'
import { ContactsSection }     from './contacts-section'
import { BankAccountsSection } from './bank-accounts-section'
import { NotesSection }        from './notes-section'
import { DocumentsSection }    from './documents-section'
import { PurchaseOrdersTab }   from './purchase-orders-tab'
import { updateVendorStatus, deleteVendor } from '../server/actions'
import { VENDOR_TYPE_LABELS, VENDOR_STATUS_LABELS, PAYMENT_TERMS_LABELS } from '@/validations/vendor'
import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'
import { useTransition } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtINR  = (n: number) => n ? `₹${new Intl.NumberFormat('en-IN').format(n)}` : '—'
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[status as keyof typeof styles] ?? ''}`}>
      {VENDOR_STATUS_LABELS[status as keyof typeof VENDOR_STATUS_LABELS] ?? status}
    </span>
  )
}

// ── Activity timeline (same as customers) ────────────────────────────────────
function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (!items.length) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Icon name="history" size={40} style={{ color: 'var(--c-border-2)', display: 'block', marginBottom: 12 }} />
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--c-secondary)', fontWeight: 500 }}>No activity yet</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-tertiary)', marginTop: 4 }}>Changes to this vendor will appear here</div>
      </div>
    )
  }
  const label: Record<string, string> = {
    insert: 'Created', update: 'Updated', delete: 'Deleted',
  }
  const dotColor: Record<string, string> = {
    insert: 'var(--c-success)', update: 'var(--c-info)', delete: 'var(--c-danger)',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map(a => (
        <div key={a.id} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: dotColor[a.action] ?? 'var(--c-border-2)' }} />
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
function OverviewTab({ v }: { v: VendorDetail }) {
  return (
    <div className={styles.detailLayout}>
      <div className={styles.sidebar}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Contact</span></div>
          <div className={styles.facts}>
            {[
              { l: 'Person',  v: v.contactPerson },
              { l: 'Phone',   v: v.phone },
              { l: 'Email',   v: v.email },
              { l: 'Website', v: v.website },
            ].map(({ l, v: val }) => val ? (
              <div key={l} className={styles.fact}>
                <span className={styles.factLabel}>{l}</span>
                <span className={styles.factValue}>{val}</span>
              </div>
            ) : null)}
            {!v.contactPerson && !v.phone && !v.email && !v.website && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', padding: '4px 0' }}>No contact details</div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Tax &amp; Compliance</span></div>
          <div className={styles.facts}>
            {v.gstin && <div className={styles.fact}><span className={styles.factLabel}>GSTIN</span><span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.gstin}</span></div>}
            {v.pan   && <div className={styles.fact}><span className={styles.factLabel}>PAN</span><span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.pan}</span></div>}
            {v.msmeNo && <div className={styles.fact}><span className={styles.factLabel}>MSME No.</span><span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.msmeNo}</span></div>}
            {!v.gstin && !v.pan && !v.msmeNo && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', padding: '4px 0' }}>No tax details</div>}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><span className={styles.panelTitle}>Commercial Terms</span></div>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factLabel}>Payment</span>
              <span className={styles.factValue}>{PAYMENT_TERMS_LABELS[v.paymentTerms as keyof typeof PAYMENT_TERMS_LABELS] ?? v.paymentTerms}</span>
            </div>
            {v.creditLimit > 0 && <div className={styles.fact}><span className={styles.factLabel}>Credit Limit</span><span className={styles.factValue} style={{ fontFamily: 'var(--font-mono)' }}>{fmtINR(v.creditLimit)}</span></div>}
            <div className={styles.fact}><span className={styles.factLabel}>Currency</span><span className={styles.factValue}>{v.currency}</span></div>
            <div className={styles.fact}><span className={styles.factLabel}>Since</span><span className={styles.factValue}>{fmtDate(v.createdAt)}</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(v.billingAddress || v.city) && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Billing / Registered Address</span></div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {[v.billingAddress, v.city && v.state ? `${v.city}, ${v.state}` : v.city ?? v.state, v.pincode, v.country !== 'India' ? v.country : null].filter(Boolean).join('\n')}
            </div>
          </div>
        )}
        {v.shippingAddress && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Shipping / Dispatch Address</span></div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{v.shippingAddress}</div>
          </div>
        )}
        {v.notes && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}><span className={styles.panelTitle}>Internal Notes</span></div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{v.notes}</div>
          </div>
        )}
        {!v.billingAddress && !v.city && !v.shippingAddress && !v.notes && (
          <div className={styles.panel} style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-tertiary)' }}>No additional details</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'contacts',   label: 'Contacts' },
  { key: 'bank',       label: 'Bank Accounts' },
  { key: 'orders',     label: 'Purchase Orders' },
  { key: 'documents',  label: 'Documents' },
  { key: 'notes',      label: 'Notes & Activity' },
]

// ── Main view ─────────────────────────────────────────────────────────────────
interface Props {
  vendor:    VendorDetail
  activeTab: string
  notes:     VendorNote[]
  documents: VendorDocument[]
  activity:  ActivityItem[]
  canEdit:   boolean
  canDelete: boolean
}

export function VendorDetailView({ vendor: v, activeTab, notes, documents, activity, canEdit, canDelete }: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const sp        = useSearchParams()
  const [, start] = useTransition()

  function setTab(tab: string) {
    const next = new URLSearchParams(sp.toString())
    next.set('tab', tab)
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  function handleDelete() {
    if (!confirm(`Delete "${v.name}"? This cannot be undone.`)) return
    start(async () => {
      const res = await deleteVendor(v.id)
      if (!res.ok) {
        alert(`Delete failed: ${res.error?.message ?? 'Unknown error'}`)
        return
      }
      router.push('/vendors')
    })
  }

  return (
    <div className={styles.page}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          <div className={styles.detailAvatar}>{v.name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('')}</div>
          <div>
            <div className={styles.detailName}>{v.name}</div>
            <div className={styles.detailMeta}>
              <span className={styles.detailCode}>{v.code}</span>
              <span className={styles.detailSep}>·</span>
              <span className={styles.typeBadge}>{VENDOR_TYPE_LABELS[v.type as keyof typeof VENDOR_TYPE_LABELS] ?? v.type}</span>
              <StatusBadge status={v.status} />
              {v.industry && <><span className={styles.detailSep}>·</span><span className={styles.detailIndustry}>{v.industry}</span></>}
            </div>
          </div>
        </div>

        <div className={styles.detailHeaderActions}>
          {canEdit && (
            <Link href={`/vendors/${v.id}/edit` as Route} className={styles.btnOutline}>
              <Icon name="pencil" size={14} /> Edit
            </Link>
          )}
          {canDelete && (
            <button className={`${styles.btnOutline} ${styles.btnDangerOutline}`} onClick={handleDelete}>
              <Icon name="trash" size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className={styles.tabStrip}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={styles.tabBtn}
            data-active={activeTab === t.key ? 'true' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className={styles.tabContent}>
        {activeTab === 'overview'  && <OverviewTab v={v} />}
        {activeTab === 'contacts'  && <ContactsSection vendorId={v.id} contacts={v.contacts} canEdit={canEdit} />}
        {activeTab === 'bank'      && <BankAccountsSection vendorId={v.id} bankAccounts={v.bankAccounts} canEdit={canEdit} />}
        {activeTab === 'orders'    && <PurchaseOrdersTab vendorId={v.id} />}
        {activeTab === 'documents' && <DocumentsSection vendorId={v.id} documents={documents} canEdit={canEdit} />}
        {activeTab === 'notes'     && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <NotesSection vendorId={v.id} notes={notes} canEdit={canEdit} />
            <div className={styles.panel}>
              <div className={styles.panelHeader}><span className={styles.panelTitle}>Activity Log</span></div>
              <ActivityTimeline items={activity} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
