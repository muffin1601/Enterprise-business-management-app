import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { LOW_STOCK_THRESHOLD, PAGE_SIZE, type ItemFilter } from '@/validations/item'

export type ItemRow = {
  id: string
  sku: string | null
  name: string
  variantLabel: string | null
  family: string | null
  brand: string | null
  unit: string | null
  imageUrl: string | null
  isImported: boolean
  stock: number
  purchasePrice: number | null
  sellingPrice: number | null
  lowStock: boolean
}
export type ItemPage = {
  rows: ItemRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type Lookup = { id: string; label: string }

const n = (v: unknown): number | null => (v == null ? null : Number(v))
const sanitize = (s: string) => s.replace(/[%,()]/g, ' ').trim()

/** Paged, searchable, filtered item list (RLS items_select → items.view). */
export async function listItems(filter: ItemFilter): Promise<ItemPage> {
  const orgId = await getActiveOrgId()
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 }
  const supabase = await createSupabaseServerClient()

  let q = supabase
    .from('items')
    .select(
      'id, sku, name, variant_label, image_url, is_imported, stock, purchase_price, selling_price, family_id, brand_id, unit_id, item_families!items_family_fkey(name), brands!items_brand_fkey(name), units!items_unit_fkey(code)',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const term = sanitize(filter.search ?? '')
  if (term) q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  if (filter.familyId) q = q.eq('family_id', filter.familyId)
  if (filter.brandId) q = q.eq('brand_id', filter.brandId)
  if (filter.imported === 'imported') q = q.eq('is_imported', true)
  if (filter.imported === 'domestic') q = q.eq('is_imported', false)
  if (filter.lowStock) q = q.lt('stock', LOW_STOCK_THRESHOLD)

  const page = Math.max(1, filter.page)
  const from = (page - 1) * PAGE_SIZE
  q = q.order('name', { ascending: true }).range(from, from + PAGE_SIZE - 1)

  const { data, count } = await q
  const total = count ?? 0
  const rows: ItemRow[] = (data ?? []).map((r) => {
    const stock = Number(r.stock ?? 0)
    return {
      id: r.id as string,
      sku: (r.sku as string | null) ?? null,
      name: r.name as string,
      variantLabel: (r.variant_label as string | null) ?? null,
      family: (r.item_families as unknown as { name: string } | null)?.name ?? null,
      brand: (r.brands as unknown as { name: string } | null)?.name ?? null,
      unit: (r.units as unknown as { code: string } | null)?.code ?? null,
      imageUrl: (r.image_url as string | null) ?? null,
      isImported: Boolean(r.is_imported),
      stock,
      purchasePrice: n(r.purchase_price),
      sellingPrice: n(r.selling_price),
      lowStock: stock < LOW_STOCK_THRESHOLD,
    }
  })

  return { rows, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) }
}

export type ItemDetail = {
  id: string
  sku: string | null
  name: string
  variantLabel: string | null
  imageUrl: string | null
  familyId: string | null
  brandId: string | null
  unitId: string | null
  family: string | null
  brand: string | null
  unit: string | null
  isImported: boolean
  deliveryDays: number | null
  stock: number
  purchasePrice: number | null
  sellingPrice: number | null
  lastPurchasePrice: number | null
  lastPurchaseDate: string | null
  importCurrency: string | null
  importPrice: number | null
  exchangeRate: number | null
  importDiscountPct: number | null
  transportType: 'lumpsum' | 'percent' | null
  transportValue: number | null
  customDutyPct: number | null
  profitMultiplier: number | null
  variations: { id: string; size: string | null; make: string | null; finish: string | null; brand: string | null }[]
}

