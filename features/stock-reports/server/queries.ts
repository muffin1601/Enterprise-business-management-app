import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { getStockStatus, REPORT_PAGE_SIZE, type StockReportFilter, type StockStatus } from '@/validations/stock-report'

const n = (v: unknown) => (v == null ? 0 : Number(v))
const san = (s: string) => s.replace(/[%_]/g, '\\$&').trim()

async function ctx() {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()
  return { orgId, supabase }
}

// ── Return Types ──────────────────────────────────────────────────────────────

export type StockDashboardStats = {
  totalItems:         number
  inStockCount:       number
  lowStockCount:      number
  outOfStockCount:    number
  overstockCount:     number
  totalPurchaseValue: number
  totalSellingValue:  number
  totalMargin:        number
  pendingPoQty:       number
}

export type CurrentStockRow = {
  id:            string
  sku:           string | null
  name:          string
  family:        string | null
  brand:         string | null
  unit:          string | null
  stock:         number
  minStock:      number
  reorderLevel:  number
  maxStock:      number | null
  purchasePrice: number | null
  sellingPrice:  number | null
  purchaseValue: number
  sellingValue:  number
  stockStatus:   StockStatus
}

export type LowStockRow = CurrentStockRow & {
  shortfall:       number
  pendingPoQty:    number
  estReorderCost:  number
}

export type ValuationRow = {
  id:            string
  name:          string
  sku:           string | null
  family:        string | null
  brand:         string | null
  stock:         number
  unit:          string | null
  purchasePrice: number | null
  sellingPrice:  number | null
  purchaseValue: number
  sellingValue:  number
  margin:        number
  marginPct:     number
}

export type ValuationSummary = {
  totalPurchaseValue: number
  totalSellingValue:  number
  totalMargin:        number
  byFamily: { family: string; purchaseValue: number; sellingValue: number; itemCount: number }[]
}

export type MovementRow = {
  id:        string
  date:      string
  itemId:    string | null
  itemName:  string
  sku:       string | null
  type:      'inward' | 'outward' | 'adjustment'
  refNo:     string
  relatedDoc:string | null
  qtyIn:     number
  qtyOut:    number
  note:      string | null
}

export type ItemMovementRow = {
  id:           string
  name:         string
  sku:          string | null
  family:       string | null
  unit:         string | null
  currentStock: number
  totalInward:  number
  totalOutward: number
  netMovement:  number
}

export type DispatchRow = {
  id:           string
  dcNo:         string
  date:         string
  dispatchDate: string | null
  status:       string
  customerName: string | null
  invoiceNo:    string | null
  itemCount:    number
  totalQty:     number
  deliveryAddress: string | null
}

// ── getStockDashboardStats ────────────────────────────────────────────────────

export async function getStockDashboardStats(): Promise<StockDashboardStats> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { totalItems:0, inStockCount:0, lowStockCount:0, outOfStockCount:0, overstockCount:0, totalPurchaseValue:0, totalSellingValue:0, totalMargin:0, pendingPoQty:0 }

  const [{ data: items }, { data: poItems }] = await Promise.all([
    supabase.from('items')
      .select('id,stock,reorder_level,min_stock,max_stock,purchase_price,selling_price')
      .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false),
    supabase.from('po_items')
      .select('qty_ordered,qty_received,purchase_orders!inner(org_id,status)')
      .eq('purchase_orders.org_id', orgId)
      .not('purchase_orders.status', 'in', '("cancelled","closed","received")'),
  ])

  const rows = items ?? []
  let inStock = 0, lowStock = 0, outStock = 0, overStock = 0
  let purchaseVal = 0, sellingVal = 0

  for (const r of rows) {
    const st = getStockStatus(n(r.stock), n(r.reorder_level), n(r.min_stock), r.max_stock ? n(r.max_stock) : null)
    if (st === 'ok')   inStock++
    else if (st === 'low')  lowStock++
    else if (st === 'out')  outStock++
    else if (st === 'over') overStock++

    const s = n(r.stock)
    if (r.purchase_price) purchaseVal += s * n(r.purchase_price)
    if (r.selling_price)  sellingVal  += s * n(r.selling_price)
  }

  const pendingPoQty = (poItems ?? []).reduce((sum, i) => sum + Math.max(0, n(i.qty_ordered) - n(i.qty_received)), 0)

  return {
    totalItems:         rows.length,
    inStockCount:       inStock,
    lowStockCount:      lowStock,
    outOfStockCount:    outStock,
    overstockCount:     overStock,
    totalPurchaseValue: purchaseVal,
    totalSellingValue:  sellingVal,
    totalMargin:        sellingVal - purchaseVal,
    pendingPoQty,
  }
}

