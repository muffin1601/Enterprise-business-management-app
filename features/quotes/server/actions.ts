'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  quoteSchema,
  type QuoteInput,
  type QuoteItemInput,
  type QuoteLocationInput,
} from '@/validations/quote'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'revised' | 'cancelled'

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
  revalidatePath('/quotes')
  if (id) revalidatePath(`/quotes/${id}`)
}

async function getNextQuoteNo(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `Q-${year}-${seq}`
}

// ── calculateQuoteTotals (private) ────────────────────────────────────────────

async function calculateQuoteTotals(
  supabase: SupabaseClient,
  quoteId: string,
  orgId: string,
): Promise<void> {
  // Fetch quote for gst settings
  const { data: quote } = await supabase
    .from('quotes')
    .select('gst_mode, gst_pct, transport')
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!quote) return

  // Fetch all locations
  const { data: locations } = await supabase
    .from('quote_locations')
    .select('id, is_included, installation_charge')
    .eq('quote_id', quoteId)

  if (!locations) return

  let quoteMaterialSubtotal = 0

  for (const loc of locations) {
    // Fetch items for this location
    const { data: items } = await supabase
      .from('quote_items')
      .select('total')
      .eq('location_id', loc.id)

    const locMaterialSubtotal = (items ?? []).reduce((sum, i) => sum + (Number(i.total) || 0), 0)

    // Update location material_subtotal and location_total
    const locTotal = locMaterialSubtotal + (Number(loc.installation_charge) || 0)
    await supabase
      .from('quote_locations')
      .update({ material_subtotal: locMaterialSubtotal, location_total: locTotal })
      .eq('id', loc.id)

    if (loc.is_included) {
      quoteMaterialSubtotal += locMaterialSubtotal + (Number(loc.installation_charge) || 0)
    }
  }

  const transport = Number(quote.transport) || 0
  const subtotalWithTransport = quoteMaterialSubtotal + transport
  const gstPct = Number(quote.gst_pct) || 18
  let gstAmount = 0
  let grandTotal = 0

  if (quote.gst_mode === 'add') {
    gstAmount = subtotalWithTransport * (gstPct / 100)
    grandTotal = subtotalWithTransport + gstAmount
  } else if (quote.gst_mode === 'inclusive') {
    gstAmount = subtotalWithTransport - subtotalWithTransport / (1 + gstPct / 100)
    grandTotal = subtotalWithTransport
  } else {
    gstAmount = 0
    grandTotal = subtotalWithTransport
  }

  await supabase
    .from('quotes')
    .update({
      material_subtotal: quoteMaterialSubtotal,
      gst_amount: gstAmount,
      grand_total: grandTotal,
    })
    .eq('id', quoteId)
    .eq('org_id', orgId)
}

// ── Default terms ─────────────────────────────────────────────────────────────

const DEFAULT_TERMS: { category: string; text: string }[] = [
  { category: 'delivery', text: 'Delivery within 4–6 weeks from date of order confirmation.' },
  { category: 'gst', text: 'GST will be charged as applicable.' },
  { category: 'payment', text: '50% advance with order, balance before dispatch.' },
  { category: 'warranty', text: 'Manufacturer warranty applicable on all products.' },
  { category: 'exclusion', text: 'Civil work, electrical work and infrastructure not included.' },
]

// ── createQuote ───────────────────────────────────────────────────────────────

