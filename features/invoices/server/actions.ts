'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  invoiceSchema,
  updateInvoiceSchema,
  updateInvoiceItemSchema,
  invoiceStatusSchema,
  invoicePaymentSchema,
  type InvoiceStatusType,
} from '@/validations/invoice'
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
  revalidatePath('/invoices')
  if (id) revalidatePath(`/invoices/${id}`)
}

async function getNextInvoiceNo(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .like('invoice_no', `INV-${year}-%`)
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `INV-${year}-${seq}`
}

async function insertStatusHistory(
  supabase: SupabaseClient,
  orgId: string,
  invoiceId: string,
  fromStatus: string | null,
  toStatus: string,
  note: string | undefined,
  userId: string,
) {
  await supabase.from('invoice_status_history').insert({
    org_id:      orgId,
    invoice_id:  invoiceId,
    from_status: fromStatus,
    to_status:   toStatus,
    note:        note ?? null,
    changed_by:  userId,
  })
}

// ── GST calculation ───────────────────────────────────────────────────────────

function calcItemGst(item: {
  rate: number; qty: number; discountPct: number; gstPct: number; isIgst: boolean
}) {
  const taxable = +(item.rate * item.qty * (1 - item.discountPct / 100)).toFixed(2)
  const halfGst = item.gstPct / 2
  const cgst    = item.isIgst ? 0 : +(taxable * halfGst / 100).toFixed(2)
  const sgst    = item.isIgst ? 0 : +(taxable * halfGst / 100).toFixed(2)
  const igst    = item.isIgst ? +(taxable * item.gstPct / 100).toFixed(2) : 0
  return {
    taxableValue: taxable,
    cgstPct:      item.isIgst ? 0 : halfGst,
    sgstPct:      item.isIgst ? 0 : halfGst,
    igstPct:      item.isIgst ? item.gstPct : 0,
    cgstAmount:   cgst,
    sgstAmount:   sgst,
    igstAmount:   igst,
    total:        +(taxable + cgst + sgst + igst).toFixed(2),
  }
}

async function recalcInvoiceTotals(
  supabase: SupabaseClient,
  invoiceId: string,
  orgId: string,
) {
  const { data: inv } = await supabase
    .from('invoices')
    .select('gst_mode,transport,is_igst')
    .eq('id', invoiceId)
    .maybeSingle()
  if (!inv) return

  const { data: items } = await supabase
    .from('invoice_items')
    .select('taxable_value,cgst_amount,sgst_amount,igst_amount,total')
    .eq('invoice_id', invoiceId)

  const taxable = (items ?? []).reduce((s, i) => s + Number(i.taxable_value), 0)
  const cgst    = (items ?? []).reduce((s, i) => s + Number(i.cgst_amount), 0)
  const sgst    = (items ?? []).reduce((s, i) => s + Number(i.sgst_amount), 0)
  const igst    = (items ?? []).reduce((s, i) => s + Number(i.igst_amount), 0)
  const totalGst = cgst + sgst + igst
  const transport = Number(inv.transport) || 0
  const grand = +(taxable + totalGst + transport).toFixed(2)

  await supabase
    .from('invoices')
    .update({
      taxable_value: +taxable.toFixed(2),
      cgst_amount:   +cgst.toFixed(2),
      sgst_amount:   +sgst.toFixed(2),
      igst_amount:   +igst.toFixed(2),
      total_gst:     +totalGst.toFixed(2),
      grand_total:   grand,
      balance_due:   +(grand - Number(0)).toFixed(2),
    })
    .eq('id', invoiceId)
    .eq('org_id', orgId)
}

// ── State Machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<InvoiceStatusType, InvoiceStatusType[]> = {
  draft:         ['issued', 'cancelled'],
  issued:        ['paid', 'partially_paid', 'cancelled'],
  partially_paid:['paid', 'cancelled'],
  paid:          [],
  cancelled:     [],
}

// ── createInvoice ─────────────────────────────────────────────────────────────

