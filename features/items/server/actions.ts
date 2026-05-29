'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { computeLandedCost } from '@/lib/calc/costing'
import { ok, err, type ActionResult } from '@/types/action'
import {
  brandSchema,
  familySchema,
  itemSchema,
  unitSchema,
  type ItemInput,
} from '@/validations/item'

/**
 * Item Management server actions. Mutations are gated by inventory permission
 * keys (PERMISSIONS.md): items.create / items.edit / items.delete; lookups by
 * items.create|edit. RLS re-checks every write; the app.fn_audit triggers (0007)
 * record them. Imported items have purchase/selling price derived server-side
 * from the landed-cost calculator — the client preview never sets the stored price.
 */

const fieldErrors = (e: import('zod').ZodError) =>
  e.flatten().fieldErrors as Record<string, string[]>

async function ctxOrErr() {
  try {
    return { ctx: await getActionContext() }
  } catch (e) {
    if (e instanceof AuthError) return { error: err(e.code, e.message) }
    throw e
  }
}

/** Map validated input → DB row, resolving prices via costing for imports. */
function toRow(input: ItemInput, orgId: string, actorId: string) {
  const imported = input.isImported
  const cost = imported
    ? computeLandedCost({
        importPrice: input.importPrice ?? 0,
        exchangeRate: input.exchangeRate ?? 0,
        importDiscountPct: input.importDiscountPct,
        transportType: input.transportType,
        transportValue: input.transportValue,
        customDutyPct: input.customDutyPct,
        profitMultiplier: input.profitMultiplier,
      })
    : null

  return {
    org_id: orgId,
    name: input.name,
    sku: input.sku || null,
    family_id: input.familyId || null,
    brand_id: input.brandId || null,
    unit_id: input.unitId || null,
    variant_label: input.variantLabel || null,
    image_url: input.imageUrl || null,
    is_imported: imported,
    delivery_days: input.deliveryDays ?? null,
    stock: input.stock ?? 0,
    purchase_price: cost ? cost.costPrice : (input.purchasePrice ?? null),
    selling_price: cost ? cost.sellingPrice : (input.sellingPrice ?? null),
    import_currency: imported ? (input.importCurrency ?? null) : null,
    import_price: imported ? (input.importPrice ?? null) : null,
    exchange_rate: imported ? (input.exchangeRate ?? null) : null,
    import_discount_pct: imported ? (input.importDiscountPct ?? null) : null,
    transport_type: imported ? (input.transportType ?? null) : null,
    transport_value: imported ? (input.transportValue ?? null) : null,
    custom_duty_pct: imported ? (input.customDutyPct ?? null) : null,
    profit_multiplier: imported ? (input.profitMultiplier ?? null) : null,
    updated_by: actorId,
  }
}

export async function createItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check the item details.', { fieldErrors: fieldErrors(parsed.error) })

  const r = await ctxOrErr()
  if (r.error) return r.error
  const ctx = r.ctx
  if (!ctx.has('items.create')) return err('forbidden', 'You cannot create items.')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('items')
    .insert({ ...toRow(parsed.data, ctx.orgId, ctx.userId), created_by: ctx.userId })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return err('conflict', 'An item with that SKU already exists.')
    return err('internal', 'Could not create the item.')
  }

  revalidatePath('/items')
  return ok({ id: data.id as string })
}

export async function updateItem(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success)
    return err('validation', 'Check the item details.', { fieldErrors: fieldErrors(parsed.error) })

  const r = await ctxOrErr()
  if (r.error) return r.error
  const ctx = r.ctx
  if (!ctx.has('items.edit')) return err('forbidden', 'You cannot edit items.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('items')
    .update(toRow(parsed.data, ctx.orgId, ctx.userId))
    .eq('id', id)
    .eq('org_id', ctx.orgId)
  if (error) {
    if (error.code === '23505') return err('conflict', 'An item with that SKU already exists.')
    return err('internal', 'Could not save the item.')
  }

  revalidatePath('/items')
  revalidatePath(`/items/${id}`)
  return ok({ id })
}

/** Soft-delete (sets deleted_at). Requires items.delete. */
export async function deleteItem(id: string): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if (r.error) return r.error
  const ctx = r.ctx
  if (!ctx.has('items.delete')) return err('forbidden', 'You cannot delete items.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('items')
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
  if (error) return err('internal', 'Could not delete the item.')

  revalidatePath('/items')
  return ok({ id })
}

// ── Lookups (categories / brands / units) ───────────────────────────────────

async function requireLookupPerm() {
  const r = await ctxOrErr()
  if (r.error) return { error: r.error }
  if (!r.ctx.has('items.create') && !r.ctx.has('items.edit'))
    return { error: err('forbidden', 'You cannot manage catalogue settings.') }
  return { ctx: r.ctx }
}

async function insertLookup(
  table: 'item_families' | 'brands' | 'units',
  row: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const g = await requireLookupPerm()
  if (g.error) return g.error
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(table)
    .insert({ ...row, org_id: g.ctx.orgId, created_by: g.ctx.userId })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return err('conflict', 'That entry already exists.')
    return err('internal', 'Could not save.')
  }
  revalidatePath('/items/lookups')
  return ok({ id: data.id as string })
}

export async function createFamily(input: unknown) {
  const parsed = familySchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Enter a name.', { fieldErrors: fieldErrors(parsed.error) })
  return insertLookup('item_families', { name: parsed.data.name })
}

export async function createBrand(input: unknown) {
  const parsed = brandSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Enter a name.', { fieldErrors: fieldErrors(parsed.error) })
  return insertLookup('brands', { name: parsed.data.name })
}

export async function createUnit(input: unknown) {
  const parsed = unitSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Enter a code.', { fieldErrors: fieldErrors(parsed.error) })
  return insertLookup('units', { code: parsed.data.code, name: parsed.data.name || null })
}

export async function deleteLookup(
  kind: 'family' | 'brand' | 'unit',
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const g = await requireLookupPerm()
  if (g.error) return g.error
  const table = kind === 'family' ? 'item_families' : kind === 'brand' ? 'brands' : 'units'
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), updated_by: g.ctx.userId })
    .eq('id', id)
    .eq('org_id', g.ctx.orgId)
  if (error) return err('internal', 'Could not delete.')
  revalidatePath('/items/lookups')
  return ok({ id })
}
