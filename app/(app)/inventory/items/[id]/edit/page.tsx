import Link from 'next/link'
import type { Route } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getItem, listFamilies, listBrands, listUnits } from '@/features/inventory/server/queries'
import { ItemForm } from '@/features/inventory/components/item-form'
import { Icon } from '@/components/ui'
import styles from '@/features/inventory/components/inventory.module.scss'

export const metadata = { title: 'Edit Item · Watcon' }

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getActionContext()
  if (!ctx.has('inventory.edit') && !ctx.has('items.edit')) redirect(`/inventory/items/${id}`)

  const [item, families, brands, units] = await Promise.all([getItem(id), listFamilies(), listBrands(), listUnits()])
  if (!item) notFound()

  return (
    <main className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link
              href={`/inventory/items/${id}` as Route}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Icon name="arrow-left" size={13} />
              {item.name}
            </Link>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 32, letterSpacing: '0.02em', color: 'var(--c-ink)', lineHeight: 1.1 }}>
            Edit Item
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', marginTop: 6 }}>
            {item.sku ?? id.slice(0, 8)} · Last updated {new Date(item.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
      <ItemForm
        mode="edit" itemId={id}
        families={families} brands={brands} units={units}
        defaultValues={{
          name: item.name, sku: item.sku ?? undefined, barcode: item.barcode ?? undefined,
          variantLabel: item.variantLabel ?? undefined, description: item.description ?? undefined,
          familyId: item.familyId ?? undefined, brandId: item.brandId ?? undefined, unitId: item.unitId ?? undefined,
          hsnCode: item.hsnCode ?? undefined, gstRate: item.gstRate,
          purchasePrice: item.purchasePrice ?? undefined, sellingPrice: item.sellingPrice ?? undefined,
          costPrice: item.costPrice ?? undefined,
          minStock: item.minStock, reorderLevel: item.reorderLevel, maxStock: item.maxStock,
          leadTimeDays: item.leadTimeDays, deliveryDays: item.deliveryDays ?? undefined,
          weightKg: item.weightKg ?? undefined,
          dimensions: item.dimensions
            ? { ...item.dimensions, unit: (item.dimensions.unit ?? 'cm') as 'm' | 'cm' | 'mm' | 'inch' }
            : undefined,
          tags: item.tags, notes: item.notes ?? undefined,
          isActive: item.isActive, isImported: item.isImported,
          importCurrency: item.importCurrency as any, importPrice: item.importPrice ?? undefined,
          exchangeRate: item.exchangeRate ?? undefined, importDiscountPct: item.importDiscountPct ?? undefined,
          transportType: item.transportType as any, transportValue: item.transportValue ?? undefined,
          customDutyPct: item.customDutyPct ?? undefined, profitMultiplier: item.profitMultiplier ?? undefined,
        }}
      />
    </main>
  )
}