export async function createQuote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('quotes.create')) return err('forbidden', 'Missing quotes.create permission.')

  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const quoteNo = await getNextQuoteNo(supabase, r.c.orgId)

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      org_id: r.c.orgId,
      quote_no: quoteNo,
      customer_id: d.customerId || null,
      subject: d.subject ?? null,
      date: d.date.toISOString().split('T')[0],
      valid_until: d.validUntil ? d.validUntil.toISOString().split('T')[0] : null,
      status: d.status ?? 'draft',
      gst_mode: d.gstMode,
      gst_pct: d.gstPct ?? 18,
      transport: d.transport ?? 0,
      transport_note: d.transportNote ?? null,
      logo_url: d.logoUrl ?? null,
      include_boq_summary: d.includeBoqSummary ?? true,
      notes: d.notes ?? null,
      revision: 0,
      material_subtotal: 0,
      gst_amount: 0,
      grand_total: 0,
      created_by: r.c.userId,
      updated_by: r.c.userId,
    })
    .select('id')
    .single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to create quote.')

  const quoteId = data.id as string

  // Create default location
  await supabase.from('quote_locations').insert({
    org_id: r.c.orgId,
    quote_id: quoteId,
    name: 'Location 1',
    sort_order: 0,
    is_included: true,
    installation_charge: 0,
    material_subtotal: 0,
    location_total: 0,
  })

  // Store default terms in the quotes.terms jsonb column
  const defaultTerms = d.terms && d.terms.length > 0 ? d.terms : DEFAULT_TERMS
  await supabase.from('quotes').update({ terms: defaultTerms }).eq('id', quoteId)

  await recordAuditEvent({
    orgId: r.c.orgId,
    actorId: r.c.userId,
    entityType: 'quotes',
    entityId: quoteId,
    action: 'insert',
    after: { quoteNo, status: d.status ?? 'draft' },
  })

  // Note: do NOT call revalAll() here — createQuote is called during page render
  // (new/page.tsx) and revalidatePath is not allowed during render in Next.js 15.
  // The list page refreshes naturally on next visit.
  return ok({ id: quoteId })
}

// ── updateQuote ───────────────────────────────────────────────────────────────

export async function updateQuote(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('quotes.edit')) return err('forbidden', 'Missing quotes.edit permission.')

  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('quotes')
    .update({
      customer_id: d.customerId || null,
      subject: d.subject ?? null,
      date: d.date.toISOString().split('T')[0],
      valid_until: d.validUntil ? d.validUntil.toISOString().split('T')[0] : null,
      gst_mode: d.gstMode,
      gst_pct: d.gstPct ?? 18,
      transport: d.transport ?? 0,
      transport_note: d.transportNote ?? null,
      logo_url: d.logoUrl ?? null,
      include_boq_summary: d.includeBoqSummary ?? true,
      notes: d.notes ?? null,
      updated_by: r.c.userId,
    })
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)

  if (error) return err('internal', error.message)

  // Update terms in the quotes.terms jsonb column
  if (d.terms !== undefined) {
    await supabase.from('quotes').update({ terms: d.terms }).eq('id', id).eq('org_id', r.c.orgId)
  }

  // Recalculate totals
  await calculateQuoteTotals(supabase, id, r.c.orgId)

  await recordAuditEvent({
    orgId: r.c.orgId,
    actorId: r.c.userId,
    entityType: 'quotes',
    entityId: id,
    action: 'update',
    after: { subject: d.subject },
  })

  revalAll(id)
  return ok({ id })
}

// ── updateQuoteStatus ─────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['accepted', 'cancelled'],
  accepted: ['cancelled'],
  revised: ['cancelled'],
  cancelled: [],
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('quotes.edit')) return err('forbidden', 'Missing quotes.edit permission.')

  const supabase = await createSupabaseServerClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('status')
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!quote) return err('not_found', 'Quote not found.')

  const currentStatus = quote.status as QuoteStatus
  const allowed = VALID_TRANSITIONS[currentStatus] ?? []

  if (!allowed.includes(status)) {
    return err(
      'state_transition',
      `Cannot transition from '${currentStatus}' to '${status}'.`,
    )
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status, updated_by: r.c.userId })
    .eq('id', id)
    .eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId: r.c.orgId,
    actorId: r.c.userId,
    entityType: 'quotes',
    entityId: id,
    action: 'update',
    after: { status },
  })

  revalAll(id)
  return ok(undefined)
}

// ── reviseQuote ───────────────────────────────────────────────────────────────

