import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { VENDOR_PAGE_SIZE, type VendorFilter } from '@/validations/vendor'

// ── Helpers ───────────────────────────────────────────────────────────────────
const sanitize = (s: string) => s.replace(/[%_]/g, '\\$&').trim()
const n = (v: unknown) => (v == null ? 0 : Number(v))

async function orgSupabase() {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return types ──────────────────────────────────────────────────────────────

export type VendorRow = {
  id:            string
  code:          string
  name:          string
  type:          string
  status:        string
  contactPerson: string | null
  phone:         string | null
  email:         string | null
  gstin:         string | null
  city:          string | null
  state:         string | null
  industry:      string | null
  paymentTerms:  string
  createdAt:     string
}

export type VendorPage = {
  rows: VendorRow[]; total: number
  page: number; pageSize: number; totalPages: number
}

export type VendorContact = {
  id:          string
  name:        string
  designation: string | null
  email:       string | null
  phone:       string | null
  department:  string | null
  isPrimary:   boolean
}

export type VendorBankAccount = {
  id:          string
  accountName: string
  accountNo:   string
  bankName:    string
  branch:      string | null
  ifscCode:    string
  accountType: string
  isPrimary:   boolean
}

export type VendorDetail = VendorRow & {
  website:         string | null
  pan:             string | null
  msmeNo:          string | null
  billingAddress:  string | null
  shippingAddress: string | null
  pincode:         string | null
  country:         string
  creditLimit:     number
  currency:        string
  notes:           string | null
  updatedAt:       string
  contacts:        VendorContact[]
  bankAccounts:    VendorBankAccount[]
}

export type VendorNote = {
  id:          string
  content:     string
  isPinned:    boolean
  createdAt:   string
  creatorName: string | null
}

export type VendorDocument = {
  id:          string
  name:        string
  category:    string
  fileUrl:     string
  fileSize:    number | null
  mimeType:    string | null
  createdAt:   string
  creatorName: string | null
}

export type VendorStats = {
  total: number; active: number; inactive: number; blacklisted: number
  byType: Record<string, number>
}

export type ActivityItem = {
  id:        string
  action:    string
  entityType:string
  at:        string
  actorName: string | null
  after:     Record<string, unknown> | null
}

// ── listVendors ───────────────────────────────────────────────────────────────

export async function listVendors(filter: VendorFilter): Promise<VendorPage> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: VENDOR_PAGE_SIZE, totalPages: 0 }

  let q = supabase
    .from('vendors')
    .select(
      'id,code,name,type,status,contact_person,phone,email,gstin,city,state,industry,payment_terms,created_at',
      { count: 'exact' },
    )
    .eq('org_id', orgId).is('deleted_at', null)

  if (filter.q) {
    const t = sanitize(filter.q)
    q = q.or(`name.ilike.%${t}%,code.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%,gstin.ilike.%${t}%`)
  }
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status)
  if (filter.type   && filter.type   !== 'all') q = q.eq('type',   filter.type)

  const col = filter.sort === 'created_at' ? 'created_at' : filter.sort ?? 'name'
  const asc  = (filter.order ?? 'asc') === 'asc'
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * VENDOR_PAGE_SIZE

  q = q.order(col, { ascending: asc }).range(from, from + VENDOR_PAGE_SIZE - 1)
  const { data, count } = await q
  const total = count ?? 0

  return {
    rows: (data ?? []).map(r => ({
      id:            r.id as string,
      code:          r.code as string,
      name:          r.name as string,
      type:          r.type as string,
      status:        r.status as string,
      contactPerson: r.contact_person as string | null,
      phone:         r.phone as string | null,
      email:         r.email as string | null,
      gstin:         r.gstin as string | null,
      city:          r.city as string | null,
      state:         r.state as string | null,
      industry:      r.industry as string | null,
      paymentTerms:  r.payment_terms as string,
      createdAt:     r.created_at as string,
    })),
    total, page, pageSize: VENDOR_PAGE_SIZE, totalPages: Math.ceil(total / VENDOR_PAGE_SIZE),
  }
}

// ── getVendor ─────────────────────────────────────────────────────────────────

