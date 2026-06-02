'use client'

import Link from 'next/link'
import { PageActions } from '@/components/app-shell/page-actions'

export function VendorTopbarAction({ canCreate }: { canCreate: boolean }) {
  if (!canCreate) return null
  return (
    <PageActions>
      <Link
        href="/vendors/new"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--c-ink)', color: 'var(--c-inverse)',
          border: '1px solid var(--c-ink)', padding: '8px 18px',
          fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          textDecoration: 'none', borderRadius: 'var(--radius-sm)',
        }}
      >
        + New Vendor
      </Link>
    </PageActions>
  )
}
