import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { RI_PAGE_SIZE, type RiFilter } from '@/validations/running-invoice'

const n   = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string)  => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return Types ──────────────────────────────────────────────────────────────

export type RiRow = {
  id:           string
  riNo:         string
  soId:         string
  soNo:         string
  customerId:   string | null
  customerName: string | null
  subject:      string | null
  date:         string
  dueDate:      string | null
  status:       string
  grandTotal:   number
  balanceDue:   number
  dcCount:      number
  itemCount:    number
  createdAt:    string
}

export type RiPage = { rows: RiRow[]; total: number; page: number; pageSize: number; totalPages: number }

export type RiStats = {
  total: number; draft: number; validated: number; posted: number; sent: number; cancelled: number
  totalValue: number; outstanding: number
}

export type RiItemRow = {
  id:              string
  dcId:            string
  dcNo:            string
  dcItemId:        string
  soItemId:        string | null
  itemId:          string | null
  name:            string
  description:     string | null
  hsnCode:         string | null
  brand:           string | null
  unit:            string | null
  qtyDelivered:    number
  qtyAlreadyBilled:number
  qtyToBill:       number
  unitPrice:       number
  discountPct:     number
  gstPct:          number
  cgstPct:         number
  sgstPct:         number
  igstPct:         number
  taxableValue:    number
  cgstAmount:      number
  sgstAmount:      number
  igstAmount:      number
  total:           number
  sortOrder:       number
}

export type RiSourceChallan = {
  id:           string
  dcId:         string
  dcNo:         string
  dispatchDate: string | null
  status:       string
  itemCount:    number
  qtyTotal:     number
}

export type RiStatusHistoryRow = {
  id: string; fromStatus: string | null; toStatus: string; note: string | null; changedBy: string | null; changedAt: string
}

export type RiDetail = {
  id:             string
  riNo:           string
  soId:           string
  soNo:           string
  customerId:     string | null
  customerName:   string | null
  customerPhone:  string | null
  customerEmail:  string | null
  subject:        string | null
  date:           string
  dueDate:        string | null
  status:         string
  billingName:    string | null
  billingAddress: string | null
  customerGstin:  string | null
  placeOfSupply:  string | null
  isIgst:         boolean
  gstPct:         number
  taxableValue:   number
  cgstAmount:     number
  sgstAmount:     number
  igstAmount:     number
  totalGst:       number
  grandTotal:     number
  amountReceived: number
  balanceDue:     number
  paymentTerms:   string | null
  notes:          string | null
  internalNotes:  string | null
  irn:            string | null
  postedAt:       string | null
  items:          RiItemRow[]
  challans:       RiSourceChallan[]
  statusHistory:  RiStatusHistoryRow[]
  createdAt:      string
  updatedAt:      string
}

export type UnbilledSummaryRow = {
  soId:         string
  soNo:         string
  customerId:   string | null
  customerName: string | null
  dcCount:      number
  oldestDcDate: string
  agingDays:    number
}

export type DeliverableChallan = {
  id:           string
  dcNo:         string
  date:         string
  dispatchDate: string | null
  itemCount:    number
  unbilledLines:number
}

// ── listRunningInvoices ───────────────────────────────────────────────────────

