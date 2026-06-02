import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { DC_PAGE_SIZE, type DcFilter } from '@/validations/delivery-challan'

const n   = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string)  => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return Types ──────────────────────────────────────────────────────────────

export type DcRow = {
  id:           string
  dcNo:         string
  invoiceId:    string
  invoiceNo:    string
  customerId:   string | null
  customerName: string | null
  subject:      string | null
  date:         string
  dispatchDate: string | null
  status:       string
  itemCount:    number
  createdAt:    string
}

export type DcPage = {
  rows: DcRow[]; total: number; page: number; pageSize: number; totalPages: number
}

export type DcStats = {
  total: number; draft: number; dispatched: number; delivered: number; cancelled: number
}

export type DcItemRow = {
  id:              string
  invoiceItemId:   string | null
  itemId:          string | null
  name:            string
  description:     string | null
  hsnCode:         string | null
  brand:           string | null
  unit:            string | null
  invoiceQty:      number
  qtyDispatched:   number
  stockAtCreation: number
  currentStock:    number       // live
  sortOrder:       number
}

export type DcStatusHistoryRow = {
  id:         string
  fromStatus: string | null
  toStatus:   string
  note:       string | null
  changedBy:  string | null
  changedAt:  string
}

export type DcDetail = {
  id:               string
  dcNo:             string
  invoiceId:        string
  invoiceNo:        string
  customerId:       string | null
  customerName:     string | null
  customerPhone:    string | null
  customerEmail:    string | null
  soId:             string | null
  subject:          string | null
  date:             string
  dispatchDate:     string | null
  expectedDelivery: string | null
  status:           string
  vehicleNo:        string | null
  driverName:       string | null
  lrNo:             string | null
  transporterName:  string | null
  deliveryAddress:  string | null
  siteContactName:  string | null
  siteContactPhone: string | null
  notes:            string | null
  internalNotes:    string | null
  stockDeducted:    boolean
  items:            DcItemRow[]
  statusHistory:    DcStatusHistoryRow[]
  createdAt:        string
  updatedAt:        string
}

// ── listChallans ──────────────────────────────────────────────────────────────

