import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { INVENTORY_PAGE_SIZE, type InventoryFilter } from '@/validations/inventory'

// ── Helpers ───────────────────────────────────────────────────────────────────
const n   = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string)  => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId   = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return types ──────────────────────────────────────────────────────────────
export type ItemRow = {
  id: string; sku: string | null; name: string; variantLabel: string | null
  imageUrl: string | null
  family: string | null; familyId: string | null
  brand: string | null;  brandId: string | null
  unit: string | null;   unitId: string | null
  hsnCode: string | null; gstRate: number
  purchasePrice: number | null; sellingPrice: number | null; costPrice: number | null
  stock: number; minStock: number; reorderLevel: number
  isActive: boolean; isImported: boolean; isTemplate: boolean
  isLowStock: boolean; isOutOfStock: boolean
  tags: string[]; createdAt: string; updatedAt: string
}

export type ItemDetail = ItemRow & {
  parentId: string | null; description: string | null
  barcode: string | null; notes: string | null
  maxStock: number; leadTimeDays: number; weightKg: number | null
  dimensions: { l?: number; w?: number; h?: number; unit?: string } | null
  deliveryDays: number | null
  lastPurchasePrice: number | null; lastPurchaseDate: string | null
  importCurrency: string | null; importPrice: number | null
  exchangeRate: number | null; importDiscountPct: number | null
  transportType: string | null; transportValue: number | null
  customDutyPct: number | null; profitMultiplier: number | null
}

export type ItemPage = {
  rows: ItemRow[]; total: number
  page: number; pageSize: number; totalPages: number
}

export type InventoryKPIs = {
  totalItems: number; activeItems: number; outOfStock: number
  lowStock: number; inventoryValue: number; sellingValue: number
  reorderRequired: number
}

export type StockMovementRow = {
  id: string; date: string; direction: 'in' | 'out'
  movementType: string; qty: number; value: number
  reference: string | null; notes: string | null
  createdAt: string; creatorName: string | null
}

export type StockAdjustmentRow = {
  id: string; type: 'add' | 'sub'; qty: number
  reason: string; refNo: string | null
  at: string; adjusterName: string | null
}

export type Lookup = { id: string; label: string; extra?: string }

