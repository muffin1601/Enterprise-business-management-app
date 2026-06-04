'use client'

import React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { InvoiceDetail } from '../server/queries'
import { INV_STATUS_LABELS } from '@/validations/invoice'

// ─── Design tokens (identical to quote-preview / so-preview) ─────────────────
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

// ─── Amount in words (Indian numbering system) ────────────────────────────────
function amountInWords(amount: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

  function convert(n: number): string {
    if (n < 20) return ones[n] ?? ''
    if (n < 100) return (tens[Math.floor(n/10)] ?? '') + (n % 10 ? ' ' + (ones[n % 10] ?? '') : '')
    if (n < 1000) return (ones[Math.floor(n/100)] ?? '') + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n/10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }

  const rupees = Math.floor(amount)
  const paise  = Math.round((amount - rupees) * 100)
  let words = convert(rupees) + ' Rupees'
  if (paise > 0) words += ' and ' + convert(paise) + ' Paise'
  return words + ' Only'
}

// ─── A4 page card ─────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  width: 794, minHeight: 1123, padding: '28px 36px',
  background: WHITE, color: BLACK, fontFamily: FONT,
  boxSizing: 'border-box',
  boxShadow: '0 4px 32px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
  position: 'relative', flexShrink: 0,
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:8 }}>{children}</div>
}
function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:2 }}>
      <span style={{ fontFamily:FONT, fontSize:10, color:LIGHT, letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontFamily:FONT, fontSize:10, fontWeight:600, color:BLACK }}>{value}</span>
    </div>
  )
}
function TH({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding:'5px 8px', fontFamily:FONT, fontSize:7.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:MUTED, background:BGROW, borderBottom:`1px solid ${RULE}`, whiteSpace:'nowrap', ...style }}>
      {children}
    </th>
  )
}
function TD({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding:'6px 8px', verticalAlign:'middle', fontSize:10, ...style }}>{children}</td>
}

