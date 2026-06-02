'use client'

import React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { DcDetail } from '../server/queries'
import { DC_STATUS_LABELS } from '@/validations/delivery-challan'

// ─── Design tokens ────────────────────────────────────────────────────────────
const FONT  = "'Noto Serif JP', Georgia, serif"
const MONO  = "'JetBrains Mono', 'Courier New', monospace"
const BLACK = '#0a0a0a'
const MID   = '#444444'
const MUTED = '#777777'
const LIGHT = '#aaaaaa'
const RULE  = '#d4d0cb'
const BGROW = '#f8f7f4'
const WHITE = '#ffffff'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

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
  return <th style={{ padding:'5px 10px', fontFamily:FONT, fontSize:7.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:MUTED, background:BGROW, borderBottom:`1px solid ${RULE}`, ...style }}>{children}</th>
}
function TD({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding:'7px 10px', verticalAlign:'middle', fontSize:10, ...style }}>{children}</td>
}

// ─── Print bar ────────────────────────────────────────────────────────────────
export function DcPreviewPrintBar({ dcId, dcNo }: { dcId: string; dcNo: string }) {
  const [info, setInfo] = React.useState('Print → Destination → Save as PDF')
  const doPrint = () => { setInfo('Printing…'); window.print(); setTimeout(() => setInfo('Print → Destination → Save as PDF'), 800) }
  return (
    <div className="no-print" style={{ position:'sticky', top:0, zIndex:200, height:48, background:BLACK, display:'flex', alignItems:'center', gap:14, padding:'0 24px', flexShrink:0 }}>
      <button onClick={doPrint} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:WHITE, color:BLACK, border:'none', fontFamily:FONT, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', cursor:'pointer' }}>
        ⎙ Print / Save as PDF
      </button>
      <Link href={`/delivery-challans/${dcId}` as Route} style={{ color:'#888', textDecoration:'none', fontFamily:FONT, fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase' }}>Close</Link>
      <span style={{ flex:1 }} />
      <span style={{ color:'#555', fontSize:10, fontFamily:FONT }}>{dcNo} · {info}</span>
    </div>
  )
}

// ─── Main preview ─────────────────────────────────────────────────────────────
interface Props { dc: DcDetail; orgName: string; orgAddress?: string; orgGstin?: string; logoUrl?: string | null }

export function DcPreview({ dc, orgName, orgAddress, orgGstin, logoUrl }: Props) {
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
            <div style={{ fontFamily:FONT, fontSize:8, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:6 }}>Delivery Challan</div>
            <div style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color:BLACK, letterSpacing:'-0.01em' }}>{dc.dcNo}</div>
            <div style={{ fontFamily:FONT, fontSize:10, color:MID, marginTop:8 }}>
              <Row2 label="Date"           value={fmtDate(dc.date)} />
              {dc.dispatchDate && <Row2 label="Dispatch Date"  value={fmtDate(dc.dispatchDate)} />}
              {dc.expectedDelivery && <Row2 label="Expected Delivery" value={fmtDate(dc.expectedDelivery)} />}
              <Row2 label="Invoice Ref"    value={dc.invoiceNo} />
              <Row2 label="Status"         value={(DC_STATUS_LABELS[dc.status] ?? dc.status).toUpperCase()} />
            </div>
          </div>
        </div>

        <div style={{ borderTop:`1.5px solid ${BLACK}`, marginBottom:12 }} />

        {/* ── CONSIGNEE / DELIVER TO ───────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
          <div>
            <SectionLabel>Consignee</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color:BLACK, marginBottom:3 }}>{dc.customerName ?? '—'}</div>
            {dc.customerPhone && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>{dc.customerPhone}</div>}
            {dc.customerEmail && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>{dc.customerEmail}</div>}
          </div>
          {dc.deliveryAddress && (
            <div>
              <SectionLabel>Deliver To</SectionLabel>
              <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{dc.deliveryAddress}</div>
              {dc.siteContactName && (
                <div style={{ fontFamily:FONT, fontSize:11, color:MID, marginTop:4 }}>
                  Contact: {dc.siteContactName}{dc.siteContactPhone ? ` · ${dc.siteContactPhone}` : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DISPATCH DETAILS ─────────────────────────────────────── */}
        {(dc.vehicleNo || dc.driverName || dc.lrNo || dc.transporterName) && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
            {dc.vehicleNo && (
              <div>
                <SectionLabel>Vehicle No.</SectionLabel>
                <div style={{ fontFamily:MONO, fontSize:12, fontWeight:600, color:BLACK }}>{dc.vehicleNo}</div>
              </div>
            )}
            {dc.driverName && (
              <div>
                <SectionLabel>Driver</SectionLabel>
                <div style={{ fontFamily:FONT, fontSize:12, color:BLACK }}>{dc.driverName}</div>
              </div>
            )}
            {dc.lrNo && (
              <div>
                <SectionLabel>LR / Bilty No.</SectionLabel>
                <div style={{ fontFamily:MONO, fontSize:12, fontWeight:600, color:BLACK }}>{dc.lrNo}</div>
              </div>
            )}
            {dc.transporterName && (
              <div>
                <SectionLabel>Transporter</SectionLabel>
                <div style={{ fontFamily:FONT, fontSize:12, color:BLACK }}>{dc.transporterName}</div>
              </div>
            )}
          </div>
        )}

        {/* ── ITEMS TABLE ──────────────────────────────────────────── */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${RULE}`, background:BGROW }}>
              <TH style={{ width:'5%', textAlign:'left' }}>#</TH>
              <TH style={{ width:'38%', textAlign:'left' }}>Description of Goods</TH>
              <TH style={{ width:'12%', textAlign:'left' }}>HSN/SAC</TH>
              <TH style={{ width:'10%', textAlign:'center' }}>Unit</TH>
              <TH style={{ width:'12%', textAlign:'right' }}>Invoice Qty</TH>
              <TH style={{ width:'13%', textAlign:'right' }}>Qty Dispatched</TH>
              <TH style={{ width:'10%', textAlign:'center' }}>Remarks</TH>
            </tr>
          </thead>
          <tbody>
            {dc.items.map((item, i) => (
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
                <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:BLACK, fontSize:12 }}>{item.qtyDispatched}</TD>
                <TD style={{ textAlign:'center', color:MUTED }}>—</TD>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS SUMMARY ───────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10, paddingTop:8, borderTop:`1px solid ${RULE}` }}>
          <div style={{ fontFamily:FONT, fontSize:10, color:MID }}>
            Total Items: <strong style={{ fontFamily:MONO, color:BLACK }}>{dc.items.length}</strong>
            <span style={{ marginLeft:16 }}>
              Total Qty Dispatched: <strong style={{ fontFamily:MONO, color:BLACK }}>{dc.items.reduce((s, i) => s + i.qtyDispatched, 0)}</strong>
            </span>
          </div>
        </div>

        {/* ── NOTES ────────────────────────────────────────────────── */}
        {dc.notes && (
          <div style={{ marginTop:14, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{dc.notes}</div>
          </div>
        )}

        {/* ── DECLARATION ──────────────────────────────────────────── */}
        <div style={{ marginTop:16, padding:'10px 14px', background:BGROW, borderRadius:3, border:`1px solid ${RULE}` }}>
          <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, fontStyle:'italic' }}>
            Declaration: The goods described above are dispatched in good condition and as per the details of Invoice No. {dc.invoiceNo}.
          </div>
        </div>

        {/* ── SIGNATURE ────────────────────────────────────────────── */}
        <div style={{ marginTop:28, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:32 }}>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Prepared By</div>
          </div>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Authorised Signatory</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{orgName}</div>
          </div>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Receiver's Signature</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{dc.customerName ?? ''}</div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop:20, borderTop:`1px solid ${RULE}`, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT }}>{orgName} · {dc.dcNo} · {fmtDate(dc.date)}</span>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT }}>E &amp; OE · This is a computer-generated Delivery Challan</span>
        </div>
      </div>
    </div>
  )
}
