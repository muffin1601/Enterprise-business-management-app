import Link from 'next/link'
import type { Route } from 'next'
import { getActionContext } from '@/lib/auth/action-context'
import { listBrands, listFamilies, listUnits } from '@/features/items/server/queries'
import { LookupsManager } from '@/features/items/components/lookups-manager'
import styles from '@/features/items/components/items.module.scss'

export const metadata = { title: 'Catalogue Settings · Watcon' }

export default async function LookupsPage() {
  const ctx = await getActionContext()
  const canManage = ctx.has('items.create') || ctx.has('items.edit')

  if (!canManage) {
    return (
      <main className={styles.page}>
        <div style={{
          padding: '14px 18px',
          background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
          border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-500)',
        }}>
          You do not have permission to manage catalogue settings.
        </div>
      </main>
    )
  }

  const [families, brands, units] = await Promise.all([listFamilies(), listBrands(), listUnits()])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Link href="/items" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)', textDecoration: 'none' }}>
              ← Items
            </Link>
          </div>
          <div className={styles.title}>Catalogue Settings</div>
          <div className={styles.subtitle}>Manage categories, brands, and units of measure.</div>
        </div>
      </header>
      <LookupsManager families={families} brands={brands} units={units} />
    </main>
  )
}
