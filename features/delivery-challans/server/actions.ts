'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  deliveryChallanSchema, updateDcSchema, dcItemUpdateSchema, dcStatusSchema,
  type DcStatusType,
} from '@/validations/delivery-challan'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getNextDcNo } from './queries'

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
  revalidatePath('/delivery-challans')
  if (id) revalidatePath(`/delivery-challans/${id}`)
}

async function insertStatusHistory(
  supabase: SupabaseClient, orgId: string, dcId: string,
  fromStatus: string | null, toStatus: string, note: string | undefined, userId: string,
) {
  await supabase.from('dc_status_history').insert({
    org_id: orgId, dc_id: dcId, from_status: fromStatus,
    to_status: toStatus, note: note ?? null, changed_by: userId,
  })
}

// ── State Machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<DcStatusType, DcStatusType[]> = {
  draft:      ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'cancelled'],
  delivered:  [],
  cancelled:  [],
}

// ── createDeliveryChallan ─────────────────────────────────────────────────────

export async function createDeliveryChallan(
  input: unknown,
): Promise<ActionResult<{ id: string; dcNo: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('challans.create')) return err('forbidden', 'Missing challans.create permission.')

  const parsed = deliveryChallanSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  // Guard: invoice must be issued
  const { data: inv } = await supabase
    .from('invoices')
    .select('id,status,invoice_no,customer_id,so_id,subject')
    .eq('id', d.invoiceId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')
  if (inv.status !== 'issued') return err('state_transition', `Invoice must be issued. Current status: ${inv.status}.`)

  // Re-validate stock for each included item (race condition guard)
  const itemIds = d.items.map(i => i.invoiceItemId)
  const { data: invItems } = await supabase
    .from('invoice_items')
    .select('id,item_id,name,description,hsn_code,brand,unit,qty')
    .eq('invoice_id', d.invoiceId)
    .in('id', itemIds)

  if (!invItems || invItems.length === 0) return err('validation', 'No invoice items found.')

  // Build map: invoiceItemId → invoice item
  const invItemMap: Record<string, typeof invItems[0]> = {}
  for (const ii of invItems) invItemMap[ii.id as string] = ii

  // Fetch live stock
  const matchedItemIds = invItems.filter(i => i.item_id).map(i => i.item_id as string)
  const stockMap: Record<string, number> = {}
  if (matchedItemIds.length > 0) {
    const { data: sd } = await supabase.from('items').select('id,stock').in('id', matchedItemIds)
    for (const s of sd ?? []) stockMap[s.id as string] = Number(s.stock) || 0
  }

  // Validate each item has sufficient stock
  for (const item of d.items) {
    if (item.qtyDispatched <= 0) continue  // skip zero-qty items
    const invItem = invItemMap[item.invoiceItemId]
    if (!invItem) return err('validation', `Invoice item ${item.invoiceItemId} not found.`)
    if (!invItem.item_id) continue  // free-text item, no stock check
    const stock = stockMap[invItem.item_id as string] ?? 0
    if (item.qtyDispatched > stock) {
      return err('validation', `Insufficient stock for "${invItem.name}". Available: ${stock}, Requested: ${item.qtyDispatched}.`)
    }
  }

  const dcNo = await getNextDcNo(supabase, r.c.orgId)

  // Get SO id from invoice for delivery address prefill
  const soId = inv.so_id as string | null

  // Create DC header
  const { data: dc, error: dcErr } = await supabase.from('delivery_challans').insert({
    org_id:           r.c.orgId,
    dc_no:            dcNo,
    invoice_id:       d.invoiceId,
    customer_id:      inv.customer_id ?? null,
    so_id:            soId,
    subject:          inv.subject ?? null,
    date:             d.date ? d.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    dispatch_date:    d.dispatchDate ? d.dispatchDate.toISOString().split('T')[0] : null,
    expected_delivery:d.expectedDelivery ? d.expectedDelivery.toISOString().split('T')[0] : null,
    status:           'draft',
    vehicle_no:       d.vehicleNo ?? null,
    driver_name:      d.driverName ?? null,
    lr_no:            d.lrNo ?? null,
    transporter_name: d.transporterName ?? null,
    delivery_address: d.deliveryAddress ?? null,
    site_contact_name: d.siteContactName ?? null,
    site_contact_phone:d.siteContactPhone ?? null,
    notes:            d.notes ?? null,
    internal_notes:   d.internalNotes ?? null,
    stock_deducted:   false,
    created_by:       r.c.userId,
    updated_by:       r.c.userId,
  }).select('id').single()

  if (dcErr || !dc) return err('internal', dcErr?.message ?? 'Failed to create delivery challan.')

  const dcId = dc.id as string

  // Insert dc_items (only items with qty_dispatched > 0)
  const dcItemRows = d.items
    .filter(i => i.qtyDispatched > 0)
    .map((i, idx) => {
      const invItem = invItemMap[i.invoiceItemId]!
      const stock   = invItem.item_id ? (stockMap[invItem.item_id as string] ?? 0) : 0
      return {
        org_id:           r.c.orgId,
        dc_id:            dcId,
        invoice_item_id:  i.invoiceItemId,
        item_id:          invItem.item_id ?? null,
        name:             invItem.name,
        description:      invItem.description ?? null,
        hsn_code:         invItem.hsn_code ?? null,
        brand:            invItem.brand ?? null,
        unit:             invItem.unit ?? null,
        invoice_qty:      Number(invItem.qty) || 0,
        qty_dispatched:   i.qtyDispatched,
        stock_at_creation:stock,
        sort_order:       idx,
      }
    })

  if (dcItemRows.length > 0) {
    const { error: itemsErr } = await supabase.from('dc_items').insert(dcItemRows)
    if (itemsErr) return err('internal', `Failed to create DC items: ${itemsErr.message}`)
  }

  await insertStatusHistory(supabase, r.c.orgId, dcId, null, 'draft', 'Delivery Challan created.', r.c.userId)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'delivery_challans',
    entityId: dcId, action: 'insert', after: { dcNo, invoiceId: d.invoiceId },
  })

  revalAll()
  revalidatePath(`/invoices/${d.invoiceId}`)
  return ok({ id: dcId, dcNo })
}

