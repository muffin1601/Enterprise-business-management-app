'use client'

import React from 'react'
import Link from 'next/link'
import type { Route } from 'next'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface QuoteItemRow {
  id: string; name: string; description?: string | null
  brand?: string | null; unit?: string | null
  rate: number; qty: number; discount_pct: number
  total: number; sort_order: number
}
export interface QuoteLocationRow {
  id: string; name: string; sort_order: number; is_included: boolean
  installation_charge: number; installation_note?: string | null
  material_subtotal: number; location_total: number; items: QuoteItemRow[]
}
export interface QuoteTermRow { id: string; category: string; text: string; sort_order: number }
export interface QuoteDetail {
  id: string; quote_no: string; revision: number; date: string
  valid_until?: string | null; status: string; subject?: string | null
  logo_url?: string | null; gst_mode: 'add' | 'inclusive' | 'none'; gst_pct: number
  transport: number; transport_note?: string | null; include_boq_summary: boolean
  notes?: string | null; material_subtotal: number; gst_amount: number; grand_total: number
  customer?: { id: string; name: string; contact_person?: string | null; billing_address?: string | null; gstin?: string | null } | null
  locations: QuoteLocationRow[]; terms: QuoteTermRow[]
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// ─── Design tokens ────────────────────────────────────────────────────────────
const FONT   = "'Noto Serif JP', Georgia, serif"
const MONO   = "'JetBrains Mono', 'Courier New', monospace"
const BLACK  = '#0a0a0a'
const DARK   = '#1a1a1a'
const MID    = '#444444'
const MUTED  = '#777777'
const LIGHT  = '#aaaaaa'
const RULE   = '#d4d0cb'
const BGROW  = '#f8f7f4'
const WHITE  = '#ffffff'

// ─── Print bar ────────────────────────────────────────────────────────────────
interface PrintBarProps { quoteId: string; quoteNo: string; includeBoqSummary: boolean; autoPrint?: boolean }

export function QuotePreviewPrintBar({ quoteId, quoteNo, includeBoqSummary, autoPrint }: PrintBarProps) {
  const [info, setInfo] = React.useState('Print → Destination → Save as PDF')

  React.useEffect(() => {
    if (autoPrint) { document.body.setAttribute('data-print','quote'); window.print(); document.body.removeAttribute('data-print') }
  }, [autoPrint])

  const doPrint = (mode: 'quote'|'boq'|'both') => {
    const labels = { quote:'Quote only', boq:'BOQ Summary only', both:'Quote + BOQ' }
    setInfo(`Printing: ${labels[mode]}`)
    document.body.setAttribute('data-print', mode)
    window.print()
    setTimeout(() => { document.body.removeAttribute('data-print'); setInfo('Print → Destination → Save as PDF') }, 500)
  }

  const barBtn = (label: string, onClick: ()=>void, primary = false) => (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding: primary ? '8px 18px' : '6px 14px',
      background: primary ? WHITE : 'transparent',
      color: primary ? BLACK : '#aaa',
      border: primary ? 'none' : '1px solid #444',
      fontFamily: FONT, fontSize: primary ? 11 : 10,
      fontWeight: primary ? 700 : 500,
      letterSpacing:'0.10em', textTransform:'uppercase',
      cursor:'pointer',
    }}>{label}</button>
  )

  return (
    <div className="no-print" style={{
      position:'sticky', top:0, zIndex:200, height:48,
      background: BLACK, display:'flex', alignItems:'center', gap:14, padding:'0 24px',
      flexShrink:0, fontFamily: FONT,
    }}>
      {barBtn('⎙ Print / Save as PDF', () => doPrint('quote'), true)}
      <Link href={`/quotes/${quoteId}/edit` as Route} style={{ color:'#888', textDecoration:'none', fontFamily:FONT, fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase' }}>
        Close
      </Link>
      <span style={{ color:'#333', margin:'0 4px' }}>|</span>
      {includeBoqSummary && barBtn('BOQ Summary', () => doPrint('boq'))}
      {includeBoqSummary && barBtn('Print Both', () => doPrint('both'))}
      <span style={{ flex:1 }} />
      <span style={{ color:'#555', fontSize:10, fontFamily:FONT, letterSpacing:'0.04em' }}>{quoteNo} · {info}</span>
    </div>
  )
}

// ─── Main preview ─────────────────────────────────────────────────────────────
interface QuotePreviewViewProps { quote: QuoteDetail; orgName: string; orgAddress?: string; orgGstin?: string }

export function QuotePreviewView({ quote, orgName, orgAddress, orgGstin }: QuotePreviewViewProps) {
  const included = quote.locations.filter(l => l.is_included).sort((a,b) => a.sort_order - b.sort_order)
  const grandMat  = included.reduce((s,l) => s + l.material_subtotal, 0)
  const subtotal  = included.reduce((s,l) => s + l.location_total, 0)

  return (
    <div style={{ fontFamily: FONT, color: BLACK, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

      {/* ── QUOTATION PAGE ────────────────────────────────────────────────────── */}
      <div className="print-page quote-page" style={pageStyle}>

        {/* HEADER — logo/company left | quotation details right */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div style={{ maxWidth: 280 }}>
            {quote.logo_url
              ? <img src={quote.logo_url} alt={orgName} style={{ maxHeight:44, maxWidth:160, objectFit:'contain', display:'block', marginBottom:4 }} />
              : <div style={{ fontFamily:FONT, fontSize:22, fontWeight:700, color:BLACK, lineHeight:1.1, letterSpacing:'-0.02em' }}>{orgName}</div>
            }
            <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>{orgName}</div>
            {orgAddress && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:4, lineHeight:1.6 }}>{orgAddress}</div>}
            {orgGstin   && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:3 }}>GSTIN: {orgGstin}</div>}
          </div>

          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:FONT, fontSize:8, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:6 }}>Quotation</div>
            <div style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color:BLACK, letterSpacing:'-0.01em' }}>{quote.quote_no}</div>
            {quote.revision > 0 && (
              <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:3, letterSpacing:'0.06em' }}>Revision {quote.revision}</div>
            )}
            <div style={{ fontFamily:FONT, fontSize:10, color:MID, marginTop:8 }}>
              <Row2 label="Date"  value={fmtDate(quote.date)} />
              {quote.valid_until && <Row2 label="Valid Until" value={fmtDate(quote.valid_until)} />}
              <Row2 label="Status" value={quote.status.toUpperCase()} />
            </div>
          </div>
        </div>

        {/* FULL-WIDTH RULE */}
        <div style={{ borderTop:`1.5px solid ${BLACK}`, marginBottom:12 }} />

        {/* META — customer | subject | quote ref */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${RULE}` }}>
          <div>
            <SectionLabel>Customer</SectionLabel>
            {quote.customer
              ? <>
                  <div style={{ fontFamily:FONT, fontSize:14, fontWeight:700, color:BLACK, marginBottom:3 }}>{quote.customer.name}</div>
                  {quote.customer.contact_person && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>Attn: {quote.customer.contact_person}</div>}
                  {quote.customer.billing_address && <div style={{ fontFamily:FONT, fontSize:11, color:MUTED, lineHeight:1.7, marginTop:3, whiteSpace:'pre-line' }}>{quote.customer.billing_address}</div>}
                  {quote.customer.gstin && <div style={{ fontFamily:FONT, fontSize:10, color:LIGHT, marginTop:4 }}>GSTIN: {quote.customer.gstin}</div>}
                </>
              : <div style={{ fontFamily:FONT, fontSize:12, color:LIGHT }}>—</div>
            }
          </div>
          <div>
            <SectionLabel>Subject / Project</SectionLabel>
            {quote.subject && <div style={{ fontFamily:FONT, fontSize:14, fontWeight:600, color:BLACK, lineHeight:1.4, marginBottom:8 }}>{quote.subject}</div>}
            {included.length > 0 && (
              <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, lineHeight:1.8 }}>
                {included.length} Area{included.length>1?'s':''}: {included.map(l=>l.name).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* LOCATION SECTIONS */}
        {included.map((loc, li) => (
          <LocationSection key={loc.id} loc={loc} idx={li} />
        ))}

        {/* GRAND TOTAL */}
        <div style={{ marginTop:10, borderTop:`1px solid ${RULE}`, paddingTop:8, pageBreakInside:'avoid' as const }}>
          <div style={{ maxWidth:300, marginLeft:'auto', display:'flex', flexDirection:'column' }}>
            <SummaryRow label="Material Subtotal"    value={fmtINR(grandMat)} />
            {quote.gst_mode === 'add' && <SummaryRow label={`GST (${quote.gst_pct}%)`} value={fmtINR(quote.gst_amount)} />}
            {quote.transport > 0 && (
              <SummaryRow
                label={`Transport${quote.transport_note ? ` — ${quote.transport_note}` : ''}`}
                value={fmtINR(quote.transport)}
              />
            )}
            <div style={{ borderTop:`1.5px solid ${BLACK}`, marginTop:6, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontFamily:FONT, fontSize:10, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:BLACK }}>Grand Total</span>
              <span style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:BLACK }}>{fmtINR(quote.grand_total)}</span>
            </div>
            {quote.gst_mode === 'add' && (
              <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, textAlign:'right', marginTop:4, letterSpacing:'0.04em' }}>
                * GST {quote.gst_pct}% added on taxable amount
              </div>
            )}
          </div>
        </div>

        {/* NOTES */}
        {quote.notes && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.7, whiteSpace:'pre-line' }}>{quote.notes}</div>
          </div>
        )}

        {/* TERMS */}
        {quote.terms.length > 0 && (
          <div style={{ marginTop:12, borderTop:`1px solid ${RULE}`, paddingTop:10 }}>
            <SectionLabel>Terms &amp; Conditions</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
              {[...quote.terms].sort((a,b)=>a.sort_order-b.sort_order).map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'baseline', gap:12 }}>
                  <span style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:BLACK, flexShrink:0, borderBottom:`1px solid ${BLACK}`, paddingBottom:1, minWidth:70 }}>
                    {t.category}
                  </span>
                  <span style={{ fontFamily:FONT, fontSize:11, color:MID, lineHeight:1.6 }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ marginTop:20, borderTop:`1px solid ${RULE}`, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>{orgName} · {quote.quote_no} · {fmtDate(quote.date)}</span>
          <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>Confidential</span>
        </div>
      </div>

      {/* ── BOQ SUMMARY PAGE ──────────────────────────────────────────────────── */}
      {quote.include_boq_summary && (
        <div className="print-page boq-page" style={pageStyle}>
          <BoqPage quote={quote} orgName={orgName} included={included} logoUrl={quote.logo_url ?? null} />
        </div>
      )}

      {/* Print styles handled in app/globals.scss */}
    </div>
  )
}

// ─── Location section ─────────────────────────────────────────────────────────
function LocationSection({ loc, idx }: { loc: QuoteLocationRow; idx: number }) {
  const hasInstall = loc.installation_charge > 0
  const items = [...loc.items].sort((a,b) => a.sort_order - b.sort_order)

  return (
    <div className="location-block" style={{ marginBottom:10 }}>
      {/* Location header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'6px 0', borderBottom:`1.5px solid ${BLACK}`, marginBottom:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:MUTED }}>Area {idx+1}</span>
          <span style={{ fontFamily:FONT, fontSize:13, fontWeight:700, color:BLACK, letterSpacing:'0.01em' }}>{loc.name}</span>
        </div>
        <span style={{ fontFamily:MONO, fontSize:12, fontWeight:600, color:BLACK }}>{fmtINR(loc.location_total)}</span>
      </div>

      {/* Items table */}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${RULE}`, background: BGROW }}>
            <TH style={{ width:'30%', textAlign:'left' }}>Item / Description</TH>
            <TH style={{ width:'13%', textAlign:'left' }}>Brand</TH>
            <TH style={{ width:'8%',  textAlign:'center' }}>Unit</TH>
            <TH style={{ width:'13%', textAlign:'right' }}>Rate (₹)</TH>
            <TH style={{ width:'8%',  textAlign:'center' }}>Qty</TH>
            <TH style={{ width:'10%', textAlign:'right' }}>Disc %</TH>
            <TH style={{ width:'14%', textAlign:'right' }}>Total (₹)</TH>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const discAmt = item.rate * item.qty * (item.discount_pct / 100)
            return (
              <tr key={item.id} style={{ borderBottom:`1px solid ${RULE}` }}>
                <TD style={{ fontWeight:600, color:BLACK, lineHeight:1.5 }}>
                  {item.name}
                  {item.description && <div style={{ fontWeight:400, fontSize:10, color:MUTED, marginTop:2 }}>{item.description}</div>}
                </TD>
                <TD style={{ color:MID }}>{item.brand || '—'}</TD>
                <TD style={{ color:MID, textAlign:'center' }}>{item.unit || '—'}</TD>
                <TD style={{ textAlign:'right', fontFamily:MONO, color:BLACK }}>{fmtINR(item.rate)}</TD>
                <TD style={{ textAlign:'center', fontFamily:MONO }}>{item.qty}</TD>
                <TD style={{ textAlign:'right' }}>
                  {item.discount_pct > 0
                    ? <><div style={{ fontFamily:MONO, fontWeight:600, color:BLACK }}>{item.discount_pct}%</div><div style={{ fontFamily:MONO, fontSize:10, color:MUTED }}>−{fmtINR(discAmt)}</div></>
                    : <span style={{ color:RULE }}>—</span>
                  }
                </TD>
                <TD style={{ textAlign:'right', fontFamily:MONO, fontWeight:700, color:BLACK }}>{fmtINR(item.total)}</TD>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Subtotals */}
      <div style={{ borderBottom:`1px solid ${RULE}`, borderLeft:`1px solid ${RULE}`, borderRight:`1px solid ${RULE}` }}>
        <SubRow label={`Material Subtotal — ${loc.name}`} value={fmtINR(loc.material_subtotal)} light cls="sub-row" />
        {hasInstall && (
          <SubRow
            label={`Installation${loc.installation_note ? ` — ${loc.installation_note}` : ''}`}
            value={fmtINR(loc.installation_charge)}
            light cls="sub-row"
          />
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:BLACK }}>
          <span style={{ fontFamily:FONT, fontSize:9, fontWeight:700, color:WHITE, letterSpacing:'0.18em', textTransform:'uppercase' }}>
            Total — {loc.name}{hasInstall ? ' (incl. installation)' : ''}
          </span>
          <span style={{ fontFamily:MONO, fontSize:13, fontWeight:700, color:WHITE }}>{fmtINR(loc.location_total)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── BOQ Summary page ─────────────────────────────────────────────────────────
function BoqPage({ quote, orgName, included, logoUrl }: { quote: QuoteDetail; orgName: string; included: QuoteLocationRow[]; logoUrl: string | null }) {
  const grandMat   = included.reduce((s,l) => s+l.material_subtotal, 0)
  const grandInst  = included.reduce((s,l) => s+l.installation_charge, 0)
  const grandTotal = included.reduce((s,l) => s+l.location_total, 0)

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div>
          {logoUrl
            ? <img src={logoUrl} alt={orgName} style={{ maxHeight:40, maxWidth:150, objectFit:'contain', display:'block', marginBottom:4 }} />
            : <div style={{ fontFamily:FONT, fontSize:22, fontWeight:700, color:BLACK, letterSpacing:'-0.01em' }}>{orgName}</div>
          }
          <div style={{ fontFamily:FONT, fontSize:8, letterSpacing:'0.22em', textTransform:'uppercase', color:MUTED, marginTop:4 }}>Bill of Quantities — Summary</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:BLACK }}>{quote.quote_no}</div>
          {quote.revision > 0 && <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:2 }}>Revision {quote.revision}</div>}
          <div style={{ fontFamily:FONT, fontSize:10, color:MID, marginTop:4 }}>Date: {fmtDate(quote.date)}</div>
        </div>
      </div>
      <div style={{ borderTop:`1.5px solid ${BLACK}`, marginBottom:12 }} />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${RULE}` }}>
        <div>
          <SectionLabel>Client</SectionLabel>
          <div style={{ fontFamily:FONT, fontSize:13, fontWeight:700, color:BLACK }}>{quote.customer?.name ?? '—'}</div>
          {quote.customer?.contact_person && <div style={{ fontFamily:FONT, fontSize:11, color:MID }}>Attn: {quote.customer.contact_person}</div>}
          {quote.customer?.billing_address && <div style={{ fontFamily:FONT, fontSize:11, color:MUTED, marginTop:3, lineHeight:1.6 }}>{quote.customer.billing_address}</div>}
        </div>
        <div>
          <SectionLabel>Project</SectionLabel>
          {quote.subject && <div style={{ fontFamily:FONT, fontSize:13, fontWeight:600, color:BLACK }}>{quote.subject}</div>}
          <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:4 }}>
            Quote No. <strong>{quote.quote_no}</strong> · Revision <strong>{quote.revision}</strong>
          </div>
          <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:2 }}>Date: <strong>{fmtDate(quote.date)}</strong></div>
          <div style={{ fontFamily:FONT, fontSize:10, color:MUTED, marginTop:2 }}>Areas: {included.map(l=>l.name).join(' · ')}</div>
        </div>
      </div>

      {/* BOQ Table */}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
        <thead>
          <tr style={{ background:BLACK }}>
            <th style={boqTh(40, 'left')}>Description</th>
            <th style={boqTh(20, 'right')}>Material (₹)</th>
            <th style={boqTh(20, 'right')}>Installation (₹)</th>
            <th style={boqTh(20, 'right')}>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {included.map((loc, i) => (
            <tr key={loc.id} style={{ borderBottom:`1px solid ${RULE}`, background: i%2===0 ? WHITE : BGROW }}>
              <td style={{ padding:'9px 12px', fontFamily:FONT, fontWeight:600, color:BLACK }}>{loc.name}</td>
              <td style={{ padding:'9px 12px', textAlign:'right', fontFamily:MONO, color:MID }}>{fmtINR(loc.material_subtotal)}</td>
              <td style={{ padding:'9px 12px', textAlign:'right', fontFamily:MONO, color:loc.installation_charge>0 ? MID : LIGHT }}>
                {loc.installation_charge > 0 ? fmtINR(loc.installation_charge) : '—'}
              </td>
              <td style={{ padding:'9px 12px', textAlign:'right', fontFamily:MONO, fontWeight:700, color:BLACK }}>{fmtINR(loc.location_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background:BLACK }}>
            <td style={{ padding:'10px 12px', fontFamily:FONT, fontSize:9, fontWeight:700, color:WHITE, letterSpacing:'0.16em', textTransform:'uppercase' }}>Grand Total</td>
            <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:MONO, fontWeight:700, color:WHITE }}>{fmtINR(grandMat)}</td>
            <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:MONO, fontWeight:700, color:WHITE }}>{grandInst>0 ? fmtINR(grandInst) : '—'}</td>
            <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:MONO, fontSize:14, fontWeight:700, color:WHITE }}>{fmtINR(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {quote.gst_mode !== 'none' && (
        <div style={{ fontFamily:FONT, fontSize:9, color:LIGHT, textAlign:'right', marginTop:8, letterSpacing:'0.04em' }}>
          {quote.gst_mode==='add'
            ? `* Above amounts exclude GST. GST @ ${quote.gst_pct}% applicable additionally.`
            : `* GST @ ${quote.gst_pct}% inclusive in the above amounts.`}
        </div>
      )}

      <div style={{ marginTop:20, borderTop:`1px solid ${RULE}`, paddingTop:10, display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>{orgName} · BOQ Summary · {quote.quote_no} · {fmtDate(quote.date)}</span>
        <span style={{ fontFamily:FONT, fontSize:9, color:LIGHT, letterSpacing:'0.06em' }}>Confidential</span>
      </div>
    </>
  )
}

// ─── Primitive helpers ────────────────────────────────────────────────────────
// A4 card — screen: fixed 794px wide paper card with shadow; print: full A4 sheet
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily:FONT, fontSize:8, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:LIGHT, marginBottom:8 }}>{children}</div>
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:2 }}>
      <span style={{ color:LIGHT, letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontWeight:600, color:BLACK }}>{value}</span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:11, color:MID }}>
      <span>{label}</span>
      <span style={{ fontFamily:MONO, color:BLACK }}>{value}</span>
    </div>
  )
}

function SubRow({ label, value, light, cls }: { label: string; value: string; light?: boolean; cls?: string }) {
  return (
    <div className={cls} style={{ display:'flex', justifyContent:'space-between', padding:'5px 10px', background: light ? BGROW : WHITE, borderBottom:`1px solid ${RULE}`, fontFamily:FONT, fontSize:10, color:MID }}>
      <span>{label}</span>
      <span style={{ fontFamily:MONO, fontWeight:600, color:BLACK }}>{value}</span>
    </div>
  )
}

function TH({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding:'5px 10px', fontFamily:FONT, fontSize:7.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:MUTED, background:BGROW, borderBottom:`1px solid ${RULE}`, whiteSpace:'nowrap', ...style }}>
      {children}
    </th>
  )
}

function TD({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding:'6px 10px', verticalAlign:'middle', fontSize:10, ...style }}>
      {children}
    </td>
  )
}

function boqTh(widthPct: number, align: 'left'|'right'): React.CSSProperties {
  return { width:`${widthPct}%`, padding:'8px 10px', fontFamily:FONT, fontSize:7.5, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:WHITE, textAlign:align }
}