// ── getCurrentStockReport ─────────────────────────────────────────────────────

export async function getCurrentStockReport(filter: StockReportFilter): Promise<{ rows: CurrentStockRow[]; total: number }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { rows: [], total: 0 }

  let q = supabase
    .from('items')
    .select(
      `id,sku,name,stock,reorder_level,min_stock,max_stock,purchase_price,selling_price,
       item_families!items_family_fkey(name),
       brands!items_brand_fkey(name),
       units!items_unit_fkey(code)`,
      { count: 'exact' },
    )
    .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false)

  if (filter.search) q = q.or(`name.ilike.%${san(filter.search)}%,sku.ilike.%${san(filter.search)}%`)
  if (filter.familyId) q = q.eq('family_id', filter.familyId)
  if (filter.brandId)  q = q.eq('brand_id', filter.brandId)

  const sortCol = filter.sort === 'stock' ? 'stock' : filter.sort === 'value' ? 'purchase_price' : 'name'
  q = q.order(sortCol, { ascending: filter.order === 'asc' })

  // No pagination here — client filters by status after fetch for accurate counts
  const { data, count } = await q.limit(2000)

  let rows: CurrentStockRow[] = (data ?? []).map(r => {
    const stock   = n(r.stock)
    const pp      = r.purchase_price ? n(r.purchase_price) : null
    const sp      = r.selling_price  ? n(r.selling_price)  : null
    const status  = getStockStatus(stock, n(r.reorder_level), n(r.min_stock), r.max_stock ? n(r.max_stock) : null)
    return {
      id:            r.id as string,
      sku:           r.sku as string | null,
      name:          r.name as string,
      family:        (r.item_families as unknown as { name: string } | null)?.name ?? null,
      brand:         (r.brands as unknown as { name: string } | null)?.name ?? null,
      unit:          (r.units as unknown as { code: string } | null)?.code ?? null,
      stock,
      minStock:      n(r.min_stock),
      reorderLevel:  n(r.reorder_level),
      maxStock:      r.max_stock ? n(r.max_stock) : null,
      purchasePrice: pp,
      sellingPrice:  sp,
      purchaseValue: pp ? stock * pp : 0,
      sellingValue:  sp ? stock * sp : 0,
      stockStatus:   status,
    }
  })

  if (filter.status && filter.status !== 'all') {
    rows = rows.filter(r => r.stockStatus === filter.status)
  }

  const total = rows.length
  const page  = Math.max(1, filter.page ?? 1)
  const from  = (page - 1) * REPORT_PAGE_SIZE
  return { rows: rows.slice(from, from + REPORT_PAGE_SIZE), total }
}

// ── getLowStockReport ─────────────────────────────────────────────────────────