// ── updateDeliveryChallan ─────────────────────────────────────────────────────

export async function updateDeliveryChallan(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('challans.edit')) return err('forbidden', 'Missing challans.edit permission.')

  const parsed = updateDcSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: dc } = await supabase.from('delivery_challans').select('status')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!dc)                return err('not_found', 'Delivery challan not found.')
  if (dc.status !== 'draft') return err('state_transition', 'Only draft challans can be edited.')

  const payload: Record<string, unknown> = { updated_by: r.c.userId }
  const optFields = ['vehicleNo','driverName','lrNo','transporterName','deliveryAddress','siteContactName','siteContactPhone','notes','internalNotes'] as const
  for (const f of optFields) {
    if (d[f] !== undefined) {
      const dbKey = f.replace(/([A-Z])/g, '_$1').toLowerCase()
      payload[dbKey] = d[f] ?? null
    }
  }
  if (d.dispatchDate !== undefined)     payload.dispatch_date     = d.dispatchDate ? d.dispatchDate.toISOString().split('T')[0] : null
  if (d.expectedDelivery !== undefined) payload.expected_delivery = d.expectedDelivery ? d.expectedDelivery.toISOString().split('T')[0] : null

  const { error } = await supabase.from('delivery_challans').update(payload).eq('id', id).eq('org_id', r.c.orgId)
  if (error) return err('internal', error.message)

  revalAll(id)
  return ok({ id })
}

// ── updateDcItemQty ───────────────────────────────────────────────────────────

export async function updateDcItemQty(dcId: string, itemId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('challans.edit')) return err('forbidden', 'Missing challans.edit permission.')

  const parsed = dcItemUpdateSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid quantity.', { fieldErrors: fe(parsed.error) })

  const supabase = await createSupabaseServerClient()

  const { data: dc } = await supabase.from('delivery_challans').select('status')
    .eq('id', dcId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!dc)                return err('not_found', 'Delivery challan not found.')
  if (dc.status !== 'draft') return err('state_transition', 'Items can only be edited on draft challans.')

  // Validate against invoice qty and current stock
  const { data: dcItem } = await supabase.from('dc_items')
    .select('invoice_qty,item_id').eq('id', itemId).eq('dc_id', dcId).maybeSingle()

  if (!dcItem) return err('not_found', 'DC item not found.')
  if (parsed.data.qtyDispatched > Number(dcItem.invoice_qty)) {
    return err('validation', `Cannot dispatch more than invoice qty (${dcItem.invoice_qty}).`)
  }

  if (dcItem.item_id) {
    const { data: stockData } = await supabase.from('items').select('stock').eq('id', dcItem.item_id as string).maybeSingle()
    const stock = Number(stockData?.stock) || 0
    if (parsed.data.qtyDispatched > stock) {
      return err('validation', `Insufficient stock. Available: ${stock}.`)
    }
  }

  const { error } = await supabase.from('dc_items')
    .update({ qty_dispatched: parsed.data.qtyDispatched })
    .eq('id', itemId).eq('dc_id', dcId)

  if (error) return err('internal', error.message)
  revalAll(dcId)
  return ok(undefined)
}

// ── dispatchChallan ───────────────────────────────────────────────────────────