export async function listChallans(filter: DcFilter): Promise<DcPage> {
  const { orgId, supabase } = await ctx()
  const ps = DC_PAGE_SIZE
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: ps, totalPages: 0 }

  let q = supabase
    .from('delivery_challans')
    .select(
      `id,dc_no,invoice_id,customer_id,subject,date,dispatch_date,status,created_at,
       invoices(id,invoice_no),
       customers(id,name)`,
      { count: 'exact' },
    )
    .eq('org_id', orgId).is('deleted_at', null)

  if (filter.q) {
    const t = san(filter.q)
    q = q.or(`dc_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.customerId) q = q.eq('customer_id', filter.customerId)
  if (filter.dateFrom)   q = q.gte('date', filter.dateFrom.toISOString().split('T')[0])
  if (filter.dateTo)     q = q.lte('date', filter.dateTo.toISOString().split('T')[0])

  const sortCol = filter.sort === 'dc_no' ? 'dc_no'
    : filter.sort === 'dispatch_date' ? 'dispatch_date'
    : 'date'
  const asc  = (filter.order ?? 'desc') === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * ps

  q = q.order(sortCol, { ascending: asc }).range(from, from + ps - 1)
  const { data, count } = await q
  const total = count ?? 0
  const ids   = (data ?? []).map(r => r.id as string)

  const itemCountById: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: items } = await supabase.from('dc_items').select('dc_id').in('dc_id', ids)
    for (const i of items ?? []) {
      const did = i.dc_id as string
      itemCountById[did] = (itemCountById[did] ?? 0) + 1
    }
  }

  return {
    rows: (data ?? []).map(r => {
      const inv  = r.invoices  as unknown as { id: string; invoice_no: string } | null
      const cust = r.customers as unknown as { id: string; name: string } | null
      return {
        id:           r.id as string,
        dcNo:         r.dc_no as string,
        invoiceId:    r.invoice_id as string,
        invoiceNo:    inv?.invoice_no ?? '',
        customerId:   r.customer_id as string | null,
        customerName: cust?.name ?? null,
        subject:      r.subject as string | null,
        date:         r.date as string,
        dispatchDate: r.dispatch_date as string | null,
        status:       r.status as string,
        itemCount:    itemCountById[r.id as string] ?? 0,
        createdAt:    r.created_at as string,
      }
    }),
    total, page, pageSize: ps, totalPages: Math.ceil(total / ps),
  }
}

// ── getChallan ────────────────────────────────────────────────────────────────

export async function getChallan(id: string): Promise<DcDetail | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data: r } = await supabase
    .from('delivery_challans')
    .select(
      `id,dc_no,invoice_id,customer_id,so_id,subject,date,dispatch_date,expected_delivery,status,
       vehicle_no,driver_name,lr_no,transporter_name,delivery_address,site_contact_name,site_contact_phone,
       notes,internal_notes,stock_deducted,created_at,updated_at,
       invoices(id,invoice_no),
       customers(id,name,phone,email)`,
    )
    .eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle()

  if (!r) return null

  const inv  = r.invoices  as unknown as { id: string; invoice_no: string } | null
  const cust = r.customers as unknown as { id: string; name: string; phone: string | null; email: string | null } | null

  // Fetch dc_items + live stock
  const { data: itemData } = await supabase
    .from('dc_items')
    .select('id,invoice_item_id,item_id,name,description,hsn_code,brand,unit,invoice_qty,qty_dispatched,stock_at_creation,sort_order')
    .eq('dc_id', id).order('sort_order', { ascending: true })

  const itemIds = (itemData ?? []).filter(i => i.item_id).map(i => i.item_id as string)
  const stockMap: Record<string, number> = {}
  if (itemIds.length > 0) {
    const { data: sd } = await supabase.from('items').select('id,stock').in('id', itemIds)
    for (const s of sd ?? []) stockMap[s.id as string] = n(s.stock)
  }

  const items: DcItemRow[] = (itemData ?? []).map(i => ({
    id:              i.id as string,
    invoiceItemId:   i.invoice_item_id as string | null,
    itemId:          i.item_id as string | null,
    name:            i.name as string,
    description:     i.description as string | null,
    hsnCode:         i.hsn_code as string | null,
    brand:           i.brand as string | null,
    unit:            i.unit as string | null,
    invoiceQty:      n(i.invoice_qty),
    qtyDispatched:   n(i.qty_dispatched),
    stockAtCreation: n(i.stock_at_creation),
    currentStock:    i.item_id ? (stockMap[i.item_id as string] ?? 0) : 0,
    sortOrder:       n(i.sort_order),
  }))

  const { data: histData } = await supabase
    .from('dc_status_history')
    .select('id,from_status,to_status,note,changed_by,changed_at')
    .eq('dc_id', id).order('changed_at', { ascending: true })

  const statusHistory: DcStatusHistoryRow[] = (histData ?? []).map(h => ({
    id:         h.id as string,
    fromStatus: h.from_status as string | null,
    toStatus:   h.to_status as string,
    note:       h.note as string | null,
    changedBy:  h.changed_by as string | null,
    changedAt:  h.changed_at as string,
  }))

  return {
    id:               r.id as string,
    dcNo:             r.dc_no as string,
    invoiceId:        r.invoice_id as string,
    invoiceNo:        inv?.invoice_no ?? '',
    customerId:       r.customer_id as string | null,
    customerName:     cust?.name ?? null,
    customerPhone:    cust?.phone ?? null,
    customerEmail:    cust?.email ?? null,
    soId:             r.so_id as string | null,
    subject:          r.subject as string | null,
    date:             r.date as string,
    dispatchDate:     r.dispatch_date as string | null,
    expectedDelivery: r.expected_delivery as string | null,
    status:           r.status as string,
    vehicleNo:        r.vehicle_no as string | null,
    driverName:       r.driver_name as string | null,
    lrNo:             r.lr_no as string | null,
    transporterName:  r.transporter_name as string | null,
    deliveryAddress:  r.delivery_address as string | null,
    siteContactName:  r.site_contact_name as string | null,
    siteContactPhone: r.site_contact_phone as string | null,
    notes:            r.notes as string | null,
    internalNotes:    r.internal_notes as string | null,
    stockDeducted:    Boolean(r.stock_deducted),
    items, statusHistory,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  }
}

// ── getChallanStats ───────────────────────────────────────────────────────────

export async function getChallanStats(): Promise<DcStats> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { total:0, draft:0, dispatched:0, delivered:0, cancelled:0 }
  const { data } = await supabase.from('delivery_challans').select('status').eq('org_id', orgId).is('deleted_at', null)
  const rows = data ?? []
  return {
    total:      rows.length,
    draft:      rows.filter(r => r.status === 'draft').length,
    dispatched: rows.filter(r => r.status === 'dispatched').length,
    delivered:  rows.filter(r => r.status === 'delivered').length,
    cancelled:  rows.filter(r => r.status === 'cancelled').length,
  }
}

// ── getLinkedChallansForInvoice ───────────────────────────────────────────────

export async function getLinkedChallansForInvoice(
  invoiceId: string,
): Promise<{ id: string; dcNo: string; status: string; dispatchDate: string | null }[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []
  const { data } = await supabase
    .from('delivery_challans')
    .select('id,dc_no,status,dispatch_date')
    .eq('org_id', orgId).eq('invoice_id', invoiceId).is('deleted_at', null)
    .order('created_at', { ascending: false })
  return (data ?? []).map(r => ({
    id:           r.id as string,
    dcNo:         r.dc_no as string,
    status:       r.status as string,
    dispatchDate: r.dispatch_date as string | null,
  }))
}

// ── getNextDcNo ───────────────────────────────────────────────────────────────

export async function getNextDcNo(supabase: import('@supabase/supabase-js').SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('delivery_challans').select('id', { count: 'exact', head: true })
    .eq('org_id', orgId).like('dc_no', `DC-${year}-%`)
  return `DC-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`
}
