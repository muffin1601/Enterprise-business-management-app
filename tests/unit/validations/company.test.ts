import { describe, it, expect } from 'vitest'
import {
  acceptInvitationSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  organizationSettingsSchema,
  switchOrganizationSchema,
  updateOrganizationSchema,
} from '@/validations/company'

const UUID = '00000000-0000-4000-8000-000000000000'

describe('createOrganizationSchema', () => {
  it('accepts just a name (minimum onboarding input)', () => {
    expect(createOrganizationSchema.safeParse({ name: 'Watcon Traders' }).success).toBe(true)
  })

  it('rejects a blank name', () => {
    const r = createOrganizationSchema.safeParse({ name: '   ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.name).toBeDefined()
  })

  it('accepts a valid GSTIN and an empty-string GSTIN', () => {
    expect(
      createOrganizationSchema.safeParse({ name: 'X', gstin: '27ABCDE1234F1Z5' }).success,
    ).toBe(true)
    expect(createOrganizationSchema.safeParse({ name: 'X', gstin: '' }).success).toBe(true)
  })

  it('rejects a malformed GSTIN', () => {
    const r = createOrganizationSchema.safeParse({ name: 'X', gstin: 'NOTAGSTIN' })
    expect(r.success).toBe(false)
  })

  it('rejects an invalid slug', () => {
    expect(createOrganizationSchema.safeParse({ name: 'X', slug: 'Bad Slug!' }).success).toBe(false)
  })

  it('accepts the onboarding form payload with all optional fields blank (regression: blank slug)', () => {
    // The form submits defaultValues { slug:'', legalName:'', gstin:'', address:'' };
    // a blank slug must NOT fail client validation (else handleSubmit never fires).
    const r = createOrganizationSchema.safeParse({
      name: 'Watcon Traders',
      slug: '',
      legalName: '',
      gstin: '',
      address: '',
    })
    expect(r.success).toBe(true)
  })
})

describe('switchOrganizationSchema', () => {
  it('accepts a uuid', () => {
    expect(switchOrganizationSchema.safeParse({ orgId: UUID }).success).toBe(true)
  })
  it('rejects a non-uuid', () => {
    expect(switchOrganizationSchema.safeParse({ orgId: 'abc' }).success).toBe(false)
  })
})

describe('updateOrganizationSchema', () => {
  it('accepts a name with blank optional fields', () => {
    expect(
      updateOrganizationSchema.safeParse({ name: 'X', legalName: '', gstin: '', pan: '', address: '' })
        .success,
    ).toBe(true)
  })
  it('validates PAN format', () => {
    expect(updateOrganizationSchema.safeParse({ name: 'X', pan: 'ABCDE1234F' }).success).toBe(true)
    expect(updateOrganizationSchema.safeParse({ name: 'X', pan: 'bad' }).success).toBe(false)
  })
})

describe('organizationSettingsSchema', () => {
  it('coerces string numbers from form inputs', () => {
    const r = organizationSettingsSchema.safeParse({
      financialYearStart: '4',
      defaultGstPct: '18',
      placeOfSupply: '',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.financialYearStart).toBe(4)
      expect(r.data.defaultGstPct).toBe(18)
    }
  })
  it('rejects a month outside 1–12', () => {
    expect(
      organizationSettingsSchema.safeParse({ financialYearStart: 13, defaultGstPct: 18 }).success,
    ).toBe(false)
  })
  it('rejects a GST % over 100', () => {
    expect(
      organizationSettingsSchema.safeParse({ financialYearStart: 4, defaultGstPct: 150 }).success,
    ).toBe(false)
  })
})

describe('inviteMemberSchema', () => {
  it('accepts a valid email + role uuid and normalizes email', () => {
    const r = inviteMemberSchema.safeParse({ email: '  New@Watcon.NET ', roleId: UUID })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('new@watcon.net')
  })
  it('rejects a non-uuid role', () => {
    expect(inviteMemberSchema.safeParse({ email: 'a@b.com', roleId: 'x' }).success).toBe(false)
  })
})

describe('acceptInvitationSchema', () => {
  it('accepts a non-empty token and rejects blank', () => {
    expect(acceptInvitationSchema.safeParse({ token: 'abc123' }).success).toBe(true)
    expect(acceptInvitationSchema.safeParse({ token: '' }).success).toBe(false)
  })
})
