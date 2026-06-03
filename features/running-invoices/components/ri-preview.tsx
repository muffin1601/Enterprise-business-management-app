'use client'

import React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { RiDetail } from '../server/queries'
import { RI_STATUS_LABELS } from '@/validations/running-invoice'

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

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', minimumFractionDigits:2 }).format(n)

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits:3 }).format(n)

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const pageStyle: React.CSSProperties = {
  width:794, minHeight:1123, padding:'28px 36px', background:WHITE, color:BLACK, fontFamily:FONT,
  boxSizing:'border-box', boxShadow:'0 4px 32px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
  position:'relative', flexShrink:0,
}

function SL({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:8 }}>{children}</div>
}
function R2({ label, value }: { label: string; value: string }) {
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

export function RiPreviewPrintBar({ riId, riNo }: { riId: string; riNo: string }) {
  const [info, setInfo] = React.useState('Print → Destination → Save as PDF')
  const doPrint = () => { setInfo('Printing…'); window.print(); setTimeout(() => setInfo('Print → Destination → Save as PDF'), 800) }
  return (
    <div className="no-print" style={{ position:'sticky', top:0, zIndex:200, height:48, background:BLACK, display:'flex', alignItems:'center', gap:14, padding:'0 24px', flexShrink:0 }}>
      <button onClick={doPrint} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:WHITE, color:BLACK, border:'none', fontFamily:FONT, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', cursor:'pointer' }}>
        ⎙ Print / Save as PDF
      </button>
      <Link href={`/running-invoices/${riId}` as Route} style={{ color:'#888', textDecoration:'none', fontFamily:FONT, fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase' }}>Close</Link>
      <span style={{ flex:1 }} />
      <span style={{ color:'#555', fontSize:10, fontFamily:FONT }}>{riNo} · {info}</span>
    </div>
  )
}

interface Props { ri: RiDetail; orgName: string; orgAddress?: string; orgGstin?: string; logoUrl?: string | null }

export function RiPreview({ ri, orgName, orgAddress, orgGstin, logoUrl }: Props) {
  const billableItems = ri.items.filter(i => i.qtyToBill > 0)

  return (
    <div style={{ fontFamily:FONT, color:BLACK, display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
      <div className="print-page" style={pageStyle}>

        {/* HEADER */}
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
            <div style={{ fontFamily:FONT, fontSize:8, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:6 }}>
              {ri.status === 'posted' || ri.status === 'sent' ? 'Tax Invoice' : 'Running Invoice (Draft)'}
            </div>
            <div style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color:BLACK, letterSpacing:'-0.01em' }}>{ri.riNo}</div>
            <div style={{ fontFamily:FONT, fontSize:10, color:MID, marginTop:8 }}>
              <R2 label="Date"         value={fmtDate(ri.date)} />
              {ri.dueDate && <R2 label="Due Date"    value={fmtDate(ri.dueDate)} />}
              <R2 label="SO Ref"        value={ri.soNo} />
              <R2 label="Status"        value={(RI_STATUS_LABELS[ri.status] ?? ri.status).toUpperCase()} />
              {ri.placeOfSupply && <R2 label="Place of Supply" value={ri.placeOfSupply} />}
            </div>
            {ri.irn && (
              <div style={{ marginTop:8, fontFamily:FONT, fontSize:8, color:MUTED, wordBreak:'break-all', maxWidth:220, textAlign:'right' }}>
                IRN: {ri.irn}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop:`1.5px solid ${BLACK}`, marginBottom:12 }} />

        {/* BILL TO */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
          <div>
            <SL>Bill To</SL>
            <div style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color:BLACK, marginBottom:3 }}>{ri.billingName ?? ri.customerName ?? '—'}</div>
            {ri.billingAddress && <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{ri.billingAddress}</div>}
            {ri.customerGstin && <div style={{ fontFamily:FONT, fontSize:10, color:LIGHT, marginTop:4 }}>GSTIN: {ri.customerGstin}</div>}
          </div>
          <div>
            <SL>Delivery Summary</SL>
            <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.8 }}>
              {ri.challans.map(c => (
                <div key={c.dcId}>{c.dcNo} — Dispatched: {fmtDate(c.dispatchDate)}</div>
              ))}
            </div>
            {ri.paymentTerms && <div style={{ fontFamily:FONT, fontSize:11, color:MUTED, marginTop:6 }}>Payment: {ri.paymentTerms}</div>}
          </div>
        </div>

        {/* ITEMS */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${RULE}`, background:BGROW }}>
              <TH style={{ width:'4%', textAlign:'left' }}>#</TH>
              <TH style={{ width:'30%', textAlign:'left' }}>Item / Description</TH>
              <TH style={{ width:'8%', textAlign:'left' }}>HSN</TH>
              <TH style={{ width:'5%', textAlign:'center' }}>Unit</TH>
              <TH style={{ width:'8%', textAlign:'right' }}>Qty</TH>
              <TH style={{ width:'11%', textAlign:'right' }}>Rate (₹)</TH>
              <TH style={{ width:'6%', textAlign:'right' }}>Disc%</TH>
              <TH style={{ width:'11%', textAlign:'right' }}>Taxable (₹)</TH>
              {ri.isIgst
                ? <><TH style={{ width:'6%', textAlign:'right' }}>IGST%</TH><TH style={{ width:'11%', textAlign:'right' }}>IGST (₹)</TH></>
                : <><TH style={{ width:'5%', textAlign:'right' }}>GST%</TH><TH style={{ width:'10%', textAlign:'right' }}>Tax (₹)</TH></>
              }
              <TH style={{ width:'11%', textAlign:'right' }}>Total (₹)</TH>
            </tr>
          </thead>
          <tbody>
            {billableItems.map((item, i) => (
              <tr key={item.id} style={{ borderBottom:`1px solid ${RULE}` }}>
                <TD style={{ color:MUTED }}>{i + 1}</TD>
                <TD style={{ fontWeight:600, color:BLACK, lineHeight:1.5 }}>
                  {item.name}
                  {item.description && <div style={{ fontWeight:400, fontSize:9, color:MUTED, marginTop:2 }}>{item.description}</div>}
                  {item.brand && <div style={{ fontWeight:400, fontSize:9, color:LIGHT }}>{item.brand}</div>}
                </TD>
                <TD style={{ fontFamily:MONO, color:MUTED, fontSize:9 }}>{item.hsnCode || '—'}</TD>
                <TD style={{ textAlign:'center', color:MID }}>{item.unit || '—'}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700 }}>{fmtNum(item.qtyToBill)}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.unitPrice)}</TD>
                <TD style={{ textAlign:'right' }}>{item.discountPct > 0 ? `${item.discountPct}%` : '—'}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.taxableValue)}</TD>
                {ri.isIgst
                  ? <><TD style={{ textAlign:'right' }}>{item.igstPct}%</TD><TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.igstAmount)}</TD></>
                  : <><TD style={{ textAlign:'right' }}>{item.gstPct}%</TD><TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.cgstAmount + item.sgstAmount)}</TD></>
                }
                <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:BLACK }}>{fmtINR(item.total)}</TD>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS */}
        <div style={{ maxWidth:300, marginLeft:'auto', marginTop:12, display:'flex', flexDirection:'column' }}>
          {[
            { l:'Taxable Value', v:fmtINR(ri.taxableValue) },
            ...(ri.isIgst
              ? [{ l:`IGST (${ri.gstPct}%)`, v:fmtINR(ri.igstAmount) }]
              : [{ l:`CGST (${ri.gstPct/2}%)`, v:fmtINR(ri.cgstAmount) }, { l:`SGST (${ri.gstPct/2}%)`, v:fmtINR(ri.sgstAmount) }]
            ),
          ].map((row, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:11, color:MID }}>
              <span>{row.l}</span><span style={{ fontFamily:MONO, color:BLACK }}>{row.v}</span>
            </div>
          ))}
          <div style={{ borderTop:`1.5px solid ${BLACK}`, marginTop:6, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:BLACK }}>Grand Total</span>
            <span style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:BLACK }}>{fmtINR(ri.grandTotal)}</span>
          </div>
        </div>

        {/* NOTES */}
        {ri.notes && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SL>Notes</SL>
            <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{ri.notes}</div>
          </div>
        )}

        {/* DECLARATION */}
        <div style={{ marginTop:16, padding:'10px 14px', background:BGROW, borderRadius:3, border:`1px solid ${RULE}` }}>
          <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, fontStyle:'italic' }}>
            This invoice is raised against Sales Order {ri.soNo} for goods delivered under: {ri.challans.map(c => c.dcNo).join(', ')}.
          </div>
        </div>

        {/* SIGNATURE */}
        <div style={{ marginTop:28, display:'grid', gridTemplateColumns:'1fr 1fr', gap:40 }}>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Authorised Signatory</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{orgName}</div>
          </div>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Receiver's Signature</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{ri.customerName ?? ''}</div>
          </div>
        </div>

        <div style={{ marginTop:20, borderTop:`1px solid ${RULE}`, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT }}>{orgName} · {ri.riNo} · {fmtDate(ri.date)}</span>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT }}>E &amp; OE · Computer-generated Running Invoice</span>
        </div>
      </div>
    </div>
  )
}
