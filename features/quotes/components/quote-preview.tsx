'use client'

/**
 * quote-preview.tsx
 *
 * Two exports:
 *  - QuotePreviewPrintBar  (client component) — sticky top bar
 *  - QuotePreviewView      (presentational)   — the print-ready document
 */

import Link from 'next/link'
import type { Route } from 'next'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteItemRow {
  id: string
  name: string
  description?: string | null
  brand?: string | null
  unit?: string | null
  rate: number
  qty: number
  discount_pct: number
  total: number
  sort_order: number
}

export interface QuoteLocationRow {
  id: string
  name: string
  sort_order: number
  is_included: boolean
  installation_charge: number
  installation_note?: string | null
  material_subtotal: number
  location_total: number
  items: QuoteItemRow[]
}

export interface QuoteTermRow {
  id: string
  category: string
  text: string
  sort_order: number
}

export interface QuoteDetail {
  id: string
  quote_no: string
  revision: number
  date: string
  valid_until?: string | null
  status: string
  subject?: string | null
  gst_mode: 'add' | 'inclusive' | 'none'
  gst_pct: number
  transport: number
  transport_note?: string | null
  include_boq_summary: boolean
  notes?: string | null
  material_subtotal: number
  gst_amount: number
  grand_total: number
  customer?: {
    id: string
    name: string
    contact_person?: string | null
    billing_address?: string | null
    gstin?: string | null
  } | null
  locations: QuoteLocationRow[]
  terms: QuoteTermRow[]
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

// ─── Status badge colours ─────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft:     { bg: 'var(--c-surface-2)',    color: 'var(--c-tertiary)' },
  sent:      { bg: 'var(--c-info-bg)',      color: 'var(--c-info)' },
  accepted:  { bg: 'var(--c-success-bg)',   color: 'var(--c-success)' },
  revised:   { bg: 'var(--c-warning-bg)',   color: 'var(--c-warning)' },
  cancelled: { bg: 'var(--c-danger-bg)',    color: 'var(--c-danger)' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOR[status] ?? STATUS_COLOR['draft']!
  const { bg, color } = s
  return (
    <span style={{
      fontFamily: 'var(--font-body)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '3px 10px',
      borderRadius: 3,
      background: bg,
      color,
    }}>
      {status}
    </span>
  )
}

// ─── Term category badge ──────────────────────────────────────────────────────

const TERM_COLOR: Record<string, { bg: string; color: string }> = {
  delivery:     { bg: '#e8f4fd', color: '#1a6fa8' },
  gst:          { bg: '#e8fde8', color: '#1a6f1a' },
  payment:      { bg: '#fdf4e8', color: '#a86a1a' },
  warranty:     { bg: '#f4e8fd', color: '#7a1a8f' },
  installation: { bg: '#fde8e8', color: '#a81a1a' },
  exclusion:    { bg: '#f0f0f0', color: '#555' },
  other:        { bg: '#f5f5f5', color: '#666' },
}

function TermBadge({ category }: { category: string }) {
  const t = TERM_COLOR[category] ?? TERM_COLOR['other']!
  const { bg, color } = t
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'var(--font-body)',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 2,
      background: bg,
      color,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {category}
    </span>
  )
}

// ─── Print bar (CLIENT) ───────────────────────────────────────────────────────

interface PrintBarProps {
  quoteId: string
  quoteNo: string
  includeBoqSummary: boolean
}

