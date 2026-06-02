'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { InvoiceDetail } from '../server/queries'
import { InvoiceHeaderCard }        from './invoice-header-card'
import { InvoiceFinancialsCard }    from './invoice-financials-card'
import { InvoiceItemsTab }          from './invoice-items-tab'
import { InvoicePaymentsTab }       from './invoice-payments-tab'
import { InvoiceStatusHistoryTab }  from './invoice-status-history-tab'
import { InvoiceStatusActions }     from './invoice-status-actions'
import { Icon } from '@/components/ui'
import styles from './invoices.module.scss'

type Tab = 'items' | 'payments' | 'history'

type LinkedPo = { id: string; poNo: string; vendorName: string; status: string; grandTotal: number }
type LinkedChallan = { id: string; dcNo: string; status: string; dispatchDate: string | null }

interface Props {
  inv:              InvoiceDetail
  canEdit:          boolean
  canIssue:         boolean
  canDelete:        boolean
  linkedPos?:       LinkedPo[]
  canCreatePo?:     boolean
  linkedChallans?:  LinkedChallan[]
  canCreateDc?:     boolean
}

const fmtINR = (n: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(n)}`

const DC_STATUS_COLORS: Record<string, string> = {
  draft: 'var(--c-secondary)', dispatched: '#1a5ba0', delivered: 'var(--c-success)', cancelled: 'var(--c-danger)',
}

export function InvoiceDetailView({ inv, canEdit, canIssue, canDelete, linkedPos = [], canCreatePo = false, linkedChallans = [], canCreateDc = false }: Props) {
  const [tab, setTab] = useState<Tab>('items')

  return (
    <div className={styles.detailLayout}>
      <nav className={styles.breadcrumb}>
        <Link href="/invoices" className={styles.breadcrumbLink}>Invoices</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{inv.invoiceNo}</span>
      </nav>

      <div className={styles.detailTop}>
        <div className={styles.detailMain}>
          <InvoiceHeaderCard inv={inv} />
          <InvoiceStatusActions
            invId={inv.id}
            status={inv.status}
            canEdit={canEdit}
            canIssue={canIssue}
            canDelete={canDelete}
          />
        </div>
        <div className={styles.detailSide}>
          <InvoiceFinancialsCard inv={inv} />
          <Link
            href={`/invoices/${inv.id}/preview` as Route}
            className={styles.btnSecondary}
            style={{ marginTop: 12, display:'flex', alignItems:'center', gap:6 }}
          >
            <Icon name="file-text" size={14} /> Preview / Print
          </Link>

          {/* Purchase Orders section */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily:'var(--font-body)', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--c-tertiary)', fontWeight:500, marginBottom:8 }}>
              Purchase Orders
            </div>
            {linkedPos.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {linkedPos.map(po => (
                  <Link
                    key={po.id}
                    href={`/purchase-orders/${po.id}` as Route}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'8px 12px', background:'var(--c-surface)',
                      border:'1px solid var(--c-border)', borderRadius:'var(--radius-sm)',
                      textDecoration:'none', gap:8,
                    }}
                  >
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--c-tertiary)' }}>{po.poNo}</span>
                      <span style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-ink)', fontWeight:500 }}>{po.vendorName}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                      <span style={{ fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', padding:'2px 6px', background:'var(--c-surface-2)', color:'var(--c-secondary)', borderRadius:2, border:'1px solid var(--c-border)' }}>
                        {po.status.replace('_', ' ')}
                      </span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--c-secondary)' }}>{fmtINR(po.grandTotal)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : canCreatePo ? (
              <Link
                href={`/purchase-orders/new?invoiceId=${inv.id}` as Route}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  padding:'9px 14px', background:'var(--c-ink)', color:'var(--c-inverse)',
                  border:'none', borderRadius:'var(--radius-sm)', textDecoration:'none',
                  fontFamily:'var(--font-body)', fontSize:11, fontWeight:500,
                  letterSpacing:'0.08em', textTransform:'uppercase',
                }}
              >
                + Create Purchase Order
              </Link>
            ) : (
              <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-tertiary)', padding:'8px 0' }}>
                No purchase orders yet.
              </div>
            )}
          </div>

          {/* ── Delivery Challans section ─────────────── */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily:'var(--font-body)', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--c-tertiary)', fontWeight:500, marginBottom:8 }}>
              Delivery Challans
            </div>
            {linkedChallans.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {linkedChallans.map(dc => (
                  <Link
                    key={dc.id}
                    href={`/delivery-challans/${dc.id}` as Route}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'8px 12px', background:'var(--c-surface)',
                      border:'1px solid var(--c-border)', borderRadius:'var(--radius-sm)',
                      textDecoration:'none', gap:8,
                    }}
                  >
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--c-tertiary)' }}>{dc.dcNo}</span>
                      {dc.dispatchDate && <span style={{ fontFamily:'var(--font-body)', fontSize:11, color:'var(--c-secondary)' }}>
                        Dispatched: {new Date(dc.dispatchDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                      </span>}
                    </div>
                    <span style={{ fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', padding:'2px 6px', background:'var(--c-surface-2)', color: DC_STATUS_COLORS[dc.status] ?? 'var(--c-secondary)', borderRadius:2, border:'1px solid var(--c-border)', whiteSpace:'nowrap' }}>
                      {dc.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : canCreateDc ? (
              <Link
                href={`/delivery-challans/new?invoiceId=${inv.id}` as Route}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  padding:'9px 14px', background:'var(--c-ink)', color:'var(--c-inverse)',
                  border:'none', borderRadius:'var(--radius-sm)', textDecoration:'none',
                  fontFamily:'var(--font-body)', fontSize:11, fontWeight:500,
                  letterSpacing:'0.08em', textTransform:'uppercase',
                }}
              >
                + Create Delivery Challan
              </Link>
            ) : (
              <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-tertiary)', padding:'8px 0' }}>
                No delivery challans yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        {(['items','payments','history'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
            type="button"
          >
            {t === 'items' ? 'Line Items'
              : t === 'payments' ? `Payments (${inv.payments.length})`
              : 'Status History'}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === 'items'    && <InvoiceItemsTab         inv={inv} canEdit={canEdit && inv.status === 'draft'} />}
        {tab === 'payments' && <InvoicePaymentsTab       inv={inv} canEdit={canEdit} />}
        {tab === 'history'  && <InvoiceStatusHistoryTab  history={inv.statusHistory} />}
      </div>
    </div>
  )
}
