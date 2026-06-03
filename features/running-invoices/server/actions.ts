'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  createRiSchema, updateRiSchema, riStatusSchema,
  addDcToRiSchema, removeDcFromRiSchema,
  type RiStatusType,
} from '@/validations/running-invoice'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getNextRiNo, validateRiForPosting } from './queries'

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
  revalidatePath('/running-invoices')
  if (id) revalidatePath(`/running-invoices/${id}`)
}

// ── GST calculation ───────────────────────────────────────────────────────────

function calcItemGst(unitPrice: number, qty: number, discPct: number, gstPct: number, isIgst: boolean) {
  const taxable = +(unitPrice * qty * (1 - discPct / 100)).toFixed(2)
  const half    = gstPct / 2
  const cgst    = isIgst ? 0 : +(taxable * half / 100).toFixed(2)
  const sgst    = isIgst ? 0 : +(taxable * half / 100).toFixed(2)
  const igst    = isIgst ? +(taxable * gstPct / 100).toFixed(2) : 0
  return {
    taxableValue: taxable, cgstPct: isIgst ? 0 : half, sgstPct: isIgst ? 0 : half,
    igstPct: isIgst ? gstPct : 0, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
    total: +(taxable + cgst + sgst + igst).toFixed(2),
  }
}

async function recalcRiTotals(supabase: SupabaseClient, riId: string, orgId: string) {
  const { data: ri }    = await supabase.from('running_invoices').select('is_igst,gst_pct').eq('id', riId).maybeSingle()
  const { data: items } = await supabase.from('ri_items').select('taxable_value,cgst_amount,sgst_amount,igst_amount').eq('ri_id', riId)
  const taxable  = (items ?? []).reduce((s, i) => s + Number(i.taxable_value), 0)
  const cgst     = (items ?? []).reduce((s, i) => s + Number(i.cgst_amount), 0)
  const sgst     = (items ?? []).reduce((s, i) => s + Number(i.sgst_amount), 0)
  const igst     = (items ?? []).reduce((s, i) => s + Number(i.igst_amount), 0)
  const totalGst = cgst + sgst + igst
  const grand    = +(taxable + totalGst).toFixed(2)
  await supabase.from('running_invoices').update({
    taxable_value: +taxable.toFixed(2), cgst_amount: +cgst.toFixed(2),
    sgst_amount: +sgst.toFixed(2), igst_amount: +igst.toFixed(2),
    total_gst: +totalGst.toFixed(2), grand_total: grand, balance_due: grand,
  }).eq('id', riId).eq('org_id', orgId)
}

async function insertStatusHistory(
  supabase: SupabaseClient, orgId: string, riId: string,
  from: string | null, to: string, note: string | undefined, userId: string,
) {
  await supabase.from('ri_status_history').insert({
    org_id: orgId, ri_id: riId, from_status: from, to_status: to, note: note ?? null, changed_by: userId,
  })
}

// ── assembleDcItems ───────────────────────────────────────────────────────────
// Core two-source logic: qty from DC, price from SO, anti-double-billing guard

