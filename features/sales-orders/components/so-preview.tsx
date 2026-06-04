'use client'

import React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { SoDetail } from '../server/queries'
import { SO_STATUS_LABELS } from '@/validations/sales-order'

// ─── Design tokens (identical to quote-preview) ───────────────────────────────
const FONT  = "'Noto Serif JP', Georgia, serif"
const MONO  = "'JetBrains Mono', 'Courier New', monospace"
const BLACK = '#0a0a0a'
const MID   = '#444444'
const MUTED = '#777777'
const LIGHT = '#aaaaaa'
const RULE  = '#d4d0cb'
const BGROW = '#f8f7f4'
const WHITE = '#ffffff'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── A4 page card ─────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  width: 794,
  minHeight: 1123,
  padding: '28px 36px',
  background: WHITE,
  color: BLACK,
  fontFamily: FONT,
  boxSizing: 'border-box',
  boxShadow: '0 4px 32px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
  position: 'relative',
  flexShrink: 0,
}

// ─── Primitive helpers ────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:8 }}>
      {children}
    </div>
  )
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:2 }}>
      <span style={{ fontFamily:FONT, fontSize:10, color:LIGHT, letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontFamily:FONT, fontSize:10, fontWeight:600, color:BLACK }}>{value}</span>
    </div>
  )
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:11, color: muted ? MUTED : MID }}>
      <span>{label}</span>
      <span style={{ fontFamily:MONO, color: muted ? MUTED : BLACK }}>{value}</span>
    </div>
  )
}

function TH({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding:'7px 10px', fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:MUTED, background:BGROW, borderBottom:`1px solid ${RULE}`, ...style }}>
      {children}
    </th>
  )
}

function TD({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding:'9px 10px', fontFamily:FONT, fontSize:11, verticalAlign:'top', borderBottom:`1px solid ${RULE}`, ...style }}>
      {children}
    </td>
  )
}

// ─── Print bar ────────────────────────────────────────────────────────────────

export function SoPreviewPrintBar({ soId, soNo }: { soId: string; soNo: string }) {
  const [info, setInfo] = React.useState('Print → Destination → Save as PDF')

  const doPrint = () => {
    setInfo('Printing…')
    window.print()
    setTimeout(() => setInfo('Print → Destination → Save as PDF'), 800)
  }

  return (
    <div className="no-print" style={{
      position:'sticky', top:0, zIndex:200, height:48,
      background: BLACK, display:'flex', alignItems:'center', gap:14, padding:'0 24px',
      flexShrink:0, fontFamily: FONT,
    }}>
      <button onClick={doPrint} style={{
        display:'inline-flex', alignItems:'center', gap:6,
        padding:'8px 18px', background:WHITE, color:BLACK, border:'none',
        fontFamily:FONT, fontSize:11, fontWeight:700, letterSpacing:'0.10em',
        textTransform:'uppercase', cursor:'pointer',
      }}>
        ⎙ Print / Save as PDF
      </button>
      <Link href={`/orders/${soId}` as Route} style={{
        color:'#888', textDecoration:'none', fontFamily:FONT,
        fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase',
      }}>
        Close
      </Link>
      <span style={{ flex:1 }} />
      <span style={{ color:'#555', fontSize:10, fontFamily:FONT, letterSpacing:'0.04em' }}>
        {soNo} · {info}
      </span>
    </div>
  )
}

// ─── Location section ─────────────────────────────────────────────────────────

