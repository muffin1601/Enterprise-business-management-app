import { z } from 'zod'

/** Shared primitives reused across feature schemas (ARCHITECTURE.md §10). */

export const email = z.string().trim().toLowerCase().email('Enter a valid email address')

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt/Supabase limit

export const uuid = z.string().uuid()

export const nonEmpty = (label = 'This field') =>
  z.string().trim().min(1, `${label} is required`)

/** URL/sub-domain handle: lowercase alphanumeric + hyphens. */
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens')

/** India GSTIN — 15 chars. Optional fields should call `.optional()`. */
export const gstin = z
  .string()
  .trim()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN')

export const pan = z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN')

export const phone = z.string().trim().regex(/^[+]?[0-9\s-]{7,15}$/, 'Invalid phone number')
