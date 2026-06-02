'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  salesOrderSchema,
  updateSalesOrderSchema,
  soStatusUpdateSchema,
  soAdvanceSchema,
  soDeliverySchema,
  soItemDeliverySchema,
  type SoStatusType,
} from '@/validations/sales-order'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  revalidatePath('/orders')
  if (id) revalidatePath(`/orders/${id}`)
}

async function getNextSoNo(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .like('so_no', `SO-${year}-%`)
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `SO-${year}-${seq}`
}

async function insertStatusHistory(
  supabase: SupabaseClient,
  orgId: string,
  soId: string,
  fromStatus: string | null,
  toStatus: string,
  note: string | undefined,
  userId: string,
) {
  await supabase.from('so_status_history').insert({
    org_id:      orgId,
    so_id:       soId,
    from_status: fromStatus,
    to_status:   toStatus,
    note:        note ?? null,
    changed_by:  userId,
  })
}

// ── State Machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<SoStatusType, SoStatusType[]> = {
  confirmed:  ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready:      ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered:  ['invoiced'],
  invoiced:   ['closed'],
  closed:     [],
  cancelled:  [],
}

// ── createSalesOrder ──────────────────────────────────────────────────────────

export async function createSalesOrder(input: unknown): Promise<ActionResult<{ id: string; soNo: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('sales_orders.create')) return err('forbidden', 'Missing sales_orders.create permission.')

  const parsed = salesOrderSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  // Guard: quote must be accepted and have no existing SO
  const { data: quote } = await supabase
    .from('quotes')
    .select('id,status,quote_no,customer_id,subject,gst_mode,gst_pct,transport,transport_note,material_subtotal,gst_amount,grand_total,terms,logo_url')
    .eq('id', d.quoteId)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!quote)                      return err('not_found', 'Quote not found.')
  if (quote.status !== 'accepted') return err('state_transition', `Cannot create SO: quote status is '${quote.status}'. Must be 'accepted'.`)

  // Check for existing SO on this quote
  const { count: soCount } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', d.quoteId)
    .is('deleted_at', null)

  if ((soCount ?? 0) > 0) return err('conflict', 'A Sales Order already exists for this quote.')

  const soNo = await getNextSoNo(supabase, r.c.orgId)

  // Create SO header (snapshot financials from quote)
  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      org_id:           r.c.orgId,
      so_no:            soNo,
      quote_id:         d.quoteId,
      customer_id:      quote.customer_id ?? null,
      subject:          quote.subject ?? null,
      date:             new Date().toISOString().split('T')[0],
      expected_delivery: d.expectedDelivery ? d.expectedDelivery.toISOString().split('T')[0] : null,
      status:           'confirmed',
      priority:         d.priority ?? 'normal',
      gst_mode:         quote.gst_mode,
      gst_pct:          quote.gst_pct,
      transport:        quote.transport,
      transport_note:   quote.transport_note ?? null,
      material_subtotal: quote.material_subtotal,
      gst_amount:       quote.gst_amount,
      grand_total:      quote.grand_total,
      delivery_address: d.deliveryAddress ?? null,
      site_contact_name:  d.siteContactName ?? null,
      site_contact_phone: d.siteContactPhone ?? null,
      notes:            d.notes ?? null,
      internal_notes:   d.internalNotes ?? null,
      terms:            quote.terms ?? [],
      logo_url:         quote.logo_url ?? null,
      created_by:       r.c.userId,
      updated_by:       r.c.userId,
    })
    .select('id')
    .single()

  if (soErr || !so) return err('internal', soErr?.message ?? 'Failed to create sales order.')

  const soId = so.id as string

  // Copy quote_locations → so_locations (with traceability)
  const { data: qLocs } = await supabase
    .from('quote_locations')
    .select('id,name,sort_order,is_included,material_subtotal,installation_charge,installation_note,location_total')
    .eq('quote_id', d.quoteId)
    .order('sort_order', { ascending: true })

  for (const loc of qLocs ?? []) {
    const { data: soLoc } = await supabase
      .from('so_locations')
      .insert({
        org_id:             r.c.orgId,
        so_id:              soId,
        quote_location_id:  loc.id,
        name:               loc.name,
        sort_order:         loc.sort_order,
        is_included:        loc.is_included,
        material_subtotal:  Number(loc.material_subtotal) || 0,
        installation_charge: Number(loc.installation_charge) || 0,
        installation_note:  loc.installation_note ?? null,
        location_total:     Number(loc.location_total) || 0,
      })
      .select('id')
      .single()

    if (!soLoc) continue

    // Copy quote_items → so_items for this location
    const { data: qItems } = await supabase
      .from('quote_items')
      .select('id,item_id,name,description,brand,unit,rate,qty,discount_pct,taxable_value,total,sort_order')
      .eq('location_id', loc.id)
      .order('sort_order', { ascending: true })

    if (qItems && qItems.length > 0) {
      await supabase.from('so_items').insert(
        qItems.map((item: Record<string, unknown>) => ({
          org_id:        r.c.orgId,
          so_id:         soId,
          location_id:   soLoc.id,
          quote_item_id: item.id,
          item_id:       item.item_id ?? null,
          name:          item.name,
          description:   item.description ?? null,
          brand:         item.brand ?? null,
          unit:          item.unit ?? null,
          rate:          Number(item.rate) || 0,
          qty:           Number(item.qty) || 1,
          qty_delivered: 0,
          discount_pct:  Number(item.discount_pct) || 0,
          taxable_value: Number(item.taxable_value) || 0,
          total:         Number(item.total) || 0,
          sort_order:    item.sort_order,
        })),
      )
    }
  }

  // Record initial status history entry
  await insertStatusHistory(supabase, r.c.orgId, soId, null, 'confirmed', 'Sales Order created from quote.', r.c.userId)

  await recordAuditEvent({
    orgId:      r.c.orgId,
    actorId:    r.c.userId,
    entityType: 'sales_orders',
    entityId:   soId,
    action:     'insert',
    after:      { soNo, quoteId: d.quoteId, status: 'confirmed' },
  })

  revalAll()
  revalidatePath(`/quotes/${d.quoteId}`)
  return ok({ id: soId, soNo })
}