export async function createInvoice(input: unknown): Promise<ActionResult<{ id: string; invoiceNo: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.create')) return err('forbidden', 'Missing invoices.create permission.')

  const parsed = invoiceSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  // Guard: SO must be active and not already invoiced
  const { data: so } = await supabase
    .from('sales_orders')
    .select('id,status,so_no,quote_id,customer_id,subject,gst_mode,gst_pct,transport,transport_note,grand_total,terms,logo_url,bill_to_name,bill_to_address,bill_to_phone,bill_to_email,bill_to_gstin')
    .eq('id', d.soId)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!so) return err('not_found', 'Sales order not found.')

  if (so.status === 'cancelled') {
    return err('state_transition', 'Cannot invoice a cancelled sales order.')
  }

  // Check for existing active invoice
  const { count: invCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('so_id', d.soId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  if ((invCount ?? 0) > 0) return err('conflict', 'An invoice already exists for this sales order.')

  const invoiceNo = await getNextInvoiceNo(supabase, r.c.orgId)
  const isIgst    = d.isIgst ?? false

  // Create invoice header
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      org_id:        r.c.orgId,
      invoice_no:    invoiceNo,
      so_id:         d.soId,
      quote_id:      so.quote_id ?? null,
      customer_id:   so.customer_id ?? null,
      subject:       so.subject ?? null,
      date:          d.date ? d.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      due_date:      d.dueDate ? d.dueDate.toISOString().split('T')[0] : null,
      status:        'draft',
      place_of_supply: d.placeOfSupply ?? null,
      gst_mode:      so.gst_mode,
      gst_pct:       so.gst_pct,
      is_igst:       isIgst,
      transport:     so.transport ?? 0,
      transport_note: so.transport_note ?? null,
      payment_terms: d.paymentTerms ?? null,
      notes:         d.notes ?? null,
      terms:         so.terms ?? [],
      logo_url:      so.logo_url ?? null,
      bill_to_name:    so.bill_to_name ?? null,
      bill_to_address: so.bill_to_address ?? null,
      bill_to_phone:   so.bill_to_phone ?? null,
      bill_to_email:   so.bill_to_email ?? null,
      bill_to_gstin:   so.bill_to_gstin ?? null,
      taxable_value: 0, cgst_amount: 0, sgst_amount: 0,
      igst_amount: 0, total_gst: 0, grand_total: 0,
      amount_paid: 0, balance_due: 0,
      created_by:    r.c.userId,
      updated_by:    r.c.userId,
    })
    .select('id')
    .single()

  if (invErr || !inv) return err('internal', invErr?.message ?? 'Failed to create invoice.')

  const invId = inv.id as string

  // Copy SO items → invoice_items with GST split
  const { data: soItems } = await supabase
    .from('so_items')
    .select('id,item_id,name,description,brand,unit,rate,qty,discount_pct,sort_order')
    .eq('so_id', d.soId)
    .order('sort_order', { ascending: true })

  if (soItems && soItems.length > 0) {
    const gstPct = Number(so.gst_pct) || 18
    const rows = soItems.map((item: Record<string, unknown>, i: number) => {
      const calc = calcItemGst({
        rate:        Number(item.rate) || 0,
        qty:         Number(item.qty) || 1,
        discountPct: Number(item.discount_pct) || 0,
        gstPct,
        isIgst,
      })
      return {
        org_id:       r.c.orgId,
        invoice_id:   invId,
        so_item_id:   item.id,
        item_id:      item.item_id ?? null,
        name:         item.name,
        description:  item.description ?? null,
        hsn_code:     null,
        brand:        item.brand ?? null,
        unit:         item.unit ?? null,
        rate:         Number(item.rate) || 0,
        qty:          Number(item.qty) || 1,
        discount_pct: Number(item.discount_pct) || 0,
        taxable_value: calc.taxableValue,
        gst_pct:      gstPct,
        cgst_pct:     calc.cgstPct,
        sgst_pct:     calc.sgstPct,
        igst_pct:     calc.igstPct,
        cgst_amount:  calc.cgstAmount,
        sgst_amount:  calc.sgstAmount,
        igst_amount:  calc.igstAmount,
        total:        calc.total,
        sort_order:   i,
      }
    })
    await supabase.from('invoice_items').insert(rows)
  }

  // Recalculate invoice totals
  await recalcInvoiceTotals(supabase, invId, r.c.orgId)

  // Note: SO status is decoupled from billing. Invoicing no longer mutates the
  // SO status; the SO ↔ invoice link itself records that an invoice exists.

  // Record initial status history
  await insertStatusHistory(supabase, r.c.orgId, invId, null, 'draft', 'Invoice created from sales order.', r.c.userId)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId,
    entityType: 'invoices', entityId: invId,
    action: 'insert', after: { invoiceNo, soId: d.soId, status: 'draft' },
  })

  revalAll()
  revalidatePath(`/orders/${d.soId}`)
  return ok({ id: invId, invoiceNo })
}