export async function reviseQuote(id: string): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('quotes.edit')) return err('forbidden', 'Missing quotes.edit permission.')

  const supabase = await createSupabaseServerClient()

  // Fetch original quote
  const { data: original } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .eq('org_id', r.c.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!original) return err('not_found', 'Quote not found.')

  const newRevision = (Number(original.revision) || 0) + 1
  const newQuoteNo = `${original.quote_no}-R${newRevision}`

  // Insert new quote as revision
  const { data: newQuote, error: insertErr } = await supabase
    .from('quotes')
    .insert({
      org_id: r.c.orgId,
      quote_no: newQuoteNo,
      parent_id: id,
      customer_id: original.customer_id,
      subject: original.subject,
      date: new Date().toISOString().split('T')[0],
      valid_until: original.valid_until,
      status: 'draft',
      gst_mode: original.gst_mode,
      gst_pct: original.gst_pct,
      transport: original.transport,
      transport_note: original.transport_note,
      logo_url: original.logo_url,
      include_boq_summary: original.include_boq_summary,
      notes: original.notes,
      revision: newRevision,
      material_subtotal: 0,
      gst_amount: 0,
      grand_total: 0,
      created_by: r.c.userId,
      updated_by: r.c.userId,
    })
    .select('id')
    .single()

  if (insertErr || !newQuote) return err('internal', insertErr?.message ?? 'Failed to create revision.')

  const newQuoteId = newQuote.id as string

  // Copy terms from original quote's jsonb column
  const { data: origQuote } = await supabase.from('quotes').select('terms').eq('id', id).maybeSingle()
  if (origQuote?.terms) {
    await supabase.from('quotes').update({ terms: origQuote.terms }).eq('id', newQuoteId)
  }

  // Copy locations and their items
  const { data: locations } = await supabase
    .from('quote_locations')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order', { ascending: true })

  if (locations) {
    for (const loc of locations) {
      const { data: newLoc } = await supabase
        .from('quote_locations')
        .insert({
          org_id: r.c.orgId,
          quote_id: newQuoteId,
          name: loc.name,
          sort_order: loc.sort_order,
          is_included: loc.is_included,
          installation_charge: loc.installation_charge,
          installation_note: loc.installation_note,
          material_subtotal: 0,
          location_total: 0,
        })
        .select('id')
        .single()

      if (!newLoc) continue

      // Copy items for this location
      const { data: items } = await supabase
        .from('quote_items')
        .select('*')
        .eq('location_id', loc.id)
        .order('sort_order', { ascending: true })

      if (items && items.length > 0) {
        await supabase.from('quote_items').insert(
          items.map((item: Record<string, unknown>) => ({
            org_id: r.c.orgId,
            quote_id: newQuoteId,
            location_id: newLoc.id,
            item_id: item.item_id,
            name: item.name,
            description: item.description,
            brand: item.brand,
            unit: item.unit,
            rate: item.rate,
            qty: item.qty,
            discount_pct: item.discount_pct,
            taxable_value: Number(item.taxable_value) || 0,
            total: item.total,
            sort_order: item.sort_order,
          })),
        )
      }
    }
  }

  // Recalculate totals for new quote
  await calculateQuoteTotals(supabase, newQuoteId, r.c.orgId)

  // Set original to 'revised'
  await supabase
    .from('quotes')
    .update({ status: 'revised', updated_by: r.c.userId })
    .eq('id', id)
    .eq('org_id', r.c.orgId)

  await recordAuditEvent({
    orgId: r.c.orgId,
    actorId: r.c.userId,
    entityType: 'quotes',
    entityId: newQuoteId,
    action: 'insert',
    after: { parentId: id, revision: newRevision, quoteNo: newQuoteNo },
  })

  revalAll()
  revalAll(id)
  return ok({ id: newQuoteId })
}

// ── upsertQuoteLocations ──────────────────────────────────────────────────────

