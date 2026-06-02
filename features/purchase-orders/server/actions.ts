'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  purchaseOrderSchema, updatePurchaseOrderSchema, poItemUpdateSchema,
  poStatusSchema, grnSchema, type PoStatusType,
} from '@/validations/purchase-order'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getNextPoNo } from './queries'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fe = (e: import('zod').ZodError) => e.flatten().fieldErrors as Record<string, string[]>

async function ctxOrErr(): Promise<{ c: import('@/lib/auth/action-context').ActionContext } | { c?: never; error: import('@/types/action').ActionErr }> {
  try { return { c: await getActionContext() } }
  catch (e) {
    if (e instanceof AuthError) return { error: err(e.code as 'unauthenticated' | 'forbidden', e.message) }
    throw e
  }
}

function revalAll(id?: string) {
  revalidatePath('/purchase-orders')
  if (id) revalidatePath(`/purchase-orders/${id}`)
}

// ── GST calculation ───────────────────────────────────────────────────────────

function calcItemGst(rate: number, qty: number, discPct: number, gstPct: number, isIgst: boolean) {
  const taxable = +(rate * qty * (1 - discPct / 100)).toFixed(2)
  const half    = gstPct / 2
  const cgst    = isIgst ? 0 : +(taxable * half / 100).toFixed(2)
  const sgst    = isIgst ? 0 : +(taxable * half / 100).toFixed(2)
  const igst    = isIgst ? +(taxable * gstPct / 100).toFixed(2) : 0
  return {
    taxableValue: taxable,
    cgstPct: isIgst ? 0 : half, sgstPct: isIgst ? 0 : half, igstPct: isIgst ? gstPct : 0,
    cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
    total: +(taxable + cgst + sgst + igst).toFixed(2),
  }
}

async function recalcPoTotals(supabase: SupabaseClient, poId: string, orgId: string) {
  const { data: po } = await supabase.from('purchase_orders').select('transport').eq('id', poId).maybeSingle()
  const { data: items } = await supabase.from('po_items')
    .select('taxable_value,cgst_amount,sgst_amount,igst_amount').eq('po_id', poId)

  const taxable  = (items ?? []).reduce((s, i) => s + Number(i.taxable_value), 0)
  const cgst     = (items ?? []).reduce((s, i) => s + Number(i.cgst_amount), 0)
  const sgst     = (items ?? []).reduce((s, i) => s + Number(i.sgst_amount), 0)
  const igst     = (items ?? []).reduce((s, i) => s + Number(i.igst_amount), 0)
  const totalGst = cgst + sgst + igst
  const transport = Number(po?.transport) || 0
  const grand    = +(taxable + totalGst + transport).toFixed(2)

  await supabase.from('purchase_orders').update({
    taxable_value: +taxable.toFixed(2), cgst_amount: +cgst.toFixed(2),
    sgst_amount: +sgst.toFixed(2), igst_amount: +igst.toFixed(2),
    total_gst: +totalGst.toFixed(2), grand_total: grand,
  }).eq('id', poId).eq('org_id', orgId)
}

// ── Status Machine ────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PoStatusType, PoStatusType[]> = {
  draft:              ['pending_approval', 'approved', 'cancelled'],
  pending_approval:   ['approved', 'cancelled'],
  approved:           ['sent', 'cancelled'],
  sent:               ['partially_received', 'received', 'cancelled'],
  partially_received: ['received', 'cancelled'],
  received:           ['closed'],
  closed:             [],
  cancelled:          [],
}

async function insertStatusHistory(
  supabase: SupabaseClient, orgId: string, poId: string,
  fromStatus: string | null, toStatus: string, note: string | undefined, userId: string,
) {
  await supabase.from('po_status_history').insert({
    org_id: orgId, po_id: poId, from_status: fromStatus,
    to_status: toStatus, note: note ?? null, changed_by: userId,
  })
}

// ── createPurchaseOrder ───────────────────────────────────────────────────────

