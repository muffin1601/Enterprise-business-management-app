import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  magicLinkSchema,
  registerSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from '@/validations/auth'

describe('loginSchema', () => {
  it('accepts a valid email + password and normalizes email', () => {
    const r = loginSchema.safeParse({ email: '  Report@Watcon.NET ', password: 'secret123' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('report@watcon.net')
  })

  it('rejects an invalid email', () => {
    const r = loginSchema.safeParse({ email: 'nope', password: 'secret123' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.email).toBeDefined()
  })

  it('rejects an empty password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: '' })
    expect(r.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const base = {
    fullName: 'Asha Rao',
    email: 'asha@watcon.net',
    password: 'longenough',
    confirmPassword: 'longenough',
  }

  it('accepts a valid registration and normalizes email', () => {
    const r = registerSchema.safeParse({ ...base, email: '  Asha@Watcon.NET ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('asha@watcon.net')
  })

  it('requires a full name', () => {
    const r = registerSchema.safeParse({ ...base, fullName: '   ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.fullName).toBeDefined()
  })

  it('rejects a short password', () => {
    const r = registerSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.password).toBeDefined()
  })

  it('flags a password mismatch on confirmPassword', () => {
    const r = registerSchema.safeParse({ ...base, confirmPassword: 'different1' })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.flatten().fieldErrors.confirmPassword).toContain('Passwords do not match')
  })
})

describe('magicLinkSchema / requestPasswordResetSchema / resendVerificationSchema', () => {
  it('accept a valid email', () => {
    expect(magicLinkSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
    expect(requestPasswordResetSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
    expect(resendVerificationSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
  })
  it('reject a missing email', () => {
    expect(magicLinkSchema.safeParse({}).success).toBe(false)
    expect(resendVerificationSchema.safeParse({}).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('accepts matching passwords ≥ 8 chars', () => {
    const r = resetPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'longenough' })
    expect(r.success).toBe(true)
  })

  it('rejects a short password', () => {
    const r = resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.password).toBeDefined()
  })

  it('flags a mismatch on confirmPassword', () => {
    const r = resetPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'different1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.confirmPassword).toContain('Passwords do not match')
  })
})