async function assembleDcItems(
  supabase: SupabaseClient, orgId: string, riId: string, dcId: string, isIgst: boolean, gstPct: number,
): Promise<number> {
  // dc_items for this challan
  const { data: dcItems } = await supabase
    .from('dc_items')
    .select('id,so_item_id,item_id,name,description,hsn_code,brand,unit,qty_dispatched,sort_order')
    .eq('dc_id', dcId).order('sort_order', { ascending: true })

  if (!dcItems || dcItems.length === 0) return 0

  // Fetch SO item prices for matched items
  const soItemIds = [...new Set(dcItems.filter(i => i.so_item_id).map(i => i.so_item_id as string))]
  const soItemMap: Record<string, { rate: number; discountPct: number; gstPct: number; qtyInvoiced: number }> = {}
  if (soItemIds.length > 0) {
    const { data: soItems } = await supabase
      .from('so_items').select('id,rate,discount_pct,qty_invoiced')
      .in('id', soItemIds)
    for (const si of soItems ?? []) {
      soItemMap[si.id as string] = {
        rate:         Number(si.rate) || 0,
        discountPct:  Number(si.discount_pct) || 0,
        gstPct:       gstPct,  // use header GST pct
        qtyInvoiced:  Number(si.qty_invoiced) || 0,
      }
    }
  }

  // Also fetch item.hsn_code for items without SO match
  const itemIds = [...new Set(dcItems.filter(i => i.item_id && !i.so_item_id).map(i => i.item_id as string))]
  const itemMap: Record<string, { hsnCode: string | null; gstRate: number }> = {}
  if (itemIds.length > 0) {
    const { data: items } = await supabase.from('items').select('id,hsn_code,gst_rate').in('id', itemIds)
    for (const it of items ?? []) itemMap[it.id as string] = { hsnCode: it.hsn_code as string | null, gstRate: Number(it.gst_rate) || gstPct }
  }

  let inserted = 0
  for (let idx = 0; idx < dcItems.length; idx++) {
    const item       = dcItems[idx]!
    const soInfo     = item.so_item_id ? soItemMap[item.so_item_id as string] : undefined
    const qtyDel     = Number(item.qty_dispatched) || 0
    const qtyInv     = soInfo?.qtyInvoiced ?? 0
    const qtyToBill  = Math.max(0, qtyDel - qtyInv)

    // Skip if nothing to bill
    if (qtyToBill === 0 && soInfo) continue

    const unitPrice  = soInfo?.rate ?? 0
    const discPct    = soInfo?.discountPct ?? 0
    const itemGstPct = soInfo?.gstPct ?? gstPct
    const calc       = calcItemGst(unitPrice, qtyToBill, discPct, itemGstPct, isIgst)
    const hsnCode    = (item.hsn_code as string | null) ?? (item.item_id ? itemMap[item.item_id as string]?.hsnCode : null) ?? null

    await supabase.from('ri_items').insert({
      org_id:            orgId,
      ri_id:             riId,
      dc_id:             dcId,
      dc_item_id:        item.id,
      so_item_id:        item.so_item_id ?? null,
      item_id:           item.item_id ?? null,
      name:              item.name,
      description:       item.description ?? null,
      hsn_code:          hsnCode,
      brand:             item.brand ?? null,
      unit:              item.unit ?? null,
      qty_delivered:     qtyDel,
      qty_already_billed:qtyInv,
      qty_to_bill:       qtyToBill,
      unit_price:        unitPrice,
      discount_pct:      discPct,
      gst_pct:           itemGstPct,
      cgst_pct:          calc.cgstPct,
      sgst_pct:          calc.sgstPct,
      igst_pct:          calc.igstPct,
      taxable_value:     calc.taxableValue,
      cgst_amount:       calc.cgstAmount,
      sgst_amount:       calc.sgstAmount,
      igst_amount:       calc.igstAmount,
      total:             calc.total,
      sort_order:        idx,
    })
    inserted++
  }
  return inserted
}

// ── State Machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<RiStatusType, RiStatusType[]> = {
  draft:     ['validated', 'cancelled'],
  validated: ['posted', 'draft', 'cancelled'],
  posted:    ['sent', 'cancelled'],
  sent:      ['cancelled'],
  cancelled: [],
}

// ── createRunningInvoice ──────────────────────────────────────────────────────