export async function getLowStockReport(): Promise<LowStockRow[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const [{ data: items }, { data: poItems }] = await Promise.all([
    supabase.from('items')
      .select(`id,sku,name,stock,reorder_level,min_stock,max_stock,purchase_price,selling_price,last_purchase_price,
               item_families!items_family_fkey(name),brands!items_brand_fkey(name),units!items_unit_fkey(code)`)
      .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false)
      .or('stock.eq.0,stock.lt.reorder_level'),
    supabase.from('po_items')
      .select('item_id,qty_ordered,qty_received,purchase_orders!inner(org_id,status)')
      .eq('purchase_orders.org_id', orgId)
      .not('purchase_orders.status', 'in', '("cancelled","closed","received")'),
  ])

  // Build pending PO qty map by item_id
  const pendingMap: Record<string, number> = {}
  for (const pi of poItems ?? []) {
    if (!pi.item_id) continue
    pendingMap[pi.item_id as string] = (pendingMap[pi.item_id as string] ?? 0) + Math.max(0, n(pi.qty_ordered) - n(pi.qty_received))
  }

  return (items ?? [])
    .map(r => {
      const stock      = n(r.stock)
      const reorder    = n(r.reorder_level) || n(r.min_stock) || 0
      const shortfall  = Math.max(0, reorder - stock)
      const lpp        = r.last_purchase_price ? n(r.last_purchase_price) : (r.purchase_price ? n(r.purchase_price) : null)
      const pp         = r.purchase_price ? n(r.purchase_price) : null
      const sp         = r.selling_price  ? n(r.selling_price)  : null
      const pending    = pendingMap[r.id as string] ?? 0
      return {
        id:            r.id as string,
        sku:           r.sku as string | null,
        name:          r.name as string,
        family:        (r.item_families as unknown as { name: string } | null)?.name ?? null,
        brand:         (r.brands as unknown as { name: string } | null)?.name ?? null,
        unit:          (r.units as unknown as { code: string } | null)?.code ?? null,
        stock,
        minStock:      n(r.min_stock),
        reorderLevel:  reorder,
        maxStock:      r.max_stock ? n(r.max_stock) : null,
        purchasePrice: pp,
        sellingPrice:  sp,
        purchaseValue: pp ? stock * pp : 0,
        sellingValue:  sp ? stock * sp : 0,
        stockStatus:   getStockStatus(stock, reorder, n(r.min_stock), r.max_stock ? n(r.max_stock) : null),
        shortfall,
        pendingPoQty:  pending,
        estReorderCost:lpp ? shortfall * lpp : 0,
      }
    })
    .sort((a, b) => {
      if (a.stock === 0 && b.stock !== 0) return -1
      if (b.stock === 0 && a.stock !== 0) return 1
      return b.shortfall - a.shortfall
    })
}

// ── getValuationReport ────────────────────────────────────────────────────────

export async function getValuationReport(filter: StockReportFilter): Promise<{ rows: ValuationRow[]; summary: ValuationSummary }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { rows: [], summary: { totalPurchaseValue:0, totalSellingValue:0, totalMargin:0, byFamily:[] } }

  let q = supabase
    .from('items')
    .select(`id,sku,name,stock,purchase_price,selling_price,
             item_families!items_family_fkey(name),brands!items_brand_fkey(name),units!items_unit_fkey(code)`)
    .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false)
    .gt('stock', 0)

  if (filter.search)   q = q.or(`name.ilike.%${san(filter.search)}%,sku.ilike.%${san(filter.search)}%`)
  if (filter.familyId) q = q.eq('family_id', filter.familyId)
  if (filter.brandId)  q = q.eq('brand_id',  filter.brandId)
  q = q.order('name', { ascending: true })

  const { data } = await q.limit(2000)

  const rows: ValuationRow[] = (data ?? []).map(r => {
    const stock = n(r.stock)
    const pp    = r.purchase_price ? n(r.purchase_price) : null
    const sp    = r.selling_price  ? n(r.selling_price)  : null
    const pv    = pp ? stock * pp : 0
    const sv    = sp ? stock * sp : 0
    const margin   = sv - pv
    const marginPct = sv > 0 ? (margin / sv) * 100 : 0
    return {
      id:            r.id as string,
      name:          r.name as string,
      sku:           r.sku as string | null,
      family:        (r.item_families as unknown as { name: string } | null)?.name ?? null,
      brand:         (r.brands as unknown as { name: string } | null)?.name ?? null,
      stock,
      unit:          (r.units as unknown as { code: string } | null)?.code ?? null,
      purchasePrice: pp,
      sellingPrice:  sp,
      purchaseValue: pv,
      sellingValue:  sv,
      margin,
      marginPct,
    }
  })

  // Summary totals
  const totalPurchaseValue = rows.reduce((s, r) => s + r.purchaseValue, 0)
  const totalSellingValue  = rows.reduce((s, r) => s + r.sellingValue, 0)
  const totalMargin        = totalSellingValue - totalPurchaseValue

  // Group by family
  const familyMap: Record<string, { pv: number; sv: number; count: number }> = {}
  for (const r of rows) {
    const f = r.family ?? 'Uncategorised'
    if (!familyMap[f]) familyMap[f] = { pv: 0, sv: 0, count: 0 }
    familyMap[f].pv    += r.purchaseValue
    familyMap[f].sv    += r.sellingValue
    familyMap[f].count += 1
  }
  const byFamily = Object.entries(familyMap)
    .map(([family, v]) => ({ family, purchaseValue: v.pv, sellingValue: v.sv, itemCount: v.count }))
    .sort((a, b) => b.purchaseValue - a.purchaseValue)

  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * REPORT_PAGE_SIZE
  return {
    rows: rows.slice(from, from + REPORT_PAGE_SIZE),
    summary: { totalPurchaseValue, totalSellingValue, totalMargin, byFamily },
  }
}

