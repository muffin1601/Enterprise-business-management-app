import { describe, it, expect } from 'vitest'
import { itemSchema, itemFilterSchema, unitSchema } from '@/validations/item'

describe('itemSchema', () => {
  it('accepts a minimal domestic item and coerces numeric strings', () => {
    const r = itemSchema.safeParse({ name: 'Tile 600x600', stock: '120', sellingPrice: '450.50' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.stock).toBe(120)
      expect(r.data.sellingPrice).toBe(450.5)
      expect(r.data.isImported).toBe(false)
    }
  })

  it('requires a name', () => {
    const r = itemSchema.safeParse({ name: '  ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.name).toBeDefined()
  })

  it('treats blank optional numbers as undefined (not 0)', () => {
    const r = itemSchema.safeParse({ name: 'X', purchasePrice: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.purchasePrice).toBeUndefined()
  })

  it('requires import price + exchange rate when isImported', () => {
    const bad = itemSchema.safeParse({ name: 'X', isImported: true })
    expect(bad.success).toBe(false)
    const ok = itemSchema.safeParse({ name: 'X', isImported: true, importPrice: '10', exchangeRate: '83' })
    expect(ok.success).toBe(true)
  })

  it('rejects a malformed image URL but allows blank', () => {
    expect(itemSchema.safeParse({ name: 'X', imageUrl: '' }).success).toBe(true)
    expect(itemSchema.safeParse({ name: 'X', imageUrl: 'nope' }).success).toBe(false)
  })
})

describe('itemFilterSchema', () => {
  it('applies defaults and coerces page', () => {
    const r = itemFilterSchema.parse({ page: '3' })
    expect(r.page).toBe(3)
    expect(r.imported).toBe('all')
    expect(r.lowStock).toBe(false)
  })

  it('parses lowStock=true from the URL string', () => {
    expect(itemFilterSchema.parse({ lowStock: 'true' }).lowStock).toBe(true)
  })
})

describe('unitSchema', () => {
  it('requires a code, name optional', () => {
    expect(unitSchema.safeParse({ code: 'SQM' }).success).toBe(true)
    expect(unitSchema.safeParse({ code: '' }).success).toBe(false)
  })
})