export async function createRunningInvoice(
  input: unknown,
): Promise<ActionResult<{ id: string; riNo: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.create')) return err('forbidden', 'Missing running_bill.create permission.')

  const parsed = createRiSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  // Guard: SO must be active
  const { data: so } = await supabase
    .from('sales_orders')
    .select('id,status,so_no,customer_id,subject,gst_pct')
    .eq('id', d.soId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!so) return err('not_found', 'Sales order not found.')
  if (!['dispatched','delivered','invoiced'].includes(so.status as string)) {
    return err('state_transition', `Cannot invoice a ${so.status} sales order.`)
  }

  // Guard: all DCs must be delivered and not already invoiced in a posted RI
  for (const dcId of d.dcIds) {
    const { data: dc } = await supabase
      .from('delivery_challans')
      .select('id,status,invoiced_at,so_id')
      .eq('id', dcId).eq('org_id', r.c.orgId).maybeSingle()

    if (!dc) return err('not_found', `Delivery challan ${dcId} not found.`)
    if (dc.status !== 'delivered') return err('state_transition', `DC must be delivered. Current: ${dc.status}`)
    if (dc.so_id !== d.soId) return err('validation', 'All challans must be from the same sales order.')
    if (dc.invoiced_at) return err('conflict', `DC is already invoiced.`)
  }

  // Fetch customer billing details snapshot
  const { data: cust } = await supabase
    .from('customers').select('name,billing_address,gstin,payment_terms')
    .eq('id', so.customer_id as string ?? '').maybeSingle()

  const gstPct  = Number(so.gst_pct) || 18
  const isIgst  = d.isIgst ?? false
  const riNo    = await getNextRiNo(supabase, r.c.orgId)
  const today   = new Date().toISOString().split('T')[0]!

  // Compute due date from payment terms
  const paymentTerms = d.paymentTerms ?? (cust?.payment_terms as string | null) ?? 'net_30'
  const termDays = parseInt(paymentTerms.replace('net_', '')) || 30
  const dueDate  = d.dueDate
    ? d.dueDate.toISOString().split('T')[0]
    : new Date(Date.now() + termDays * 86400000).toISOString().split('T')[0]

  const { data: ri, error: riErr } = await supabase.from('running_invoices').insert({
    org_id:          r.c.orgId,
    ri_no:           riNo,
    so_id:           d.soId,
    customer_id:     so.customer_id ?? null,
    subject:         (so.subject as string | null) ?? null,
    date:            d.date ? d.date.toISOString().split('T')[0]! : today,
    due_date:        dueDate,
    status:          'draft',
    billing_name:    (cust?.name as string | null) ?? null,
    billing_address: (cust?.billing_address as string | null) ?? null,
    customer_gstin:  (cust?.gstin as string | null) ?? null,
    place_of_supply: d.placeOfSupply ?? null,
    is_igst:         isIgst,
    gst_pct:         gstPct,
    payment_terms:   paymentTerms,
    notes:           d.notes ?? null,
    internal_notes:  d.internalNotes ?? null,
    taxable_value: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_gst: 0, grand_total: 0, balance_due: 0,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (riErr || !ri) return err('internal', riErr?.message ?? 'Failed to create running invoice.')

  const riId = ri.id as string

  // Add each DC and assemble items
  for (const dcId of d.dcIds) {
    await supabase.from('ri_challans').insert({ org_id: r.c.orgId, ri_id: riId, dc_id: dcId })
    await assembleDcItems(supabase, r.c.orgId, riId, dcId, isIgst, gstPct)
  }

  await recalcRiTotals(supabase, riId, r.c.orgId)
  await insertStatusHistory(supabase, r.c.orgId, riId, null, 'draft', 'Running invoice created.', r.c.userId)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'running_invoices',
    entityId: riId, action: 'insert', after: { riNo, soId: d.soId },
  })

  revalAll()
  revalidatePath(`/orders/${d.soId}`)
  return ok({ id: riId, riNo })
}

// ── addDcToRi ─────────────────────────────────────────────────────────────────

