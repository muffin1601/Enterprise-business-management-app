import { notFound } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getQuote } from '@/features/quotes/server/queries'
import { getActiveOrganization } from '@/features/company/server/queries'
import {
  QuotePreviewPrintBar,
  QuotePreviewView,
  type QuoteDetail as PreviewQuoteDetail,
} from '@/features/quotes/components/quote-preview'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quote = await getQuote(id)
  return { title: quote ? `${quote.quoteNo} · Preview · Watcon` : 'Quote Preview · Watcon' }
}

export default async function QuotePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await getActionContext()
  if (!ctx.has('quotes.view')) {
    return (
      <div style={{ padding:'14px 18px', margin:'24px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)', fontFamily:'var(--font-body)', fontSize:'var(--fs-500)' }}>
        You do not have permission to view quotes.
      </div>
    )
  }

  const [q, org] = await Promise.all([getQuote(id), getActiveOrganization()])
  if (!q) notFound()

  // Adapt camelCase query result → snake_case preview type
  const previewQuote: PreviewQuoteDetail = {
    id:                  q.id,
    quote_no:            q.quoteNo,
    revision:            q.revision,
    date:                q.date,
    valid_until:         q.validUntil,
    status:              q.status,
    subject:             q.subject,
    gst_mode:            q.gstMode as PreviewQuoteDetail['gst_mode'],
    gst_pct:             q.gstPct,
    transport:           q.transport,
    transport_note:      q.transportNote,
    include_boq_summary: q.includeBoqSummary,
    notes:               q.notes,
    material_subtotal:   q.materialSubtotal,
    gst_amount:          q.gstAmount,
    grand_total:         q.grandTotal,
    customer: (q as any).customerName ? {
      id:              (q as any).customerId ?? '',
      name:            (q as any).customerName ?? '',
      contact_person:  (q as any).customerContactPerson,
      billing_address: (q as any).customerBillingAddress,
      gstin:           null,
    } : null,
    locations: q.locations.map(l => ({
      id:                  l.id,
      name:                l.name,
      sort_order:          l.sortOrder,
      is_included:         l.isIncluded,
      installation_charge: l.installationCharge,
      installation_note:   l.installationNote,
      material_subtotal:   l.materialSubtotal,
      location_total:      l.locationTotal,
      items: l.items.map(i => ({
        id:           i.id,
        name:         i.name,
        description:  i.description,
        brand:        i.brand,
        unit:         i.unit,
        rate:         i.rate,
        qty:          i.qty,
        discount_pct: i.discountPct,
        total:        i.total,
        sort_order:   i.sortOrder,
      })),
    })),
    terms: q.terms.map(t => ({
      id:         t.id,
      category:   t.category,
      text:       t.text,
      sort_order: t.sortOrder,
    })),
  }

  return (
    <>
      <QuotePreviewPrintBar
        quoteId={q.id}
        quoteNo={q.quoteNo}
        includeBoqSummary={q.includeBoqSummary}
      />
      <QuotePreviewView
        quote={previewQuote}
        orgName={org?.name ?? ''}
        orgAddress={org?.address ?? undefined}
        orgGstin={org?.gstin ?? undefined}
      />
    </>
  )
}