export async function listRunningInvoices(filter: RiFilter): Promise<RiPage> {
  const { orgId, supabase } = await ctx()
  const ps = RI_PAGE_SIZE
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: ps, totalPages: 0 }

  let q = supabase
    .from('running_invoices')
    .select(
      `id,ri_no,so_id,customer_id,subject,date,due_date,status,grand_total,balance_due,created_at,
       sales_orders(id,so_no),
       customers(id,name)`,
      { count: 'exact' },
    )
    .eq('org_id', orgId).is('deleted_at', null)

  if (filter.q) {
    const t = san(filter.q)
    q = q.or(`ri_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.customerId) q = q.eq('customer_id', filter.customerId)
  if (filter.soId)       q = q.eq('so_id', filter.soId)
  if (filter.dateFrom)   q = q.gte('date', filter.dateFrom.toISOString().split('T')[0]!)
  if (filter.dateTo)     q = q.lte('date', filter.dateTo.toISOString().split('T')[0]!)

  const sortCol = filter.sort === 'grand_total' ? 'grand_total'
    : filter.sort === 'due_date' ? 'due_date' : filter.sort === 'ri_no' ? 'ri_no' : 'date'
  const asc  = filter.order === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * ps

  q = q.order(sortCol, { ascending: asc }).range(from, from + ps - 1)
  const { data, count } = await q
  const total = count ?? 0
  const ids   = (data ?? []).map(r => r.id as string)

  // Counts
  const dcCountById:   Record<string, number> = {}
  const itemCountById: Record<string, number> = {}
  if (ids.length > 0) {
    const [{ data: rcs }, { data: ris }] = await Promise.all([
      supabase.from('ri_challans').select('ri_id').in('ri_id', ids),
      supabase.from('ri_items').select('ri_id').in('ri_id', ids),
    ])
    for (const r of rcs ?? []) { const id = r.ri_id as string; dcCountById[id] = (dcCountById[id] ?? 0) + 1 }
    for (const r of ris ?? [])  { const id = r.ri_id as string; itemCountById[id] = (itemCountById[id] ?? 0) + 1 }
  }

  return {
    rows: (data ?? []).map(r => {
      const so   = r.sales_orders as unknown as { so_no: string } | null
      const cust = r.customers    as unknown as { name: string }  | null
      return {
        id:           r.id as string,
        riNo:         r.ri_no as string,
        soId:         r.so_id as string,
        soNo:         so?.so_no ?? '',
        customerId:   r.customer_id as string | null,
        customerName: cust?.name ?? null,
        subject:      r.subject as string | null,
        date:         r.date as string,
        dueDate:      r.due_date as string | null,
        status:       r.status as string,
        grandTotal:   n(r.grand_total),
        balanceDue:   n(r.balance_due),
        dcCount:      dcCountById[r.id as string] ?? 0,
        itemCount:    itemCountById[r.id as string] ?? 0,
        createdAt:    r.created_at as string,
      }
    }),
    total, page, pageSize: ps, totalPages: Math.ceil(total / ps),
  }
}

// ── getRunningInvoice ─────────────────────────────────────────────────────────

export async function getRunningInvoice(id: string): Promise<RiDetail | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data: r } = await supabase
    .from('running_invoices')
    .select(
      `id,ri_no,so_id,customer_id,subject,date,due_date,status,billing_name,billing_address,customer_gstin,
       place_of_supply,is_igst,gst_pct,taxable_value,cgst_amount,sgst_amount,igst_amount,total_gst,grand_total,
       amount_received,balance_due,payment_terms,notes,internal_notes,irn,posted_at,created_at,updated_at,
       sales_orders(id,so_no),
       customers(id,name,phone,email)`,
    )
    .eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle()

  if (!r) return null

  const so   = r.sales_orders as unknown as { id: string; so_no: string } | null
  const cust = r.customers    as unknown as { id: string; name: string; phone: string | null; email: string | null } | null

  // Items
  const { data: itemData } = await supabase
    .from('ri_items')
    .select(`id,dc_id,dc_item_id,so_item_id,item_id,name,description,hsn_code,brand,unit,
             qty_delivered,qty_already_billed,qty_to_bill,unit_price,discount_pct,
             gst_pct,cgst_pct,sgst_pct,igst_pct,taxable_value,cgst_amount,sgst_amount,igst_amount,total,sort_order,
             delivery_challans!ri_items_dc_id_fkey(dc_no)`)
    .eq('ri_id', id).order('sort_order', { ascending: true })

  const items: RiItemRow[] = (itemData ?? []).map(i => ({
    id:               i.id as string,
    dcId:             i.dc_id as string,
    dcNo:             (i.delivery_challans as unknown as { dc_no: string } | null)?.dc_no ?? '',
    dcItemId:         i.dc_item_id as string,
    soItemId:         i.so_item_id as string | null,
    itemId:           i.item_id as string | null,
    name:             i.name as string,
    description:      i.description as string | null,
    hsnCode:          i.hsn_code as string | null,
    brand:            i.brand as string | null,
    unit:             i.unit as string | null,
    qtyDelivered:     n(i.qty_delivered),
    qtyAlreadyBilled: n(i.qty_already_billed),
    qtyToBill:        n(i.qty_to_bill),
    unitPrice:        n(i.unit_price),
    discountPct:      n(i.discount_pct),
    gstPct:           n(i.gst_pct),
    cgstPct:          n(i.cgst_pct),
    sgstPct:          n(i.sgst_pct),
    igstPct:          n(i.igst_pct),
    taxableValue:     n(i.taxable_value),
    cgstAmount:       n(i.cgst_amount),
    sgstAmount:       n(i.sgst_amount),
    igstAmount:       n(i.igst_amount),
    total:            n(i.total),
    sortOrder:        n(i.sort_order),
  }))

  // Source challans
  const { data: rcData } = await supabase
    .from('ri_challans')
    .select(`id,dc_id,delivery_challans!ri_challans_dc_id_fkey(dc_no,dispatch_date,status)`)
    .eq('ri_id', id)

  const dcIds = (rcData ?? []).map(rc => rc.dc_id as string)
  const itemCountByDc: Record<string, number> = {}
  const qtyByDc: Record<string, number> = {}
  for (const item of items) {
    itemCountByDc[item.dcId] = (itemCountByDc[item.dcId] ?? 0) + 1
    qtyByDc[item.dcId]       = (qtyByDc[item.dcId] ?? 0) + item.qtyToBill
  }

  const challans: RiSourceChallan[] = (rcData ?? []).map(rc => {
    const dc = rc.delivery_challans as unknown as { dc_no: string; dispatch_date: string | null; status: string } | null
    return {
      id:           rc.id as string,
      dcId:         rc.dc_id as string,
      dcNo:         dc?.dc_no ?? '',
      dispatchDate: dc?.dispatch_date ?? null,
      status:       dc?.status ?? '',
      itemCount:    itemCountByDc[rc.dc_id as string] ?? 0,
      qtyTotal:     qtyByDc[rc.dc_id as string] ?? 0,
    }
  })

  // Status history
  const { data: histData } = await supabase
    .from('ri_status_history')
    .select('id,from_status,to_status,note,changed_by,changed_at')
    .eq('ri_id', id).order('changed_at', { ascending: true })

  const statusHistory: RiStatusHistoryRow[] = (histData ?? []).map(h => ({
    id:         h.id as string,
    fromStatus: h.from_status as string | null,
    toStatus:   h.to_status as string,
    note:       h.note as string | null,
    changedBy:  h.changed_by as string | null,
    changedAt:  h.changed_at as string,
  }))

  return {
    id:             r.id as string,
    riNo:           r.ri_no as string,
    soId:           r.so_id as string,
    soNo:           so?.so_no ?? '',
    customerId:     r.customer_id as string | null,
    customerName:   cust?.name ?? null,
    customerPhone:  cust?.phone ?? null,
    customerEmail:  cust?.email ?? null,
    subject:        r.subject as string | null,
    date:           r.date as string,
    dueDate:        r.due_date as string | null,
    status:         r.status as string,
    billingName:    r.billing_name as string | null,
    billingAddress: r.billing_address as string | null,
    customerGstin:  r.customer_gstin as string | null,
    placeOfSupply:  r.place_of_supply as string | null,
    isIgst:         Boolean(r.is_igst),
    gstPct:         n(r.gst_pct),
    taxableValue:   n(r.taxable_value),
    cgstAmount:     n(r.cgst_amount),
    sgstAmount:     n(r.sgst_amount),
    igstAmount:     n(r.igst_amount),
    totalGst:       n(r.total_gst),
    grandTotal:     n(r.grand_total),
    amountReceived: n(r.amount_received),
    balanceDue:     n(r.balance_due),
    paymentTerms:   r.payment_terms as string | null,
    notes:          r.notes as string | null,
    internalNotes:  r.internal_notes as string | null,
    irn:            r.irn as string | null,
    postedAt:       r.posted_at as string | null,
    items, challans, statusHistory,
    createdAt:      r.created_at as string,
    updatedAt:      r.updated_at as string,
  }
}

// ── getRiStats ────────────────────────────────────────────────────────────────

export async function getRiStats(): Promise<RiStats> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { total:0, draft:0, validated:0, posted:0, sent:0, cancelled:0, totalValue:0, outstanding:0 }
  const { data } = await supabase.from('running_invoices').select('status,grand_total,balance_due').eq('org_id', orgId).is('deleted_at', null)
  const rows = data ?? []
  return {
    total:      rows.length,
    draft:      rows.filter(r => r.status === 'draft').length,
    validated:  rows.filter(r => r.status === 'validated').length,
    posted:     rows.filter(r => r.status === 'posted').length,
    sent:       rows.filter(r => r.status === 'sent').length,
    cancelled:  rows.filter(r => r.status === 'cancelled').length,
    totalValue: rows.reduce((s, r) => s + n(r.grand_total), 0),
    outstanding:rows.filter(r => ['posted','sent'].includes(r.status as string)).reduce((s, r) => s + n(r.balance_due), 0),
  }
}

// ── getUnbilledDcWorklist ─────────────────────────────────────────────────────

export async function getUnbilledDcWorklist(): Promise<UnbilledSummaryRow[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const today = new Date().toISOString().split('T')[0]!

  // Delivered DCs with no invoiced_at
  const { data: dcs } = await supabase
    .from('delivery_challans')
    .select(`id,date,so_id,invoiced_at,
             sales_orders!inner(id,so_no,customer_id,customers(id,name))`)
    .eq('org_id', orgId).eq('status', 'delivered').is('invoiced_at', null).is('deleted_at', null)
    .order('date', { ascending: true })

  if (!dcs || dcs.length === 0) return []

  // Group by SO
  const soMap: Record<string, {
    soNo: string; customerId: string | null; customerName: string | null
    dcs: { id: string; date: string }[]
  }> = {}

  for (const dc of dcs) {
    const so = dc.sales_orders as unknown as { id: string; so_no: string; customer_id: string | null; customers: { name: string } | null } | null
    const sid = dc.so_id as string
    if (!soMap[sid]) {
      soMap[sid] = { soNo: so?.so_no ?? '', customerId: so?.customer_id ?? null, customerName: so?.customers?.name ?? null, dcs: [] }
    }
    soMap[sid].dcs.push({ id: dc.id as string, date: dc.date as string })
  }

  return Object.entries(soMap).map(([soId, data]) => {
    const oldestDate = data.dcs[0]!.date
    const agingDays  = Math.floor((new Date(today).getTime() - new Date(oldestDate).getTime()) / 86400000)
    return {
      soId, soNo: data.soNo, customerId: data.customerId, customerName: data.customerName,
      dcCount: data.dcs.length, oldestDcDate: oldestDate, agingDays,
    }
  }).sort((a, b) => b.agingDays - a.agingDays)
}

// ── getDeliverableChallansForSo ───────────────────────────────────────────────

export async function getDeliverableChallansForSo(soId: string): Promise<DeliverableChallan[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const { data: dcs } = await supabase
    .from('delivery_challans')
    .select('id,dc_no,date,dispatch_date')
    .eq('org_id', orgId).eq('so_id', soId).eq('status', 'delivered')
    .is('invoiced_at', null).is('deleted_at', null)
    .order('date', { ascending: true })

  if (!dcs || dcs.length === 0) return []

  const dcIds = dcs.map(d => d.id as string)
  const { data: dcItems } = await supabase
    .from('dc_items').select('dc_id,qty_dispatched,so_item_id').in('dc_id', dcIds)

  // For each dc_item, check unbilled qty vs so_item.qty_invoiced
  const soItemIds = [...new Set((dcItems ?? []).filter(i => i.so_item_id).map(i => i.so_item_id as string))]
  const qtyInvoicedMap: Record<string, number> = {}
  if (soItemIds.length > 0) {
    const { data: soItems } = await supabase.from('so_items').select('id,qty_invoiced').in('id', soItemIds)
    for (const si of soItems ?? []) qtyInvoicedMap[si.id as string] = n(si.qty_invoiced)
  }

  const unbilledByDc: Record<string, number> = {}
  const itemCountByDc: Record<string, number> = {}
  for (const item of dcItems ?? []) {
    const dcId      = item.dc_id as string
    const qtyInv    = item.so_item_id ? (qtyInvoicedMap[item.so_item_id as string] ?? 0) : 0
    const unbilled  = Math.max(0, n(item.qty_dispatched) - qtyInv)
    unbilledByDc[dcId]  = (unbilledByDc[dcId] ?? 0) + unbilled
    itemCountByDc[dcId] = (itemCountByDc[dcId] ?? 0) + 1
  }

  return dcs.map(d => ({
    id:           d.id as string,
    dcNo:         d.dc_no as string,
    date:         d.date as string,
    dispatchDate: d.dispatch_date as string | null,
    itemCount:    itemCountByDc[d.id as string] ?? 0,
    unbilledLines:unbilledByDc[d.id as string] ?? 0,
  }))
}

// ── getLinkedRisForSo ─────────────────────────────────────────────────────────

export async function getLinkedRisForSo(soId: string): Promise<
  { id: string; riNo: string; status: string; grandTotal: number; date: string }[]
> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []
  const { data } = await supabase
    .from('running_invoices')
    .select('id,ri_no,status,grand_total,date')
    .eq('org_id', orgId).eq('so_id', soId).is('deleted_at', null)
    .order('date', { ascending: false })
  return (data ?? []).map(r => ({
    id: r.id as string, riNo: r.ri_no as string,
    status: r.status as string, grandTotal: n(r.grand_total), date: r.date as string,
  }))
}

// ── getLinkedRiForDc ──────────────────────────────────────────────────────────

export async function getLinkedRiForDc(dcId: string): Promise<
  { id: string; riNo: string; status: string } | null
> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null
  const { data } = await supabase
    .from('delivery_challans')
    .select('running_invoice_id,running_invoices(id,ri_no,status)')
    .eq('id', dcId).maybeSingle()
  if (!data?.running_invoice_id) return null
  const ri = data.running_invoices as unknown as { id: string; ri_no: string; status: string } | null
  return ri ? { id: ri.id, riNo: ri.ri_no, status: ri.status } : null
}

// ── getNextRiNo ───────────────────────────────────────────────────────────────

export async function getNextRiNo(supabase: import('@supabase/supabase-js').SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('running_invoices').select('id', { count: 'exact', head: true })
    .eq('org_id', orgId).like('ri_no', `RI-${year}-%`)
  return `RI-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`
}

// ── validateRiForPosting ──────────────────────────────────────────────────────

export async function validateRiForPosting(id: string): Promise<{ valid: boolean; failures: string[] }> {
  const { orgId, supabase } = await ctx()
  const failures: string[] = []
  if (!orgId) return { valid: false, failures: ['Not authenticated'] }

  const { data: ri } = await supabase
    .from('running_invoices')
    .select('id,grand_total,customer_id,so_id,status')
    .eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle()

  if (!ri) return { valid: false, failures: ['Running invoice not found.'] }
  if (ri.status === 'posted') return { valid: false, failures: ['Already posted.'] }

  const { data: items } = await supabase.from('ri_items').select('qty_to_bill,unit_price').eq('ri_id', id)
  const billableItems = (items ?? []).filter(i => n(i.qty_to_bill) > 0)
  if (billableItems.length === 0) failures.push('No billable items (all quantities are zero).')

  const zeroPriceItems = billableItems.filter(i => n(i.unit_price) === 0)
  if (zeroPriceItems.length > 0) failures.push(`${zeroPriceItems.length} item(s) have zero unit price.`)

  if (n(ri.grand_total) <= 0) failures.push('Grand total must be greater than zero.')

  // Check no DC already in another posted RI
  const { data: rcs } = await supabase.from('ri_challans').select('dc_id').eq('ri_id', id)
  const dcIds = (rcs ?? []).map(r => r.dc_id as string)
  if (dcIds.length === 0) failures.push('No delivery challans selected.')

  return { valid: failures.length === 0, failures }
}