// ─── Print bar ────────────────────────────────────────────────────────────────
export function InvoicePreviewPrintBar({ invId, invNo }: { invId: string; invNo: string }) {
  const [info, setInfo] = React.useState('Print → Destination → Save as PDF')

  const doPrint = () => {
    setInfo('Printing…')
    window.print()
    setTimeout(() => setInfo('Print → Destination → Save as PDF'), 800)
  }

  return (
    <div className="no-print" style={{
      position:'sticky', top:0, zIndex:200, height:48,
      background:BLACK, display:'flex', alignItems:'center', gap:14, padding:'0 24px', flexShrink:0,
    }}>
      <button onClick={doPrint} style={{
        display:'inline-flex', alignItems:'center', gap:6,
        padding:'8px 18px', background:WHITE, color:BLACK, border:'none',
        fontFamily:FONT, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', cursor:'pointer',
      }}>
        ⎙ Print / Save as PDF
      </button>
      <Link href={`/invoices/${invId}` as Route} style={{ color:'#888', textDecoration:'none', fontFamily:FONT, fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase' }}>
        Close
      </Link>
      <span style={{ flex:1 }} />
      <span style={{ color:'#555', fontSize:10, fontFamily:FONT, letterSpacing:'0.04em' }}>{invNo} · {info}</span>
    </div>
  )
}

// ─── Main preview ─────────────────────────────────────────────────────────────
interface Props { inv: InvoiceDetail; orgName: string; orgAddress?: string; orgGstin?: string }

export function InvoicePreview({ inv, orgName, orgAddress, orgGstin }: Props) {
  const today    = new Date().toISOString().split('T')[0]!
  const isOverdue = !!(inv.dueDate && inv.dueDate < today && ['issued','partially_paid'].includes(inv.status))

  return (
    <div style={{ fontFamily:FONT, color:BLACK, display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
      <div className="print-page" style={pageStyle}>

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div style={{ maxWidth:280 }}>
            {inv.logoUrl
              ? <img src={inv.logoUrl} alt={orgName} style={{ maxHeight:44, maxWidth:160, objectFit:'contain', display:'block', marginBottom:4 }} />
              : <div style={{ fontFamily:FONT, fontSize:22, fontWeight:700, color:BLACK, lineHeight:1.1, letterSpacing:'-0.02em' }}>{orgName}</div>
            }
            <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>{orgName}</div>
            {orgAddress && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:4, lineHeight:1.6 }}>{orgAddress}</div>}
            {orgGstin   && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:3 }}>GSTIN: {orgGstin}</div>}
          </div>

          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:FONT, fontSize:8, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:6 }}>Tax Invoice</div>
            <div style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color:BLACK, letterSpacing:'-0.01em' }}>{inv.invoiceNo}</div>
            <div style={{ fontFamily:FONT, fontSize:10, color:MID, marginTop:8 }}>
              <Row2 label="Date"         value={fmtDate(inv.date)} />
              {inv.dueDate && <Row2 label="Due Date"  value={fmtDate(inv.dueDate)} />}
              <Row2 label="SO Ref"        value={inv.soNo} />
              {inv.quoteNo && <Row2 label="Quote Ref" value={inv.quoteNo} />}
              <Row2 label="Status"        value={(INV_STATUS_LABELS[inv.status] ?? inv.status).toUpperCase()} />
              {inv.placeOfSupply && <Row2 label="Place of Supply" value={inv.placeOfSupply} />}
            </div>
            {isOverdue && (
              <div style={{ marginTop:8, display:'inline-block', padding:'3px 10px', background:'#fae8e8', color:'#a63d3d', border:'1px solid #a63d3d', borderRadius:2, fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' }}>
                OVERDUE
              </div>
            )}
          </div>
        </div>

        {/* RULE */}
        <div style={{ borderTop:`1.5px solid ${BLACK}`, marginBottom:12 }} />

        {/* ── BILL TO / SHIP TO ──────────────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
          <div>
            <SectionLabel>Bill To</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color:BLACK, marginBottom:3 }}>{inv.billToName ?? inv.customerName ?? '—'}</div>
            {inv.billToAddress && <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line', marginBottom:2 }}>{inv.billToAddress}</div>}
            {(inv.billToPhone ?? inv.customerPhone) && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>{inv.billToPhone ?? inv.customerPhone}</div>}
            {(inv.billToEmail ?? inv.customerEmail) && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>{inv.billToEmail ?? inv.customerEmail}</div>}
            {inv.billToGstin && <div style={{ fontFamily:FONT, fontSize:11, color:MUTED }}>GSTIN: {inv.billToGstin}</div>}
          </div>
          <div>
            <SectionLabel>Subject / Project</SectionLabel>
            {inv.subject && <div style={{ fontFamily:FONT, fontSize:13, fontWeight:600, color:BLACK, lineHeight:1.4 }}>{inv.subject}</div>}
            {inv.paymentTerms && (
              <div style={{ fontFamily:FONT, fontSize:11, color:MUTED, marginTop:6 }}>Payment Terms: {inv.paymentTerms}</div>
            )}
            <div style={{ fontFamily:FONT, fontSize:11, color:MUTED, marginTop:4 }}>
              {inv.isIgst ? 'IGST Applied (Inter-state)' : 'CGST + SGST Applied (Intra-state)'}
            </div>
          </div>
        </div>

        {/* ── ITEMS TABLE ────────────────────────────────────────────────────── */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10, marginBottom:0 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${RULE}`, background:BGROW }}>
              <TH style={{ width:'3%', textAlign:'left' }}>#</TH>
              <TH style={{ width:'24%', textAlign:'left' }}>Item / Description</TH>
              <TH style={{ width:'7%', textAlign:'left' }}>HSN/SAC</TH>
              <TH style={{ width:'5%', textAlign:'center' }}>Unit</TH>
              <TH style={{ width:'9%', textAlign:'right' }}>Rate (₹)</TH>
              <TH style={{ width:'4%', textAlign:'center' }}>Qty</TH>
              <TH style={{ width:'5%', textAlign:'right' }}>Disc%</TH>
              <TH style={{ width:'9%', textAlign:'right' }}>Taxable (₹)</TH>
              {inv.isIgst ? (
                <>
                  <TH style={{ width:'9%', textAlign:'right' }}>IGST%</TH>
                  <TH style={{ width:'12%', textAlign:'right' }}>IGST (₹)</TH>
                </>
              ) : (
                <>
                  <TH style={{ width:'6%', textAlign:'right' }}>CGST%</TH>
                  <TH style={{ width:'7%', textAlign:'right' }}>CGST (₹)</TH>
                  <TH style={{ width:'6%', textAlign:'right' }}>SGST%</TH>
                  <TH style={{ width:'7%', textAlign:'right' }}>SGST (₹)</TH>
                </>
              )}
              <TH style={{ width: inv.isIgst ? '13%' : '8%', textAlign:'right' }}>Total (₹)</TH>
            </tr>
          </thead>
          <tbody>
            {[...inv.items].sort((a,b) => a.sortOrder - b.sortOrder).map((item, i) => (
              <tr key={item.id} style={{ borderBottom:`1px solid ${RULE}` }}>
                <TD style={{ color:MUTED }}>{i + 1}</TD>
                <TD style={{ fontWeight:600, color:BLACK, lineHeight:1.5 }}>
                  {item.name}
                  {item.description && <div style={{ fontWeight:400, fontSize:9, color:MUTED, marginTop:2 }}>{item.description}</div>}
                  {item.brand && <div style={{ fontWeight:400, fontSize:9, color:LIGHT, marginTop:1 }}>{item.brand}</div>}
                </TD>
                <TD style={{ fontFamily:MONO, color:MUTED, fontSize:9 }}>{item.hsnCode || '—'}</TD>
                <TD style={{ textAlign:'center', color:MID }}>{item.unit || '—'}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.rate)}</TD>
                <TD style={{ textAlign:'center', fontFamily:MONO }}>{item.qty}</TD>
                <TD style={{ textAlign:'right' }}>{item.discountPct > 0 ? `${item.discountPct}%` : <span style={{ color:RULE }}>—</span>}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.taxableValue)}</TD>
                {inv.isIgst ? (
                  <>
                    <TD style={{ textAlign:'right' }}>{item.igstPct}%</TD>
                    <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.igstAmount)}</TD>
                  </>
                ) : (
                  <>
                    <TD style={{ textAlign:'right' }}>{item.cgstPct}%</TD>
                    <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.cgstAmount)}</TD>
                    <TD style={{ textAlign:'right' }}>{item.sgstPct}%</TD>
                    <TD style={{ textAlign:'right', fontFamily:MONO }}>{fmtINR(item.sgstAmount)}</TD>
                  </>
                )}
                <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:BLACK }}>{fmtINR(item.total)}</TD>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS ─────────────────────────────────────────────────────────── */}
        <div style={{ borderLeft:`1px solid ${RULE}`, borderRight:`1px solid ${RULE}`, borderBottom:`1px solid ${RULE}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:BGROW, borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:10, color:MID }}>
            <span>Taxable Value</span>
            <span style={{ fontFamily:MONO, color:BLACK }}>{fmtINR(inv.taxableValue)}</span>
          </div>
          {inv.transport > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:BGROW, borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:10, color:MID }}>
              <span>Transport{inv.transportNote ? ` (${inv.transportNote})` : ''}</span>
              <span style={{ fontFamily:MONO, color:BLACK }}>{fmtINR(inv.transport)}</span>
            </div>
          )}
          {inv.isIgst ? (
            <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:BGROW, borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:10, color:MID }}>
              <span>IGST @ {inv.gstPct}%</span>
              <span style={{ fontFamily:MONO, color:BLACK }}>{fmtINR(inv.igstAmount)}</span>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:BGROW, borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:10, color:MID }}>
                <span>CGST @ {inv.gstPct / 2}%</span>
                <span style={{ fontFamily:MONO, color:BLACK }}>{fmtINR(inv.cgstAmount)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:BGROW, borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:10, color:MID }}>
                <span>SGST @ {inv.gstPct / 2}%</span>
                <span style={{ fontFamily:MONO, color:BLACK }}>{fmtINR(inv.sgstAmount)}</span>
              </div>
            </>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px', background:BLACK, fontFamily:FONT, fontSize:9, fontWeight:700, color:WHITE, letterSpacing:'0.16em', textTransform:'uppercase' }}>
            <span>Grand Total</span>
            <span style={{ fontFamily:MONO, fontSize:14 }}>{fmtINR(inv.grandTotal)}</span>
          </div>
        </div>

        {/* Amount in words */}
        <div style={{ marginTop:8, fontFamily:FONT, fontSize:10, color:MID, fontStyle:'italic' }}>
          Amount in Words: <strong style={{ color:BLACK }}>{amountInWords(inv.grandTotal)}</strong>
        </div>

        {/* Payment status */}
        {inv.amountPaid > 0 && (
          <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            <div style={{ fontFamily:FONT, fontSize:10, color:'#0e7a3e' }}>Amount Paid: {fmtINR(inv.amountPaid)}</div>
            <div style={{ fontFamily:FONT, fontSize:11, fontWeight:700, color: inv.balanceDue === 0 ? '#0e7a3e' : '#a63d3d' }}>
              Balance Due: {fmtINR(inv.balanceDue)}
            </div>
          </div>
        )}

        {/* Notes */}
        {inv.notes && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{inv.notes}</div>
          </div>
        )}

        {/* Terms */}
        {inv.terms && inv.terms.length > 0 && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Terms &amp; Conditions</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
              {inv.terms.map((t, i) => (
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

        {/* Signature block */}
        <div style={{ marginTop:28, display:'grid', gridTemplateColumns:'1fr 1fr', gap:40 }}>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Authorised Signatory</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{orgName}</div>
          </div>
          <div style={{ borderTop:`1px solid ${RULE}`, paddingTop:8 }}>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.08em', textTransform:'uppercase' }}>Receiver's Signature</div>
            <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, marginTop:2 }}>{inv.customerName ?? ''}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop:20, borderTop:`1px solid ${RULE}`, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>{orgName} · {inv.invoiceNo} · {fmtDate(inv.date)}</span>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>This is a computer-generated invoice</span>
        </div>

      </div>
    </div>
  )
}
