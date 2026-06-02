import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { PO_PAGE_SIZE, type PoFilter } from '@/validations/purchase-order'

// ── Helpers ───────────────────────────────────────────────────────────────────

const n   = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string)  => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return Types ──────────────────────────────────────────────────────────────

export type PoRow = {
  id:              string
  poNo:            string
  invoiceId:       string
  invoiceNo:       string
  vendorId:        string
  vendorName:      string
  customerRef:     string | null
  subject:         string | null
  date:            string
  expectedDelivery:string | null
  status:          string
  grandTotal:      number
  itemCount:       number
  createdAt:       string
}

export type PoPage = {
  rows: PoRow[]; total: number; page: number; pageSize: number; totalPages: number
}

export type PoStats = {
  total: number; draft: number; pendingApproval: number; approved: number
  sent: number; partiallyReceived: number; received: number; closed: number; cancelled: number
  totalValue: number
}

export type PoItemRow = {
  id:              string
  invoiceItemId:   string | null
  itemId:          string | null
  name:            string
  description:     string | null
  hsnCode:         string | null
  brand:           string | null
  unit:            string | null
  invoiceQty:      number
  stockAtCreation: number
  currentStock:    number          // live stock fetched from items table
  qtyOrdered:      number
  qtyReceived:     number
  rate:            number
  discountPct:     number
  taxableValue:    number
  gstPct:          number
  cgstPct:         number
  sgstPct:         number
  igstPct:         number
  cgstAmount:      number
  sgstAmount:      number
  igstAmount:      number
  total:           number
  sortOrder:       number
  // Computed
  stockStatus:     'sufficient' | 'low' | 'out' | 'unknown'
  needsOrdering:   number          // max(0, invoiceQty - currentStock)
}

export type PoStatusHistoryRow = {
  id:         string
  fromStatus: string | null
  toStatus:   string
  note:       string | null
  changedBy:  string | null
  changedAt:  string
}

export type GrnRow = {
  id:           string
  grnNo:        string
  date:         string
  deliveryNote: string | null
  notes:        string | null
  createdAt:    string
  items: {
    id:          string
    poItemId:    string
    itemName:    string
    qtyReceived: number
    batchNo:     string | null
  }[]
}

export type PoDetail = {
  id:              string
  poNo:            string
  invoiceId:       string
  invoiceNo:       string
  vendorId:        string
  vendorName:      string
  vendorPhone:     string | null
  vendorEmail:     string | null
  vendorGstin:     string | null
  customerRef:     string | null
  subject:         string | null
  date:            string
  expectedDelivery:string | null
  status:          string
  gstMode:         string
  gstPct:          number
  isIgst:          boolean
  transport:       number
  transportNote:   string | null
  taxableValue:    number
  cgstAmount:      number
  sgstAmount:      number
  igstAmount:      number
  totalGst:        number
  grandTotal:      number
  paymentTerms:    string | null
  advanceAmount:   number
  advancePaid:     boolean
  notes:           string | null
  internalNotes:   string | null
  terms:           { category: string; text: string }[]
  approvedBy:      string | null
  approvedAt:      string | null
  sentAt:          string | null
  items:           PoItemRow[]
  grns:            GrnRow[]
  statusHistory:   PoStatusHistoryRow[]
  createdAt:       string
  updatedAt:       string
}

// ── listPurchaseOrders ────────────────────────────────────────────────────────