// ── getMovementLedger ─────────────────────────────────────────────────────────

export async function getMovementLedger(filter: StockReportFilter): Promise<{ rows: MovementRow[]; total: number }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { rows: [], total: 0 }

  const dateFrom = filter.dateFrom ? filter.dateFrom.toISOString().split('T')[0] : undefined
  const dateTo   = filter.dateTo   ? filter.dateTo.toISOString().split('T')[0]   : undefined

  const movements: MovementRow[] = []

  // 1. Inward — GRN items
  {
    let q = supabase
      .from('grn_items')
      .select(`id,qty_received,item_id,
               goods_receipts!inner(id,grn_no,date,org_id,po_id,
                 purchase_orders!inner(po_no,invoice_id,
                   invoices(invoice_no)
                 )
               ),
               items(name,sku)`)
      .eq('goods_receipts.org_id', orgId)

    if (dateFrom) q = q.gte('goods_receipts.date', dateFrom)
    if (dateTo)   q = q.lte('goods_receipts.date', dateTo)
    if (filter.search) {
      const t = san(filter.search)
      q = q.ilike('items.name', `%${t}%`)
    }

    const { data } = await q.order('goods_receipts(date)', { ascending: false }).limit(500)

    for (const r of data ?? []) {
      const grn = r.goods_receipts as unknown as { id: string; grn_no: string; date: string; po_id: string; purchase_orders: { po_no: string; invoices: { invoice_no: string } | null } | null } | null
      const item = r.items as unknown as { name: string; sku: string | null } | null
      movements.push({
        id:         r.id as string,
        date:       grn?.date ?? '',
        itemId:     r.item_id as string | null,
        itemName:   item?.name ?? 'Unknown',
        sku:        item?.sku ?? null,
        type:       'inward',
        refNo:      grn?.grn_no ?? '',
        relatedDoc: grn?.purchase_orders?.po_no ?? null,
        qtyIn:      n(r.qty_received),
        qtyOut:     0,
        note:       null,
      })
    }
  }

  // 2. Outward — DC items (only dispatched)
  {
    let q = supabase
      .from('dc_items')
      .select(`id,qty_dispatched,item_id,
               delivery_challans!inner(id,dc_no,dispatch_date,org_id,stock_deducted,invoice_id,
                 invoices(invoice_no)
               ),
               items(name,sku)`)
      .eq('delivery_challans.org_id', orgId)
      .eq('delivery_challans.stock_deducted', true)

    if (dateFrom) q = q.gte('delivery_challans.dispatch_date', dateFrom)
    if (dateTo)   q = q.lte('delivery_challans.dispatch_date', dateTo)

    const { data } = await q.order('delivery_challans(dispatch_date)', { ascending: false }).limit(500)

    for (const r of data ?? []) {
      const dc   = r.delivery_challans as unknown as { id: string; dc_no: string; dispatch_date: string | null; invoices: { invoice_no: string } | null } | null
      const item = r.items as unknown as { name: string; sku: string | null } | null
      movements.push({
        id:         r.id as string,
        date:       dc?.dispatch_date ?? '',
        itemId:     r.item_id as string | null,
        itemName:   item?.name ?? 'Unknown',
        sku:        item?.sku ?? null,
        type:       'outward',
        refNo:      dc?.dc_no ?? '',
        relatedDoc: dc?.invoices?.invoice_no ?? null,
        qtyIn:      0,
        qtyOut:     n(r.qty_dispatched),
        note:       null,
      })
    }
  }

  // 3. Adjustments
  {
    let q = supabase
      .from('stock_adjustments')
      .select('id,type,qty,reason,ref_no,at,item_id,items(name,sku)')
      .eq('org_id', orgId)

    if (dateFrom) q = q.gte('at', dateFrom)
    if (dateTo)   q = q.lte('at', dateTo)

    const { data } = await q.order('at', { ascending: false }).limit(200)

    for (const r of data ?? []) {
      const item = r.items as unknown as { name: string; sku: string | null } | null
      const isAdd = r.type === 'add'
      movements.push({
        id:         r.id as string,
        date:       (r.at as string).split('T')[0]!,
        itemId:     r.item_id as string | null,
        itemName:   item?.name ?? 'Unknown',
        sku:        item?.sku ?? null,
        type:       'adjustment',
        refNo:      (r.ref_no as string | null) ?? `ADJ-${r.id}`,
        relatedDoc: null,
        qtyIn:      isAdd ? n(r.qty) : 0,
        qtyOut:     isAdd ? 0 : n(r.qty),
        note:       r.reason as string | null,
      })
    }
  }

  // Sort by date desc
  movements.sort((a, b) => b.date.localeCompare(a.date))

  const total = movements.length
  const page  = Math.max(1, filter.page ?? 1)
  const from  = (page - 1) * REPORT_PAGE_SIZE
  return { rows: movements.slice(from, from + REPORT_PAGE_SIZE), total }
}