export async function addDcToRi(input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.edit')) return err('forbidden', 'Missing running_bill.edit permission.')

  const parsed = addDcToRiSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid input.')

  const { riId, dcId } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: ri } = await supabase.from('running_invoices').select('status,is_igst,gst_pct,so_id')
    .eq('id', riId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()
  if (!ri)                     return err('not_found', 'Running invoice not found.')
  if (ri.status !== 'draft')   return err('state_transition', 'Can only add challans to draft invoices.')

  const { data: dc } = await supabase.from('delivery_challans').select('status,so_id,invoiced_at')
    .eq('id', dcId).eq('org_id', r.c.orgId).maybeSingle()
  if (!dc)                     return err('not_found', 'Delivery challan not found.')
  if (dc.status !== 'delivered') return err('state_transition', 'Challan must be delivered.')
  if (dc.so_id !== ri.so_id)   return err('validation', 'Challan must be from the same sales order.')
  if (dc.invoiced_at)          return err('conflict', 'Challan is already invoiced.')

  // Check not already in this RI
  const { count } = await supabase.from('ri_challans').select('id', { count: 'exact', head: true })
    .eq('ri_id', riId).eq('dc_id', dcId)
  if ((count ?? 0) > 0) return err('conflict', 'Challan already added to this invoice.')

  await supabase.from('ri_challans').insert({ org_id: r.c.orgId, ri_id: riId, dc_id: dcId })
  await assembleDcItems(supabase, r.c.orgId, riId, dcId, Boolean(ri.is_igst), Number(ri.gst_pct) || 18)
  await recalcRiTotals(supabase, riId, r.c.orgId)

  revalAll(riId)
  return ok(undefined)
}

// ── removeDcFromRi ────────────────────────────────────────────────────────────

export async function removeDcFromRi(input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.edit')) return err('forbidden', 'Missing running_bill.edit permission.')

  const parsed = removeDcFromRiSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid input.')

  const { riId, dcId } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: ri } = await supabase.from('running_invoices').select('status')
    .eq('id', riId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()
  if (!ri)                   return err('not_found', 'Running invoice not found.')
  if (ri.status !== 'draft') return err('state_transition', 'Can only modify draft invoices.')

  await supabase.from('ri_items').delete().eq('ri_id', riId).eq('dc_id', dcId)
  await supabase.from('ri_challans').delete().eq('ri_id', riId).eq('dc_id', dcId)
  await recalcRiTotals(supabase, riId, r.c.orgId)

  revalAll(riId)
  return ok(undefined)
}

// ── updateRunningInvoice ──────────────────────────────────────────────────────

export async function updateRunningInvoice(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.edit')) return err('forbidden', 'Missing running_bill.edit permission.')

  const parsed = updateRiSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: ri } = await supabase.from('running_invoices').select('status,is_igst,gst_pct')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()
  if (!ri)                   return err('not_found', 'Running invoice not found.')
  if (ri.status !== 'draft') return err('state_transition', 'Only draft invoices can be edited.')

  const payload: Record<string, unknown> = { updated_by: r.c.userId }
  if (d.dueDate !== undefined)     payload.due_date       = d.dueDate ? d.dueDate.toISOString().split('T')[0]! : null
  if (d.placeOfSupply !== undefined)payload.place_of_supply = d.placeOfSupply
  if (d.paymentTerms !== undefined) payload.payment_terms  = d.paymentTerms
  if (d.notes !== undefined)        payload.notes           = d.notes
  if (d.internalNotes !== undefined)payload.internal_notes  = d.internalNotes

  // If isIgst changed, recalculate all item GST splits
  if (d.isIgst !== undefined && Boolean(d.isIgst) !== Boolean(ri.is_igst)) {
    payload.is_igst = d.isIgst
    const newIsIgst = Boolean(d.isIgst)
    const gstPct    = Number(ri.gst_pct) || 18
    const { data: items } = await supabase.from('ri_items')
      .select('id,unit_price,qty_to_bill,discount_pct,gst_pct').eq('ri_id', id)
    for (const item of items ?? []) {
      const calc = calcItemGst(Number(item.unit_price), Number(item.qty_to_bill), Number(item.discount_pct), Number(item.gst_pct) || gstPct, newIsIgst)
      await supabase.from('ri_items').update({
        cgst_pct: calc.cgstPct, sgst_pct: calc.sgstPct, igst_pct: calc.igstPct,
        taxable_value: calc.taxableValue, cgst_amount: calc.cgstAmount,
        sgst_amount: calc.sgstAmount, igst_amount: calc.igstAmount, total: calc.total,
      }).eq('id', item.id as string)
    }
    await recalcRiTotals(supabase, id, r.c.orgId)
  }

  await supabase.from('running_invoices').update(payload).eq('id', id).eq('org_id', r.c.orgId)
  revalAll(id)
  return ok({ id })
}

