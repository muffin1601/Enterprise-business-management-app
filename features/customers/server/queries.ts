import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { PAGE_SIZE, type CustomerFilter } from '@/validations/customer'

// ── Helpers ───────────────────────────────────────────────────────────────────
const sanitize = (s: string) => s.replace(/[%_]/g, '\\$&').trim()
const n = (v: unknown) => (v == null ? 0 : Number(v))

async function orgSupabase() {
  const orgId = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return types ──────────────────────────────────────────────────────────────
export type CustomerRow = {
  id: string; code: string; name: string
  contactPerson: string | null; phone: string | null; email: string | null
  gstin: string | null; industry: string | null
  type: string; status: string
  creditLimit: number; paymentTerms: string; createdAt: string
}

export type CustomerPage = {
  rows: CustomerRow[]; total: number
  page: number; pageSize: number; totalPages: number
}

export type CustomerContact = {
  id: string; name: string; designation: string | null
  email: string | null; phone: string | null; isPrimary: boolean
}

export type CustomerAddress = {
  id: string; label: string; addressLine1: string; addressLine2: string | null
  city: string | null; state: string | null; country: string; pincode: string | null
  isBilling: boolean; isShipping: boolean; isDefault: boolean
}

export type CustomerDetail = CustomerRow & {
  website: string | null; pan: string | null; postSaleDiscount: number
  billingName: string | null; billingAddress: string | null
  deliveryName: string | null; deliveryAddress: string | null
  sameAsBilling: boolean; notes: string | null; updatedAt: string
  contacts: CustomerContact[]; addresses: CustomerAddress[]
}

export type CustomerNote = {
  id: string; content: string; isPinned: boolean
  createdAt: string; creatorName: string | null
}

export type CustomerStats = {
  total: number; active: number; inactive: number; blocked: number; withCredit: number
}

export type InvoiceRow = {
  id: string; invoiceNo: string; date: string; dueDate: string | null
  status: string; total: number; amountPaid: number; balance: number
  createdAt: string
}

export type PaymentRow = {
  id: string; date: string; mode: string; reference: string | null
  amount: number; notes: string | null; createdAt: string
  creatorName: string | null
}

export type BillingKPIs = {
  totalBilled: number; totalReceived: number; outstanding: number
  overdue: number; creditLimit: number; availableCredit: number
}

export type AgingBucket = {
  label: string; amount: number; count: number; days: string
}

export type LedgerEntry = {
  date: string; particular: string; type: 'invoice' | 'payment' | 'credit_note' | 'opening'
  debit: number; credit: number; balance: number; refNo: string
}

export type CustomerDocument = {
  id: string; name: string; category: string; fileUrl: string
  fileSize: number | null; mimeType: string | null; createdAt: string
  creatorName: string | null
}

export type ActivityItem = {
  id: string; action: string; entityType: string; at: string
  actorName: string | null; after: Record<string, unknown> | null
}

// ── listCustomers ─────────────────────────────────────────────────────────────
export async function listCustomers(filter: CustomerFilter): Promise<CustomerPage> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 }

  let q = supabase
    .from('customers')
    .select('id,code,name,contact_person,phone,email,gstin,industry,type,status,credit_limit,payment_terms,created_at', { count: 'exact' })
    .eq('org_id', orgId).is('deleted_at', null)

  if (filter.q) {
    const t = sanitize(filter.q)
    q = q.or(`name.ilike.%${t}%,code.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%,gstin.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.type   && filter.type   !== 'all') q = q.eq('type',   filter.type)

  const col = filter.sort === 'created_at' ? 'created_at' : filter.sort ?? 'name'
  const asc = (filter.order ?? 'asc') === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * PAGE_SIZE

  q = q.order(col, { ascending: asc }).range(from, from + PAGE_SIZE - 1)
  const { data, count } = await q
  const total = count ?? 0

  return {
    rows: (data ?? []).map((r) => ({
      id: r.id as string, code: r.code as string, name: r.name as string,
      contactPerson: r.contact_person as string | null, phone: r.phone as string | null,
      email: r.email as string | null, gstin: r.gstin as string | null,
      industry: r.industry as string | null, type: r.type as string, status: r.status as string,
      creditLimit: n(r.credit_limit), paymentTerms: r.payment_terms as string,
      createdAt: r.created_at as string,
    })),
    total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE),
  }
}

// ── getCustomer ───────────────────────────────────────────────────────────────
export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return null

  const [{ data: c }, { data: contacts }, { data: addresses }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle(),
    supabase.from('customer_contacts').select('id,name,designation,email,phone,is_primary')
      .eq('customer_id', id).eq('org_id', orgId).is('deleted_at', null)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    supabase.from('customer_addresses').select('id,label,address_line1,address_line2,city,state,country,pincode,is_billing,is_shipping,is_default')
      .eq('customer_id', id).eq('org_id', orgId).is('deleted_at', null)
      .order('is_default', { ascending: false }),
  ])

  if (!c) return null

  return {
    id: c.id as string, code: c.code as string, name: c.name as string,
    contactPerson: c.contact_person as string | null, phone: c.phone as string | null,
    email: c.email as string | null, website: c.website as string | null,
    gstin: c.gstin as string | null, pan: c.pan as string | null,
    industry: c.industry as string | null, type: c.type as string, status: c.status as string,
    creditLimit: n(c.credit_limit), paymentTerms: c.payment_terms as string,
    postSaleDiscount: n(c.post_sale_discount),
    billingName: c.billing_name as string | null, billingAddress: c.billing_address as string | null,
    deliveryName: c.delivery_name as string | null, deliveryAddress: c.delivery_address as string | null,
    sameAsBilling: c.same_as_billing as boolean, notes: c.notes as string | null,
    createdAt: c.created_at as string, updatedAt: c.updated_at as string,
    contacts: (contacts ?? []).map((cc) => ({
      id: cc.id as string, name: cc.name as string,
      designation: cc.designation as string | null, email: cc.email as string | null,
      phone: cc.phone as string | null, isPrimary: cc.is_primary as boolean,
    })),
    addresses: (addresses ?? []).map((ca) => ({
      id: ca.id as string, label: ca.label as string,
      addressLine1: ca.address_line1 as string, addressLine2: ca.address_line2 as string | null,
      city: ca.city as string | null, state: ca.state as string | null,
      country: ca.country as string, pincode: ca.pincode as string | null,
      isBilling: ca.is_billing as boolean, isShipping: ca.is_shipping as boolean,
      isDefault: ca.is_default as boolean,
    })),
  }
}

// ── getCustomerNotes ──────────────────────────────────────────────────────────
export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('customer_notes')
    .select('id,content,is_pinned,created_at,users!customer_notes_created_by_fkey(full_name)')
    .eq('customer_id', customerId).eq('org_id', orgId).is('deleted_at', null)
    .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })

  return (data ?? []).map((n) => ({
    id: n.id as string, content: n.content as string, isPinned: n.is_pinned as boolean,
    createdAt: n.created_at as string,
    creatorName: (n.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }))
}

// ── getCustomerStats ──────────────────────────────────────────────────────────
export async function getCustomerStats(): Promise<CustomerStats> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return { total: 0, active: 0, inactive: 0, blocked: 0, withCredit: 0 }

  const { data } = await supabase
    .from('customers').select('status,credit_limit').eq('org_id', orgId).is('deleted_at', null)

  const rows = data ?? []
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive').length,
    blocked: rows.filter((r) => r.status === 'blocked').length,
    withCredit: rows.filter((r) => n(r.credit_limit) > 0).length,
  }
}

// ── getNextCustomerCode ───────────────────────────────────────────────────────
export async function getNextCustomerCode(): Promise<string> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return 'CUST-0001'
  const { count } = await supabase
    .from('customers').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
  return `CUST-${String((count ?? 0) + 1).padStart(4, '0')}`
}

// ── getCustomerInvoices ────────────────────────────────────────────────────────
export async function getCustomerInvoices(customerId: string): Promise<InvoiceRow[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('invoices')
    .select('id,invoice_no,date,due_date,status,total,amount_paid,balance,created_at')
    .eq('org_id', orgId).eq('customer_id', customerId).is('deleted_at', null)
    .order('date', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id as string, invoiceNo: r.invoice_no as string,
    date: r.date as string, dueDate: r.due_date as string | null,
    status: r.status as string, total: n(r.total),
    amountPaid: n(r.amount_paid), balance: n(r.balance),
    createdAt: r.created_at as string,
  }))
}

// ── getCustomerPayments ────────────────────────────────────────────────────────
export async function getCustomerPayments(customerId: string): Promise<PaymentRow[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('payments')
    .select('id,date,mode,reference,amount,notes,created_at,users!payments_created_by_fkey(full_name)')
    .eq('org_id', orgId).eq('customer_id', customerId)
    .order('date', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id as string, date: r.date as string, mode: r.mode as string,
    reference: r.reference as string | null, amount: n(r.amount),
    notes: r.notes as string | null, createdAt: r.created_at as string,
    creatorName: (r.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }))
}

// ── getCustomerBillingKPIs ─────────────────────────────────────────────────────
export async function getCustomerBillingKPIs(customerId: string): Promise<BillingKPIs> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return { totalBilled: 0, totalReceived: 0, outstanding: 0, overdue: 0, creditLimit: 0, availableCredit: 0 }

  const today = new Date().toISOString().split('T')[0]!

  const [{ data: cust }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from('customers').select('credit_limit').eq('id', customerId).eq('org_id', orgId).maybeSingle(),
    supabase.from('invoices').select('total,amount_paid,balance,due_date,status')
      .eq('org_id', orgId).eq('customer_id', customerId).is('deleted_at', null),
    supabase.from('payments').select('amount')
      .eq('org_id', orgId).eq('customer_id', customerId),
  ])

  const invRows    = invoices ?? []
  const pmtRows    = payments ?? []
  const totalBilled  = invRows.reduce((s, r) => s + n(r.total), 0)
  const totalReceived = pmtRows.reduce((s, r) => s + n(r.amount), 0)
  const outstanding   = Math.max(0, totalBilled - totalReceived)
  const overdue       = invRows
    .filter((r) => r.due_date && r.due_date < today && !['paid', 'cancelled'].includes(r.status as string))
    .reduce((s, r) => s + n(r.balance), 0)
  const creditLimit     = n(cust?.credit_limit)
  const availableCredit = Math.max(0, creditLimit - outstanding)

  return { totalBilled, totalReceived, outstanding, overdue, creditLimit, availableCredit }
}

// ── getCustomerAging ───────────────────────────────────────────────────────────
export async function getCustomerAging(customerId: string): Promise<AgingBucket[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]!

  const { data } = await supabase
    .from('invoices')
    .select('balance,due_date,status')
    .eq('org_id', orgId).eq('customer_id', customerId).is('deleted_at', null)
    .not('status', 'in', '("paid","cancelled")')

  const rows = (data ?? []).filter((r) => n(r.balance) > 0)

  const getDaysOverdue = (dueDate: string | null) => {
    if (!dueDate) return 0
    const due = new Date(dueDate)
    return Math.floor((today.getTime() - due.getTime()) / 86_400_000)
  }

  const buckets = [
    { label: 'Current',    days: 'Not yet due',  min: -Infinity, max: 0,  amount: 0, count: 0 },
    { label: '0–30 Days',  days: '0–30 days',    min: 0,  max: 30,  amount: 0, count: 0 },
    { label: '31–60 Days', days: '31–60 days',   min: 30, max: 60,  amount: 0, count: 0 },
    { label: '61–90 Days', days: '61–90 days',   min: 60, max: 90,  amount: 0, count: 0 },
    { label: '90+ Days',   days: 'Over 90 days', min: 90, max: Infinity, amount: 0, count: 0 },
  ]

  rows.forEach((r) => {
    const days = getDaysOverdue(r.due_date as string | null)
    const bal  = n(r.balance)
    const bucket = buckets.find((b) => days > b.min && days <= b.max)
    if (bucket) { bucket.amount += bal; bucket.count++ }
  })

  return buckets.map(({ label, days, amount, count }) => ({ label, days, amount, count }))
}

// ── getCustomerLedger ─────────────────────────────────────────────────────────
export async function getCustomerLedger(customerId: string): Promise<LedgerEntry[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('id,invoice_no,date,total,status')
      .eq('org_id', orgId).eq('customer_id', customerId).is('deleted_at', null)
      .order('date', { ascending: true }),
    supabase.from('payments').select('id,date,mode,reference,amount')
      .eq('org_id', orgId).eq('customer_id', customerId)
      .order('date', { ascending: true }),
  ])

  const entries: Array<Omit<LedgerEntry, 'balance'>> = []

  for (const inv of invoices ?? []) {
    entries.push({
      date: inv.date as string,
      particular: `Invoice ${inv.invoice_no as string}`,
      type: 'invoice',
      debit: n(inv.total), credit: 0,
      refNo: inv.invoice_no as string,
    })
  }

  for (const pmt of payments ?? []) {
    entries.push({
      date: pmt.date as string,
      particular: `Payment${pmt.reference ? ` — ${pmt.reference}` : ''} (${pmt.mode as string})`,
      type: 'payment',
      debit: 0, credit: n(pmt.amount),
      refNo: (pmt.reference as string | null) ?? '',
    })
  }

  entries.sort((a, b) => a.date.localeCompare(b.date))

  let running = 0
  return entries.map((e) => {
    running = running + e.debit - e.credit
    return { ...e, balance: running }
  })
}

// ── getCustomerDocuments ───────────────────────────────────────────────────────
export async function getCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('customer_documents')
    .select('id,name,category,file_url,file_size,mime_type,created_at,users!customer_documents_created_by_fkey(full_name)')
    .eq('customer_id', customerId).eq('org_id', orgId).is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (data ?? []).map((d) => ({
    id: d.id as string, name: d.name as string, category: d.category as string,
    fileUrl: d.file_url as string, fileSize: d.file_size as number | null,
    mimeType: d.mime_type as string | null, createdAt: d.created_at as string,
    creatorName: (d.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }))
}

// ── getCustomerActivity ────────────────────────────────────────────────────────
export async function getCustomerActivity(customerId: string): Promise<ActivityItem[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('audit_logs')
    .select('id,action,entity_type,at,after,users!audit_logs_actor_id_fkey(full_name)')
    .eq('org_id', orgId).eq('entity_id', customerId)
    .order('at', { ascending: false }).limit(50)

  return (data ?? []).map((a) => ({
    id: a.id as string, action: a.action as string, entityType: a.entity_type as string,
    at: a.at as string,
    actorName: (a.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
    after: a.after as Record<string, unknown> | null,
  }))
}
