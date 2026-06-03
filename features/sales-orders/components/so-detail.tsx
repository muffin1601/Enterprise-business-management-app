'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { SoDetail } from '../server/queries'
import { SoHeaderCard }       from './so-header-card'
import { SoFinancialsCard }   from './so-financials-card'
import { SoLocationsTab }     from './so-locations-tab'
import { SoStatusHistoryTab } from './so-status-history-tab'
import { SoAdvanceTab }       from './so-advance-tab'
import { SoDeliveryTab }      from './so-delivery-tab'
import { SoStatusActions }    from './so-status-actions'
import { Icon } from '@/components/ui'
import { INV_STATUS_LABELS } from '@/validations/invoice'
import styles from './sales-orders.module.scss'

type Tab = 'items' | 'delivery' | 'advance' | 'history'

type LinkedRi = { id: string; riNo: string; status: string; grandTotal: number; date: string }

const RI_STATUS_LABELS_SIMPLE: Record<string, string> = {
  draft: 'Draft', validated: 'Validated', posted: 'Posted', sent: 'Sent', cancelled: 'Cancelled',
}

interface Props {
  so:               SoDetail
  canEdit:          boolean
  canDelete:        boolean
  linkedInvoice?:   { id: string; invoiceNo: string; status: string } | null
  canCreateInvoice?:boolean
  linkedRis?:       LinkedRi[]
  canCreateRi?:     boolean
}

export function SoDetail({ so, canEdit, canDelete, linkedInvoice, canCreateInvoice, linkedRis = [], canCreateRi = false }: Props) {
  const [tab, setTab] = useState<Tab>('items')

  return (
    <div className={styles.detailLayout}>
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <nav className={styles.breadcrumb}>
        <Link href="/orders" className={styles.breadcrumbLink}>Sales Orders</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{so.soNo}</span>
      </nav>

      {/* ── Top section: header + actions + financials ─── */}
      <div className={styles.detailTop}>
        <div className={styles.detailMain}>
          <SoHeaderCard so={so} />
          <SoStatusActions
            soId={so.id}
            status={so.status}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
        <div className={styles.detailSide}>
          <SoFinancialsCard so={so} />
          <Link href={`/orders/${so.id}/preview` as Route} className={styles.btnSecondary} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="file-text" size={14} /> Preview / Print
          </Link>

          {/* Invoice section */}
          <div style={{ marginTop: 12 }}>
            {linkedInvoice ? (
              <Link
                href={`/invoices/${linkedInvoice.id}` as Route}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--c-success-bg)',
                  border: '1px solid var(--c-success)', borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none', gap: 8,
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--c-success)' }}>
                  Invoice: {linkedInvoice.invoiceNo}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--c-success)', opacity: 0.8 }}>
                  {INV_STATUS_LABELS[linkedInvoice.status] ?? linkedInvoice.status} →
                </span>
              </Link>
            ) : canCreateInvoice && !['cancelled'].includes(so.status) ? (
              <Link
                href={`/invoices/new?soId=${so.id}` as Route}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 14px', background: 'var(--c-ink)', color: 'var(--c-inverse)',
                  border: '1px solid var(--c-ink)', borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none', fontFamily: 'var(--font-body)',
                  fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >
                + Create Invoice
              </Link>
            ) : null}
          </div>

          {/* Running Invoices section */}
          {(linkedRis.length > 0 || canCreateRi) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily:'var(--font-body)', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--c-tertiary)', fontWeight:500, marginBottom:8 }}>
                Running Invoices
              </div>
              {linkedRis.length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {linkedRis.map(ri => (
                    <Link
                      key={ri.id}
                      href={`/running-invoices/${ri.id}` as Route}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'7px 11px', background:'var(--c-surface)',
                        border:'1px solid var(--c-border)', borderRadius:'var(--radius-sm)',
                        textDecoration:'none', gap:8,
                      }}
                    >
                      <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--c-tertiary)' }}>{ri.riNo}</span>
                        <span style={{ fontFamily:'var(--font-body)', fontSize:11, color:'var(--c-secondary)' }}>
                          {new Date(ri.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                        </span>
                      </div>
                      <span style={{ fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', padding:'2px 6px', background:'var(--c-surface-2)', color:'var(--c-secondary)', borderRadius:2, border:'1px solid var(--c-border)', whiteSpace:'nowrap' }}>
                        {RI_STATUS_LABELS_SIMPLE[ri.status] ?? ri.status}
                      </span>
                    </Link>
                  ))}
                  {canCreateRi && ['dispatched','delivered'].includes(so.status) && (
                    <Link
                      href={`/running-invoices/new?soId=${so.id}` as Route}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'7px', border:'1px dashed var(--c-border-2)', borderRadius:'var(--radius-sm)', textDecoration:'none', fontFamily:'var(--font-body)', fontSize:11, color:'var(--c-tertiary)' }}
                    >
                      + Another
                    </Link>
                  )}
                </div>
              ) : canCreateRi && ['dispatched','delivered'].includes(so.status) ? (
                <Link
                  href={`/running-invoices/new?soId=${so.id}` as Route}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    padding:'9px 14px', background:'var(--c-ink)', color:'var(--c-inverse)',
                    border:'none', borderRadius:'var(--radius-sm)', textDecoration:'none',
                    fontFamily:'var(--font-body)', fontSize:11, fontWeight:500,
                    letterSpacing:'0.08em', textTransform:'uppercase',
                  }}
                >
                  + Create Running Invoice
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className={styles.tabs}>
        {(['items', 'delivery', 'advance', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
            type="button"
          >
            {t === 'items'    ? 'Items & Locations'
            : t === 'delivery' ? 'Delivery'
            : t === 'advance'  ? 'Advance Payment'
            : 'Status History'}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === 'items'    && <SoLocationsTab     so={so} canEdit={canEdit} />}
        {tab === 'delivery' && <SoDeliveryTab       so={so} canEdit={canEdit} />}
        {tab === 'advance'  && <SoAdvanceTab        so={so} canEdit={canEdit} />}
        {tab === 'history'  && <SoStatusHistoryTab  history={so.statusHistory} />}
      </div>

      {/* Internal notes (staff-only) */}
      {so.internalNotes && (
        <div className={styles.internalNotes}>
          <span className={styles.metaLabel}>Internal Notes (Staff Only)</span>
          <p className={styles.notesText}>{so.internalNotes}</p>
        </div>
      )}
    </div>
  )
}
