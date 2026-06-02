'use client'

import React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { PoDetail } from '../server/queries'
import { PO_STATUS_LABELS } from '@/validations/purchase-order'

// ─── Design tokens (identical to quote/SO/invoice previews) ───────────────────
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
  new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', minimumFractionDigits:2 }).format(n)

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

// ─── A4 page ──────────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  width:794, minHeight:1123, padding:'28px 36px', background:WHITE, color:BLACK,
  fontFamily:FONT, boxSizing:'border-box',
  boxShadow:'0 4px 32px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
  position:'relative', flexShrink:0,
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:8 }}>{children}</div>
}
function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:2 }}>
      <span style={{ fontFamily:FONT, fontSize:10, color:LIGHT }}>{label}</span>
      <span style={{ fontFamily:FONT, fontSize:10, fontWeight:600, color:BLACK }}>{value}</span>
    </div>
  )
}
function TH({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding:'5px 8px', fontFamily:FONT, fontSize:7.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:MUTED, background:BGROW, borderBottom:`1px solid ${RULE}`, whiteSpace:'nowrap', ...style }}>{children}</th>
}
function TD({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding:'6px 8px', verticalAlign:'middle', fontSize:10, ...style }}>{children}</td>
}

// ─── Print bar ────────────────────────────────────────────────────────────────
export function PoPreviewPrintBar({ poId, poNo }: { poId: string; poNo: string }) {
  const [info, setInfo] = React.useState('Print → Destination → Save as PDF')
  const doPrint = () => { setInfo('Printing…'); window.print(); setTimeout(() => setInfo('Print → Destination → Save as PDF'), 800) }
  return (
    <div className="no-print" style={{ position:'sticky', top:0, zIndex:200, height:48, background:BLACK, display:'flex', alignItems:'center', gap:14, padding:'0 24px', flexShrink:0 }}>
      <button onClick={doPrint} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:WHITE, color:BLACK, border:'none', fontFamily:FONT, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', cursor:'pointer' }}>
        ⎙ Print / Save as PDF
      </button>
      <Link href={`/purchase-orders/${poId}` as Route} style={{ color:'#888', textDecoration:'none', fontFamily:FONT, fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase' }}>
        Close
      </Link>
      <span style={{ flex:1 }} />
      <span style={{ color:'#555', fontSize:10, fontFamily:FONT, letterSpacing:'0.04em' }}>{poNo} · {info}</span>
    </div>
  )
}

// ─── Main preview ─────────────────────────────────────────────────────────────
interface Props { po: PoDetail; orgName: string; orgAddress?: string; orgGstin?: string; logoUrl?: string | null }

export function PoPreview({ po, orgName, orgAddress, orgGstin, logoUrl }: Props) {
  const itemsWithOrder = po.items.filter(i => i.qtyOrdered > 0)

  return (
    <div style={{ fontFamily:FONT, color:BLACK, display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
      <div className="print-page" style={pageStyle}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div style={{ maxWidth:280 }}>
            {logoUrl
              ? <img src={logoUrl} alt={orgName} style={{ maxHeight:44, maxWidth:160, objectFit:'contain', display:'block', marginBottom:4 }} />
              : <div style={{ fontFamily:FONT, fontSize:22, fontWeight:700, color:BLACK, lineHeight:1.1, letterSpacing:'-0.02em' }}>{orgName}</div>
            }
            <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>{orgName}</div>
            {orgAddress && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:4, lineHeight:1.6 }}>{orgAddress}</div>}
            {orgGstin   && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:3 }}>GSTIN: {orgGstin}</div>}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:FONT, fontSize:8, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:6 }}>Purchase Order</div>
            <div style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color:BLACK, letterSpacing:'-0.01em' }}>{po.poNo}</div>
            <div style={{ fontFamily:FONT, fontSize:10, color:MID, marginTop:8 }}>
              <Row2 label="Date"          value={fmtDate(po.date)} />
              <Row2 label="Invoice Ref"   value={po.invoiceNo} />
              {po.expectedDelivery && <Row2 label="Expected Delivery" value={fmtDate(po.expectedDelivery)} />}
              {po.customerRef && <Row2 label="For Customer" value={po.customerRef} />}
              <Row2 label="Status" value={(PO_STATUS_LABELS[po.status] ?? po.status).toUpperCase()} />
            </div>
          </div>
        </div>

        {/* RULE */}
        <div style={{ borderTop:`1.5px solid ${BLACK}`, marginBottom:12 }} />

        {/* ── VENDOR / TERMS ──────────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
          <div>
            <SectionLabel>Vendor (Bill To)</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color:BLACK, marginBottom:3 }}>{po.vendorName}</div>
            {po.vendorPhone && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>{po.vendorPhone}</div>}
            {po.vendorEmail && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>{po.vendorEmail}</div>}
            {po.vendorGstin && <div style={{ fontFamily:FONT, fontSize:10, color:LIGHT, marginTop:4 }}>GSTIN: {po.vendorGstin}</div>}
          </div>
          <div>
            <SectionLabel>Order Terms</SectionLabel>
            {po.paymentTerms && <div style={{ fontFamily:FONT, fontSize:12, color:MID, marginBottom:4 }}>Payment: {po.paymentTerms}</div>}
            <div style={{ fontFamily:FONT, fontSize:11, color:MUTED }}>{po.isIgst ? 'IGST Applicable (Inter-state)' : 'CGST + SGST Applicable (Intra-state)'}</div>
            {po.subject && <div style={{ fontFamily:FONT, fontSize:12, fontWeight:600, color:BLACK, marginTop:6 }}>{po.subject}</div>}
          </div>
        </div>

        {/* ── ITEMS TABLE ──────────────────────────────────────────────── */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${RULE}`, background:BGROW }}>
              <TH style={{ width:'4%', textAlign:'left' }}>#</TH>
              <TH style={{ width:'25%', textAlign:'left' }}>Item / Description</TH>
              <TH style={{ width:'8%', textAlign:'left' }}>HSN</TH>
              <TH style={{ width:'6%', textAlign:'center' }}>Unit</TH>
              <TH style={{ width:'7%', textAlign:'right' }}>Invoice Qty</TH>
              <TH style={{ width:'8%', textAlign:'right' }}>Order Qty</TH>
              <TH style={{ width:'10%', textAlign:'right' }}>Rate (₹)</TH>
              <TH style={{ width:'6%', textAlign:'right' }}>Disc%</TH>
              <TH style={{ width:'10%', textAlign:'right' }}>Taxable (₹)</TH>
              {po.isIgst ? (
                <><TH style={{ width:'6%', textAlign:'right' }}>IGST%</TH><TH style={{ width:'10%', textAlign:'right' }}>IGST (₹)</TH></>
              ) : (
                <><TH style={{ width:'5%', textAlign:'right' }}>GST%</TH><TH style={{ width:'8%', textAlign:'right' }}>Tax (₹)</TH></>
              )}
              <TH style={{ width:'10%', textAlign:'right' }}>Total (₹)</TH>
            </tr>
          </thead>
          <tbody>
            {(itemsWithOrder.length > 0 ? itemsWithOrder : po.items).map((item, i) => (
              <tr key={item.id} style={{ borderBottom:`1px solid ${RULE}` }}>
                <TD style={{ color:MUTED }}>{i + 1}</TD>
                <TD style={{ fontWeight:600, color:BLACK, lineHeight:1.5 }}>
                  {item.name}
                  {item.description && <div style={{ fontWeight:400, fontSize:9, color:MUTED, marginTop:2 }}>{item.description}</div>}
                  {item.brand && <div style={{ fontWeight:400, fontSize:9, color:LIGHT, marginTop:1 }}>{item.brand}</div>}
                </TD>
                <TD style={{ fontFamily:MONO, color:MUTED, fontSize:9 }}>{item.hsnCode || '—'}</TD>
                <TD style={{ textAlign:'center', color:MID }}>{item.unit || '—'}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO, color:MUTED }}>{item.invoiceQty}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700 }}>{item.qtyOrdered}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.rate)}</TD>
                <TD style={{ textAlign:'right' }}>{item.discountPct > 0 ? `${item.discountPct}%` : '—'}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.taxableValue)}</TD>
                {po.isIgst ? (
                  <><TD style={{ textAlign:'right' }}>{item.igstPct}%</TD><TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.igstAmount)}</TD></>
                ) : (
                  <><TD style={{ textAlign:'right' }}>{item.gstPct}%</TD><TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.cgstAmount + item.sgstAmount)}</TD></>
                )}
                <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:BLACK }}>{fmtINR(item.total)}</TD>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS ───────────────────────────────────────────────────── */}
        <div style={{ maxWidth:300, marginLeft:'auto', marginTop:12, display:'flex', flexDirection:'column' }}>
          {[
            { l:'Material Subtotal',                           v: fmtINR(po.taxableValue) },
            ...(po.transport > 0 ? [{ l:`Transport${po.transportNote ? ` — ${po.transportNote}` : ''}`, v: fmtINR(po.transport) }] : []),
            ...(po.isIgst ? [{ l:`IGST (${po.gstPct}%)`, v: fmtINR(po.igstAmount) }]
              : [{ l:`CGST (${po.gstPct/2}%)`, v: fmtINR(po.cgstAmount) }, { l:`SGST (${po.gstPct/2}%)`, v: fmtINR(po.sgstAmount) }]),
          ].map((r, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:11, color:MID }}>
              <span>{r.l}</span>
              <span style={{ fontFamily:MONO, color:BLACK }}>{r.v}</span>
            </div>
          ))}
          <div style={{ borderTop:`1.5px solid ${BLACK}`, marginTop:6, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:BLACK }}>Grand Total</span>
            <span style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:BLACK }}>{fmtINR(po.grandTotal)}</span>
          </div>
        </div>

        {/* ── NOTES & TERMS ────────────────────────────────────────────── */}
        {po.notes && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{po.notes}</div>
          </div>
        )}
        {po.terms && po.terms.length > 0 && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Terms &amp; Conditions</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
              {po.terms.map((t, i) => (
                <div key={i} style={{ display:'flex', alignItems:'baseline', gap:12 }}>
                  <span style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:BLACK, flexShrink:0, borderBottom:`1px solid ${BLACK}`, paddingBottom:1, minWidth:70 }}>{t.category}</span>
                  <span style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.6 }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SIGNATURE ────────────────────────────────────────────────── */}
        <div style={{ marginTop:28, display:'grid', gridTemplateColumns:'1fr 1fr', gap:40 }}>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Authorised Signatory</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{orgName}</div>
          </div>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Vendor Acknowledgement</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{po.vendorName}</div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop:20, borderTop:`1px solid ${RULE}`, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>{orgName} · {po.poNo} · {fmtDate(po.date)}</span>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>This is a computer-generated Purchase Order</span>
        </div>
      </div>
    </div>
  )
}