// ── getItemMovementSummary ────────────────────────────────────────────────────

export async function getItemMovementSummary(filter: StockReportFilter): Promise<ItemMovementRow[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const dateFrom = filter.dateFrom ? filter.dateFrom.toISOString().split('T')[0] : undefined
  const dateTo   = filter.dateTo   ? filter.dateTo.toISOString().split('T')[0]   : undefined

  // Fetch items
  const { data: items } = await supabase
    .from('items')
    .select(`id,sku,name,stock,item_families!items_family_fkey(name),units!items_unit_fkey(code)`)
    .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false)
    .order('name')
    .limit(1000)

  if (!items) return []

  const itemIds = items.map(i => i.id as string)

  // Inward totals
  const inwardMap: Record<string, number> = {}
  {
    let q = supabase.from('grn_items')
      .select('item_id,qty_received,goods_receipts!inner(date,org_id)')
      .eq('goods_receipts.org_id', orgId)
      .in('item_id', itemIds)
    if (dateFrom) q = q.gte('goods_receipts.date', dateFrom)
    if (dateTo)   q = q.lte('goods_receipts.date', dateTo)
    const { data } = await q
    for (const r of data ?? []) {
      const id = r.item_id as string
      inwardMap[id] = (inwardMap[id] ?? 0) + n(r.qty_received)
    }
  }

  // Outward totals
  const outwardMap: Record<string, number> = {}
  {
    let q = supabase.from('dc_items')
      .select('item_id,qty_dispatched,delivery_challans!inner(dispatch_date,org_id,stock_deducted)')
      .eq('delivery_challans.org_id', orgId)
      .eq('delivery_challans.stock_deducted', true)
      .in('item_id', itemIds)
    if (dateFrom) q = q.gte('delivery_challans.dispatch_date', dateFrom)
    if (dateTo)   q = q.lte('delivery_challans.dispatch_date', dateTo)
    const { data } = await q
    for (const r of data ?? []) {
      const id = r.item_id as string
      outwardMap[id] = (outwardMap[id] ?? 0) + n(r.qty_dispatched)
    }
  }

  return items.map(i => {
    const inward  = inwardMap[i.id as string] ?? 0
    const outward = outwardMap[i.id as string] ?? 0
    return {
      id:           i.id as string,
      name:         i.name as string,
      sku:          i.sku as string | null,
      family:       (i.item_families as unknown as { name: string } | null)?.name ?? null,
      unit:         (i.units as unknown as { code: string } | null)?.code ?? null,
      currentStock: n(i.stock),
      totalInward:  inward,
      totalOutward: outward,
      netMovement:  inward - outward,
    }
  }).filter(r => r.totalInward > 0 || r.totalOutward > 0 || filter.search)
}