// ── updateInvoice ─────────────────────────────────────────────────────────────

export async function updateInvoice(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.edit')) return err('forbidden', 'Missing invoices.edit permission.')

  const parsed = updateInvoiceSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status,is_igst')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')
  if (inv.status !== 'draft') return err('state_transition', 'Only draft invoices can be edited.')

  const updatePayload: Record<string, unknown> = {
    place_of_supply: d.placeOfSupply ?? null,
    payment_terms:   d.paymentTerms ?? null,
    notes:           d.notes ?? null,
    updated_by:      r.c.userId,
  }
  if (d.dueDate !== undefined) {
    updatePayload.due_date = d.dueDate ? d.dueDate.toISOString().split('T')[0] : null
  }
  if (d.terms !== undefined) updatePayload.terms = d.terms

  const isIgstChanged = d.isIgst !== undefined && Boolean(d.isIgst) !== Boolean(inv.is_igst)
  if (d.isIgst !== undefined) updatePayload.is_igst = d.isIgst

  await supabase.from('invoices').update(updatePayload).eq('id', id).eq('org_id', r.c.orgId)

  // If GST type changed, recalculate all item GST splits
  if (isIgstChanged) {
    const newIsIgst = Boolean(d.isIgst)
    const { data: items } = await supabase
      .from('invoice_items')
      .select('id,rate,qty,discount_pct,gst_pct')
      .eq('invoice_id', id)

    for (const item of items ?? []) {
      const calc = calcItemGst({
        rate: Number(item.rate), qty: Number(item.qty),
        discountPct: Number(item.discount_pct), gstPct: Number(item.gst_pct), isIgst: newIsIgst,
      })
      await supabase.from('invoice_items').update({
        cgst_pct: calc.cgstPct, sgst_pct: calc.sgstPct, igst_pct: calc.igstPct,
        cgst_amount: calc.cgstAmount, sgst_amount: calc.sgstAmount, igst_amount: calc.igstAmount,
        taxable_value: calc.taxableValue, total: calc.total,
      }).eq('id', item.id as string)
    }
    await recalcInvoiceTotals(supabase, id, r.c.orgId)
  }

  revalAll(id)
  return ok({ id })
}

// ── updateInvoiceItem ─────────────────────────────────────────────────────────

export async function updateInvoiceItem(
  invoiceId: string,
  itemId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.edit')) return err('forbidden', 'Missing invoices.edit permission.')

  const parsed = updateInvoiceItemSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status,is_igst')
    .eq('id', invoiceId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')
  if (inv.status !== 'draft') return err('state_transition', 'Items can only be edited on draft invoices.')

  const { data: item } = await supabase
    .from('invoice_items')
    .select('rate,qty,discount_pct,gst_pct')
    .eq('id', itemId).eq('invoice_id', invoiceId).maybeSingle()

  if (!item) return err('not_found', 'Invoice item not found.')

  const rate       = d.rate        ?? Number(item.rate)
  const qty        = d.qty         ?? Number(item.qty)
  const discPct    = d.discountPct ?? Number(item.discount_pct)
  const gstPct     = d.gstPct      ?? Number(item.gst_pct)
  const isIgst     = Boolean(inv.is_igst)

  const calc = calcItemGst({ rate, qty, discountPct: discPct, gstPct, isIgst })

  await supabase.from('invoice_items').update({
    ...(d.hsnCode !== undefined ? { hsn_code: d.hsnCode ?? null } : {}),
    rate, qty, discount_pct: discPct, gst_pct: gstPct,
    cgst_pct: calc.cgstPct, sgst_pct: calc.sgstPct, igst_pct: calc.igstPct,
    taxable_value: calc.taxableValue,
    cgst_amount: calc.cgstAmount, sgst_amount: calc.sgstAmount, igst_amount: calc.igstAmount,
    total: calc.total,
  }).eq('id', itemId)

  await recalcInvoiceTotals(supabase, invoiceId, r.c.orgId)

  revalAll(invoiceId)
  return ok(undefined)
}

// ── issueInvoice ──────────────────────────────────────────────────────────────

export async function issueInvoice(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.issue')) return err('forbidden', 'Missing invoices.issue permission.')

  const supabase = await createSupabaseServerClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status,grand_total')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')
  if (inv.status !== 'draft') return err('state_transition', 'Only draft invoices can be issued.')
  if (Number(inv.grand_total) <= 0) return err('validation', 'Cannot issue an invoice with zero value.')

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'issued', issued_at: new Date().toISOString(), issued_by: r.c.userId, updated_by: r.c.userId })
    .eq('id', id).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)

  await insertStatusHistory(supabase, r.c.orgId, id, 'draft', 'issued', undefined, r.c.userId)
  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'invoices', entityId: id, action: 'update', after: { status: 'issued' } })

  revalAll(id)
  return ok(undefined)
}