// ── listItems ──────────────────────────────────────────────────────────────────
export async function listItems(filter: InventoryFilter): Promise<ItemPage> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { rows: [], total: 0, page: 1, pageSize: INVENTORY_PAGE_SIZE, totalPages: 0 }

  let q = supabase
    .from('items')
    .select(`id,sku,name,variant_label,image_url,family_id,brand_id,unit_id,
             hsn_code,gst_rate,purchase_price,selling_price,cost_price,
             stock,min_stock,reorder_level,is_active,is_imported,is_template,
             tags,created_at,updated_at,
             item_families!items_family_fkey(name),
             brands!items_brand_fkey(name),
             units!items_unit_fkey(code)`,
    { count: 'exact' })
    .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false)

  // Search
  if (filter.q) {
    const t = san(filter.q)
    q = q.or(`name.ilike.%${t}%,sku.ilike.%${t}%,hsn_code.ilike.%${t}%`)
  }

  // Filters
  if (filter.familyId) q = q.eq('family_id', filter.familyId)
  if (filter.brandId)  q = q.eq('brand_id',  filter.brandId)
  if (filter.imported === 'imported') q = q.eq('is_imported', true)
  if (filter.imported === 'domestic') q = q.eq('is_imported', false)

  if (filter.status === 'active')       q = q.eq('is_active', true)
  if (filter.status === 'inactive')     q = q.eq('is_active', false)
  if (filter.status === 'archived')     q = q.not('deleted_at', 'is', null)
  if (filter.status === 'out_of_stock') q = q.eq('stock', 0)
  if (filter.status === 'low_stock')    q = q.gt('reorder_level', 0).filter('stock', 'lte', 'reorder_level')

  // Sort
  const sortCol = filter.sort ?? 'name'
  const asc     = (filter.order ?? 'asc') === 'asc'
  const page    = Math.max(1, filter.page ?? 1)
  const from    = (page - 1) * INVENTORY_PAGE_SIZE

  q = q.order(sortCol, { ascending: asc }).range(from, from + INVENTORY_PAGE_SIZE - 1)

  const { data, count } = await q
  const total = count ?? 0

  const rows: ItemRow[] = (data ?? []).map((r) => {
    const stock       = n(r.stock)
    const reorder     = n(r.reorder_level)
    const minSt       = n(r.min_stock)
    return {
      id:            r.id as string,
      sku:           r.sku as string | null,
      name:          r.name as string,
      variantLabel:  r.variant_label as string | null,
      imageUrl:      (r.image_url as string | null) ?? null,
      familyId:      r.family_id as string | null,
      family:        (r.item_families as {name:string}|null)?.name ?? null,
      brandId:       r.brand_id as string | null,
      brand:         (r.brands as {name:string}|null)?.name ?? null,
      unitId:        r.unit_id as string | null,
      unit:          (r.units as {code:string}|null)?.code ?? null,
      hsnCode:       r.hsn_code as string | null,
      gstRate:       n(r.gst_rate),
      purchasePrice: r.purchase_price != null ? n(r.purchase_price) : null,
      sellingPrice:  r.selling_price  != null ? n(r.selling_price)  : null,
      costPrice:     r.cost_price     != null ? n(r.cost_price)     : null,
      stock,
      minStock:      minSt,
      reorderLevel:  reorder,
      isActive:      r.is_active as boolean,
      isImported:    r.is_imported as boolean,
      isTemplate:    r.is_template as boolean,
      isLowStock:    reorder > 0 && stock <= reorder && stock > 0,
      isOutOfStock:  stock <= 0,
      tags:          (r.tags as string[] | null) ?? [],
      createdAt:     r.created_at as string,
      updatedAt:     r.updated_at as string,
    }
  })

  return { rows, total, page, pageSize: INVENTORY_PAGE_SIZE, totalPages: Math.ceil(total / INVENTORY_PAGE_SIZE) }
}

// ── getItem ────────────────────────────────────────────────────────────────────
export async function getItem(id: string): Promise<ItemDetail | null> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return null

  const { data: r } = await supabase
    .from('items').select('*,item_families!items_family_fkey(name),brands!items_brand_fkey(name),units!items_unit_fkey(code)')
    .eq('id', id).eq('org_id', orgId).is('deleted_at', null).maybeSingle()

  if (!r) return null
  const stock = n(r.stock)
  const reorder = n(r.reorder_level)

  return {
    id: r.id as string, sku: r.sku as string|null, name: r.name as string,
    variantLabel: r.variant_label as string|null,
    parentId: r.parent_id as string|null,
    familyId: r.family_id as string|null, family: (r.item_families as {name:string}|null)?.name ?? null,
    brandId: r.brand_id as string|null, brand: (r.brands as {name:string}|null)?.name ?? null,
    unitId: r.unit_id as string|null, unit: (r.units as {code:string}|null)?.code ?? null,
    hsnCode: r.hsn_code as string|null, gstRate: n(r.gst_rate),
    description: r.description as string|null, barcode: r.barcode as string|null,
    notes: r.notes as string|null,
    purchasePrice: r.purchase_price != null ? n(r.purchase_price) : null,
    sellingPrice: r.selling_price != null ? n(r.selling_price) : null,
    costPrice: r.cost_price != null ? n(r.cost_price) : null,
    stock, minStock: n(r.min_stock), reorderLevel: reorder, maxStock: n(r.max_stock),
    leadTimeDays: n(r.lead_time_days),
    weightKg: r.weight_kg != null ? n(r.weight_kg) : null,
    dimensions: r.dimensions as ItemDetail['dimensions'],
    tags: (r.tags as string[]|null) ?? [],
    isActive: r.is_active as boolean, isImported: r.is_imported as boolean,
    isTemplate: r.is_template as boolean, deliveryDays: r.delivery_days != null ? n(r.delivery_days) : null,
    isLowStock: reorder > 0 && stock <= reorder && stock > 0,
    isOutOfStock: stock <= 0,
    lastPurchasePrice: r.last_purchase_price != null ? n(r.last_purchase_price) : null,
    lastPurchaseDate: r.last_purchase_date as string|null,
    importCurrency: r.import_currency as string|null, importPrice: r.import_price != null ? n(r.import_price) : null,
    exchangeRate: r.exchange_rate != null ? n(r.exchange_rate) : null,
    importDiscountPct: r.import_discount_pct != null ? n(r.import_discount_pct) : null,
    transportType: r.transport_type as string|null, transportValue: r.transport_value != null ? n(r.transport_value) : null,
    customDutyPct: r.custom_duty_pct != null ? n(r.custom_duty_pct) : null,
    profitMultiplier: r.profit_multiplier != null ? n(r.profit_multiplier) : null,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }
}

