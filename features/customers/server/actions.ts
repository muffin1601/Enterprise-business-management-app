'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  customerSchema, contactSchema, noteSchema, paymentSchema,
  type CustomerInput, type ContactInput, type NoteInput, type PaymentInput,
} from '@/validations/customer'
import { getNextCustomerCode } from './queries'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fe = (e: import('zod').ZodError) => e.flatten().fieldErrors as Record<string, string[]>

async function ctxOrErr() {
  try { return { c: await getActionContext() } }
  catch (e) {
    if (e instanceof AuthError) return { error: err(e.code as 'unauthenticated' | 'forbidden', e.message) }
    throw e
  }
}

function path(id?: string) {
  revalidatePath('/customers')
  if (id) revalidatePath(`/customers/${id}`)
}

// ── createCustomer ────────────────────────────────────────────────────────────
export async function createCustomer(input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.create')) return err('forbidden', 'Missing customers.create permission.')

  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const code = await getNextCustomerCode()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.from('customers').insert({
    org_id: r.c.orgId, code, name: d.name,
    contact_person: d.contactPerson ?? null, phone: d.phone ?? null, email: d.email ?? null,
    website: d.website ?? null, gstin: d.gstin ?? null, pan: d.pan ?? null,
    industry: d.industry ?? null, type: d.type ?? 'retail', status: d.status ?? 'active',
    credit_limit: d.creditLimit ?? 0, payment_terms: d.paymentTerms ?? 'net_30',
    post_sale_discount: d.postSaleDiscount ?? 0,
    billing_name: d.billingName ?? null, billing_address: d.billingAddress ?? null,
    delivery_name: d.deliveryName ?? null, delivery_address: d.deliveryAddress ?? null,
    same_as_billing: d.sameAsBilling ?? false, notes: d.notes ?? null,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to create customer.')

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'customers',
    entityId: data.id as string, action: 'insert', after: { name: d.name, code },
  })

  path()
  return ok({ id: data.id as string })
}

// ── updateCustomer ────────────────────────────────────────────────────────────
export async function updateCustomer(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('customers').update({
    name: d.name, contact_person: d.contactPerson ?? null, phone: d.phone ?? null,
    email: d.email ?? null, website: d.website ?? null, gstin: d.gstin ?? null,
    pan: d.pan ?? null, industry: d.industry ?? null, type: d.type ?? 'retail',
    status: d.status ?? 'active', credit_limit: d.creditLimit ?? 0,
    payment_terms: d.paymentTerms ?? 'net_30', post_sale_discount: d.postSaleDiscount ?? 0,
    billing_name: d.billingName ?? null, billing_address: d.billingAddress ?? null,
    delivery_name: d.deliveryName ?? null, delivery_address: d.deliveryAddress ?? null,
    same_as_billing: d.sameAsBilling ?? false, notes: d.notes ?? null,
    updated_by: r.c.userId,
  }).eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'customers',
    entityId: id, action: 'update', after: { name: d.name },
  })

  path(id)
  return ok({ id })
}

// ── deleteCustomer ────────────────────────────────────────────────────────────
export async function deleteCustomer(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.delete')) return err('forbidden', 'Missing customers.delete permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('customers')
    .update({ deleted_at: new Date().toISOString(), updated_by: r.c.userId })
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'customers', entityId: id, action: 'delete',
  })

  path()
  return ok(undefined)
}

// ── updateCustomerStatus ──────────────────────────────────────────────────────
export async function updateCustomerStatus(
  id: string, status: 'active' | 'inactive' | 'blocked',
): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('customers')
    .update({ status, updated_by: r.c.userId })
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'customers',
    entityId: id, action: 'update', after: { status },
  })

  path(id)
  return ok(undefined)
}

// ── addContact ────────────────────────────────────────────────────────────────
export async function addContact(customerId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check contact details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  if (d.isPrimary) {
    await supabase.from('customer_contacts').update({ is_primary: false })
      .eq('customer_id', customerId).eq('org_id', r.c.orgId)
  }

  const { data, error } = await supabase.from('customer_contacts').insert({
    org_id: r.c.orgId, customer_id: customerId, name: d.name,
    designation: d.designation ?? null, email: d.email ?? null,
    phone: d.phone ?? null, is_primary: d.isPrimary ?? false,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to add contact.')

  path(customerId)
  return ok({ id: data.id as string })
}

// ── updateContact ─────────────────────────────────────────────────────────────
export async function updateContact(contactId: string, customerId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check contact details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  if (d.isPrimary) {
    await supabase.from('customer_contacts').update({ is_primary: false })
      .eq('customer_id', customerId).eq('org_id', r.c.orgId)
  }

  const { error } = await supabase.from('customer_contacts').update({
    name: d.name, designation: d.designation ?? null, email: d.email ?? null,
    phone: d.phone ?? null, is_primary: d.isPrimary ?? false, updated_by: r.c.userId,
  }).eq('id', contactId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(customerId)
  return ok(undefined)
}

// ── deleteContact ─────────────────────────────────────────────────────────────
export async function deleteContact(contactId: string, customerId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('customer_contacts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', contactId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(customerId)
  return ok(undefined)
}

// ── addNote ───────────────────────────────────────────────────────────────────
export async function addNote(customerId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Note cannot be empty.')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('customer_notes').insert({
    org_id: r.c.orgId, customer_id: customerId, content: parsed.data.content,
    is_pinned: parsed.data.isPinned ?? false, created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to add note.')
  path(customerId)
  return ok({ id: data.id as string })
}

// ── deleteNote ────────────────────────────────────────────────────────────────
export async function deleteNote(noteId: string, customerId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('customer_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(customerId)
  return ok(undefined)
}

// ── recordPayment ─────────────────────────────────────────────────────────────
export async function recordPayment(customerId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check payment details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.from('payments').insert({
    org_id: r.c.orgId, customer_id: customerId,
    date: d.date, amount: d.amount, mode: d.mode,
    reference: d.reference ?? null, notes: d.notes ?? null,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to record payment.')

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'payments',
    entityId: data.id as string, action: 'insert',
    after: { customerId, amount: d.amount, mode: d.mode, date: d.date },
  })

  path(customerId)
  return ok({ id: data.id as string })
}

// ── deleteDocument ────────────────────────────────────────────────────────────
export async function deleteDocument(documentId: string, customerId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const supabase = await createSupabaseServerClient()

  // Soft-delete the metadata row
  const { error } = await supabase.from('customer_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(customerId)
  return ok(undefined)
}

// ── saveDocument (called after client-side upload) ────────────────────────────
export async function saveDocument(
  customerId: string,
  input: { name: string; category: string; fileUrl: string; filePath: string; fileSize: number; mimeType: string }
): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('customers.edit')) return err('forbidden', 'Missing customers.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('customer_documents').insert({
    org_id: r.c.orgId, customer_id: customerId,
    name: input.name, category: input.category,
    file_url: input.fileUrl, file_path: input.filePath,
    file_size: input.fileSize, mime_type: input.mimeType,
    created_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to save document.')
  path(customerId)
  return ok({ id: data.id as string })
}
