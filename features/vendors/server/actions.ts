'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionContext, AuthError } from '@/lib/auth/action-context'
import { recordAuditEvent } from '@/lib/audit/audit'
import { ok, err, type ActionResult } from '@/types/action'
import {
  vendorSchema, vendorContactSchema, vendorBankAccountSchema, vendorNoteSchema,
} from '@/validations/vendor'
import { getNextVendorCode } from './queries'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fe = (e: import('zod').ZodError) => e.flatten().fieldErrors as Record<string, string[]>

async function ctxOrErr(): Promise<{ c: import('@/lib/auth/action-context').ActionContext } | { c?: never; error: import('@/types/action').ActionErr }> {
  try { return { c: await getActionContext() } }
  catch (e) {
    if (e instanceof AuthError) return { error: err(e.code as 'unauthenticated' | 'forbidden', e.message) }
    throw e
  }
}

function path(id?: string) {
  revalidatePath('/vendors')
  if (id) revalidatePath(`/vendors/${id}`)
}

// ── createVendor ──────────────────────────────────────────────────────────────
export async function createVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.create')) return err('forbidden', 'Missing vendors.create permission.')

  const parsed = vendorSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const code = await getNextVendorCode()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.from('vendors').insert({
    org_id: r.c.orgId, code, name: d.name,
    type: d.type ?? 'supplier', status: d.status ?? 'active',
    contact_person: d.contactPerson ?? null, phone: d.phone ?? null,
    email: d.email ?? null, website: d.website ?? null,
    gstin: d.gstin ?? null, pan: d.pan ?? null, msme_no: d.msmeNo ?? null,
    billing_address: d.billingAddress ?? null, shipping_address: d.shippingAddress ?? null,
    city: d.city ?? null, state: d.state ?? null,
    pincode: d.pincode ?? null, country: d.country ?? 'India',
    payment_terms: d.paymentTerms ?? 'net_30',
    credit_limit: d.creditLimit ?? 0, currency: d.currency ?? 'INR',
    industry: d.industry ?? null, notes: d.notes ?? null,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to create vendor.')

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'vendors',
    entityId: data.id as string, action: 'insert', after: { name: d.name, code },
  })

  path()
  return ok({ id: data.id as string })
}

// ── updateVendor ──────────────────────────────────────────────────────────────
export async function updateVendor(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const parsed = vendorSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check the form fields.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendors').update({
    name: d.name, type: d.type ?? 'supplier', status: d.status ?? 'active',
    contact_person: d.contactPerson ?? null, phone: d.phone ?? null,
    email: d.email ?? null, website: d.website ?? null,
    gstin: d.gstin ?? null, pan: d.pan ?? null, msme_no: d.msmeNo ?? null,
    billing_address: d.billingAddress ?? null, shipping_address: d.shippingAddress ?? null,
    city: d.city ?? null, state: d.state ?? null,
    pincode: d.pincode ?? null, country: d.country ?? 'India',
    payment_terms: d.paymentTerms ?? 'net_30',
    credit_limit: d.creditLimit ?? 0, currency: d.currency ?? 'INR',
    industry: d.industry ?? null, notes: d.notes ?? null,
    updated_by: r.c.userId,
  }).eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'vendors',
    entityId: id, action: 'update', after: { name: d.name },
  })

  path(id)
  return ok({ id })
}

// ── deleteVendor ──────────────────────────────────────────────────────────────
export async function deleteVendor(id: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  // Soft-delete uses UPDATE under the hood, so requires both delete + edit permissions
  if (!r.c.has('vendors.delete') && !r.c.has('vendors.edit')) {
    return err('forbidden', 'Missing vendors.delete permission.')
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendors')
    .delete()
    .eq('id', id).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'vendors', entityId: id, action: 'delete',
  })

  path()
  return ok(undefined)
}

// ── updateVendorStatus ────────────────────────────────────────────────────────
export async function updateVendorStatus(
  id: string, status: 'active' | 'inactive' | 'blacklisted',
): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendors')
    .update({ status, updated_by: r.c.userId })
    .eq('id', id).eq('org_id', r.c.orgId).is('deleted_at', null)

  if (error) return err('internal', error.message)

  await recordAuditEvent({
    orgId: r.c.orgId, actorId: r.c.userId, entityType: 'vendors',
    entityId: id, action: 'update', after: { status },
  })

  path(id)
  return ok(undefined)
}

