import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { listFamilies, listBrands, listUnits } from '@/features/inventory/server/queries'
import { ItemForm } from '@/features/inventory/components/item-form'
import { Icon } from '@/components/ui'
import styles from '@/features/inventory/components/inventory.module.scss'

export const metadata = { title: 'New Item · Watcon' }

export default async function NewItemPage() {
  const ctx = await getActionContext()
  if (!ctx.has('inventory.create') && !ctx.has('items.create')) redirect('/inventory/items')

  const [families, brands, units] = await Promise.all([listFamilies(), listBrands(), listUnits()])

  return (
    <main className={styles.page}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link
              href={'/inventory/items' as Route}
              style={{
                fontFamily: 'var(--font-body)', fontSize: 12,
                color: 'var(--c-tertiary)', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                transition: 'color 120ms',
              }}
            >
              <Icon name="arrow-left" size={13} />
              Inventory
            </Link>
          </div>
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 32,
            letterSpacing: '0.02em', color: 'var(--c-ink)', lineHeight: 1.1,
          }}>
            New Item
          </div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 12,
            color: 'var(--c-tertiary)', marginTop: 6,
          }}>
            Add a new item to your inventory catalogue.
          </div>
        </div>
      </div>

      <ItemForm mode="create" families={families} brands={brands} units={units} />
    </main>
  )
}