export async function dispatchChallan(id: string, note?: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('challans.post')) return err('forbidden', 'Missing challans.post permission.')

  const supabase = await createSupabaseServerClient()

  const { data: dc } = await supabase.from('delivery_challans')
    .select('status,stock_deducted,invoice_id')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!dc) return err('not_found', 'Delivery challan not found.')
  if (dc.status !== 'draft') return err('state_transition', `Cannot dispatch a ${dc.status} challan.`)
  if (dc.stock_deducted) return err('state_transition', 'Stock already deducted for this challan.')

  // Fetch all dc_items
  const { data: dcItems } = await supabase
    .from('dc_items')
    .select('id,item_id,name,qty_dispatched')
    .eq('dc_id', id)

  if (!dcItems || dcItems.length === 0) return err('validation', 'No items in this challan.')

  // Pre-validate stock for ALL items with item_id
  const itemsWithStock = dcItems.filter(i => i.item_id && Number(i.qty_dispatched) > 0)
  if (itemsWithStock.length > 0) {
    const itemIds = itemsWithStock.map(i => i.item_id as string)
    const { data: stockData } = await supabase.from('items').select('id,stock,name').in('id', itemIds)
    const stockMap: Record<string, number> = {}
    for (const s of stockData ?? []) stockMap[s.id as string] = Number(s.stock) || 0

    for (const item of itemsWithStock) {
      const available = stockMap[item.item_id as string] ?? 0
      const needed    = Number(item.qty_dispatched) || 0
      if (needed > available) {
        return err('validation', `Insufficient stock for "${item.name}". Available: ${available}, Needed: ${needed}. Please update the delivery challan or restock first.`)
      }
    }
  }

  // All validations passed — deduct stock atomically
  const today = new Date().toISOString().split('T')[0]

  const { error: updateErr } = await supabase.from('delivery_challans').update({
    status:           'dispatched',
    stock_deducted:   true,
    stock_deducted_at:new Date().toISOString(),
    dispatch_date:    today,
    updated_by:       r.c.userId,
  }).eq('id', id).eq('org_id', r.c.orgId)

  if (updateErr) return err('internal', updateErr.message)

  // Deduct stock for each item atomically
  for (const item of itemsWithStock) {
    const qty = Number(item.qty_dispatched)
    const { data: cur } = await supabase
      .from('items').select('stock').eq('id', item.item_id as string).single()
    const newStock = Math.max(0, (Number(cur?.stock) || 0) - qty)
    await supabase.from('items').update({ stock: newStock }).eq('id', item.item_id as string)
  }

  await insertStatusHistory(supabase, r.c.orgId, id, 'draft', 'dispatched', note, r.c.userId)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'delivery_challans',
    entityId: id, action: 'update', after: { status: 'dispatched', stockDeducted: true },
  })

  revalAll(id)
  revalidatePath(`/invoices/${dc.invoice_id as string}`)
  return ok(undefined)
}

// ── updateDcStatus (delivered / cancel) ──────────────────────────────────────

export async function updateDcStatus(id: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('challans.edit') && !r.c.has('challans.post')) {
    return err('forbidden', 'Missing challans.edit permission.')
  }

  const parsed = dcStatusSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid status.', { fieldErrors: fe(parsed.error) })

  const { status: toStatus, note } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: dc } = await supabase.from('delivery_challans')
    .select('status,stock_deducted,invoice_id')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!dc) return err('not_found', 'Delivery challan not found.')

  const allowed = VALID_TRANSITIONS[dc.status as DcStatusType] ?? []
  if (!allowed.includes(toStatus)) {
    return err('state_transition', `Cannot transition from '${dc.status}' to '${toStatus}'.`)
  }

  // On cancellation: if stock was deducted, restore it
  if (toStatus === 'cancelled' && dc.stock_deducted) {
    const { data: dcItems } = await supabase.from('dc_items')
      .select('item_id,qty_dispatched').eq('dc_id', id)

    for (const item of (dcItems ?? []).filter(i => i.item_id && Number(i.qty_dispatched) > 0)) {
      const { data: cur } = await supabase.from('items').select('stock').eq('id', item.item_id as string).single()
      const restored = (Number(cur?.stock) || 0) + Number(item.qty_dispatched)
      await supabase.from('items').update({ stock: restored }).eq('id', item.item_id as string)
    }
  }

  const { error } = await supabase.from('delivery_challans').update({
    status: toStatus,
    ...(toStatus === 'cancelled' ? { stock_deducted: false } : {}),
    updated_by: r.c.userId,
  }).eq('id', id).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)

  await insertStatusHistory(supabase, r.c.orgId, id, dc.status as string, toStatus, note, r.c.userId)
  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'delivery_challans', entityId: id, action: 'update', after: { status: toStatus } })

  revalAll(id)
  return ok(undefined)
}

// ── deleteDeliveryChallan ─────────────────────────────────────────────────────

export async function deleteDeliveryChallan(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('challans.delete')) return err('forbidden', 'Missing challans.delete permission.')

  const supabase = await createSupabaseServerClient()

  const { data: dc } = await supabase.from('delivery_challans').select('status,dc_no')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!dc) return err('not_found', 'Delivery challan not found.')
  if (dc.status !== 'draft') return err('state_transition', `Cannot delete a ${dc.status} challan.`)

  const { error } = await supabase.from('delivery_challans').delete().eq('id', id).eq('org_id', r.c.orgId)
  if (error) return err('internal', error.message)

  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'delivery_challans', entityId: id, action: 'delete', after: { dcNo: dc.dc_no } })

  revalAll()
  return ok(undefined)
}