// ── validateRunningInvoice (action) ───────────────────────────────────────────

export async function validateRunningInvoiceAction(id: string): Promise<ActionResult<{ valid: boolean; failures: string[] }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.edit')) return err('forbidden', 'Missing running_bill.edit permission.')

  const result = await validateRiForPosting(id)
  if (!result.valid) return ok(result)  // return failures to UI without changing status

  const supabase = await createSupabaseServerClient()
  await supabase.from('running_invoices').update({ status: 'validated', updated_by: r.c.userId })
    .eq('id', id).eq('org_id', r.c.orgId)
  await insertStatusHistory(supabase, r.c.orgId, id, 'draft', 'validated', undefined, r.c.userId)

  revalAll(id)
  return ok(result)
}

// ── postRunningInvoice ────────────────────────────────────────────────────────

export async function postRunningInvoice(id: string, note?: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.post')) return err('forbidden', 'Missing running_bill.post permission.')

  const supabase = await createSupabaseServerClient()

  const { data: ri } = await supabase.from('running_invoices')
    .select('status,so_id,grand_total').eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!ri) return err('not_found', 'Running invoice not found.')
  if (!['draft','validated'].includes(ri.status as string)) {
    return err('state_transition', `Cannot post a ${ri.status} invoice.`)
  }

  // Re-run validation
  const validation = await validateRiForPosting(id)
  if (!validation.valid) return err('validation', `Validation failed: ${validation.failures.join('; ')}`)

  // Fetch ri_items and ri_challans for side effects
  const [{ data: riItems }, { data: riChallans }] = await Promise.all([
    supabase.from('ri_items').select('so_item_id,qty_to_bill').eq('ri_id', id).gt('qty_to_bill', 0),
    supabase.from('ri_challans').select('dc_id').eq('ri_id', id),
  ])

  // ── COMMIT SEQUENCE ────────────────────────────────────────────────────────

  // 1. Post the invoice
  const { error: postErr } = await supabase.from('running_invoices').update({
    status:    'posted',
    posted_at: new Date().toISOString(),
    posted_by: r.c.userId,
    updated_by:r.c.userId,
  }).eq('id', id).eq('org_id', r.c.orgId)

  if (postErr) return err('internal', postErr.message)

  // 2. Increment qty_invoiced on so_items
  for (const item of riItems ?? []) {
    if (!item.so_item_id || Number(item.qty_to_bill) <= 0) continue
    const { data: si } = await supabase.from('so_items').select('qty_invoiced').eq('id', item.so_item_id as string).single()
    await supabase.from('so_items').update({
      qty_invoiced: (Number(si?.qty_invoiced) || 0) + Number(item.qty_to_bill),
    }).eq('id', item.so_item_id as string)
  }

  // 3. Mark challans as invoiced
  for (const rc of riChallans ?? []) {
    await supabase.from('delivery_challans').update({
      invoiced_at: new Date().toISOString(),
      running_invoice_id: id,
    }).eq('id', rc.dc_id as string).eq('org_id', r.c.orgId)
  }

  // 4. Check if SO is fully invoiced → update SO status
  const { data: soItems } = await supabase
    .from('so_items').select('qty,qty_invoiced').eq('so_id', ri.so_id as string)
  const allInvoiced = (soItems ?? []).every(si => Number(si.qty_invoiced) >= Number(si.qty))
  if (allInvoiced && (soItems ?? []).length > 0) {
    await supabase.from('sales_orders').update({ status: 'invoiced', updated_by: r.c.userId })
      .eq('id', ri.so_id as string).eq('org_id', r.c.orgId)
  }

  // 5. Status history + audit
  await insertStatusHistory(supabase, r.c.orgId, id, 'validated', 'posted', note, r.c.userId)
  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'running_invoices',
    entityId: id, action: 'update', after: { status: 'posted', grandTotal: ri.grand_total },
  })

  revalAll(id)
  revalidatePath(`/orders/${ri.so_id as string}`)
  return ok(undefined)
}

