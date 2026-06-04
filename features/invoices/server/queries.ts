import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { INV_PAGE_SIZE, type InvoiceFilter } from '@/validations/invoice'

// ── Helpers ───────────────────────────────────────────────────────────────────

const n   = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string)  => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return Types ──────────────────────────────────────────────────────────────

export type InvoiceRow = {
  id:           string
  invoiceNo:    string
  soId:         string
  soNo:         string
  customerId:   string | null
  customerName: string | null
  subject:      string | null
  date:         string
  dueDate:      string | null
  status:       string
  grandTotal:   number
  amountPaid:   number
  balanceDue:   number
  isOverdue:    boolean
  itemCount:    number
  createdAt:    string
}

export type InvoicePage = {
  rows:       InvoiceRow[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export type InvoiceStats = {
  total:        number
  draft:        number
  issued:       number
  paid:         number
  partiallyPaid:number
  cancelled:    number
  overdue:      number
  totalValue:   number
  totalOutstanding: number
}

export type InvoiceItemRow = {
  id:          string
  soItemId:    string | null
  itemId:      string | null
  name:        string
  description: string | null
  hsnCode:     string | null
  brand:       string | null
  unit:        string | null
  rate:        number
  qty:         number
  discountPct: number
  taxableValue:number
  gstPct:      number
  cgstPct:     number
  sgstPct:     number
  igstPct:     number
  cgstAmount:  number
  sgstAmount:  number
  igstAmount:  number
  total:       number
  sortOrder:   number
}

export type InvoicePaymentRow = {
  id:          string
  amount:      number
  paymentDate: string
  paymentMode: string
  referenceNo: string | null
  note:        string | null
  recordedBy:  string | null
  createdAt:   string
}

export type InvoiceStatusHistoryRow = {
  id:         string
  fromStatus: string | null
  toStatus:   string
  note:       string | null
  changedBy:  string | null
  changedAt:  string
}

export type InvoiceDetail = {
  id:            string
  invoiceNo:     string
  soId:          string
  soNo:          string
  quoteId:       string | null
  quoteNo:       string | null
  customerId:    string | null
  customerName:  string | null
  customerCode:  string | null
  customerPhone: string | null
  customerEmail: string | null
  billToName:    string | null
  billToAddress: string | null
  billToPhone:   string | null
  billToEmail:   string | null
  billToGstin:   string | null
  subject:       string | null
  date:          string
  dueDate:       string | null
  status:        string
  placeOfSupply: string | null
  gstMode:       string
  gstPct:        number
  isIgst:        boolean
  taxableValue:  number
  transport:     number
  transportNote: string | null
  cgstAmount:    number
  sgstAmount:    number
  igstAmount:    number
  totalGst:      number
  grandTotal:    number
  amountPaid:    number
  balanceDue:    number
  paymentTerms:  string | null
  notes:         string | null
  terms:         { category: string; text: string }[]
  logoUrl:       string | null
  issuedAt:      string | null
  items:         InvoiceItemRow[]
  payments:      InvoicePaymentRow[]
  statusHistory: InvoiceStatusHistoryRow[]
  createdAt:     string
  updatedAt:     string
}

// ── listInvoices ──────────────────────────────────────────────────────────────

export async function listInvoices(filter: InvoiceFilter): Promise<InvoicePage> {
  const { orgId, supabase } = await ctx()
  const ps = INV_PAGE_SIZE
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: ps, totalPages: 0 }

  const today = new Date().toISOString().split('T')[0]!

  let q = supabase
    .from('invoices')
    .select(
      `id,invoice_no,so_id,customer_id,subject,date,due_date,status,
       grand_total,amount_paid,balance_due,created_at,
       sales_orders(id,so_no),
       customers(id,name)`,
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)

  if (filter.q) {
    const t = san(filter.q)
    q = q.or(`invoice_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.customerId) q = q.eq('customer_id', filter.customerId)
  if (filter.dateFrom)   q = q.gte('date', filter.dateFrom.toISOString().split('T')[0])
  if (filter.dateTo)     q = q.lte('date', filter.dateTo.toISOString().split('T')[0])
  if (filter.overdue)    q = q.lt('due_date', today).in('status', ['issued','partially_paid'])

  const sortCol = filter.sort === 'grand_total' ? 'grand_total'
    : filter.sort === 'due_date'    ? 'due_date'
    : filter.sort === 'invoice_no'  ? 'invoice_no'
    : 'date'
  const asc  = (filter.order ?? 'desc') === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * ps

  q = q.order(sortCol, { ascending: asc }).range(from, from + ps - 1)

  const { data, count } = await q
  const total = count ?? 0

  // Fetch item counts
  const ids = (data ?? []).map(r => r.id as string)
  const itemCountById: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id')
      .in('invoice_id', ids)
    for (const item of items ?? []) {
      const iid = item.invoice_id as string
      itemCountById[iid] = (itemCountById[iid] ?? 0) + 1
    }
  }

  const rows: InvoiceRow[] = (data ?? []).map(r => {
    const cust = r.customers    as unknown as { name: string } | null
    const so   = r.sales_orders as unknown as { so_no: string } | null
    const due  = r.due_date as string | null
    const isOverdue = !!(due && due < today && ['issued','partially_paid'].includes(r.status as string))
    return {
      id:           r.id as string,
      invoiceNo:    r.invoice_no as string,
      soId:         r.so_id as string,
      soNo:         so?.so_no ?? '',
      customerId:   r.customer_id as string | null,
      customerName: cust?.name ?? null,
      subject:      r.subject as string | null,
      date:         r.date as string,
      dueDate:      due,
      status:       r.status as string,
      grandTotal:   n(r.grand_total),
      amountPaid:   n(r.amount_paid),
      balanceDue:   n(r.balance_due),
      isOverdue,
      itemCount:    itemCountById[r.id as string] ?? 0,
      createdAt:    r.created_at as string,
    }
  })

  return { rows, total, page, pageSize: ps, totalPages: Math.ceil(total / ps) }
}

// ── getInvoice ────────────────────────────────────────────────────────────────

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data: r } = await supabase
    .from('invoices')
    .select(
      `id,invoice_no,so_id,quote_id,customer_id,subject,date,due_date,status,
       place_of_supply,gst_mode,gst_pct,is_igst,
       taxable_value,transport,transport_note,
       cgst_amount,sgst_amount,igst_amount,total_gst,grand_total,
       amount_paid,balance_due,payment_terms,
       bill_to_name,bill_to_address,bill_to_phone,bill_to_email,bill_to_gstin,
       notes,terms,logo_url,issued_at,created_at,updated_at,
       sales_orders(id,so_no),
       quotes(id,quote_no),
       customers(id,code,name,phone,email)`,
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!r) return null

  const cust  = r.customers    as unknown as { id: string; code: string | null; name: string; phone: string | null; email: string | null } | null
  const so    = r.sales_orders as unknown as { id: string; so_no: string } | null
  const quote = r.quotes        as unknown as { id: string; quote_no: string } | null

  // Items
  const { data: itemData } = await supabase
    .from('invoice_items')
    .select('id,so_item_id,item_id,name,description,hsn_code,brand,unit,rate,qty,discount_pct,taxable_value,gst_pct,cgst_pct,sgst_pct,igst_pct,cgst_amount,sgst_amount,igst_amount,total,sort_order')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true })

  const items: InvoiceItemRow[] = (itemData ?? []).map(i => ({
    id:           i.id as string,
    soItemId:     i.so_item_id as string | null,
    itemId:       i.item_id as string | null,
    name:         i.name as string,
    description:  i.description as string | null,
    hsnCode:      i.hsn_code as string | null,
    brand:        i.brand as string | null,
    unit:         i.unit as string | null,
    rate:         n(i.rate),
    qty:          n(i.qty),
    discountPct:  n(i.discount_pct),
    taxableValue: n(i.taxable_value),
    gstPct:       n(i.gst_pct),
    cgstPct:      n(i.cgst_pct),
    sgstPct:      n(i.sgst_pct),
    igstPct:      n(i.igst_pct),
    cgstAmount:   n(i.cgst_amount),
    sgstAmount:   n(i.sgst_amount),
    igstAmount:   n(i.igst_amount),
    total:        n(i.total),
    sortOrder:    n(i.sort_order),
  }))

  // Payments
  const { data: payData } = await supabase
    .from('invoice_payments')
    .select('id,amount,payment_date,payment_mode,reference_no,note,recorded_by,created_at')
    .eq('invoice_id', id)
    .order('payment_date', { ascending: true })

  const payments: InvoicePaymentRow[] = (payData ?? []).map(p => ({
    id:          p.id as string,
    amount:      n(p.amount),
    paymentDate: p.payment_date as string,
    paymentMode: p.payment_mode as string,
    referenceNo: p.reference_no as string | null,
    note:        p.note as string | null,
    recordedBy:  p.recorded_by as string | null,
    createdAt:   p.created_at as string,
  }))

  // Status history
  const { data: histData } = await supabase
    .from('invoice_status_history')
    .select('id,from_status,to_status,note,changed_by,changed_at')
    .eq('invoice_id', id)
    .order('changed_at', { ascending: true })

  const statusHistory: InvoiceStatusHistoryRow[] = (histData ?? []).map(h => ({
    id:         h.id as string,
    fromStatus: h.from_status as string | null,
    toStatus:   h.to_status as string,
    note:       h.note as string | null,
    changedBy:  h.changed_by as string | null,
    changedAt:  h.changed_at as string,
  }))

  const rawTerms = (r.terms as { category: string; text: string }[] | null) ?? []

  return {
    id:            r.id as string,
    invoiceNo:     r.invoice_no as string,
    soId:          r.so_id as string,
    soNo:          so?.so_no ?? '',
    quoteId:       r.quote_id as string | null,
    quoteNo:       quote?.quote_no ?? null,
    customerId:    r.customer_id as string | null,
    customerName:  cust?.name ?? null,
    customerCode:  cust?.code ?? null,
    customerPhone: cust?.phone ?? null,
    customerEmail: cust?.email ?? null,
    billToName:    (r.bill_to_name as string | null) ?? cust?.name ?? null,
    billToAddress: r.bill_to_address as string | null,
    billToPhone:   (r.bill_to_phone as string | null) ?? cust?.phone ?? null,
    billToEmail:   (r.bill_to_email as string | null) ?? cust?.email ?? null,
    billToGstin:   r.bill_to_gstin as string | null,
    subject:       r.subject as string | null,
    date:          r.date as string,
    dueDate:       r.due_date as string | null,
    status:        r.status as string,
    placeOfSupply: r.place_of_supply as string | null,
    gstMode:       r.gst_mode as string,
    gstPct:        n(r.gst_pct),
    isIgst:        Boolean(r.is_igst),
    taxableValue:  n(r.taxable_value),
    transport:     n(r.transport),
    transportNote: r.transport_note as string | null,
    cgstAmount:    n(r.cgst_amount),
    sgstAmount:    n(r.sgst_amount),
    igstAmount:    n(r.igst_amount),
    totalGst:      n(r.total_gst),
    grandTotal:    n(r.grand_total),
    amountPaid:    n(r.amount_paid),
    balanceDue:    n(r.balance_due),
    paymentTerms:  r.payment_terms as string | null,
    notes:         r.notes as string | null,
    terms:         rawTerms,
    logoUrl:       r.logo_url as string | null,
    issuedAt:      r.issued_at as string | null,
    items,
    payments,
    statusHistory,
    createdAt:     r.created_at as string,
    updatedAt:     r.updated_at as string,
  }
}

// ── getInvoiceStats ───────────────────────────────────────────────────────────

export async function getInvoiceStats(): Promise<InvoiceStats> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { total:0, draft:0, issued:0, paid:0, partiallyPaid:0, cancelled:0, overdue:0, totalValue:0, totalOutstanding:0 }

  const today = new Date().toISOString().split('T')[0]!

  const { data } = await supabase
    .from('invoices')
    .select('status,grand_total,balance_due,due_date')
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const rows = data ?? []
  return {
    total:         rows.length,
    draft:         rows.filter(r => r.status === 'draft').length,
    issued:        rows.filter(r => r.status === 'issued').length,
    paid:          rows.filter(r => r.status === 'paid').length,
    partiallyPaid: rows.filter(r => r.status === 'partially_paid').length,
    cancelled:     rows.filter(r => r.status === 'cancelled').length,
    overdue:       rows.filter(r => ['issued','partially_paid'].includes(r.status as string) && (r.due_date as string | null) != null && (r.due_date as string) < today).length,
    totalValue:    rows.reduce((s, r) => s + n(r.grand_total), 0),
    totalOutstanding: rows.filter(r => ['issued','partially_paid'].includes(r.status as string)).reduce((s, r) => s + n(r.balance_due), 0),
  }
}

// ── getLinkedInvoiceForSo ─────────────────────────────────────────────────────

export async function getLinkedInvoiceForSo(
  soId: string,
): Promise<{ id: string; invoiceNo: string; status: string } | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data } = await supabase
    .from('invoices')
    .select('id,invoice_no,status')
    .eq('org_id', orgId)
    .eq('so_id', soId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (!data) return null
  return { id: data.id as string, invoiceNo: data.invoice_no as string, status: data.status as string }
}

// ── canCreateInvoiceForSo ─────────────────────────────────────────────────────

export async function canCreateInvoiceForSo(
  soId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { allowed: false, reason: 'Not authenticated' }

  const { data: so } = await supabase
    .from('sales_orders')
    .select('id,status,so_no')
    .eq('id', soId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!so) return { allowed: false, reason: 'Sales order not found.' }

  if (so.status === 'cancelled') {
    return { allowed: false, reason: 'Cannot invoice a cancelled sales order.' }
  }

  const existing = await getLinkedInvoiceForSo(soId)
  if (existing) {
    return { allowed: false, reason: `Invoice ${existing.invoiceNo} already exists for this order.` }
  }

  return { allowed: true }
}

// ── getEligibleSosForInvoicing ────────────────────────────────────────────────

export async function getEligibleSosForInvoicing(
  search?: string,
  page = 1,
  limit = 20,
): Promise<{
  items: { id: string; soNo: string; subject: string | null; customerName: string | null; grandTotal: number; status: string }[]
  total: number
}> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { items: [], total: 0 }

  // Get all SO IDs that already have an active invoice
  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('so_id')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  const usedSoIds = (existingInvoices ?? []).map(i => i.so_id as string)

  let q = supabase
    .from('sales_orders')
    .select('id,so_no,subject,grand_total,status,customers(id,name)')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('date', { ascending: false })

  if (search) {
    const t = san(search)
    q = q.or(`so_no.ilike.%${t}%,subject.ilike.%${t}%`)
  }

  const { data } = await q.limit(500)

  const filtered = (data ?? [])
    .filter(r => !usedSoIds.includes(r.id as string))
    .map(r => {
      const cust = r.customers as unknown as { name: string } | null
      return {
        id:           r.id as string,
        soNo:         r.so_no as string,
        subject:      r.subject as string | null,
        customerName: cust?.name ?? null,
        grandTotal:   n(r.grand_total),
        status:       r.status as string,
      }
    })

  const total = filtered.length
  const from  = (page - 1) * limit
  const items = filtered.slice(from, from + limit)

  return { items, total }
}