// ── Variation types ───────────────────────────────────────────────────────────
export type VariationInput = {
  size: string; finish: string; make: string; brand: string
  stock: number; sellingPrice: number | null; purchasePrice: number | null
}

export type ItemVariantRow = {
  id: string; sku: string | null; name: string; variantLabel: string | null
  size: string | null; finish: string | null; make: string | null; brand: string | null
  stock: number; sellingPrice: number | null; purchasePrice: number | null
  isActive: boolean; createdAt: string
}

// ── getItemVariants ───────────────────────────────────────────────────────────
export async function getItemVariants(parentId: string): Promise<ItemVariantRow[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const { data } = await supabase
    .from('items')
    .select('id,sku,name,variant_label,stock,selling_price,purchase_price,is_active,created_at,item_variations!itemvar_item_fkey(size,make,finish,brand)')
    .eq('org_id', orgId)
    .eq('parent_id', parentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return (data ?? []).map(r => {
    const v = (r.item_variations as {size:string|null;make:string|null;finish:string|null;brand:string|null}[] | null)?.[0]
    return {
      id: r.id as string,
      sku: r.sku as string | null,
      name: r.name as string,
      variantLabel: r.variant_label as string | null,
      size: v?.size ?? null,
      finish: v?.finish ?? null,
      make: v?.make ?? null,
      brand: v?.brand ?? null,
      stock: n(r.stock) ?? 0,
      sellingPrice: r.selling_price != null ? n(r.selling_price) : null,
      purchasePrice: r.purchase_price != null ? n(r.purchase_price) : null,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at as string,
    }
  })
}

// ── getInventoryKPIs ──────────────────────────────────────────────────────────
export async function getInventoryKPIs(): Promise<InventoryKPIs> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { totalItems:0, activeItems:0, outOfStock:0, lowStock:0, inventoryValue:0, sellingValue:0, reorderRequired:0 }

  const { data } = await supabase
    .from('items')
    .select('stock,min_stock,reorder_level,purchase_price,selling_price,cost_price,is_active')
    .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false)

  const rows = data ?? []
  const totalItems     = rows.length
  const activeItems    = rows.filter(r => r.is_active).length
  const outOfStock     = rows.filter(r => n(r.stock) <= 0).length
  const lowStock       = rows.filter(r => { const rl=n(r.reorder_level); return rl>0 && n(r.stock)<=rl && n(r.stock)>0 }).length
  const reorderRequired= rows.filter(r => { const rl=n(r.reorder_level); return rl>0 && n(r.stock)<=rl }).length
  const inventoryValue = rows.reduce((s,r) => s + n(r.stock) * n(r.cost_price ?? r.purchase_price), 0)
  const sellingValue   = rows.reduce((s,r) => s + n(r.stock) * n(r.selling_price), 0)

  return { totalItems, activeItems, outOfStock, lowStock, inventoryValue, sellingValue, reorderRequired }
}