// ── addContact ────────────────────────────────────────────────────────────────
export async function addVendorContact(vendorId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const parsed = vendorContactSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check contact details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  if (d.isPrimary) {
    await supabase.from('vendor_contacts').update({ is_primary: false })
      .eq('vendor_id', vendorId).eq('org_id', r.c.orgId)
  }

  const { data, error } = await supabase.from('vendor_contacts').insert({
    org_id: r.c.orgId, vendor_id: vendorId, name: d.name,
    designation: d.designation ?? null, email: d.email ?? null,
    phone: d.phone ?? null, department: d.department ?? null,
    is_primary: d.isPrimary ?? false,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to add contact.')
  path(vendorId)
  return ok({ id: data.id as string })
}

// ── updateContact ─────────────────────────────────────────────────────────────
export async function updateVendorContact(contactId: string, vendorId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const parsed = vendorContactSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check contact details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  if (d.isPrimary) {
    await supabase.from('vendor_contacts').update({ is_primary: false })
      .eq('vendor_id', vendorId).eq('org_id', r.c.orgId)
  }

  const { error } = await supabase.from('vendor_contacts').update({
    name: d.name, designation: d.designation ?? null, email: d.email ?? null,
    phone: d.phone ?? null, department: d.department ?? null,
    is_primary: d.isPrimary ?? false, updated_by: r.c.userId,
  }).eq('id', contactId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(vendorId)
  return ok(undefined)
}

// ── deleteContact ─────────────────────────────────────────────────────────────
export async function deleteVendorContact(contactId: string, vendorId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendor_contacts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', contactId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(vendorId)
  return ok(undefined)
}

// ── addBankAccount ────────────────────────────────────────────────────────────
export async function addVendorBankAccount(vendorId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const parsed = vendorBankAccountSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check bank account details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  if (d.isPrimary) {
    await supabase.from('vendor_bank_accounts').update({ is_primary: false })
      .eq('vendor_id', vendorId).eq('org_id', r.c.orgId)
  }

  const { data, error } = await supabase.from('vendor_bank_accounts').insert({
    org_id: r.c.orgId, vendor_id: vendorId,
    account_name: d.accountName, account_no: d.accountNo,
    bank_name: d.bankName, branch: d.branch ?? null,
    ifsc_code: d.ifscCode, account_type: d.accountType,
    is_primary: d.isPrimary ?? false, created_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to add bank account.')
  path(vendorId)
  return ok({ id: data.id as string })
}

// ── updateBankAccount ─────────────────────────────────────────────────────────
export async function updateVendorBankAccount(bankId: string, vendorId: string, input: unknown): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const parsed = vendorBankAccountSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Check bank account details.', { fieldErrors: fe(parsed.error) })

  const d = parsed.data
  const supabase = await createSupabaseServerClient()

  if (d.isPrimary) {
    await supabase.from('vendor_bank_accounts').update({ is_primary: false })
      .eq('vendor_id', vendorId).eq('org_id', r.c.orgId)
  }

  const { error } = await supabase.from('vendor_bank_accounts').update({
    account_name: d.accountName, account_no: d.accountNo,
    bank_name: d.bankName, branch: d.branch ?? null,
    ifsc_code: d.ifscCode, account_type: d.accountType,
    is_primary: d.isPrimary ?? false,
  }).eq('id', bankId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(vendorId)
  return ok(undefined)
}

// ── deleteVendorBankAccount ───────────────────────────────────────────────────
export async function deleteVendorBankAccount(bankId: string, vendorId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendor_bank_accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', bankId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(vendorId)
  return ok(undefined)
}

// ── addNote ───────────────────────────────────────────────────────────────────
export async function addVendorNote(vendorId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const parsed = vendorNoteSchema.safeParse(input)
  if (!parsed.success) return err('validation', 'Note cannot be empty.')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('vendor_notes').insert({
    org_id: r.c.orgId, vendor_id: vendorId,
    content: parsed.data.content, is_pinned: parsed.data.isPinned ?? false,
    created_by: r.c.userId, updated_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to add note.')
  path(vendorId)
  return ok({ id: data.id as string })
}

// ── toggleNotePin ─────────────────────────────────────────────────────────────
export async function toggleVendorNotePin(noteId: string, vendorId: string, isPinned: boolean): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendor_notes')
    .update({ is_pinned: isPinned, updated_by: r.c.userId })
    .eq('id', noteId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(vendorId)
  return ok(undefined)
}

// ── deleteNote ────────────────────────────────────────────────────────────────
export async function deleteVendorNote(noteId: string, vendorId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendor_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(vendorId)
  return ok(undefined)
}

// ── saveDocument ──────────────────────────────────────────────────────────────
export async function saveVendorDocument(
  vendorId: string,
  input: { name: string; category: string; fileUrl: string; filePath: string; fileSize: number; mimeType: string },
): Promise<ActionResult<{ id: string }>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('vendor_documents').insert({
    org_id: r.c.orgId, vendor_id: vendorId,
    name: input.name, category: input.category,
    file_url: input.fileUrl, file_path: input.filePath,
    file_size: input.fileSize, mime_type: input.mimeType,
    created_by: r.c.userId,
  }).select('id').single()

  if (error || !data) return err('internal', error?.message ?? 'Failed to save document.')
  path(vendorId)
  return ok({ id: data.id as string })
}

// ── deleteDocument ────────────────────────────────────────────────────────────
export async function deleteVendorDocument(docId: string, vendorId: string): Promise<ActionResult<void>> {
  const r = await ctxOrErr()
  if ('error' in r) return r.error
  if (!r.c.has('vendors.edit')) return err('forbidden', 'Missing vendors.edit permission.')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('vendor_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', docId).eq('org_id', r.c.orgId)

  if (error) return err('internal', error.message)
  path(vendorId)
  return ok(undefined)
}
