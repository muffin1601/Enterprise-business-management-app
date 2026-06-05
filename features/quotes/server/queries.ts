import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { PAGE_SIZE, type QuoteFilter } from '@/validations/quote'
import type { QuoteDetail } from '../components/quote-editor'

// ── Helpers ───────────────────────────────────────────────────────────────────
const n   = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string)  => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId   = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return types ──────────────────────────────────────────────────────────────
export type QuoteRow = {
  id: string
  quoteNo: string
  revision: number
  parentId: string | null
  customerId: string | null
  customerName: string | null
  subject: string | null
  date: string
  status: string
  gstMode: string
  gstPct: number
  transport: number
  grandTotal: number
  materialSubtotal: number
  gstAmount: number
  locationCount: number
  itemCount: number
  locationNames: string[]
  hasInstallation: boolean
  createdAt: string
}

export type QuotePage = {
  rows: QuoteRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type QuoteStats = {
  total: number; draft: number; sent: number
  accepted: number; revised: number; cancelled: number
  totalValue: number
}

// ── listQuotes ────────────────────────────────────────────────────────────────
export async function listQuotes(filter: QuoteFilter): Promise<QuotePage> {
  const { orgId, supabase } = await ctx()
  const ps = PAGE_SIZE ?? 20
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: ps, totalPages: 0 }

  let q = supabase
    .from('quotes')
    .select(
      `id,quote_no,revision,parent_id,customer_id,subject,date,status,
       gst_mode,gst_pct,transport,grand_total,material_subtotal,gst_amount,created_at,
       customers(id,name)`,
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)

  if (filter.q) {
    const t = san(filter.q)
    q = q.or(`quote_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.customerId) q = q.eq('customer_id', filter.customerId)

  const sortCol = filter.sort === 'grand_total' ? 'grand_total'
    : filter.sort === 'quote_no' ? 'quote_no' : 'date'
  const asc  = (filter.order ?? 'desc') === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * ps

  q = q.order(sortCol, { ascending: asc }).range(from, from + ps - 1)

  const { data, count } = await q
  const total = count ?? 0
  const ids   = (data ?? []).map(r => r.id as string)

  // ── Fetch location meta for cards ─────────────────────────────────────────
  let locationsByQuote: Record<string, { name: string; installation: boolean }[]> = {}

  // itemCountByQuote tracks total items across all locations per quote
  const itemCountByQuote: Record<string, number> = {}

  if (ids.length > 0) {
    // quote_locations has NO deleted_at column — do not filter on it
    const { data: locs } = await supabase
      .from('quote_locations')
      .select('id,quote_id,name,installation_charge')
      .in('quote_id', ids)
      .order('sort_order', { ascending: true })

    for (const l of locs ?? []) {
      const qid = l.quote_id as string
      if (!locationsByQuote[qid]) locationsByQuote[qid] = []
      locationsByQuote[qid].push({
        name:         l.name as string,
        installation: n(l.installation_charge) > 0,
      })
    }

    // Fetch item counts per location, then roll up to quote level
    const locIds = (locs ?? []).map(l => l.id as string)
    if (locIds.length > 0) {
      const { data: items } = await supabase
        .from('quote_items')
        .select('location_id')
        .in('location_id', locIds)

      // Map location → quote for rollup
      const locToQuote: Record<string, string> = {}
      for (const l of locs ?? []) locToQuote[l.id as string] = l.quote_id as string

      for (const item of items ?? []) {
        const qid = locToQuote[item.location_id as string]
        if (qid) itemCountByQuote[qid] = (itemCountByQuote[qid] ?? 0) + 1
      }
    }
  }

  const rows: QuoteRow[] = (data ?? []).map(r => {
    const cust  = r.customers as unknown as { id: string; name: string } | null
    const locs  = locationsByQuote[r.id as string] ?? []
    return {
      id:               r.id as string,
      quoteNo:          r.quote_no as string,
      revision:         n(r.revision),
      parentId:         r.parent_id as string | null,
      customerId:       r.customer_id as string | null,
      customerName:     cust?.name ?? null,
      subject:          r.subject as string | null,
      date:             r.date as string,
      status:           r.status as string,
      gstMode:          r.gst_mode as string,
      gstPct:           n(r.gst_pct),
      transport:        n(r.transport),
      grandTotal:       n(r.grand_total),
      materialSubtotal: n(r.material_subtotal),
      gstAmount:        n(r.gst_amount),
      locationCount:    locs.length,
      itemCount:        itemCountByQuote[r.id as string] ?? 0,
      locationNames:    locs.map(l => l.name),
      hasInstallation:  locs.some(l => l.installation),
      createdAt:        r.created_at as string,
    }
  })

  return { rows, total, page, pageSize: ps, totalPages: Math.ceil(total / ps) }
}

// ── getQuote ──────────────────────────────────────────────────────────────────
export async function getQuote(id: string): Promise<QuoteDetail | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data: r } = await supabase
    .from('quotes')
    .select(
      `id,quote_no,revision,parent_id,customer_id,subject,date,valid_until,
       status,gst_mode,gst_pct,transport,transport_note,logo_url,
       include_boq_summary,notes,terms,
       material_subtotal,gst_amount,grand_total,created_at,updated_at,
       customers(id,code,name,phone,email,billing_address,contact_person)`,
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!r) return null

  const cust = r.customers as unknown as {
    id: string; code: string | null; name: string
    phone: string | null; email: string | null
    billing_address: string | null; contact_person: string | null
  } | null

  const { data: locData } = await supabase
    .from('quote_locations')
    .select('id,name,sort_order,is_included,material_subtotal,installation_charge,installation_pct,installation_note,location_total')
    .eq('quote_id', id)
    // quote_locations has no deleted_at column — do NOT filter on it
    .order('sort_order', { ascending: true })

  const locIds = (locData ?? []).map(l => l.id as string)
  type QItem = { id: string; itemId: string|null; name: string; description: string|null; brand: string|null; unit: string|null; rate: number; qty: number; discountPct: number; total: number; sortOrder: number }
  const itemsByLoc: Record<string, QItem[]> = {}

  if (locIds.length > 0) {
    const { data: itemData } = await supabase
      .from('quote_items')
      .select('id,location_id,item_id,name,description,brand,unit,rate,qty,discount_pct,taxable_value,total,sort_order')
      .in('location_id', locIds)
      .order('sort_order', { ascending: true })

    for (const item of itemData ?? []) {
      const lid = item.location_id as string
      if (!itemsByLoc[lid]) itemsByLoc[lid] = []
      itemsByLoc[lid].push({
        id:           item.id as string,
        itemId:       item.item_id as string | null,
        name:         item.name as string,
        description:  item.description as string | null,
        brand:        item.brand as string | null,
        unit:         item.unit as string | null,
        rate:         n(item.rate),
        qty:          n(item.qty),
        discountPct:  n(item.discount_pct),
        total:        n(item.total),
        sortOrder:    n(item.sort_order),
      })
    }
  }

  const locations = (locData ?? []).map(l => ({
    id:                 l.id as string,
    name:               l.name as string,
    sortOrder:          n(l.sort_order),
    isIncluded:         Boolean(l.is_included),
    materialSubtotal:   n(l.material_subtotal),
    installationCharge: n(l.installation_charge),
    installationPct:    l.installation_pct == null ? null : n(l.installation_pct),
    installationNote:   l.installation_note as string | null,
    locationTotal:      n(l.location_total),
    items:              itemsByLoc[l.id as string] ?? [],
  }))

  // Parse terms from jsonb
  const rawTerms = (r.terms as { category: string; text: string }[] | null) ?? []
  const terms = rawTerms.map((t, i) => ({
    id: `term-${i}`, category: t.category, text: t.text, sortOrder: i,
  }))

  const detail: QuoteDetail & {
    parentId: string | null
    customerName: string | null; customerCode: string | null
    customerPhone: string | null; customerEmail: string | null
    customerBillingAddress: string | null; customerContactPerson: string | null
    createdAt: string; updatedAt: string
  } = {
    id:                     r.id as string,
    quoteNo:                r.quote_no as string,
    revision:               n(r.revision),
    parentId:               r.parent_id as string | null,
    customerId:             r.customer_id as string | null,
    customerName:           cust?.name ?? null,
    customerCode:           cust?.code ?? null,
    customerPhone:          cust?.phone ?? null,
    customerEmail:          cust?.email ?? null,
    customerBillingAddress: cust?.billing_address ?? null,
    customerContactPerson:  cust?.contact_person ?? null,
    subject:                r.subject as string | null,
    date:                   r.date as string,
    validUntil:             r.valid_until as string | null,
    status:                 r.status as QuoteDetail['status'],
    gstMode:                r.gst_mode as 'add' | 'inclusive' | 'none',
    gstPct:                 n(r.gst_pct),
    transport:              n(r.transport),
    transportNote:          r.transport_note as string | null,
    logoUrl:                (r.logo_url as string | null) ?? null,
    includeBoqSummary:      Boolean(r.include_boq_summary),
    grandTotal:             n(r.grand_total),
    materialSubtotal:       n(r.material_subtotal),
    gstAmount:              n(r.gst_amount),
    notes:                  r.notes as string | null,
    createdAt:              r.created_at as string,
    updatedAt:              r.updated_at as string,
    locations,
    terms,
  }
  return detail
}

// ── getQuoteStats ─────────────────────────────────────────────────────────────
export async function getQuoteStats(): Promise<QuoteStats> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { total:0, draft:0, sent:0, accepted:0, revised:0, cancelled:0, totalValue:0 }

  const { data } = await supabase
    .from('quotes').select('status,grand_total').eq('org_id', orgId).is('deleted_at', null)

  const rows = data ?? []
  return {
    total:      rows.length,
    draft:      rows.filter(r => r.status === 'draft').length,
    sent:       rows.filter(r => r.status === 'sent').length,
    accepted:   rows.filter(r => r.status === 'accepted').length,
    revised:    rows.filter(r => r.status === 'revised').length,
    cancelled:  rows.filter(r => r.status === 'cancelled').length,
    totalValue: rows.reduce((s, r) => s + n(r.grand_total), 0),
  }
}

// ── getNextQuoteNo ────────────────────────────────────────────────────────────
export async function getNextQuoteNo(): Promise<string> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return `QT-${new Date().getFullYear()}-001`
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('quotes').select('*', { count: 'exact', head: true })
    .eq('org_id', orgId).like('quote_no', `QT-${year}-%`)
  return `QT-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`
}