// ── updateInvoiceStatus ───────────────────────────────────────────────────────

export async function updateInvoiceStatus(id: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.edit')) return err('forbidden', 'Missing invoices.edit permission.')

  const parsed = invoiceStatusSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Invalid status.', { fieldErrors: fe(parsed.error) })

  const { status: toStatus, note } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')

  const allowed = VALID_TRANSITIONS[inv.status as InvoiceStatusType] ?? []
  if (!allowed.includes(toStatus)) {
    return err('state_transition', `Cannot transition from '${inv.status}' to '${toStatus}'.`)
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: toStatus, updated_by: r.c.userId })
    .eq('id', id).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)

  await insertStatusHistory(supabase, r.c.orgId, id, inv.status as string, toStatus, note, r.c.userId)
  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'invoices', entityId: id, action: 'update', after: { status: toStatus } })

  revalAll(id)
  return ok(undefined)
}

// ── recordPayment ─────────────────────────────────────────────────────────────

export async function recordPayment(invoiceId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.edit')) return err('forbidden', 'Missing invoices.edit permission.')

  const parsed = invoicePaymentSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status,grand_total,amount_paid')
    .eq('id', invoiceId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')

  const validPaymentStatuses = ['issued', 'partially_paid']
  if (!validPaymentStatuses.includes(inv.status as string)) {
    return err('state_transition', `Cannot record payment on a ${inv.status} invoice.`)
  }

  const newTotal = Number(inv.amount_paid) + d.amount
  if (newTotal > Number(inv.grand_total) * 1.01) {
    return err('validation', 'Payment exceeds invoice total.')
  }

  const { error } = await supabase.from('invoice_payments').insert({
    org_id:      r.c.orgId,
    invoice_id:  invoiceId,
    amount:      d.amount,
    payment_date: d.paymentDate.toISOString().split('T')[0],
    payment_mode: d.paymentMode,
    reference_no: d.referenceNo ?? null,
    note:         d.note ?? null,
    recorded_by:  r.c.userId,
  })

  if (error) return err('internal', error.message)
  // DB trigger handles amount_paid + balance_due + status auto-transition

  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'invoices', entityId: invoiceId, action: 'update', after: { payment: d.amount } })

  revalAll(invoiceId)
  return ok(undefined)
}

// ── deletePayment ─────────────────────────────────────────────────────────────

export async function deletePayment(invoiceId: string, paymentId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.edit')) return err('forbidden', 'Missing invoices.edit permission.')

  const supabase = await createSupabaseServerClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')
  if (inv.status === 'paid') return err('state_transition', 'Cannot remove payment from a paid invoice.')

  const { error } = await supabase
    .from('invoice_payments')
    .delete()
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)

  if (error) return err('internal', error.message)
  // DB trigger handles recalculation

  revalAll(invoiceId)
  return ok(undefined)
}

// ── deleteInvoice (draft only) ────────────────────────────────────────────────

export async function deleteInvoice(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('invoices.delete')) return err('forbidden', 'Missing invoices.delete permission.')

  const supabase = await createSupabaseServerClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status,so_id,invoice_no')
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null).maybeSingle()

  if (!inv) return err('not_found', 'Invoice not found.')
  if (inv.status !== 'draft') return err('state_transition', `Cannot delete a ${inv.status} invoice. Cancel it first.`)

  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('org_id', r.c.orgId)
  if (error) return err('internal', error.message)

  // SO status is decoupled from billing — nothing to revert on the SO here.

  await recordAuditEvent({ orgId: r.c.orgId, actorId: r.c.userId, entityType: 'invoices', entityId: id, action: 'delete', after: { invoiceNo: inv.invoice_no } })

  revalAll()
  return ok(undefined)
}
