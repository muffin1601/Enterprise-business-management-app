'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  itemSchema, adjustmentSchema, familySchema, brandSchema, unitSchema,
  type ItemInput, type AdjustmentInput,
} from '@/validations/inventory'
import { getNextSku } from './queries'

const fe = (e: import('zod').ZodError) => e.flatten().fieldErrors as Record<string, string[]>

async function ctxOrErr() {
  try { return { c: await getActionContext() } }
  catch (e) {
    if (e instanceof AuthError) return { error: err(e.code as 'unauthenticated'|'forbidden', e.message) }
    throw e
  }
}

function revalAll(id?: string) {
  revalidatePath('/inventory/items')
  revalidatePath('/inventory/dashboard')
  if (id) revalidatePath(`/inventory/items/${id}`)
}

// ── createItem ────────────────────────────────────────────────────────────────
export async function createItem(input: unknown): Promise<ActionResult<{id:string}>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('inventory.create')) return err('forbidden', 'Missing inventory.create permission.')

  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const sku = d.sku || await getNextSku()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.from('items').insert({
    org_id: r.c.orgId,
    sku, name: d.name, variant_label: d.variantLabel ?? null,
    description: d.description ?? null, barcode: d.barcode ?? null,
    family_id: d.familyId ?? null, brand_id: d.brandId ?? null, unit_id: d.unitId ?? null,
    hsn_code: d.hsnCode ?? null, gst_rate: d.gstRate ?? 18,
    purchase_price: d.purchasePrice ?? null, selling_price: d.sellingPrice ?? null,
    cost_price: d.costPrice ?? null,
    stock: d.stock ?? 0, min_stock: d.minStock ?? 0,
    reorder_level: d.reorderLevel ?? 0, max_stock: d.maxStock ?? 0,
    lead_time_days: d.leadTimeDays ?? 0,
    weight_kg: d.weightKg ?? null, dimensions: d.dimensions ?? null,
    tags: d.tags ?? [], notes: d.notes ?? null,
    is_active: d.isActive ?? true, is_imported: d.isImported ?? false,
    delivery_days: d.deliveryDays ?? null,
    import_currency: d.importCurrency ?? null, import_price: d.importPrice ?? null,
    exchange_rate: d.exchangeRate ?? null, import_discount_pct: d.importDiscountPct ?? null,
    transport_type: d.transportType ?? null, transport_value: d.transportValue ?? null,
    custom_duty_pct: d.customDutyPct ?? null, profit_multiplier: d.profitMultiplier ?? null,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to create item.')

  await recordAuditEvent({ orgId:r.c.orgId, actorId:r.c.userId, entityType:'items', entityId:data.id as string, action:'insert', after:{name:d.name, sku} })

  // Record opening stock movement if stock > 0
  if ((d.stock ?? 0) > 0) {
    await supabase.from('stock_movements').insert({
      org_id: r.c.orgId, item_id: data.id as string,
      date: new Date().toISOString().split('T')[0],
      qty: d.stock, value: (d.costPrice ?? d.purchasePrice ?? 0) * (d.stock ?? 0),
      direction: 'in', movement_type: 'opening',
      reference: 'Opening stock', created_by: r.c.userId,
    })
  }

  revalAll()
  return ok({ id: data.id as string })
}

// ── updateItem ────────────────────────────────────────────────────────────────
export async function updateItem(id: string, input: unknown): Promise<ActionResult<{id:string}>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('inventory.edit')) return err('forbidden', 'Missing inventory.edit permission.')

  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.from('items').update({
    name: d.name, variant_label: d.variantLabel ?? null,
    description: d.description ?? null, barcode: d.barcode ?? null,
    family_id: d.familyId ?? null, brand_id: d.brandId ?? null, unit_id: d.unitId ?? null,
    hsn_code: d.hsnCode ?? null, gst_rate: d.gstRate ?? 18,
    purchase_price: d.purchasePrice ?? null, selling_price: d.sellingPrice ?? null,
    cost_price: d.costPrice ?? null,
    min_stock: d.minStock ?? 0, reorder_level: d.reorderLevel ?? 0, max_stock: d.maxStock ?? 0,
    lead_time_days: d.leadTimeDays ?? 0,
    weight_kg: d.weightKg ?? null, dimensions: d.dimensions ?? null,
    tags: d.tags ?? [], notes: d.notes ?? null,
    is_active: d.isActive ?? true, is_imported: d.isImported ?? false,
    delivery_days: d.deliveryDays ?? null,
    import_currency: d.importCurrency ?? null, import_price: d.importPrice ?? null,
    exchange_rate: d.exchangeRate ?? null, import_discount_pct: d.importDiscountPct ?? null,
    transport_type: d.transportType ?? null, transport_value: d.transportValue ?? null,
    custom_duty_pct: d.customDutyPct ?? null, profit_multiplier: d.profitMultiplier ?? null,
    updated_by: r.c.userId,
  }).eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null)

  if (error) return err('internal', error.message)
  await recordAuditEvent({ orgId:r.c.orgId, actorId:r.c.userId, entityType:'items', entityId:id, action:'update', after:{name:d.name} })
  revalAll(id)
  return ok({ id })
}