// ── getDispatchSummary ────────────────────────────────────────────────────────

export async function getDispatchSummary(filter: StockReportFilter): Promise<{ rows: DispatchRow[]; total: number }> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return { rows: [], total: 0 }

  let q = supabase
    .from('delivery_challans')
    .select(`id,dc_no,date,dispatch_date,status,delivery_address,
             invoices(id,invoice_no),
             customers(id,name)`,
      { count: 'exact' })
    .eq('org_id', orgId).is('deleted_at', null)

  const dateFrom = filter.dateFrom ? filter.dateFrom.toISOString().split('T')[0] : undefined
  const dateTo   = filter.dateTo   ? filter.dateTo.toISOString().split('T')[0]   : undefined
  if (dateFrom) q = q.gte('date', dateFrom)
  if (dateTo)   q = q.lte('date', dateTo)
  if (filter.search) q = q.or(`dc_no.ilike.%${san(filter.search)}%`)

  const sortCol = filter.sort === 'dc_no' ? 'dc_no' : filter.sort === 'date' ? 'date' : 'dispatch_date'
  q = q.order(sortCol, { ascending: filter.order === 'asc' })

  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * REPORT_PAGE_SIZE

  const { data, count } = await q.range(from, from + REPORT_PAGE_SIZE - 1)
  const ids = (data ?? []).map(r => r.id as string)

  // Fetch item counts and totals per DC
  const dcItemMap: Record<string, { count: number; totalQty: number }> = {}
  if (ids.length > 0) {
    const { data: dcItems } = await supabase
      .from('dc_items').select('dc_id,qty_dispatched').in('dc_id', ids)
    for (const i of dcItems ?? []) {
      const did = i.dc_id as string
      if (!dcItemMap[did]) dcItemMap[did] = { count: 0, totalQty: 0 }
      dcItemMap[did].count += 1
      dcItemMap[did].totalQty += n(i.qty_dispatched)
    }
  }

  const rows: DispatchRow[] = (data ?? []).map(r => {
    const inv  = r.invoices  as unknown as { invoice_no: string } | null
    const cust = r.customers as unknown as { name: string } | null
    return {
      id:              r.id as string,
      dcNo:            r.dc_no as string,
      date:            r.date as string,
      dispatchDate:    r.dispatch_date as string | null,
      status:          r.status as string,
      customerName:    cust?.name ?? null,
      invoiceNo:       inv?.invoice_no ?? null,
      itemCount:       dcItemMap[r.id as string]?.count ?? 0,
      totalQty:        dcItemMap[r.id as string]?.totalQty ?? 0,
      deliveryAddress: r.delivery_address as string | null,
    }
  })

  return { rows, total: count ?? 0 }
}

// ── getTopItemsByValue (for chart) ────────────────────────────────────────────

export async function getTopItemsByValue(limit = 10): Promise<{ name: string; purchaseValue: number; sellingValue: number }[]> {
  const { orgId, supabase } = await ctx()
  if (!orgId) return []

  const { data } = await supabase
    .from('items')
    .select('name,stock,purchase_price,selling_price')
    .eq('org_id', orgId).is('deleted_at', null).eq('is_template', false)
    .gt('stock', 0)
    .not('purchase_price', 'is', null)
    .order('stock', { ascending: false })
    .limit(100)

  return (data ?? [])
    .map(r => ({
      name:          r.name as string,
      purchaseValue: n(r.stock) * n(r.purchase_price),
      sellingValue:  r.selling_price ? n(r.stock) * n(r.selling_price) : 0,
    }))
    .sort((a, b) => b.purchaseValue - a.purchaseValue)
    .slice(0, limit)
}