export async function getVendor(id: string): Promise<VendorDetail | null> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return null

  const [{ data: v }, { data: contacts }, { data: banks }] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle(),
    supabase.from('vendor_contacts')
      .select('id,name,designation,email,phone,department,is_primary')
      .eq('vendor_id', id).eq('org_id', orgId).is('deleted_at', null)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    supabase.from('vendor_bank_accounts')
      .select('id,account_name,account_no,bank_name,branch,ifsc_code,account_type,is_primary')
      .eq('vendor_id', id).eq('org_id', orgId).is('deleted_at', null)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
  ])

  if (!v) return null

  return {
    id:              v.id as string,
    code:            v.code as string,
    name:            v.name as string,
    type:            v.type as string,
    status:          v.status as string,
    contactPerson:   v.contact_person as string | null,
    phone:           v.phone as string | null,
    email:           v.email as string | null,
    website:         v.website as string | null,
    gstin:           v.gstin as string | null,
    pan:             v.pan as string | null,
    msmeNo:          v.msme_no as string | null,
    billingAddress:  v.billing_address as string | null,
    shippingAddress: v.shipping_address as string | null,
    city:            v.city as string | null,
    state:           v.state as string | null,
    pincode:         v.pincode as string | null,
    country:         v.country as string,
    industry:        v.industry as string | null,
    paymentTerms:    v.payment_terms as string,
    creditLimit:     n(v.credit_limit),
    currency:        v.currency as string,
    notes:           v.notes as string | null,
    createdAt:       v.created_at as string,
    updatedAt:       v.updated_at as string,
    contacts: (contacts ?? []).map(c => ({
      id:          c.id as string,
      name:        c.name as string,
      designation: c.designation as string | null,
      email:       c.email as string | null,
      phone:       c.phone as string | null,
      department:  c.department as string | null,
      isPrimary:   c.is_primary as boolean,
    })),
    bankAccounts: (banks ?? []).map(b => ({
      id:          b.id as string,
      accountName: b.account_name as string,
      accountNo:   b.account_no as string,
      bankName:    b.bank_name as string,
      branch:      b.branch as string | null,
      ifscCode:    b.ifsc_code as string,
      accountType: b.account_type as string,
      isPrimary:   b.is_primary as boolean,
    })),
  }
}

// ── getVendorNotes ────────────────────────────────────────────────────────────

export async function getVendorNotes(vendorId: string): Promise<VendorNote[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('vendor_notes')
    .select('id,content,is_pinned,created_at,users!vendor_notes_created_by_fkey(full_name)')
    .eq('vendor_id', vendorId).eq('org_id', orgId).is('deleted_at', null)
    .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })

  return (data ?? []).map(n => ({
    id:          n.id as string,
    content:     n.content as string,
    isPinned:    n.is_pinned as boolean,
    createdAt:   n.created_at as string,
    creatorName: (n.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }))
}

// ── getVendorDocuments ────────────────────────────────────────────────────────

export async function getVendorDocuments(vendorId: string): Promise<VendorDocument[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('vendor_documents')
    .select('id,name,category,file_url,file_size,mime_type,created_at,users!vendor_documents_created_by_fkey(full_name)')
    .eq('vendor_id', vendorId).eq('org_id', orgId).is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (data ?? []).map(d => ({
    id:          d.id as string,
    name:        d.name as string,
    category:    d.category as string,
    fileUrl:     d.file_url as string,
    fileSize:    d.file_size as number | null,
    mimeType:    d.mime_type as string | null,
    createdAt:   d.created_at as string,
    creatorName: (d.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }))
}

// ── getVendorStats ────────────────────────────────────────────────────────────

export async function getVendorStats(): Promise<VendorStats> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return { total: 0, active: 0, inactive: 0, blacklisted: 0, byType: {} }

  const { data } = await supabase
    .from('vendors').select('status,type').eq('org_id', orgId).is('deleted_at', null)

  const rows = data ?? []
  const byType: Record<string, number> = {}
  rows.forEach(r => { byType[r.type as string] = (byType[r.type as string] ?? 0) + 1 })

  return {
    total:       rows.length,
    active:      rows.filter(r => r.status === 'active').length,
    inactive:    rows.filter(r => r.status === 'inactive').length,
    blacklisted: rows.filter(r => r.status === 'blacklisted').length,
    byType,
  }
}

// ── getNextVendorCode ─────────────────────────────────────────────────────────

export async function getNextVendorCode(): Promise<string> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return 'VEN-0001'
  const { count } = await supabase
    .from('vendors').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
  return `VEN-${String((count ?? 0) + 1).padStart(4, '0')}`
}

// ── getVendorActivity ─────────────────────────────────────────────────────────

export async function getVendorActivity(vendorId: string): Promise<ActivityItem[]> {
  const { orgId, supabase } = await orgSupabase()
  if (!orgId) return []

  const { data } = await supabase
    .from('audit_logs')
    .select('id,action,entity_type,at,after,users!audit_logs_actor_id_fkey(full_name)')
    .eq('org_id', orgId).eq('entity_id', vendorId)
    .order('at', { ascending: false }).limit(50)

  return (data ?? []).map(a => ({
    id:         a.id as string,
    action:     a.action as string,
    entityType: a.entity_type as string,
    at:         a.at as string,
    actorName:  (a.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
    after:      a.after as Record<string, unknown> | null,
  }))
}