export function QuotePreviewPrintBar({ quoteId, quoteNo, includeBoqSummary }: PrintBarProps) {
  const handlePrintQuote = () => {
    if (typeof window !== 'undefined') {
      document.body.setAttribute('data-print', 'quote')
      window.print()
      document.body.removeAttribute('data-print')
    }
  }

  const handlePrintBoq = () => {
    if (typeof window !== 'undefined') {
      document.body.setAttribute('data-print', 'boq')
      window.print()
      document.body.removeAttribute('data-print')
    }
  }

  const handlePrintBoth = () => {
    if (typeof window !== 'undefined') {
      document.body.setAttribute('data-print', 'both')
      window.print()
      document.body.removeAttribute('data-print')
    }
  }

  return (
    <div
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Edit link */}
      <Link
        href={`/quotes/${quoteId}/edit` as Route}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--c-secondary)',
          textDecoration: 'none',
          padding: '6px 12px',
          borderRadius: 4,
          border: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
        }}
      >
        ← EDIT
      </Link>

      {/* Quote ref */}
      <div style={{
        flex: 1,
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--c-ink)',
      }}>
        {quoteNo} — PREVIEW
      </div>

      {/* Print buttons */}
      <button
        onClick={handlePrintQuote}
        style={btnStyle('var(--c-ink)', 'var(--c-surface)')}
      >
        PRINT QUOTE
      </button>

      {includeBoqSummary && (
        <button
          onClick={handlePrintBoq}
          style={btnStyle('var(--c-surface)', 'var(--c-warning)')}
        >
          PRINT BOQ SUMMARY
        </button>
      )}

      {includeBoqSummary && (
        <button
          onClick={handlePrintBoth}
          style={btnStyle('var(--c-surface)', 'var(--c-ink)')}
        >
          PRINT BOTH
        </button>
      )}
    </div>
  )
}