export async function getItem(id: string): Promise<ItemDetail | null> {
  const orgId = await getActiveOrgId()
  if (!orgId) return null
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('items')
    .select(
      '*, item_families!items_family_fkey(name), brands!items_brand_fkey(name), units!items_unit_fkey(code), item_variations(id, size, make, finish, brand)',
    )
    .eq('org_id', orgId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) return null

  return {
    id: data.id as string,
    sku: (data.sku as string | null) ?? null,
    name: data.name as string,
    variantLabel: (data.variant_label as string | null) ?? null,
    imageUrl: (data.image_url as string | null) ?? null,
    familyId: (data.family_id as string | null) ?? null,
    brandId: (data.brand_id as string | null) ?? null,
    unitId: (data.unit_id as string | null) ?? null,
    family: (data.item_families as unknown as { name: string } | null)?.name ?? null,
    brand: (data.brands as unknown as { name: string } | null)?.name ?? null,
    unit: (data.units as unknown as { code: string } | null)?.code ?? null,
    isImported: Boolean(data.is_imported),
    deliveryDays: data.delivery_days == null ? null : Number(data.delivery_days),
    stock: Number(data.stock ?? 0),
    purchasePrice: n(data.purchase_price),
    sellingPrice: n(data.selling_price),
    lastPurchasePrice: n(data.last_purchase_price),
    lastPurchaseDate: (data.last_purchase_date as string | null) ?? null,
    importCurrency: (data.import_currency as string | null) ?? null,
    importPrice: n(data.import_price),
    exchangeRate: n(data.exchange_rate),
    importDiscountPct: n(data.import_discount_pct),
    transportType: (data.transport_type as 'lumpsum' | 'percent' | null) ?? null,
    transportValue: n(data.transport_value),
    customDutyPct: n(data.custom_duty_pct),
    profitMultiplier: n(data.profit_multiplier),
    variations: ((data.item_variations as unknown as ItemDetail['variations']) ?? []).map((v) => ({
      id: v.id,
      size: v.size,
      make: v.make,
      finish: v.finish,
      brand: v.brand,
    })),
  }
}

async function listLookup(table: 'item_families' | 'brands'): Promise<Lookup[]> {
  const orgId = await getActiveOrgId()
  if (!orgId) return []
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from(table)
    .select('id, name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  return (data ?? []).map((r) => ({ id: r.id as string, label: r.name as string }))
}

export const listFamilies = () => listLookup('item_families')
export const listBrands = () => listLookup('brands')

export async function listUnits(): Promise<Lookup[]> {
  const orgId = await getActiveOrgId()
  if (!orgId) return []
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('units')
    .select('id, code, name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('code', { ascending: true })
  return (data ?? []).map((r) => ({
    id: r.id as string,
    label: (r.name as string | null) ? `${r.code} · ${r.name}` : (r.code as string),
  }))
}

export type InventorySummary = {
  totalItems: number
  totalStockValue: number
  lowStockCount: number
  importedCount: number
}

export type ItemActivityItem = {
  id: string; action: string; entityType: string; at: string
  actorName: string | null; after: Record<string, unknown> | null
}

export async function getItemActivity(itemId: string): Promise<ItemActivityItem[]> {
  const orgId = await getActiveOrgId()
  if (!orgId) return []
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('audit_logs')
    .select('id,action,entity_type,at,after,users!audit_logs_actor_id_fkey(full_name)')
    .eq('org_id', orgId).eq('entity_id', itemId)
    .order('at', { ascending: false }).limit(50)
  return (data ?? []).map((a) => ({
    id: a.id as string, action: a.action as string, entityType: a.entity_type as string,
    at: a.at as string,
    actorName: (a.users as unknown as { full_name: string | null } | null)?.full_name ?? null,
    after: a.after as Record<string, unknown> | null,
  }))
}

/** Active org's currency code for money formatting (defaults INR). */
export async function getOrgCurrency(): Promise<string> {
  const orgId = await getActiveOrgId()
  if (!orgId) return 'INR'
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from('organizations').select('currency').eq('id', orgId).maybeSingle()
  return (data?.currency as string) ?? 'INR'
}

/** Aggregates over the catalogue (RLS items.view). MVP: client-side fold. */
export async function getInventorySummary(): Promise<InventorySummary> {
  const orgId = await getActiveOrgId()
  if (!orgId) return { totalItems: 0, totalStockValue: 0, lowStockCount: 0, importedCount: 0 }
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('items')
    .select('stock, purchase_price, is_imported')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .limit(10000)

  const rows = data ?? []
  let totalStockValue = 0
  let lowStockCount = 0
  let importedCount = 0
  for (const r of rows) {
    const stock = Number(r.stock ?? 0)
    totalStockValue += stock * Number(r.purchase_price ?? 0)
    if (stock < LOW_STOCK_THRESHOLD) lowStockCount += 1
    if (r.is_imported) importedCount += 1
  }
  return {
    totalItems: rows.length,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    lowStockCount,
    importedCount,
  }
}