// ── getStockMovements ─────────────────────────────────────────────────────────
export async function getStockMovements(itemId: string): Promise<StockMovementRow[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const { data } = await supabase
    .from('stock_movements')
    .select('id,date,direction,movement_type,qty,value,reference,notes,created_at,users!stock_movements_created_by_fkey(full_name)')
    .eq('org_id', orgId).eq('item_id', itemId)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
    .limit(100)

  return (data ?? []).map(r => ({
    id: r.id as string, date: r.date as string,
    direction: r.direction as 'in'|'out',
    movementType: r.movement_type as string,
    qty: n(r.qty), value: n(r.value),
    reference: r.reference as string|null, notes: r.notes as string|null,
    createdAt: r.created_at as string,
    creatorName: (r.users as {full_name:string|null}|null)?.full_name ?? null,
  }))
}

// ── getAllMovements ────────────────────────────────────────────────────────────
export async function getAllMovements(page = 1): Promise<{ rows: (StockMovementRow & {itemName:string; itemSku:string|null})[]; total:number }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { rows: [], total: 0 }
  const from = (page-1)*30

  const { data, count } = await supabase
    .from('stock_movements')
    .select('id,date,direction,movement_type,qty,value,reference,notes,created_at,item_id,items!stock_movements_item_id_fkey(name,sku),users!stock_movements_created_by_fkey(full_name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
    .range(from, from+29)

  return {
    total: count ?? 0,
    rows: (data ?? []).map(r => ({
      id: r.id as string, date: r.date as string,
      direction: r.direction as 'in'|'out',
      movementType: r.movement_type as string,
      qty: n(r.qty), value: n(r.value),
      reference: r.reference as string|null, notes: r.notes as string|null,
      createdAt: r.created_at as string,
      creatorName: (r.users as {full_name:string|null}|null)?.full_name ?? null,
      itemName: (r.items as {name:string;sku:string|null}|null)?.name ?? '',
      itemSku:  (r.items as {name:string;sku:string|null}|null)?.sku ?? null,
    }))
  }
}

// ── getAdjustments ────────────────────────────────────────────────────────────
export async function getAdjustments(itemId?: string): Promise<StockAdjustmentRow[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  let q = supabase
    .from('stock_adjustments')
    .select('id,type,qty,reason,ref_no,at,created_at,users!stock_adjustments_created_by_fkey(full_name)')
    .eq('org_id', orgId).order('at', { ascending: false }).limit(100)

  if (itemId) q = q.eq('item_id', itemId)

  const { data } = await q
  return (data ?? []).map(r => ({
    id: r.id as string, type: r.type as 'add'|'sub',
    qty: n(r.qty), reason: r.reason as string, refNo: r.ref_no as string|null,
    at: r.at as string,
    adjusterName: (r.users as {full_name:string|null}|null)?.full_name ?? null,
  }))
}

// ── lookups ────────────────────────────────────────────────────────────────────
export async function listFamilies(): Promise<Lookup[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []
  const { data } = await supabase.from('item_families').select('id,name')
    .eq('org_id', orgId).is('deleted_at', null).order('name')
  return (data ?? []).map(r => ({ id: r.id as string, label: r.name as string }))
}

export async function listBrands(): Promise<Lookup[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []
  const { data } = await supabase.from('brands').select('id,name')
    .eq('org_id', orgId).is('deleted_at', null).order('name')
  return (data ?? []).map(r => ({ id: r.id as string, label: r.name as string }))
}

export async function listUnits(): Promise<Lookup[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []
  const { data } = await supabase.from('units').select('id,code,name')
    .eq('org_id', orgId).is('deleted_at', null).order('code')
  return (data ?? []).map(r => ({ id: r.id as string, label: r.code as string, extra: r.name as string }))
}

// ── getNextSku ────────────────────────────────────────────────────────────────
export async function getNextSku(): Promise<string> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return 'ITM-0001'
  const { count } = await supabase.from('items').select('*', { count:'exact', head:true }).eq('org_id', orgId)
  return `ITM-${String((count ?? 0) + 1).padStart(4, '0')}`
}