function btnStyle(color: string, bg: string): React.CSSProperties {
  return {
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '7px 16px',
    borderRadius: 4,
    border: '1.5px solid var(--c-border)',
    background: bg,
    color,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

// ─── QuotePreviewView (presentational, no client directive needed) ─────────────

interface QuotePreviewViewProps {
  quote: QuoteDetail
  orgName: string
  orgAddress?: string
  orgGstin?: string
}

export function QuotePreviewView({
  quote,
  orgName,
  orgAddress,
  orgGstin,
}: QuotePreviewViewProps) {
  const includedLocations = quote.locations
    .filter((l) => l.is_included)
    .sort((a, b) => a.sort_order - b.sort_order)

  const locationNames = includedLocations.map((l) => l.name)

  const grandTotalMaterial = includedLocations.reduce(
    (sum, l) => sum + l.material_subtotal,
    0,
  )

  // For grand total section: sum material + installation per included location
  const subtotalForGrand = includedLocations.reduce(
    (sum, l) => sum + l.location_total,
    0,
  )

  return (
    <div
      className="quote-preview-doc"
      style={{
        maxWidth: 900,
        margin: '0 auto',
        fontFamily: 'var(--font-body)',
        background: '#fff',
        color: '#111',
      }}
    >
      {/* ── QUOTE PAGE ─────────────────────────────────────────────────────── */}
      <div className="print-page quote-page" style={pageStyle}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          {/* Left: org */}
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#111', lineHeight: 1 }}>
              {orgName}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4, letterSpacing: '0.04em' }}>
              Management Software
            </div>
            {orgAddress && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 8, maxWidth: 280, lineHeight: 1.5 }}>
                {orgAddress}
              </div>
            )}
            {orgGstin && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                GSTIN: <strong>{orgGstin}</strong>
              </div>
            )}
          </div>

          {/* Right: quote meta */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#888',
              marginBottom: 4,
            }}>
              Quotation
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#111' }}>
              {quote.quote_no}
            </div>
            {quote.revision > 0 && (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#c8860a', marginTop: 2 }}>
                Revision {quote.revision}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
              Date: <strong>{fmtDate(quote.date)}</strong>
            </div>
            {quote.valid_until && (
              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                Valid Until: <strong>{fmtDate(quote.valid_until)}</strong>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <StatusBadge status={quote.status} />
            </div>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ borderTop: '2px solid #111', marginBottom: 16 }} />

        {/* META GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Customer */}
          <div>
            <div style={sectionLabelStyle}>Customer</div>
            {quote.customer ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 2 }}>
                  {quote.customer.name}
                </div>
                {quote.customer.contact_person && (
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                    Attn: {quote.customer.contact_person}
                  </div>
                )}
                {quote.customer.billing_address && (
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {quote.customer.billing_address}
                  </div>
                )}
                {quote.customer.gstin && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    GSTIN: {quote.customer.gstin}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#aaa' }}>No customer linked</div>
            )}
          </div>

          {/* Subject / Scope */}
          <div>
            <div style={sectionLabelStyle}>Subject</div>
            {quote.subject && (
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8, lineHeight: 1.4 }}>
                {quote.subject}
              </div>
            )}
            {locationNames.length > 0 && (
              <div style={{ fontSize: 12, color: '#555' }}>
                <span style={{ fontWeight: 600 }}>{locationNames.length} location{locationNames.length > 1 ? 's' : ''}:</span>{' '}
                {locationNames.join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* ── LOCATIONS ─────────────────────────────────────────────────────── */}
        {includedLocations.map((loc) => (
          <LocationBlock key={loc.id} loc={loc} />
        ))}

        {/* ── GRAND TOTAL ───────────────────────────────────────────────────── */}
        <GrandTotalSection
          quote={quote}
          subtotalForGrand={subtotalForGrand}
          grandTotalMaterial={grandTotalMaterial}
        />

        {/* ── NOTES ─────────────────────────────────────────────────────────── */}
        {quote.notes && (
          <div style={{ marginTop: 24, padding: '12px 16px', background: '#fafafa', borderLeft: '3px solid #ddd', borderRadius: 2 }}>
            <div style={sectionLabelStyle}>Notes</div>
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {quote.notes}
            </div>
          </div>
        )}

        {/* ── TERMS & CONDITIONS ────────────────────────────────────────────── */}
        {quote.terms.length > 0 && (
          <TermsSection terms={quote.terms} />
        )}
      </div>

      {/* ── BOQ SUMMARY PAGE ──────────────────────────────────────────────────── */}
      {quote.include_boq_summary && (
        <div
          className="print-page boq-page"
          style={{ ...pageStyle, pageBreakBefore: 'always', marginTop: 48 }}
        >
          <BoqSummaryPage
            quote={quote}
            orgName={orgName}
            includedLocations={includedLocations}
          />
        </div>
      )}

      {/* ── Print styles ──────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .quote-preview-doc { max-width: 100%; }
          .print-page { page-break-after: always; padding: 24px !important; }
          .print-page:last-child { page-break-after: auto; }

          /* data-print="quote" → only show quote page */
          body[data-print="quote"] .boq-page { display: none !important; }

          /* data-print="boq" → only show boq page */
          body[data-print="boq"] .quote-page { display: none !important; }

          /* data-print="both" → show all (default) */
        }
      `}</style>
    </div>
  )
}

// ─── Location block ───────────────────────────────────────────────────────────

function LocationBlock({ loc }: { loc: QuoteLocationRow }) {
  const hasInstallation = loc.installation_charge > 0

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Dark header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#1a1a2e',
        color: '#fff',
        padding: '8px 14px',
        borderRadius: '4px 4px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>📍</span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            {loc.name}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
          {fmtINR(loc.location_total)}
        </span>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
            <Th align="left"  style={{ width: '28%' }}>Item</Th>
            <Th align="left"  style={{ width: '14%' }}>Brand</Th>
            <Th align="center" style={{ width: '8%' }}>Unit</Th>
            <Th align="right" style={{ width: '12%' }}>Rate</Th>
            <Th align="center" style={{ width: '8%' }}>Qty</Th>
            <Th align="right" style={{ width: '12%' }}>Disc</Th>
            <Th align="right" style={{ width: '14%' }}>Total</Th>
          </tr>
        </thead>
        <tbody>
          {loc.items.sort((a, b) => a.sort_order - b.sort_order).map((item, idx) => {
            const discountAmount = item.rate * item.qty * (item.discount_pct / 100)
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                <Td>
                  <div style={{ fontWeight: 600, color: '#111' }}>{item.name}</div>
                  {item.description && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{item.description}</div>
                  )}
                </Td>
                <Td style={{ color: '#555' }}>{item.brand ?? '—'}</Td>
                <Td align="center" style={{ color: '#555' }}>{item.unit ?? '—'}</Td>
                <Td align="right">{fmtINR(item.rate)}</Td>
                <Td align="center">{item.qty}</Td>
                <Td align="right">
                  {item.discount_pct > 0 ? (
                    <div>
                      <div style={{ color: '#c8860a', fontWeight: 600 }}>{item.discount_pct}%</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>— {fmtINR(discountAmount)}</div>
                    </div>
                  ) : (
                    <span style={{ color: '#ccc' }}>—</span>
                  )}
                </Td>
                <Td align="right" style={{ fontWeight: 600 }}>{fmtINR(item.total)}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Subtotals */}
      <div style={{ border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
        {/* Material subtotal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '7px 14px',
          background: '#f0f4f8',
          fontSize: 12,
          fontWeight: 600,
          color: '#333',
          borderBottom: hasInstallation ? '1px solid #ddd' : undefined,
        }}>
          <span>Material Subtotal</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmtINR(loc.material_subtotal)}</span>
        </div>

        {/* Installation row */}
        {hasInstallation && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '7px 14px',
            background: '#fffbeb',
            fontSize: 12,
            fontWeight: 600,
            color: '#92400e',
            borderBottom: '1px solid #ddd',
          }}>
            <span>
              Installation
              {loc.installation_note && (
                <span style={{ fontWeight: 400, color: '#b45309', marginLeft: 6 }}>
                  — {loc.installation_note}
                </span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmtINR(loc.installation_charge)}</span>
          </div>
        )}

        {/* Location total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: '#1a1a2e',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
        }}>
          <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>
            Total — {loc.name.toUpperCase()}{hasInstallation ? ' (INCL. INSTALLATION)' : ''}
          </span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}>
            {fmtINR(loc.location_total)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Grand total section ──────────────────────────────────────────────────────

function GrandTotalSection({
  quote,
  subtotalForGrand,
  grandTotalMaterial,
}: {
  quote: QuoteDetail
  subtotalForGrand: number
  grandTotalMaterial: number
}) {
  const hasTransport  = quote.transport > 0
  const hasGst        = quote.gst_mode === 'add'

  return (
    <div style={{ marginTop: 16, marginBottom: 24 }}>
      <div style={{ borderTop: '2px solid #111', paddingTop: 12 }}>
        <div style={{ maxWidth: 320, marginLeft: 'auto' }}>
          <div style={totalRowStyle()}>
            <span>Material Subtotal</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmtINR(grandTotalMaterial)}</span>
          </div>

          {hasGst && (
            <div style={totalRowStyle()}>
              <span>GST ({quote.gst_pct}%)</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmtINR(quote.gst_amount)}</span>
            </div>
          )}

          {hasTransport && (
            <div style={totalRowStyle()}>
              <span>
                Transport
                {quote.transport_note && (
                  <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>— {quote.transport_note}</span>
                )}
              </span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmtINR(quote.transport)}</span>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 14px',
            marginTop: 4,
            background: '#1a1a2e',
            color: '#fff',
            borderRadius: 4,
            fontSize: 15,
            fontWeight: 800,
          }}>
            <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 12 }}>Grand Total</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 16 }}>{fmtINR(quote.grand_total)}</span>
          </div>

          {quote.gst_mode === 'add' && (
            <div style={{ fontSize: 10, color: '#888', textAlign: 'right', marginTop: 6 }}>
              * GST {quote.gst_pct}% added on taxable amount
            </div>
          )}
          {quote.gst_mode === 'inclusive' && (
            <div style={{ fontSize: 10, color: '#888', textAlign: 'right', marginTop: 6 }}>
              * GST {quote.gst_pct}% inclusive — GST component: {fmtINR(quote.gst_amount)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Terms & Conditions ───────────────────────────────────────────────────────

function TermsSection({ terms }: { terms: QuoteTermRow[] }) {
  const sorted = [...terms].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <div style={{ marginTop: 28, borderTop: '1px solid #ddd', paddingTop: 16 }}>
      <div style={{ ...sectionLabelStyle, marginBottom: 10 }}>Terms &amp; Conditions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <TermBadge category={t.category} />
            <div style={{ fontSize: 12, color: '#333', lineHeight: 1.6, paddingTop: 1 }}>
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── BOQ Summary page ─────────────────────────────────────────────────────────

function BoqSummaryPage({
  quote,
  orgName,
  includedLocations,
}: {
  quote: QuoteDetail
  orgName: string
  includedLocations: QuoteLocationRow[]
}) {
  const grandMaterial     = includedLocations.reduce((s, l) => s + l.material_subtotal, 0)
  const grandInstallation = includedLocations.reduce((s, l) => s + l.installation_charge, 0)
  const grandTotal        = includedLocations.reduce((s, l) => s + l.location_total, 0)

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111' }}>{orgName}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Management Software</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#888' }}>
            BOQ Summary
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#111', marginTop: 2 }}>
            {quote.quote_no}
          </div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
            {fmtDate(quote.date)}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '2px solid #111', marginBottom: 16 }} />

      {/* Customer + project */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div>
          <div style={sectionLabelStyle}>Customer</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{quote.customer?.name ?? '—'}</div>
          {quote.customer?.contact_person && (
            <div style={{ fontSize: 12, color: '#555' }}>Attn: {quote.customer.contact_person}</div>
          )}
        </div>
        <div>
          <div style={sectionLabelStyle}>Project</div>
          {quote.subject && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{quote.subject}</div>
          )}
        </div>
      </div>

      {/* BOQ table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#1a1a2e', color: '#fff' }}>
            <Th align="left"  style={{ width: '40%', color: '#fff', borderColor: '#1a1a2e' }}>Area / Location</Th>
            <Th align="right" style={{ color: '#fff', borderColor: '#1a1a2e' }}>Material</Th>
            <Th align="right" style={{ color: '#fff', borderColor: '#1a1a2e' }}>Installation</Th>
            <Th align="right" style={{ color: '#fff', borderColor: '#1a1a2e' }}>Total</Th>
          </tr>
        </thead>
        <tbody>
          {includedLocations.map((loc, idx) => (
            <tr key={loc.id} style={{ borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
              <Td style={{ fontWeight: 600 }}>{loc.name}</Td>
              <Td align="right" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmtINR(loc.material_subtotal)}</Td>
              <Td align="right" style={{ fontFamily: 'var(--font-mono, monospace)', color: loc.installation_charge > 0 ? '#92400e' : '#ccc' }}>
                {loc.installation_charge > 0 ? fmtINR(loc.installation_charge) : '—'}
              </Td>
              <Td align="right" style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>{fmtINR(loc.location_total)}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#1a1a2e', color: '#fff', fontWeight: 700 }}>
            <td style={{ padding: '9px 12px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Grand Total
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>
              {fmtINR(grandMaterial)}
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>
              {grandInstallation > 0 ? fmtINR(grandInstallation) : '—'}
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontSize: 14 }}>
              {fmtINR(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* GST note for BOQ */}
      {quote.gst_mode === 'add' && (
        <div style={{ marginTop: 12, fontSize: 11, color: '#888', textAlign: 'right' }}>
          * Above amounts exclude GST. GST @ {quote.gst_pct}% applicable additionally.
        </div>
      )}
      {quote.gst_mode === 'inclusive' && (
        <div style={{ marginTop: 12, fontSize: 11, color: '#888', textAlign: 'right' }}>
          * GST @ {quote.gst_pct}% is inclusive in the above amounts.
        </div>
      )}
    </>
  )
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  padding: '40px 48px',
  background: '#fff',
  color: '#111',
  minHeight: '297mm',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#999',
  marginBottom: 6,
}

function totalRowStyle(): React.CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 14px',
    fontSize: 12,
    color: '#444',
    borderBottom: '1px solid #eee',
  }
}

function Th({
  children,
  align = 'left',
  style,
}: {
  children?: React.ReactNode
  align?: 'left' | 'right' | 'center'
  style?: React.CSSProperties
}) {
  return (
    <th style={{
      padding: '7px 12px',
      textAlign: align,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#555',
      borderBottom: '1px solid #ddd',
      ...style,
    }}>
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  style,
}: {
  children?: React.ReactNode
  align?: 'left' | 'right' | 'center'
  style?: React.CSSProperties
}) {
  return (
    <td style={{
      padding: '7px 12px',
      textAlign: align,
      verticalAlign: 'top',
      fontSize: 12,
      ...style,
    }}>
      {children}
    </td>
  )
}
