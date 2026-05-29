import { describe, it, expect } from 'vitest'
import {
  updateProfileSchema,
  changePasswordSchema,
  userRoleSchema,
  setUserStatusSchema,
} from '@/validations/user'

const UUID = '00000000-0000-4000-8000-000000000000'

describe('updateProfileSchema', () => {
  it('accepts a name with optional fields left blank', () => {
    const r = updateProfileSchema.safeParse({ fullName: 'Asha Rao', phone: '', avatarUrl: '' })
    expect(r.success).toBe(true)
  })

  it('requires a full name', () => {
    const r = updateProfileSchema.safeParse({ fullName: '   ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.fullName).toBeDefined()
  })

  it('accepts a valid phone and rejects a malformed one', () => {
    expect(updateProfileSchema.safeParse({ fullName: 'A', phone: '+91 98765 43210' }).success).toBe(true)
    const bad = updateProfileSchema.safeParse({ fullName: 'A', phone: 'abc' })
    expect(bad.success).toBe(false)
    if (!bad.success) expect(bad.error.flatten().fieldErrors.phone).toBeDefined()
  })

  it('rejects a non-URL avatar but allows empty', () => {
    expect(updateProfileSchema.safeParse({ fullName: 'A', avatarUrl: '' }).success).toBe(true)
    expect(updateProfileSchema.safeParse({ fullName: 'A', avatarUrl: 'not-a-url' }).success).toBe(false)
    expect(
      updateProfileSchema.safeParse({ fullName: 'A', avatarUrl: 'https://cdn.example.com/a.png' }).success,
    ).toBe(true)
  })
})

describe('changePasswordSchema', () => {
  it('accepts matching passwords ≥ 8 chars', () => {
    const r = changePasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'longenough' })
    expect(r.success).toBe(true)
  })

  it('rejects a short password', () => {
    const r = changePasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.password).toBeDefined()
  })

  it('flags a mismatch on confirmPassword', () => {
    const r = changePasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'different1' })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.flatten().fieldErrors.confirmPassword).toContain('Passwords do not match')
  })
})

describe('userRoleSchema', () => {
  it('accepts two uuids', () => {
    expect(userRoleSchema.safeParse({ userId: UUID, roleId: UUID }).success).toBe(true)
  })
  it('rejects a non-uuid', () => {
    expect(userRoleSchema.safeParse({ userId: 'x', roleId: UUID }).success).toBe(false)
  })
})

describe('setUserStatusSchema', () => {
  it('accepts a uuid + boolean', () => {
    expect(setUserStatusSchema.safeParse({ userId: UUID, active: false }).success).toBe(true)
  })
  it('rejects a non-boolean active', () => {
    expect(setUserStatusSchema.safeParse({ userId: UUID, active: 'no' }).success).toBe(false)
  })
})