// ── cancelRunningInvoice ──────────────────────────────────────────────────────

export async function cancelRunningInvoice(id: string, note?: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.edit') && !r.c.has('running_bill.post')) {
    return err('forbidden', 'Missing permission to cancel.')
  }

  const supabase = await createSupabaseServerClient()
  const { data: ri } = await supabase.from('running_invoices')
    .select('status,so_id').eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!ri) return err('not_found', 'Running invoice not found.')

  const wasPosted = ri.status === 'posted' || ri.status === 'sent'

  // If was posted: reverse qty_invoiced
  if (wasPosted) {
    const { data: riItems } = await supabase.from('ri_items').select('so_item_id,qty_to_bill').eq('ri_id', id).gt('qty_to_bill', 0)
    for (const item of riItems ?? []) {
      if (!item.so_item_id) continue
      const { data: si } = await supabase.from('so_items').select('qty_invoiced').eq('id', item.so_item_id as string).single()
      const newQty = Math.max(0, (Number(si?.qty_invoiced) || 0) - Number(item.qty_to_bill))
      await supabase.from('so_items').update({ qty_invoiced: newQty }).eq('id', item.so_item_id as string)
    }
    // Unmark challans
    const { data: riChallans } = await supabase.from('ri_challans').select('dc_id').eq('ri_id', id)
    for (const rc of riChallans ?? []) {
      await supabase.from('delivery_challans').update({ invoiced_at: null, running_invoice_id: null })
        .eq('id', rc.dc_id as string).eq('org_id', r.c.orgId)
    }
    // Revert SO status if needed
    await supabase.from('sales_orders').update({ status: 'delivered', updated_by: r.c.userId })
      .eq('id', ri.so_id as string).eq('org_id', r.c.orgId).eq('status', 'invoiced')
  }

  await supabase.from('running_invoices').update({ status: 'cancelled', updated_by: r.c.userId })
    .eq('id', id).eq('org_id', r.c.orgId)
  await insertStatusHistory(supabase, r.c.orgId, id, ri.status as string, 'cancelled', note, r.c.userId)
  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'running_invoices', entityId: id, action: 'update', after: { status: 'cancelled' } })

  revalAll(id)
  return ok(undefined)
}

// ── deleteRunningInvoice ──────────────────────────────────────────────────────

export async function deleteRunningInvoice(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('running_bill.delete')) return err('forbidden', 'Missing running_bill.delete permission.')

  const supabase = await createSupabaseServerClient()
  const { data: ri } = await supabase.from('running_invoices').select('status,ri_no')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!ri) return err('not_found', 'Running invoice not found.')
  if (!['draft','cancelled'].includes(ri.status as string)) {
    return err('state_transition', `Cannot delete a ${ri.status} invoice.`)
  }

  const { error } = await supabase.from('running_invoices').delete().eq('id', id).eq('org_id', r.c.orgId)
  if (error) return err('internal', error.message)

  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'running_invoices', entityId: id, action: 'delete', after: { riNo: ri.ri_no } })

  revalAll()
  return ok(undefined)
}