export async function createPurchaseOrder(input: unknown): Promise<ActionResult<{ id: string; poNo: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('purchase_orders.create')) return err('forbidden', 'Missing purchase_orders.create permission.')

  const parsed = purchaseOrderSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  // Guard: invoice must be issued
  const { data: inv } = await supabase
    .from('invoices')
    .select('id,status,invoice_no,customer_id,subject,gst_mode,gst_pct,terms')
    .eq('id', d.invoiceId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv)                    return err('not_found', 'Invoice not found.')
  if (inv.status !== 'issued') return err('state_transition', `Invoice must be issued. Current status: ${inv.status}.`)

  // Fetch vendor for customer_ref
  const { data: ven } = await supabase.from('vendors').select('name').eq('id', d.vendorId).maybeSingle()

  // Fetch customer name for reference
  const { data: cust } = await supabase.from('customers').select('name').eq('id', inv.customer_id ?? '').maybeSingle()

  const poNo = await getNextPoNo(supabase, r.c.orgId)
  const isIgst = d.isIgst ?? false

  // Create PO header
  const { data: po, error: poErr } = await supabase.from('purchase_orders').insert({
    org_id:         r.c.orgId,
    po_no:          poNo,
    invoice_id:     d.invoiceId,
    vendor_id:      d.vendorId,
    customer_ref:   cust?.name ?? null,
    subject:        inv.subject ?? null,
    date:           d.date ? d.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    expected_delivery: d.expectedDelivery ? d.expectedDelivery.toISOString().split('T')[0] : null,
    status:         'draft',
    gst_mode:       inv.gst_mode ?? 'add',
    gst_pct:        inv.gst_pct ?? 18,
    is_igst:        isIgst,
    transport:      d.transport ?? 0,
    transport_note: d.transportNote ?? null,
    payment_terms:  d.paymentTerms ?? ven?.name ? null : null,
    notes:          d.notes ?? null,
    internal_notes: d.internalNotes ?? null,
    terms:          inv.terms ?? [],
    taxable_value: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_gst: 0, grand_total: 0,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (poErr || !po) return err('internal', poErr?.message ?? 'Failed to create PO.')

  const poId  = po.id as string
  const gstPct = Number(inv.gst_pct) || 18

  // Copy invoice_items → po_items with stock check
  const { data: invItems } = await supabase
    .from('invoice_items')
    .select('id,item_id,name,description,hsn_code,brand,unit,qty,discount_pct,gst_pct,sort_order')
    .eq('invoice_id', d.invoiceId).order('sort_order', { ascending: true })

  if (invItems && invItems.length > 0) {
    // Fetch live stock for all items
    const itemIds = (invItems).filter(i => i.item_id).map(i => i.item_id as string)
    const stockMap: Record<string, number> = {}
    if (itemIds.length > 0) {
      const { data: stockData } = await supabase.from('items').select('id,stock,purchase_price').in('id', itemIds)
      for (const s of stockData ?? []) stockMap[s.id as string] = Number(s.stock) || 0
      // Also store purchase price for rate prefill
      for (const s of stockData ?? []) {
        if (s.purchase_price) stockMap[`price_${s.id}`] = Number(s.purchase_price)
      }
    }

    const poItemRows = invItems.map((item, i) => {
      const invQty   = Number(item.qty) || 1
      const stock    = item.item_id ? (stockMap[item.item_id as string] ?? 0) : 0
      const qtyToOrder = Math.max(0, invQty - stock)
      const purchaseRate = item.item_id ? (stockMap[`price_${item.item_id}`] ?? 0) : 0
      const itemGstPct   = Number(item.gst_pct) || gstPct
      const calc = calcItemGst(purchaseRate, qtyToOrder, Number(item.discount_pct) || 0, itemGstPct, isIgst)
      return {
        org_id:           r.c.orgId,
        po_id:            poId,
        invoice_item_id:  item.id,
        item_id:          item.item_id ?? null,
        name:             item.name,
        description:      item.description ?? null,
        hsn_code:         item.hsn_code ?? null,
        brand:            item.brand ?? null,
        unit:             item.unit ?? null,
        invoice_qty:      invQty,
        stock_at_creation:stock,
        qty_ordered:      qtyToOrder,
        qty_received:     0,
        rate:             purchaseRate,
        discount_pct:     Number(item.discount_pct) || 0,
        gst_pct:          itemGstPct,
        cgst_pct:         calc.cgstPct, sgst_pct: calc.sgstPct, igst_pct: calc.igstPct,
        taxable_value:    calc.taxableValue,
        cgst_amount:      calc.cgstAmount, sgst_amount: calc.sgstAmount, igst_amount: calc.igstAmount,
        total:            calc.total,
        sort_order:       i,
      }
    })

    await supabase.from('po_items').insert(poItemRows)
  }

  await recalcPoTotals(supabase, poId, r.c.orgId)
  await insertStatusHistory(supabase, r.c.orgId, poId, null, 'draft', 'PO created from invoice.', r.c.userId)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'purchase_orders',
    entityId: poId, action: 'insert', after: { poNo, invoiceId: d.invoiceId, vendorId: d.vendorId },
  })

  revalAll()
  revalidatePath(`/invoices/${d.invoiceId}`)
  return ok({ id: poId, poNo })
}