export async function upsertQuoteLocations(
  quoteId: string,
  locations: QuoteLocationInput[],
): Promise<ActionResult<{ locationIds: string[] }>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('quotes.edit')) return err('forbidden', 'Missing quotes.edit permission.')

  const supabase = await createSupabaseServerClient()

  // Delete existing locations (CASCADE deletes items)
  const { error: delErr } = await supabase
    .from('quote_locations')
    .delete()
    .eq('quote_id', quoteId)

  if (delErr) return err('internal', delErr.message)

  if (locations.length === 0) {
    revalAll(quoteId)
    return ok({ locationIds: [] })
  }

  // Insert each location individually so IDs come back in guaranteed order
  const locationIds: string[] = []
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]!
    const { data: row, error: insErr } = await supabase
      .from('quote_locations')
      .insert({
        org_id: r.c.orgId,
        quote_id: quoteId,
        name: loc.name,
        sort_order: i,
        is_included: loc.isIncluded ?? true,
        installation_charge: loc.installationCharge ?? 0,
        installation_note: loc.installationNote ?? null,
        material_subtotal: 0,
        location_total: 0,
      })
      .select('id')
      .single()

    if (insErr || !row) return err('internal', insErr?.message ?? `Failed to insert location ${i + 1}.`)
    locationIds.push(row.id as string)
  }

  // Recalculate totals
  await calculateQuoteTotals(supabase, quoteId, r.c.orgId)

  revalAll(quoteId)
  return ok({ locationIds })
}

// ── upsertQuoteItems ──────────────────────────────────────────────────────────

export async function upsertQuoteItems(
  locationId: string,
  quoteId: string,
  items: QuoteItemInput[],
): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('quotes.edit')) return err('forbidden', 'Missing quotes.edit permission.')

  const supabase = await createSupabaseServerClient()

  // Delete existing items for this location
  const { error: delErr } = await supabase
    .from('quote_items')
    .delete()
    .eq('location_id', locationId)

  if (delErr) return err('internal', delErr.message)

  if (items.length > 0) {
    const rows = items.map((item, i) => {
      const rate    = Number(item.rate)        || 0
      const qty     = Number(item.qty)         || 1
      const discPct = Number(item.discountPct) || 0
      const total   = +(rate * qty * (1 - discPct / 100)).toFixed(2)
      return {
        org_id:        r.c.orgId,
        quote_id:      quoteId,
        location_id:   locationId,
        item_id:       item.itemId ?? null,
        name:          item.name,
        description:   item.description  ?? null,
        brand:         item.brand        ?? null,
        unit:          item.unit         ?? null,
        rate,
        qty,
        discount_pct:  discPct,
        taxable_value: +(rate * qty).toFixed(2),
        total,
        sort_order:    i,
      }
    })

    const { error: insErr } = await supabase.from('quote_items').insert(rows)
    if (insErr) return err('internal', `quote_items insert: ${insErr.message}`)
  }

  // Update location subtotals
  const { data: allItems } = await supabase
    .from('quote_items')
    .select('total')
    .eq('location_id', locationId)

  const locMaterialSubtotal = (allItems ?? []).reduce((sum, i) => sum + (Number(i.total) || 0), 0)

  const { data: loc } = await supabase
    .from('quote_locations')
    .select('installation_charge')
    .eq('id', locationId)
    .maybeSingle()

  const installationCharge = Number(loc?.installation_charge) || 0
  const locationTotal = locMaterialSubtotal + installationCharge

  await supabase
    .from('quote_locations')
    .update({ material_subtotal: locMaterialSubtotal, location_total: locationTotal })
    .eq('id', locationId)

  // Recalculate quote grand totals
  await calculateQuoteTotals(supabase, quoteId, r.c.orgId)

  revalAll(quoteId)
  return ok(undefined)
}

// ── deleteQuote (soft) ────────────────────────────────────────────────────────

export async function deleteQuote(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('quotes.delete') && !r.c.has('quotes.edit')) return err('forbidden', 'Missing quotes.delete permission.')

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId: r.c.orgId,
    actorId: r.c.userId,
    entityType: 'quotes',
    entityId: id,
    action: 'delete',
  })

  revalAll()
  return ok(undefined)
}
