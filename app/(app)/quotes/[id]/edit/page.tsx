import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { QuoteEditor } from '@/features/quotes/components/quote-editor'
import type { QuoteDetail, CustomerRef, ItemRef } from '@/features/quotes/components/quote-editor'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const orgId = await getActiveOrgId()
  if (!orgId) return { title: 'Edit Quote · Watcon' }
  const { data } = await supabase.from('quotes').select('quote_no,subject').eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle()
  if (!data) return { title: 'Edit Quote · Watcon' }
  return { title: `${data.subject ? `${data.quote_no} – ${data.subject}` : data.quote_no} · Edit · Watcon` }
}

export default async function QuoteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('quotes.edit')) redirect(`/quotes/${id}/preview`)

  const orgId = ctx.orgId
  const supabase = await createSupabaseServerClient()

  const [quoteRes, locRes, customersRes, itemsRes] = await Promise.all([
    // 1. Quote (terms stored as jsonb in quotes.terms)
    supabase
      .from('quotes')
      .select('id,quote_no,revision,customer_id,subject,date,valid_until,status,gst_mode,gst_pct,transport,transport_note,logo_url,include_boq_summary,notes,terms,material_subtotal,gst_amount,grand_total')
      .eq('id', id).eq('org_id', orgId).is('deleted_at', null)
      .maybeSingle(),

    // 2. Locations + items (separate query — nested joins don't work well with ordering)
    supabase
      .from('quote_locations')
      .select('id,name,sort_order,is_included,installation_charge,installation_note,material_subtotal,location_total')
      .eq('quote_id', id) // no .is('deleted_at',null) — quote_locations has no deleted_at
      .order('sort_order', { ascending: true }),

    // 3. Customers dropdown
    supabase.from('customers').select('id,code,name,contact_person,phone').eq('org_id', orgId).is('deleted_at', null).eq('status', 'active').order('name').limit(500),

    // 4. Items autocomplete
    supabase.from('items').select('id,name,sku,brands!items_brand_fkey(name),units!items_unit_fkey(code),selling_price,purchase_price').eq('org_id', orgId).is('deleted_at', null).eq('is_active', true).eq('is_template', false).order('name').limit(1000),
  ])

  if (!quoteRes.data) notFound()
  const raw = quoteRes.data

  // Allow editing all statuses — readonly banner shown inside the editor for accepted/cancelled

  // Fetch items for each location
  const locIds = (locRes.data ?? []).map((l: any) => l.id as string)
  const itemsByLoc: Record<string, any[]> = {}

  if (locIds.length > 0) {
    const { data: allItems } = await supabase
      .from('quote_items')
      .select('id,location_id,item_id,name,description,brand,unit,rate,qty,discount_pct,total,sort_order')
      .in('location_id', locIds)
      .order('sort_order', { ascending: true })

    for (const item of allItems ?? []) {
      const lid = item.location_id as string
      if (!itemsByLoc[lid]) itemsByLoc[lid] = []
      itemsByLoc[lid].push(item)
    }
  }

  // Parse terms from jsonb (stored as array of {category, text})
  const rawTerms = (raw.terms as { category: string; text: string }[] | null) ?? []
  const terms = rawTerms.map((t, i) => ({ id: `term-${i}`, category: t.category, text: t.text, sortOrder: i }))

  const quote: QuoteDetail = {
    id: raw.id as string,
    quoteNo: raw.quote_no as string,
    revision: Number(raw.revision) || 0,
    customerId: (raw.customer_id as string | null) ?? null,
    subject: (raw.subject as string | null) ?? null,
    date: raw.date as string,
    validUntil: (raw.valid_until as string | null) ?? null,
    status: raw.status as QuoteDetail['status'],
    gstMode: raw.gst_mode as QuoteDetail['gstMode'],
    gstPct: Number(raw.gst_pct) || 18,
    transport: Number(raw.transport) || 0,
    transportNote: (raw.transport_note as string | null) ?? null,
    logoUrl: (raw.logo_url as string | null) ?? null,
    includeBoqSummary: Boolean(raw.include_boq_summary),
    notes: (raw.notes as string | null) ?? null,
    materialSubtotal: Number(raw.material_subtotal) || 0,
    gstAmount: Number(raw.gst_amount) || 0,
    grandTotal: Number(raw.grand_total) || 0,
    locations: (locRes.data ?? []).map((loc: any) => ({
      id: loc.id as string,
      name: loc.name as string,
      sortOrder: Number(loc.sort_order) || 0,
      isIncluded: Boolean(loc.is_included),
      installationCharge: Number(loc.installation_charge) || 0,
      installationNote: (loc.installation_note as string | null) ?? null,
      materialSubtotal: Number(loc.material_subtotal) || 0,
      locationTotal: Number(loc.location_total) || 0,
      items: (itemsByLoc[loc.id as string] ?? []).map((item: any) => ({
        id: item.id as string,
        itemId: (item.item_id as string | null) ?? null,
        name: item.name as string,
        description: (item.description as string | null) ?? null,
        brand: (item.brand as string | null) ?? null,
        unit: (item.unit as string | null) ?? null,
        rate: Number(item.rate) || 0,
        qty: Number(item.qty) || 1,
        discountPct: Number(item.discount_pct) || 0,
        total: Number(item.total) || 0,
        sortOrder: Number(item.sort_order) || 0,
      })),
    })),
    terms,
  }

  const customers: CustomerRef[] = ((customersRes.data ?? []) as any[]).map((c) => ({
    id: c.id as string, code: c.code as string, name: c.name as string,
    contactPerson: (c.contact_person as string | null) ?? null,
    phone: (c.phone as string | null) ?? null,
  }))

  const items: ItemRef[] = ((itemsRes.data ?? []) as any[]).map((r) => {
    // PostgREST returns joined rows as arrays — handle both array and object
    const brandsRaw = r.brands
    const unitsRaw  = r.units
    const brandName = Array.isArray(brandsRaw) ? (brandsRaw[0]?.name ?? null) : (brandsRaw?.name ?? null)
    const unitCode  = Array.isArray(unitsRaw)  ? (unitsRaw[0]?.code  ?? null) : (unitsRaw?.code  ?? null)
    return {
      id: r.id as string,
      sku: (r.sku as string | null) ?? '',
      name: r.name as string,
      brand: brandName,
      unit: unitCode,
      sellingPrice: r.selling_price != null ? Number(r.selling_price) : 0,
      purchasePrice: r.purchase_price != null ? Number(r.purchase_price) : 0,
    }
  })

  const isReadOnly = raw.status === 'accepted' || raw.status === 'cancelled'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isReadOnly && (
        <div style={{
          padding: '10px 20px', background: 'var(--c-warning-bg)',
          borderBottom: '1px solid var(--c-warning)', flexShrink: 0,
          fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-warning)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <strong>{raw.status === 'accepted' ? 'Accepted' : 'Cancelled'}</strong>
          — This quote is locked. Changes will not be saved. Use Revise to create a new version.
        </div>
      )}
      <QuoteEditor quote={quote} customers={customers} items={items} canEdit={!isReadOnly} />
    </div>
  )
}