function LocationSection({ loc, idx, showDelivered }: {
  loc: SoDetail['locations'][number]
  idx: number
  showDelivered: boolean
}) {
  const items = [...loc.items].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="location-block" style={{ marginBottom: 12 }}>
      {/* Location header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'6px 0', borderBottom:`1.5px solid ${BLACK}`, marginBottom:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:MUTED }}>Area {idx + 1}</span>
          <span style={{ fontFamily:FONT, fontSize:13, fontWeight:700, color:BLACK, letterSpacing:'0.01em' }}>{loc.name}</span>
        </div>
        <span style={{ fontFamily:MONO, fontSize:12, fontWeight:600, color:BLACK }}>{fmtINR(loc.locationTotal)}</span>
      </div>

      {/* Items table */}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${RULE}`, background:BGROW }}>
            <TH style={{ width:'32%', textAlign:'left' }}>Item / Description</TH>
            <TH style={{ width:'12%', textAlign:'left' }}>Brand</TH>
            <TH style={{ width:'7%',  textAlign:'center' }}>Unit</TH>
            <TH style={{ width:'13%', textAlign:'right' }}>Rate (₹)</TH>
            <TH style={{ width:'7%',  textAlign:'center' }}>Qty</TH>
            {showDelivered && <TH style={{ width:'7%', textAlign:'center' }}>Del.</TH>}
            <TH style={{ width:'10%', textAlign:'right' }}>Disc %</TH>
            <TH style={{ width:'12%', textAlign:'right' }}>Total (₹)</TH>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} style={{ borderBottom:`1px solid ${RULE}` }}>
              <TD style={{ fontWeight:600, color:BLACK, lineHeight:1.5 }}>
                {item.name}
                {item.description && <div style={{ fontWeight:400, fontSize:10, color:MUTED, marginTop:2 }}>{item.description}</div>}
              </TD>
              <TD style={{ color:MID }}>{item.brand || '—'}</TD>
              <TD style={{ color:MID, textAlign:'center' }}>{item.unit || '—'}</TD>
              <TD style={{ textAlign:'right', fontFamily:MONO, color:BLACK }}>{fmtINR(item.rate)}</TD>
              <TD style={{ textAlign:'center', fontFamily:MONO }}>{item.qty}</TD>
              {showDelivered && (
                <TD style={{ textAlign:'center', fontFamily:MONO, color: item.qtyDelivered >= item.qty ? '#1a7a4a' : MUTED }}>
                  {item.qtyDelivered}
                </TD>
              )}
              <TD style={{ textAlign:'right' }}>
                {item.discountPct > 0
                  ? <><div style={{ fontFamily:MONO, fontWeight:600, color:BLACK }}>{item.discountPct}%</div>
                       <div style={{ fontFamily:MONO, fontSize:10, color:MUTED }}>−{fmtINR(item.rate * item.qty * (item.discountPct / 100))}</div></>
                  : <span style={{ color:RULE }}>—</span>
                }
              </TD>
              <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:BLACK }}>{fmtINR(item.total)}</TD>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Subtotals row */}
      <div style={{ borderBottom:`1px solid ${RULE}`, borderLeft:`1px solid ${RULE}`, borderRight:`1px solid ${RULE}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', borderBottom:`1px solid ${RULE}` }}>
          <span style={{ fontFamily:FONT, fontSize:10, color:MUTED }}>Material Subtotal — {loc.name}</span>
          <span style={{ fontFamily:MONO, fontSize:10, color:MID }}>{fmtINR(loc.materialSubtotal)}</span>
        </div>
        {loc.installationCharge > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', borderBottom:`1px solid ${RULE}` }}>
            <span style={{ fontFamily:FONT, fontSize:10, color:MUTED }}>
              Installation{loc.installationNote ? ` — ${loc.installationNote}` : ''}
            </span>
            <span style={{ fontFamily:MONO, fontSize:10, color:MID }}>{fmtINR(loc.installationCharge)}</span>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:BLACK }}>
          <span style={{ fontFamily:FONT, fontSize:9, fontWeight:700, color:WHITE, letterSpacing:'0.18em', textTransform:'uppercase' }}>
            Total — {loc.name}{loc.installationCharge > 0 ? ' (incl. installation)' : ''}
          </span>
          <span style={{ fontFamily:MONO, fontSize:13, fontWeight:700, color:WHITE }}>{fmtINR(loc.locationTotal)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main preview ─────────────────────────────────────────────────────────────

export function SoPreview({ so, orgName, orgAddress, orgGstin }: {
  so:          SoDetail
  orgName:     string
  orgAddress?: string
  orgGstin?:   string
}) {
  const included       = so.locations.filter(l => l.isIncluded).sort((a, b) => a.sortOrder - b.sortOrder)
  const grandMat       = included.reduce((s, l) => s + l.materialSubtotal, 0)
  const anyDelivered   = included.some(l => l.items.some(i => i.qtyDelivered > 0))
  const statusLabel    = SO_STATUS_LABELS[so.status] ?? so.status

  return (
    <div style={{ fontFamily:FONT, color:BLACK, display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
      <div className="print-page" style={pageStyle}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div style={{ maxWidth:280 }}>
            {so.logoUrl
              ? <img src={so.logoUrl} alt={orgName} style={{ maxHeight:44, maxWidth:160, objectFit:'contain', display:'block', marginBottom:4 }} />
              : <div style={{ fontFamily:FONT, fontSize:22, fontWeight:700, color:BLACK, lineHeight:1.1, letterSpacing:'-0.02em' }}>{orgName}</div>
            }
            <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>{orgName}</div>
            {orgAddress && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:4, lineHeight:1.6 }}>{orgAddress}</div>}
            {orgGstin   && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:3 }}>GSTIN: {orgGstin}</div>}
          </div>

          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:FONT, fontSize:8, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:6 }}>Sales Order</div>
            <div style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color:BLACK, letterSpacing:'-0.01em' }}>{so.soNo}</div>
            <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:3, letterSpacing:'0.05em' }}>Ref: {so.quoteNo}</div>
            <div style={{ fontFamily:FONT, fontSize:10, color:MID, marginTop:8 }}>
              <Row2 label="Date"    value={fmtDate(so.date)} />
              {so.expectedDelivery && <Row2 label="Expected Delivery" value={fmtDate(so.expectedDelivery)} />}
              <Row2 label="Status"  value={statusLabel.toUpperCase()} />
            </div>
          </div>
        </div>

        {/* RULE */}
        <div style={{ borderTop:`1.5px solid ${BLACK}`, marginBottom:12 }} />

        {/* ── BILL TO / DELIVER TO ──────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
          <div>
            <SectionLabel>Bill To</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color:BLACK, marginBottom:3 }}>{so.billToName ?? so.customerName ?? '—'}</div>
            {so.billToAddress && <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line', marginBottom:2 }}>{so.billToAddress}</div>}
            {(so.billToPhone ?? so.customerPhone) && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>{so.billToPhone ?? so.customerPhone}</div>}
            {(so.billToEmail ?? so.customerEmail) && <div style={{ fontFamily:FONT, fontSize:11, color:MUTED }}>{so.billToEmail ?? so.customerEmail}</div>}
            {so.billToGstin && <div style={{ fontFamily:FONT, fontSize:11, color:MUTED }}>GSTIN: {so.billToGstin}</div>}
          </div>
          <div>
            <SectionLabel>Deliver To</SectionLabel>
            {so.deliveryAddress
              ? <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{so.deliveryAddress}</div>
              : <div style={{ fontFamily:FONT, fontSize:11, color:LIGHT }}>—</div>
            }
            {so.siteContactName && (
              <div style={{ fontFamily:FONT, fontSize:11, color:MID, marginTop:4 }}>
                Contact: <strong>{so.siteContactName}</strong>
                {so.siteContactPhone ? ` · ${so.siteContactPhone}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Subject / project row */}
        {so.subject && (
          <div style={{ marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
            <SectionLabel>Subject / Project</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:13, fontWeight:600, color:BLACK }}>{so.subject}</div>
            {included.length > 0 && (
              <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:4 }}>
                {included.length} Area{included.length > 1 ? 's' : ''}: {included.map(l => l.name).join(' · ')}
              </div>
            )}
          </div>
        )}

        {/* ── LOCATION SECTIONS ────────────────────────────────────── */}
        {included.map((loc, i) => (
          <LocationSection key={loc.id} loc={loc} idx={i} showDelivered={anyDelivered} />
        ))}

        {/* ── TOTALS ───────────────────────────────────────────────── */}
        <div style={{ marginTop:10, borderTop:`1px solid ${RULE}`, paddingTop:8, pageBreakInside:'avoid' as const }}>
          <div style={{ maxWidth:300, marginLeft:'auto', display:'flex', flexDirection:'column' }}>
            <SummaryRow label="Material Subtotal"  value={fmtINR(grandMat)} />
            {so.transport > 0 && (
              <SummaryRow
                label={`Transport${so.transportNote ? ` — ${so.transportNote}` : ''}`}
                value={fmtINR(so.transport)}
              />
            )}
            {so.gstMode !== 'none' && (
              <SummaryRow
                label={`GST (${so.gstPct}%)${so.gstMode === 'inclusive' ? ' — Inclusive' : ''}`}
                value={fmtINR(so.gstAmount)}
              />
            )}
            <div style={{ borderTop:`1.5px solid ${BLACK}`, marginTop:6, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:BLACK }}>Grand Total</span>
              <span style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:BLACK }}>{fmtINR(so.grandTotal)}</span>
            </div>
            {so.gstMode === 'add' && (
              <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, textAlign:'right', marginTop:4, letterSpacing:'0.04em' }}>
                * GST {so.gstPct}% added on taxable amount
              </div>
            )}
            {so.advanceReceived && so.advanceAmount > 0 && (
              <>
                <SummaryRow label="Advance Received" value={`(${fmtINR(so.advanceAmount)})`} />
                <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontFamily:FONT, fontSize:11 }}>
                  <span style={{ color:MID }}>Balance Due</span>
                  <span style={{ fontFamily:MONO, fontWeight:700, color:BLACK }}>{fmtINR(Math.max(0, so.grandTotal - so.advanceAmount))}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── NOTES ────────────────────────────────────────────────── */}
        {so.notes && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{so.notes}</div>
          </div>
        )}

        {/* ── TERMS ────────────────────────────────────────────────── */}
        {so.terms.length > 0 && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Terms &amp; Conditions</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
              {so.terms.map((t, i) => (
                <div key={i} style={{ display:'flex', alignItems:'baseline', gap:12 }}>
                  <span style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:BLACK, flexShrink:0, borderBottom:`1px solid ${BLACK}`, paddingBottom:1, minWidth:70 }}>
                    {t.category}
                  </span>
                  <span style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.6 }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SIGNATURE ────────────────────────────────────────────── */}
        <div style={{ marginTop:32, display:'grid', gridTemplateColumns:'1fr 1fr', gap:48 }}>
          <div>
            <div style={{ height:40 }} />
            <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8, fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>
              Authorised Signatory
            </div>
          </div>
          <div>
            <div style={{ height:40 }} />
            <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8, fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>
              Customer Acknowledgement
            </div>
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <div style={{ marginTop:20, borderTop:`1px solid ${RULE}`, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>
            {orgName} · {so.soNo} · {fmtDate(so.date)}
          </span>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>Confidential</span>
        </div>

      </div>
    </div>
  )
}