// ── deleteItem (soft) ─────────────────────────────────────────────────────────
export async function deleteItem(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('inventory.delete')) return err('forbidden', 'Missing inventory.delete permission.')
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('items').update({ deleted_at: new Date().toISOString(), updated_by: r.c.userId }).eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null)
  if (error) return err('internal', error.message)
  await recordAuditEvent({ orgId:r.c.orgId, actorId:r.c.userId, entityType:'items', entityId:id, action:'delete' })
  revalAll()
  return ok(undefined)
}

// ── adjustStock ───────────────────────────────────────────────────────────────
export async function adjustStock(itemId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  if (!r.c.has('inventory.adjust')) return err('forbidden', 'Missing inventory.adjust permission.')

  const parsed = adjustmentSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check adjustment details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  // Get current stock
  const { data: item } = await supabase.from('items').select('stock,cost_price,purchase_price').eq('id', itemId).eq('org_id', r.c.orgId).maybeSingle()
  if (!item) return err('not_found', 'Item not found.')

  const curr    = Number(item.stock ?? 0)
  const adjQty  = d.type === 'add' ? d.qty : -d.qty
  const newStock = Math.max(0, curr + adjQty)

  // Update stock
  const { error: upErr } = await supabase.from('items')
    .update({ stock: newStock, updated_by: r.c.userId }).eq('id', itemId).eq('org_id', r.c.orgId)
  if (upErr) return err('internal', upErr.message)

  // Record adjustment
  await supabase.from('stock_adjustments').insert({
    org_id: r.c.orgId, item_id: itemId,
    type: d.type, qty: d.qty, reason: d.reason, ref_no: d.refNo ?? null,
    at: new Date().toISOString(), created_by: r.c.userId,
  })

  // Record movement
  const unitValue = Number(item.cost_price ?? item.purchase_price ?? 0)
  await supabase.from('stock_movements').insert({
    org_id: r.c.orgId, item_id: itemId,
    date: new Date().toISOString().split('T')[0],
    qty: d.qty, value: unitValue * d.qty,
    direction: d.type === 'add' ? 'in' : 'out',
    movement_type: 'adjustment',
    reference: d.refNo ?? null, notes: d.reason,
    created_by: r.c.userId,
  })

  await recordAuditEvent({ orgId:r.c.orgId, actorId:r.c.userId, entityType:'items', entityId:itemId, action:'update', after:{stockAdjustment:adjQty, newStock, reason:d.reason} })
  revalAll(itemId)
  return ok(undefined)
}

// ── Lookup CRUD ───────────────────────────────────────────────────────────────
export async function createFamily(input: unknown): Promise<ActionResult<{id:string}>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  const p = familySchema.safeParse(input)
  if (!p.success) return err('validation', 'Invalid name.')
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('item_families').insert({ org_id:r.c.orgId, name:p.data.name, created_by:r.c.userId, updated_by:r.c.userId }).select('id').single()
  if (error || !data) return err('internal', error?.message ?? 'Failed.')
  revalidatePath('/inventory/items')
  return ok({ id: data.id as string })
}

export async function createBrand(input: unknown): Promise<ActionResult<{id:string}>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  const p = brandSchema.safeParse(input)
  if (!p.success) return err('validation', 'Invalid name.')
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('brands').insert({ org_id:r.c.orgId, name:p.data.name, created_by:r.c.userId, updated_by:r.c.userId }).select('id').single()
  if (error || !data) return err('internal', error?.message ?? 'Failed.')
  revalidatePath('/inventory/items')
  return ok({ id: data.id as string })
}

export async function createUnit(input: unknown): Promise<ActionResult<{id:string}>> {
  const r = await ctxOrErr(); if ('error' in r) return r.error
  const p = unitSchema.safeParse(input)
  if (!p.success) return err('validation', 'Invalid code.')
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('units').insert({ org_id:r.c.orgId, code:p.data.code, name:p.data.name??null, created_by:r.c.userId, updated_by:r.c.userId }).select('id').single()
  if (error || !data) return err('internal', error?.message ?? 'Failed.')
  revalidatePath('/inventory/items')
  return ok({ id: data.id as string })
}