// ── updatePurchaseOrder ───────────────────────────────────────────────────────

export async function updatePurchaseOrder(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('purchase_orders.edit')) return err('forbidden', 'Missing purchase_orders.edit permission.')

  const parsed = updatePurchaseOrderSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: po } = await supabase.from('purchase_orders').select('status,is_igst')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!po)                return err('not_found', 'Purchase order not found.')
  if (po.status !== 'draft') return err('state_transition', 'Only draft POs can be edited.')

  const updatePayload: Record<string, unknown> = { updated_by: r.c.userId }
  if (d.vendorId)         updatePayload.vendor_id        = d.vendorId
  if (d.paymentTerms !== undefined) updatePayload.payment_terms = d.paymentTerms
  if (d.notes !== undefined)        updatePayload.notes         = d.notes
  if (d.internalNotes !== undefined)updatePayload.internal_notes = d.internalNotes
  if (d.terms !== undefined)        updatePayload.terms         = d.terms
  if (d.transport !== undefined)    updatePayload.transport     = d.transport
  if (d.transportNote !== undefined)updatePayload.transport_note = d.transportNote
  if (d.isIgst !== undefined)       updatePayload.is_igst       = d.isIgst
  if (d.expectedDelivery !== undefined) {
    updatePayload.expected_delivery = d.expectedDelivery ? d.expectedDelivery.toISOString().split('T')[0] : null
  }

  await supabase.from('purchase_orders').update(updatePayload).eq('id', id).eq('org_id', r.c.orgId)

  // If GST type changed, recalc all items
  if (d.isIgst !== undefined && Boolean(d.isIgst) !== Boolean(po.is_igst)) {
    const newIsIgst = Boolean(d.isIgst)
    const { data: items } = await supabase.from('po_items').select('id,rate,qty_ordered,discount_pct,gst_pct').eq('po_id', id)
    for (const item of items ?? []) {
      const calc = calcItemGst(Number(item.rate), Number(item.qty_ordered), Number(item.discount_pct), Number(item.gst_pct), newIsIgst)
      await supabase.from('po_items').update({
        cgst_pct: calc.cgstPct, sgst_pct: calc.sgstPct, igst_pct: calc.igstPct,
        cgst_amount: calc.cgstAmount, sgst_amount: calc.sgstAmount, igst_amount: calc.igstAmount,
        taxable_value: calc.taxableValue, total: calc.total,
      }).eq('id', item.id as string)
    }
  }

  await recalcPoTotals(supabase, id, r.c.orgId)
  revalAll(id)
  return ok({ id })
}

// ── updatePoItem ──────────────────────────────────────────────────────────────

export async function updatePoItem(poId: string, itemId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('purchase_orders.edit')) return err('forbidden', 'Missing purchase_orders.edit permission.')

  const parsed = poItemUpdateSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: po } = await supabase.from('purchase_orders').select('status,is_igst')
    .eq('id', poId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!po)                return err('not_found', 'PO not found.')
  if (po.status !== 'draft') return err('state_transition', 'Items can only be edited on draft POs.')

  const calc = calcItemGst(d.rate, d.qtyOrdered, d.discountPct, d.gstPct, Boolean(po.is_igst))

  await supabase.from('po_items').update({
    qty_ordered: d.qtyOrdered, rate: d.rate, discount_pct: d.discountPct, gst_pct: d.gstPct,
    ...(d.hsnCode !== undefined ? { hsn_code: d.hsnCode ?? null } : {}),
    cgst_pct: calc.cgstPct, sgst_pct: calc.sgstPct, igst_pct: calc.igstPct,
    taxable_value: calc.taxableValue,
    cgst_amount: calc.cgstAmount, sgst_amount: calc.sgstAmount, igst_amount: calc.igstAmount,
    total: calc.total,
  }).eq('id', itemId).eq('po_id', poId)

  await recalcPoTotals(supabase, poId, r.c.orgId)
  revalAll(poId)
  return ok(undefined)
}

// ── updatePoStatus ────────────────────────────────────────────────────────────

