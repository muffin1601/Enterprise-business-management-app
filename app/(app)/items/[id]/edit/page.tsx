import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import {
  getItem, getOrgCurrency, listBrands, listFamilies, listUnits,
} from '@/features/items/server/queries'
import type { ItemInput } from '@/validations/item'
import { ItemForm } from '@/features/items/components/item-form'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'Edit Item · Watcon' }

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getActionContext()

  if (!ctx.has('items.edit')) {
    return (
      <main className={styles.page}>
        <div style={{
          padding: '14px 18px',
          background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to edit items.
        </div>
      </main>
    )
  }

  const [item, families, brands, units, currency] = await Promise.all([
    getItem(id), listFamilies(), listBrands(), listUnits(), getOrgCurrency(),
  ])
  if (!item) notFound()

  const defaultValues: Partial<ItemInput> = {
    name: item.name,
    sku: item.sku ?? '',
    familyId: item.familyId ?? '',
    brandId: item.brandId ?? '',
    unitId: item.unitId ?? '',
    variantLabel: item.variantLabel ?? '',
    imageUrl: item.imageUrl ?? '',
    isImported: item.isImported,
    deliveryDays: item.deliveryDays ?? undefined,
    stock: item.stock,
    purchasePrice: item.purchasePrice ?? undefined,
    sellingPrice: item.sellingPrice ?? undefined,
    importCurrency: (item.importCurrency as ItemInput['importCurrency']) ?? undefined,
    importPrice: item.importPrice ?? undefined,
    exchangeRate: item.exchangeRate ?? undefined,
    importDiscountPct: item.importDiscountPct ?? undefined,
    transportType: item.transportType ?? undefined,
    transportValue: item.transportValue ?? undefined,
    customDutyPct: item.customDutyPct ?? undefined,
    profitMultiplier: item.profitMultiplier ?? undefined,
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Link href={`/items/${id}` as Route} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', textDecoration: 'none' }}>
              ← {item.name}
            </Link>
          </div>
          <div className={styles.title}>Edit Item</div>
          <div className={styles.subtitle}>Update catalogue details, pricing or stock.</div>
        </div>
      </header>
      <ItemForm
        mode="edit"
        itemId={id}
        defaultValues={defaultValues}
        families={families}
        brands={brands}
        units={units}
        currency={currency}
      />
    </main>
  )
}
