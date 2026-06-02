import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'

// ── Stock check result types ───────────────────────────────────────────────────

export type StockItemStatus = 'sufficient' | 'low' | 'out' | 'no_inventory'

export type StockCheckItem = {
  invoiceItemId:    string
  itemId:           string | null
  name:             string
  hsnCode:          string | null
  brand:            string | null
  unit:             string | null
  invoiceQty:       number
  currentStock:     number
  shortfall:        number                // max(0, invoiceQty - currentStock)
  stockStatus:      StockItemStatus
  // Existing PO coverage (if a PO from this invoice is already in progress)
  existingPoId:     string | null
  existingPoNo:     string | null
  existingPoStatus: string | null
  existingPoQtyOrdered: number
}

export type StockCheckResult = {
  invoiceId:      string
  invoiceNo:      string
  invoiceStatus:  string
  customerName:   string | null
  canDispatch:    boolean   // true only when ALL items have sufficient stock
  canPartial:     boolean   // true when at least ONE item has sufficient stock
  allInStock:     boolean
  itemsReady:     number    // items with stock >= invoiceQty
  itemsMissing:   number    // items with stock < invoiceQty
  totalShortfall: number
  hasExistingPo:  boolean   // true if a PO is already created for missing items
  items:          StockCheckItem[]
}

// ── Main stock check function ─────────────────────────────────────────────────

export async function checkStockForInvoice(invoiceId: string): Promise<StockCheckResult | null> {
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()

  if (!orgId) return null

  // 1. Fetch invoice + customer
  const { data: inv } = await supabase
    .from('invoices')
    .select('id,invoice_no,status,customer_id,customers(id,name)')
    .eq('id', invoiceId).eq('org_id', orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return null

  const cust = inv.customers as unknown as { name: string } | null

  // 2. Fetch invoice items
  const { data: invItems } = await supabase
    .from('invoice_items')
    .select('id,item_id,name,description,hsn_code,brand,unit,qty')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true })

  if (!invItems || invItems.length === 0) {
    return {
      invoiceId, invoiceNo: inv.invoice_no as string,
      invoiceStatus: inv.status as string,
      customerName: cust?.name ?? null,
      canDispatch: false, canPartial: false, allInStock: false,
      itemsReady: 0, itemsMissing: 0, totalShortfall: 0, hasExistingPo: false, items: [],
    }
  }

  // 3. Fetch live stock for all matched items
  const itemIds = invItems.filter(i => i.item_id).map(i => i.item_id as string)
  const stockMap: Record<string, number> = {}

  if (itemIds.length > 0) {
    const { data: stockData } = await supabase
      .from('items').select('id,stock').in('id', itemIds)
    for (const s of stockData ?? []) stockMap[s.id as string] = Number(s.stock) || 0
  }

  // 4. Check existing POs for this invoice (to show coverage info)
  const { data: existingPos } = await supabase
    .from('purchase_orders')
    .select('id,po_no,status,po_items(item_id,qty_ordered)')
    .eq('invoice_id', invoiceId).eq('org_id', orgId).is('deleted_at', null)
    .not('status', 'in', '("cancelled")')

  // Build a map: item_id → best PO coverage
  type PoCoverage = { poId: string; poNo: string; poStatus: string; qtyOrdered: number }
  const poCoverageMap: Record<string, PoCoverage> = {}

  for (const po of existingPos ?? []) {
    for (const pi of (po.po_items as { item_id: string | null; qty_ordered: number }[]) ?? []) {
      if (!pi.item_id) continue
      // Keep the most recent/active coverage
      if (!poCoverageMap[pi.item_id]) {
        poCoverageMap[pi.item_id] = {
          poId:      po.id as string,
          poNo:      po.po_no as string,
          poStatus:  po.status as string,
          qtyOrdered:Number(pi.qty_ordered) || 0,
        }
      }
    }
  }

  // 5. Build result items
  let itemsReady   = 0
  let itemsMissing = 0
  let totalShortfall = 0

  const items: StockCheckItem[] = invItems.map(i => {
    const invoiceQty   = Number(i.qty) || 0
    const hasItem      = !!i.item_id
    const currentStock = hasItem ? (stockMap[i.item_id as string] ?? 0) : 0
    const shortfall    = Math.max(0, invoiceQty - currentStock)

    const stockStatus: StockItemStatus = !hasItem ? 'no_inventory'
      : currentStock === 0                ? 'out'
      : currentStock < invoiceQty         ? 'low'
      : 'sufficient'

    const coverage = hasItem && i.item_id ? poCoverageMap[i.item_id as string] : undefined

    if (stockStatus === 'sufficient') itemsReady++
    else { itemsMissing++; totalShortfall += shortfall }

    return {
      invoiceItemId:    i.id as string,
      itemId:           i.item_id as string | null,
      name:             i.name as string,
      hsnCode:          i.hsn_code as string | null,
      brand:            i.brand as string | null,
      unit:             i.unit as string | null,
      invoiceQty,
      currentStock,
      shortfall,
      stockStatus,
      existingPoId:     coverage?.poId ?? null,
      existingPoNo:     coverage?.poNo ?? null,
      existingPoStatus: coverage?.poStatus ?? null,
      existingPoQtyOrdered: coverage?.qtyOrdered ?? 0,
    }
  })

  const canDispatch  = itemsMissing === 0
  const canPartial   = itemsReady > 0
  const hasExistingPo = (existingPos ?? []).length > 0

  return {
    invoiceId, invoiceNo: inv.invoice_no as string,
    invoiceStatus: inv.status as string,
    customerName: cust?.name ?? null,
    canDispatch, canPartial, allInStock: canDispatch,
    itemsReady, itemsMissing, totalShortfall,
    hasExistingPo, items,
  }
}
