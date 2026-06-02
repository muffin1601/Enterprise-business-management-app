import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { SO_PAGE_SIZE, type SoFilter } from '@/validations/sales-order'

// ── Helpers ───────────────────────────────────────────────────────────────────

const n   = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string)  => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return Types ──────────────────────────────────────────────────────────────

export type SoRow = {
  id:               string
  soNo:             string
  quoteId:          string
  quoteNo:          string
  customerId:       string | null
  customerName:     string | null
  subject:          string | null
  date:             string
  expectedDelivery: string | null
  status:           string
  priority:         string
  grandTotal:       number
  materialSubtotal: number
  gstAmount:        number
  advanceReceived:  boolean
  advanceAmount:    number
  locationCount:    number
  itemCount:        number
  createdAt:        string
}

export type SoPage = {
  rows:       SoRow[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export type SoStats = {
  total:      number
  confirmed:  number
  processing: number
  ready:      number
  dispatched: number
  delivered:  number
  invoiced:   number
  closed:     number
  cancelled:  number
  totalValue: number
}

export type SoStatusHistoryRow = {
  id:         string
  fromStatus: string | null
  toStatus:   string
  note:       string | null
  changedBy:  string | null
  changedAt:  string
}

export type SoItemRow = {
  id:           string
  locationId:   string
  quoteItemId:  string | null
  itemId:       string | null
  name:         string
  description:  string | null
  brand:        string | null
  unit:         string | null
  rate:         number
  qty:          number
  qtyDelivered: number
  discountPct:  number
  taxableValue: number
  total:        number
  sortOrder:    number
}

export type SoLocationRow = {
  id:                 string
  quoteLocationId:    string | null
  name:               string
  sortOrder:          number
  isIncluded:         boolean
  materialSubtotal:   number
  installationCharge: number
  installationNote:   string | null
  locationTotal:      number
  items:              SoItemRow[]
}

export type SoDetail = {
  id:               string
  soNo:             string
  quoteId:          string
  quoteNo:          string
  customerId:       string | null
  customerName:     string | null
  customerCode:     string | null
  customerPhone:    string | null
  customerEmail:    string | null
  subject:          string | null
  date:             string
  expectedDelivery: string | null
  status:           string
  priority:         string
  gstMode:          string
  gstPct:           number
  transport:        number
  transportNote:    string | null
  materialSubtotal: number
  gstAmount:        number
  grandTotal:       number
  advanceAmount:    number
  advanceReceived:  boolean
  advanceDate:      string | null
  advanceNote:      string | null
  deliveryAddress:  string | null
  siteContactName:  string | null
  siteContactPhone: string | null
  notes:            string | null
  internalNotes:    string | null
  terms:            { category: string; text: string }[]
  logoUrl:          string | null
  locations:        SoLocationRow[]
  statusHistory:    SoStatusHistoryRow[]
  createdAt:        string
  updatedAt:        string
}

// ── listSalesOrders ───────────────────────────────────────────────────────────

export async function listSalesOrders(filter: SoFilter): Promise<SoPage> {
  const { orgId, supabase } = await ctx()
  const ps = SO_PAGE_SIZE
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: ps, totalPages: 0 }

  let q = supabase
    .from('sales_orders')
    .select(
      `id,so_no,quote_id,customer_id,subject,date,expected_delivery,status,priority,
       grand_total,material_subtotal,gst_amount,advance_amount,advance_received,created_at,
       quotes(id,quote_no),
       customers(id,name)`,
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)

  if (filter.q) {
    const t = san(filter.q)
    q = q.or(`so_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all')   q = q.eq('status', filter.status)
  if (filter.priority && filter.priority !== 'all') q = q.eq('priority', filter.priority)
  if (filter.customerId) q = q.eq('customer_id', filter.customerId)
  if (filter.dateFrom)   q = q.gte('date', filter.dateFrom.toISOString().split('T')[0])
  if (filter.dateTo)     q = q.lte('date', filter.dateTo.toISOString().split('T')[0])

  const sortCol = filter.sort === 'grand_total'        ? 'grand_total'
    : filter.sort === 'so_no'           ? 'so_no'
    : filter.sort === 'expected_delivery' ? 'expected_delivery'
    : 'date'
  const asc  = (filter.order ?? 'desc') === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * ps

  q = q.order(sortCol, { ascending: asc }).range(from, from + ps - 1)

  const { data, count } = await q
  const total = count ?? 0
  const ids   = (data ?? []).map(r => r.id as string)

  // Fetch location + item counts
  const locationCountByso: Record<string, number> = {}
  const itemCountByso:     Record<string, number> = {}

  if (ids.length > 0) {
    const { data: locs } = await supabase
      .from('so_locations')
      .select('id,so_id')
      .in('so_id', ids)

    for (const l of locs ?? []) {
      const sid = l.so_id as string
      locationCountByso[sid] = (locationCountByso[sid] ?? 0) + 1
    }

    const locIds = (locs ?? []).map(l => l.id as string)
    if (locIds.length > 0) {
      const { data: items } = await supabase
        .from('so_items')
        .select('location_id,so_id')
        .in('location_id', locIds)

      for (const item of items ?? []) {
        const sid = item.so_id as string
        itemCountByso[sid] = (itemCountByso[sid] ?? 0) + 1
      }
    }
  }

  const rows: SoRow[] = (data ?? []).map(r => {
    const cust  = r.customers as unknown as { id: string; name: string } | null
    const quote = r.quotes    as unknown as { id: string; quote_no: string } | null
    return {
      id:               r.id as string,
      soNo:             r.so_no as string,
      quoteId:          r.quote_id as string,
      quoteNo:          quote?.quote_no ?? '',
      customerId:       r.customer_id as string | null,
      customerName:     cust?.name ?? null,
      subject:          r.subject as string | null,
      date:             r.date as string,
      expectedDelivery: r.expected_delivery as string | null,
      status:           r.status as string,
      priority:         r.priority as string,
      grandTotal:       n(r.grand_total),
      materialSubtotal: n(r.material_subtotal),
      gstAmount:        n(r.gst_amount),
      advanceReceived:  Boolean(r.advance_received),
      advanceAmount:    n(r.advance_amount),
      locationCount:    locationCountByso[r.id as string] ?? 0,
      itemCount:        itemCountByso[r.id as string] ?? 0,
      createdAt:        r.created_at as string,
    }
  })

  return { rows, total, page, pageSize: ps, totalPages: Math.ceil(total / ps) }
}

// ── getSalesOrder ─────────────────────────────────────────────────────────────

export async function getSalesOrder(id: string): Promise<SoDetail | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data: r } = await supabase
    .from('sales_orders')
    .select(
      `id,so_no,quote_id,customer_id,subject,date,expected_delivery,status,priority,
       gst_mode,gst_pct,transport,transport_note,material_subtotal,gst_amount,grand_total,
       advance_amount,advance_received,advance_date,advance_note,
       delivery_address,site_contact_name,site_contact_phone,
       notes,internal_notes,terms,logo_url,created_at,updated_at,
       quotes(id,quote_no,logo_url),
       customers(id,code,name,phone,email)`,
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!r) return null

  const cust  = r.customers as unknown as { id: string; code: string | null; name: string; phone: string | null; email: string | null } | null
  const quote = r.quotes    as unknown as { id: string; quote_no: string; logo_url: string | null } | null

  // Fetch locations
  const { data: locData } = await supabase
    .from('so_locations')
    .select('id,quote_location_id,name,sort_order,is_included,material_subtotal,installation_charge,installation_note,location_total')
    .eq('so_id', id)
    .order('sort_order', { ascending: true })

  const locIds = (locData ?? []).map(l => l.id as string)
  const itemsByLoc: Record<string, SoItemRow[]> = {}

  if (locIds.length > 0) {
    const { data: itemData } = await supabase
      .from('so_items')
      .select('id,location_id,quote_item_id,item_id,name,description,brand,unit,rate,qty,qty_delivered,discount_pct,taxable_value,total,sort_order,so_id')
      .in('location_id', locIds)
      .order('sort_order', { ascending: true })

    for (const item of itemData ?? []) {
      const lid = item.location_id as string
      if (!itemsByLoc[lid]) itemsByLoc[lid] = []
      itemsByLoc[lid].push({
        id:           item.id as string,
        locationId:   item.location_id as string,
        quoteItemId:  item.quote_item_id as string | null,
        itemId:       item.item_id as string | null,
        name:         item.name as string,
        description:  item.description as string | null,
        brand:        item.brand as string | null,
        unit:         item.unit as string | null,
        rate:         n(item.rate),
        qty:          n(item.qty),
        qtyDelivered: n(item.qty_delivered),
        discountPct:  n(item.discount_pct),
        taxableValue: n(item.taxable_value),
        total:        n(item.total),
        sortOrder:    n(item.sort_order),
      })
    }
  }

  const locations: SoLocationRow[] = (locData ?? []).map(l => ({
    id:                 l.id as string,
    quoteLocationId:    l.quote_location_id as string | null,
    name:               l.name as string,
    sortOrder:          n(l.sort_order),
    isIncluded:         Boolean(l.is_included),
    materialSubtotal:   n(l.material_subtotal),
    installationCharge: n(l.installation_charge),
    installationNote:   l.installation_note as string | null,
    locationTotal:      n(l.location_total),
    items:              itemsByLoc[l.id as string] ?? [],
  }))

  // Fetch status history
  const { data: histData } = await supabase
    .from('so_status_history')
    .select('id,from_status,to_status,note,changed_by,changed_at')
    .eq('so_id', id)
    .order('changed_at', { ascending: true })

  const statusHistory: SoStatusHistoryRow[] = (histData ?? []).map(h => ({
    id:         h.id as string,
    fromStatus: h.from_status as string | null,
    toStatus:   h.to_status as string,
    note:       h.note as string | null,
    changedBy:  h.changed_by as string | null,
    changedAt:  h.changed_at as string,
  }))

  const rawTerms = (r.terms as { category: string; text: string }[] | null) ?? []

  return {
    id:               r.id as string,
    soNo:             r.so_no as string,
    quoteId:          r.quote_id as string,
    quoteNo:          quote?.quote_no ?? '',
    customerId:       r.customer_id as string | null,
    customerName:     cust?.name ?? null,
    customerCode:     cust?.code ?? null,
    customerPhone:    cust?.phone ?? null,
    customerEmail:    cust?.email ?? null,
    subject:          r.subject as string | null,
    date:             r.date as string,
    expectedDelivery: r.expected_delivery as string | null,
    status:           r.status as string,
    priority:         r.priority as string,
    gstMode:          r.gst_mode as string,
    gstPct:           n(r.gst_pct),
    transport:        n(r.transport),
    transportNote:    r.transport_note as string | null,
    materialSubtotal: n(r.material_subtotal),
    gstAmount:        n(r.gst_amount),
    grandTotal:       n(r.grand_total),
    advanceAmount:    n(r.advance_amount),
    advanceReceived:  Boolean(r.advance_received),
    advanceDate:      r.advance_date as string | null,
    advanceNote:      r.advance_note as string | null,
    deliveryAddress:  r.delivery_address as string | null,
    siteContactName:  r.site_contact_name as string | null,
    siteContactPhone: r.site_contact_phone as string | null,
    notes:            r.notes as string | null,
    internalNotes:    r.internal_notes as string | null,
    terms:            rawTerms,
    logoUrl:          (r.logo_url as string | null) ?? (quote?.logo_url ?? null),
    locations,
    statusHistory,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  }
}

// ── getSalesOrderStats ────────────────────────────────────────────────────────

export async function getSalesOrderStats(): Promise<SoStats> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { total:0, confirmed:0, processing:0, ready:0, dispatched:0, delivered:0, invoiced:0, closed:0, cancelled:0, totalValue:0 }

  const { data } = await supabase
    .from('sales_orders')
    .select('status,grand_total')
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const rows = data ?? []
  return {
    total:      rows.length,
    confirmed:  rows.filter(r => r.status === 'confirmed').length,
    processing: rows.filter(r => r.status === 'processing').length,
    ready:      rows.filter(r => r.status === 'ready').length,
    dispatched: rows.filter(r => r.status === 'dispatched').length,
    delivered:  rows.filter(r => r.status === 'delivered').length,
    invoiced:   rows.filter(r => r.status === 'invoiced').length,
    closed:     rows.filter(r => r.status === 'closed').length,
    cancelled:  rows.filter(r => r.status === 'cancelled').length,
    totalValue: rows.reduce((s, r) => s + n(r.grand_total), 0),
  }
}

// ── getLinkedSoForQuote ───────────────────────────────────────────────────────

export async function getLinkedSoForQuote(
  quoteId: string,
): Promise<{ id: string; soNo: string; status: string } | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data } = await supabase
    .from('sales_orders')
    .select('id,so_no,status')
    .eq('org_id', orgId)
    .eq('quote_id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null
  return { id: data.id as string, soNo: data.so_no as string, status: data.status as string }
}

// ── canCreateSoForQuote ───────────────────────────────────────────────────────

export async function canCreateSoForQuote(
  quoteId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { allowed: false, reason: 'Not authenticated' }

  const { data: quote } = await supabase
    .from('quotes')
    .select('id,status,quote_no')
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!quote)                      return { allowed: false, reason: 'Quote not found.' }
  if (quote.status !== 'accepted') return { allowed: false, reason: `Quote must be accepted. Current status: ${quote.status}.` }

  const existing = await getLinkedSoForQuote(quoteId)
  if (existing)                    return { allowed: false, reason: `Sales Order ${existing.soNo} already exists for this quote.` }

  return { allowed: true }
}

// ── getAcceptedQuotesWithoutSo ────────────────────────────────────────────────
// Used by the quote-picker in the "New Sales Order" flow.

export async function getAcceptedQuotesWithoutSo(
  search?: string,
  page = 1,
  limit = 20,
): Promise<{
  quotes: { id: string; quoteNo: string; subject: string | null; customerName: string | null; grandTotal: number }[]
  total: number
}> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { quotes: [], total: 0 }

  // Get all accepted quote IDs that already have an SO
  const { data: existingSos } = await supabase
    .from('sales_orders')
    .select('quote_id')
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const usedQuoteIds = (existingSos ?? []).map(s => s.quote_id as string)

  let q = supabase
    .from('quotes')
    .select('id,quote_no,subject,grand_total,customers(id,name)', { count: 'exact' })
    .eq('org_id', orgId)
    .eq('status', 'accepted')
    .is('deleted_at', null)
    .order('date', { ascending: false })

  if (search) {
    const t = san(search)
    q = q.or(`quote_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }

  // Fetch a larger batch to account for filtering out used quotes, then paginate client-side
  const { data } = await q.limit(500)

  const filtered = (data ?? [])
    .filter(r => !usedQuoteIds.includes(r.id as string))
    .map(r => {
      const cust = r.customers as unknown as { name: string } | null
      return {
        id:           r.id as string,
        quoteNo:      r.quote_no as string,
        subject:      r.subject as string | null,
        customerName: cust?.name ?? null,
        grandTotal:   n(r.grand_total),
      }
    })

  const total = filtered.length
  const from  = (page - 1) * limit
  const quotes = filtered.slice(from, from + limit)

  return { quotes, total }
}