// ── updateSalesOrder ──────────────────────────────────────────────────────────

export async function updateSalesOrder(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('sales_orders.edit')) return err('forbidden', 'Missing sales_orders.edit permission.')

  const parsed = updateSalesOrderSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const updatePayload: Record<string, unknown> = {
    priority:         d.priority,
    delivery_address: d.deliveryAddress ?? null,
    site_contact_name:  d.siteContactName ?? null,
    site_contact_phone: d.siteContactPhone ?? null,
    notes:            d.notes ?? null,
    internal_notes:   d.internalNotes ?? null,
    updated_by:       r.c.userId,
  }

  if (d.expectedDelivery !== undefined) {
    updatePayload.expected_delivery = d.expectedDelivery
      ? d.expectedDelivery.toISOString().split('T')[0]
      : null
  }
  if (d.terms !== undefined) {
    updatePayload.terms = d.terms
  }

  const { error } = await supabase
    .from('sales_orders')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId:      r.c.orgId,
    actorId:    r.c.userId,
    entityType: 'sales_orders',
    entityId:   id,
    action:     'update',
    after:      { priority: d.priority },
  })

  revalAll(id)
  return ok({ id })
}

// ── updateSoStatus ────────────────────────────────────────────────────────────

export async function updateSoStatus(id: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('sales_orders.edit')) return err('forbidden', 'Missing sales_orders.edit permission.')

  const parsed = soStatusUpdateSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid status update.', { fieldErrors: fe(parsed.error) })

  const { status: toStatus, note } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: so } = await supabase
    .from('sales_orders')
    .select('status')
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!so) return err('not_found', 'Sales order not found.')

  const currentStatus = so.status as SoStatusType
  const allowed       = VALID_TRANSITIONS[currentStatus] ?? []

  if (!allowed.includes(toStatus)) {
    return err('state_transition', `Cannot transition from '${currentStatus}' to '${toStatus}'.`)
  }

  const { error } = await supabase
    .from('sales_orders')
    .update({ status: toStatus, updated_by: r.c.userId })
    .eq('id', id)
    .eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)

  await insertStatusHistory(supabase, r.c.orgId, id, currentStatus, toStatus, note, r.c.userId)

  await recordAuditEvent({
    orgId:      r.c.orgId,
    actorId:    r.c.userId,
    entityType: 'sales_orders',
    entityId:   id,
    action:     'update',
    after:      { status: toStatus },
  })

  revalAll(id)
  return ok(undefined)
}