export async function updatePoStatus(id: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('purchase_orders.edit') && !r.c.has('purchase_orders.approve')) {
    return err('forbidden', 'Missing permission to update PO status.')
  }

  const parsed = poStatusSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid status.', { fieldErrors: fe(parsed.error) })

  const { status: toStatus, note } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: po } = await supabase.from('purchase_orders').select('status')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!po) return err('not_found', 'Purchase order not found.')

  const allowed = VALID_TRANSITIONS[po.status as PoStatusType] ?? []
  if (!allowed.includes(toStatus)) {
    return err('state_transition', `Cannot transition from '${po.status}' to '${toStatus}'.`)
  }

  // Approval requires the approve permission
  if (toStatus === 'approved' && !r.c.has('purchase_orders.approve') && !r.c.has('purchase_orders.edit')) {
    return err('forbidden', 'Missing purchase_orders.approve permission.')
  }

  const updatePayload: Record<string, unknown> = { status: toStatus, updated_by: r.c.userId }
  if (toStatus === 'approved')  { updatePayload.approved_by = r.c.userId; updatePayload.approved_at = new Date().toISOString() }
  if (toStatus === 'sent')      { updatePayload.sent_at = new Date().toISOString() }

  const { error } = await supabase.from('purchase_orders').update(updatePayload).eq('id', id).eq('org_id', r.c.orgId)
  if (error) return err('internal', error.message)

  await insertStatusHistory(supabase, r.c.orgId, id, po.status as string, toStatus, note, r.c.userId)
  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'purchase_orders', entityId: id, action: 'update', after: { status: toStatus } })

  revalAll(id)
  return ok(undefined)
}

// ── createGrn ─────────────────────────────────────────────────────────────────

export async function createGrn(poId: string, input: unknown): Promise<ActionResult<{ id: string; grnNo: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('purchase_orders.receive')) return err('forbidden', 'Missing purchase_orders.receive permission.')

  const parsed = grnSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: po } = await supabase.from('purchase_orders').select('status')
    .eq('id', poId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!po) return err('not_found', 'Purchase order not found.')
  if (!['sent','partially_received'].includes(po.status as string)) {
    return err('state_transition', `Cannot receive goods on a PO with status '${po.status}'.`)
  }

  // Validate qty_received per item ≤ remaining
  for (const item of d.items) {
    const { data: pi } = await supabase.from('po_items')
      .select('qty_ordered,qty_received,item_id').eq('id', item.poItemId).maybeSingle()
    if (!pi) return err('not_found', `PO item ${item.poItemId} not found.`)
    const remaining = Number(pi.qty_ordered) - Number(pi.qty_received)
    if (item.qtyReceived > remaining + 0.001) {
      return err('validation', `Cannot receive more than remaining qty (${remaining}) for this item.`)
    }
  }

  // Generate GRN number
  const year = new Date().getFullYear()
  const { count } = await supabase.from('goods_receipts').select('id', { count: 'exact', head: true })
    .eq('org_id', r.c.orgId).like('grn_no', `GRN-${year}-%`)
  const grnNo = `GRN-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: grn, error: grnErr } = await supabase.from('goods_receipts').insert({
    org_id: r.c.orgId, po_id: poId, grn_no: grnNo,
    date: d.date.toISOString().split('T')[0],
    delivery_note: d.deliveryNote ?? null,
    notes: d.notes ?? null,
    created_by: r.c.userId,
  }).select('id').single()

  if (grnErr || !grn) return err('internal', grnErr?.message ?? 'Failed to create GRN.')

  const grnId = grn.id as string

  // Insert grn_items (DB trigger updates stock + PO status)
  for (const item of d.items) {
    const { data: pi } = await supabase.from('po_items').select('item_id').eq('id', item.poItemId).maybeSingle()
    await supabase.from('grn_items').insert({
      org_id: r.c.orgId, grn_id: grnId, po_item_id: item.poItemId,
      item_id: pi?.item_id ?? null,
      qty_received: item.qtyReceived, batch_no: item.batchNo ?? null,
    })
  }

  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'goods_receipts', entityId: grnId, action: 'insert', after: { grnNo, poId } })

  revalAll(poId)
  return ok({ id: grnId, grnNo })
}

// ── deletePurchaseOrder ───────────────────────────────────────────────────────

export async function deletePurchaseOrder(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('purchase_orders.delete')) return err('forbidden', 'Missing purchase_orders.delete permission.')

  const supabase = await createSupabaseServerClient()

  const { data: po } = await supabase.from('purchase_orders').select('status,po_no')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!po) return err('not_found', 'Purchase order not found.')
  if (!['draft','cancelled'].includes(po.status as string)) {
    return err('state_transition', `Cannot delete a ${po.status} PO. Cancel it first.`)
  }

  const { error } = await supabase.from('purchase_orders').delete().eq('id', id).eq('org_id', r.c.orgId)
  if (error) return err('internal', error.message)

  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'purchase_orders', entityId: id, action: 'delete', after: { poNo: po.po_no } })

  revalAll()
  return ok(undefined)
}