export async function listPurchaseOrders(filter: PoFilter): Promise<PoPage> {
  const { orgId, supabase } = await ctx()
  const ps = PO_PAGE_SIZE
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: ps, totalPages: 0 }

  let q = supabase
    .from('purchase_orders')
    .select(
      `id,po_no,invoice_id,vendor_id,customer_ref,subject,date,expected_delivery,status,grand_total,created_at,
       invoices(id,invoice_no),
       vendors(id,name)`,
      { count: 'exact' },
    )
    .eq('org_id', orgId).is('deleted_at', null)

  if (filter.q) {
    const t = san(filter.q)
    q = q.or(`po_no.ilike.%${t}%,subject.ilike.%${t}%,customer_ref.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.vendorId) q = q.eq('vendor_id', filter.vendorId)

  const sortCol = filter.sort === 'grand_total' ? 'grand_total'
    : filter.sort === 'po_no'            ? 'po_no'
    : filter.sort === 'expected_delivery' ? 'expected_delivery'
    : 'date'
  const asc  = (filter.order ?? 'desc') === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * ps

  q = q.order(sortCol, { ascending: asc }).range(from, from + ps - 1)
  const { data, count } = await q
  const total = count ?? 0
  const ids   = (data ?? []).map(r => r.id as string)

  // Item counts
  const itemCountById: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: items } = await supabase.from('po_items').select('po_id').in('po_id', ids)
    for (const i of items ?? []) {
      const pid = i.po_id as string
      itemCountById[pid] = (itemCountById[pid] ?? 0) + 1
    }
  }

  return {
    rows: (data ?? []).map(r => {
      const inv = r.invoices as unknown as { id: string; invoice_no: string } | null
      const ven = r.vendors  as unknown as { id: string; name: string } | null
      return {
        id:              r.id as string,
        poNo:            r.po_no as string,
        invoiceId:       r.invoice_id as string,
        invoiceNo:       inv?.invoice_no ?? '',
        vendorId:        r.vendor_id as string,
        vendorName:      ven?.name ?? '',
        customerRef:     r.customer_ref as string | null,
        subject:         r.subject as string | null,
        date:            r.date as string,
        expectedDelivery:r.expected_delivery as string | null,
        status:          r.status as string,
        grandTotal:      n(r.grand_total),
        itemCount:       itemCountById[r.id as string] ?? 0,
        createdAt:       r.created_at as string,
      }
    }),
    total, page, pageSize: ps, totalPages: Math.ceil(total / ps),
  }
}

// ── getPurchaseOrder ──────────────────────────────────────────────────────────

export async function getPurchaseOrder(id: string): Promise<PoDetail | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data: r } = await supabase
    .from('purchase_orders')
    .select(
      `id,po_no,invoice_id,vendor_id,customer_ref,subject,date,expected_delivery,status,
       gst_mode,gst_pct,is_igst,transport,transport_note,
       taxable_value,cgst_amount,sgst_amount,igst_amount,total_gst,grand_total,
       payment_terms,advance_amount,advance_paid,notes,internal_notes,terms,
       approved_by,approved_at,sent_at,created_at,updated_at,
       invoices(id,invoice_no),
       vendors(id,name,phone,email,gstin)`,
    )
    .eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle()

  if (!r) return null

  const inv = r.invoices as unknown as { id: string; invoice_no: string } | null
  const ven = r.vendors  as unknown as { id: string; name: string; phone: string | null; email: string | null; gstin: string | null } | null

  // Fetch po_items and live stock
  const { data: itemData } = await supabase
    .from('po_items')
    .select('id,invoice_item_id,item_id,name,description,hsn_code,brand,unit,invoice_qty,stock_at_creation,qty_ordered,qty_received,rate,discount_pct,taxable_value,gst_pct,cgst_pct,sgst_pct,igst_pct,cgst_amount,sgst_amount,igst_amount,total,sort_order')
    .eq('po_id', id).order('sort_order', { ascending: true })

  // Get live stock for all matched items
  const itemIds = (itemData ?? []).filter(i => i.item_id).map(i => i.item_id as string)
  const stockMap: Record<string, number> = {}
  if (itemIds.length > 0) {
    const { data: stockData } = await supabase.from('items').select('id,stock').in('id', itemIds)
    for (const s of stockData ?? []) stockMap[s.id as string] = n(s.stock)
  }

  const items: PoItemRow[] = (itemData ?? []).map(i => {
    const currentStock = i.item_id ? (stockMap[i.item_id as string] ?? 0) : 0
    const invoiceQty   = n(i.invoice_qty)
    const hasItem      = !!i.item_id
    const stockStatus: PoItemRow['stockStatus'] = !hasItem ? 'unknown'
      : currentStock === 0 ? 'out'
      : currentStock < invoiceQty ? 'low'
      : 'sufficient'
    return {
      id:              i.id as string,
      invoiceItemId:   i.invoice_item_id as string | null,
      itemId:          i.item_id as string | null,
      name:            i.name as string,
      description:     i.description as string | null,
      hsnCode:         i.hsn_code as string | null,
      brand:           i.brand as string | null,
      unit:            i.unit as string | null,
      invoiceQty,
      stockAtCreation: n(i.stock_at_creation),
      currentStock,
      qtyOrdered:      n(i.qty_ordered),
      qtyReceived:     n(i.qty_received),
      rate:            n(i.rate),
      discountPct:     n(i.discount_pct),
      taxableValue:    n(i.taxable_value),
      gstPct:          n(i.gst_pct),
      cgstPct:         n(i.cgst_pct),
      sgstPct:         n(i.sgst_pct),
      igstPct:         n(i.igst_pct),
      cgstAmount:      n(i.cgst_amount),
      sgstAmount:      n(i.sgst_amount),
      igstAmount:      n(i.igst_amount),
      total:           n(i.total),
      sortOrder:       n(i.sort_order),
      stockStatus,
      needsOrdering:   Math.max(0, invoiceQty - currentStock),
    }
  })

  // Fetch GRNs
  const { data: grnData } = await supabase
    .from('goods_receipts')
    .select('id,grn_no,date,delivery_note,notes,created_at')
    .eq('po_id', id).order('date', { ascending: false })

  const grnIds = (grnData ?? []).map(g => g.id as string)
  const grnItemsByGrn: Record<string, GrnRow['items']> = {}
  if (grnIds.length > 0) {
    const { data: grnItems } = await supabase
      .from('grn_items')
      .select('id,grn_id,po_item_id,qty_received,batch_no,po_items(name)')
      .in('grn_id', grnIds)
    for (const gi of grnItems ?? []) {
      const gid = gi.grn_id as string
      if (!grnItemsByGrn[gid]) grnItemsByGrn[gid] = []
      const piName = (gi.po_items as unknown as { name: string } | null)?.name ?? 'Item'
      grnItemsByGrn[gid].push({
        id: gi.id as string, poItemId: gi.po_item_id as string,
        itemName: piName, qtyReceived: n(gi.qty_received), batchNo: gi.batch_no as string | null,
      })
    }
  }

  const grns: GrnRow[] = (grnData ?? []).map(g => ({
    id: g.id as string, grnNo: g.grn_no as string,
    date: g.date as string, deliveryNote: g.delivery_note as string | null,
    notes: g.notes as string | null, createdAt: g.created_at as string,
    items: grnItemsByGrn[g.id as string] ?? [],
  }))

  // Fetch status history
  const { data: histData } = await supabase
    .from('po_status_history')
    .select('id,from_status,to_status,note,changed_by,changed_at')
    .eq('po_id', id).order('changed_at', { ascending: true })

  const statusHistory: PoStatusHistoryRow[] = (histData ?? []).map(h => ({
    id: h.id as string, fromStatus: h.from_status as string | null,
    toStatus: h.to_status as string, note: h.note as string | null,
    changedBy: h.changed_by as string | null, changedAt: h.changed_at as string,
  }))

  return {
    id:              r.id as string,
    poNo:            r.po_no as string,
    invoiceId:       r.invoice_id as string,
    invoiceNo:       inv?.invoice_no ?? '',
    vendorId:        r.vendor_id as string,
    vendorName:      ven?.name ?? '',
    vendorPhone:     ven?.phone ?? null,
    vendorEmail:     ven?.email ?? null,
    vendorGstin:     ven?.gstin ?? null,
    customerRef:     r.customer_ref as string | null,
    subject:         r.subject as string | null,
    date:            r.date as string,
    expectedDelivery:r.expected_delivery as string | null,
    status:          r.status as string,
    gstMode:         r.gst_mode as string,
    gstPct:          n(r.gst_pct),
    isIgst:          Boolean(r.is_igst),
    transport:       n(r.transport),
    transportNote:   r.transport_note as string | null,
    taxableValue:    n(r.taxable_value),
    cgstAmount:      n(r.cgst_amount),
    sgstAmount:      n(r.sgst_amount),
    igstAmount:      n(r.igst_amount),
    totalGst:        n(r.total_gst),
    grandTotal:      n(r.grand_total),
    paymentTerms:    r.payment_terms as string | null,
    advanceAmount:   n(r.advance_amount),
    advancePaid:     Boolean(r.advance_paid),
    notes:           r.notes as string | null,
    internalNotes:   r.internal_notes as string | null,
    terms:           (r.terms as { category: string; text: string }[] | null) ?? [],
    approvedBy:      r.approved_by as string | null,
    approvedAt:      r.approved_at as string | null,
    sentAt:          r.sent_at as string | null,
    items, grns, statusHistory,
    createdAt:       r.created_at as string,
    updatedAt:       r.updated_at as string,
  }
}

// ── getPoStats ────────────────────────────────────────────────────────────────

export async function getPoStats(): Promise<PoStats> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { total:0, draft:0, pendingApproval:0, approved:0, sent:0, partiallyReceived:0, received:0, closed:0, cancelled:0, totalValue:0 }

  const { data } = await supabase
    .from('purchase_orders').select('status,grand_total').eq('org_id', orgId).is('deleted_at', null)

  const rows = data ?? []
  return {
    total:             rows.length,
    draft:             rows.filter(r => r.status === 'draft').length,
    pendingApproval:   rows.filter(r => r.status === 'pending_approval').length,
    approved:          rows.filter(r => r.status === 'approved').length,
    sent:              rows.filter(r => r.status === 'sent').length,
    partiallyReceived: rows.filter(r => r.status === 'partially_received').length,
    received:          rows.filter(r => r.status === 'received').length,
    closed:            rows.filter(r => r.status === 'closed').length,
    cancelled:         rows.filter(r => r.status === 'cancelled').length,
    totalValue:        rows.reduce((s, r) => s + n(r.grand_total), 0),
  }
}

// ── getLinkedPosForInvoice ────────────────────────────────────────────────────

export async function getLinkedPosForInvoice(invoiceId: string): Promise<
  { id: string; poNo: string; vendorName: string; status: string; grandTotal: number }[]
> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const { data } = await supabase
    .from('purchase_orders')
    .select('id,po_no,status,grand_total,vendors(id,name)')
    .eq('org_id', orgId).eq('invoice_id', invoiceId).is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (data ?? []).map(r => {
    const ven = r.vendors as unknown as { name: string } | null
    return {
      id: r.id as string, poNo: r.po_no as string,
      vendorName: ven?.name ?? '', status: r.status as string, grandTotal: n(r.grand_total),
    }
  })
}

// ── canCreatePoForInvoice ─────────────────────────────────────────────────────

export async function canCreatePoForInvoice(
  invoiceId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { allowed: false, reason: 'Not authenticated' }

  const { data: inv } = await supabase
    .from('invoices').select('id,status,invoice_no')
    .eq('id', invoiceId).eq('org_id', orgId).is('deleted_at', null).maybeSingle()

  if (!inv)                    return { allowed: false, reason: 'Invoice not found.' }
  if (inv.status !== 'issued') return { allowed: false, reason: `Invoice must be issued. Current status: ${inv.status}.` }
  return { allowed: true }
}

// ── getEligibleInvoicesForPo ──────────────────────────────────────────────────

export async function getEligibleInvoicesForPo(
  search?: string, page = 1, limit = 20,
): Promise<{
  items: { id: string; invoiceNo: string; subject: string | null; customerName: string | null; grandTotal: number; date: string }[]
  total: number
}> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { items: [], total: 0 }

  let q = supabase
    .from('invoices')
    .select('id,invoice_no,subject,grand_total,date,customers(id,name)', { count: 'exact' })
    .eq('org_id', orgId).eq('status', 'issued').is('deleted_at', null)
    .order('date', { ascending: false })

  if (search) {
    const t = san(search)
    q = q.or(`invoice_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }

  const { data } = await q.limit(500)

  const filtered = (data ?? []).map(r => {
    const cust = r.customers as unknown as { name: string } | null
    return {
      id: r.id as string, invoiceNo: r.invoice_no as string,
      subject: r.subject as string | null, customerName: cust?.name ?? null,
      grandTotal: n(r.grand_total), date: r.date as string,
    }
  })

  const total = filtered.length
  const items = filtered.slice((page - 1) * limit, (page - 1) * limit + limit)
  return { items, total }
}

// ── getNextPoNo ───────────────────────────────────────────────────────────────

export async function getNextPoNo(supabase: import('@supabase/supabase-js').SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('purchase_orders').select('id', { count: 'exact', head: true })
    .eq('org_id', orgId).like('po_no', `PO-${year}-%`)
  return `PO-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`
}