// ── recordAdvancePayment ──────────────────────────────────────────────────────

export async function recordAdvancePayment(id: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('sales_orders.edit')) return err('forbidden', 'Missing sales_orders.edit permission.')

  const parsed = soAdvanceSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('sales_orders')
    .update({
      advance_amount:   d.advanceAmount,
      advance_received: d.advanceReceived,
      advance_date:     d.advanceDate ? d.advanceDate.toISOString().split('T')[0] : null,
      advance_note:     d.advanceNote ?? null,
      updated_by:       r.c.userId,
    })
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId:      r.c.orgId,
    actorId:    r.c.userId,
    entityType: 'sales_orders',
    entityId:   id,
    action:     'update',
    after:      { advanceAmount: d.advanceAmount, advanceReceived: d.advanceReceived },
  })

  revalAll(id)
  return ok(undefined)
}

// ── updateDeliveryDetails ─────────────────────────────────────────────────────

export async function updateDeliveryDetails(id: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('sales_orders.edit')) return err('forbidden', 'Missing sales_orders.edit permission.')

  const parsed = soDeliverySchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('sales_orders')
    .update({
      delivery_address:   d.deliveryAddress ?? null,
      site_contact_name:  d.siteContactName ?? null,
      site_contact_phone: d.siteContactPhone ?? null,
      expected_delivery:  d.expectedDelivery ? d.expectedDelivery.toISOString().split('T')[0] : null,
      updated_by:         r.c.userId,
    })
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)

  if (error) return err('internal', error.message)

  revalAll(id)
  return ok(undefined)
}

// ── updateItemQtyDelivered ────────────────────────────────────────────────────

export async function updateItemQtyDelivered(soId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('sales_orders.edit')) return err('forbidden', 'Missing sales_orders.edit permission.')

  const parsed = soItemDeliverySchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const supabase = await createSupabaseServerClient()

  for (const item of parsed.data.items) {
    const { error } = await supabase
      .from('so_items')
      .update({ qty_delivered: item.qtyDelivered })
      .eq('id', item.id)
      .eq('so_id', soId)

    if (error) return err('internal', `Failed to update item ${item.id}: ${error.message}`)
  }

  revalAll(soId)
  return ok(undefined)
}

// ── deleteSalesOrder (soft) ───────────────────────────────────────────────────

export async function deleteSalesOrder(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('sales_orders.delete')) return err('forbidden', 'Missing sales_orders.delete permission.')

  const supabase = await createSupabaseServerClient()

  const { data: so } = await supabase
    .from('sales_orders')
    .select('status,so_no')
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!so) return err('not_found', 'Sales order not found.')

  if (!['confirmed', 'cancelled'].includes(so.status)) {
    return err('state_transition', `Cannot delete a sales order with status '${so.status}'. Cancel it first.`)
  }

  const { error } = await supabase
    .from('sales_orders')
    .delete()
    .eq('id', id)
    .eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId:      r.c.orgId,
    actorId:    r.c.userId,
    entityType: 'sales_orders',
    entityId:   id,
    action:     'delete',
    after:      { soNo: so.so_no },
  })

  revalAll()
  return ok(undefined)
}
