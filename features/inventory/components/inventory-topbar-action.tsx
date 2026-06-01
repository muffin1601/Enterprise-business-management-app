'use client'

import Link from 'next/link'
import { PageActions } from '@/components/app-shell/page-actions'
import styles from './inventory.module.scss'

export function InventoryTopbarAction({ href = '/inventory/items/new', label = '+ New Item' }: { href?: string; label?: string }) {
  return (
    <PageActions>
      <Link href={href as import('next').Route} className={styles.btnPrimary}>{label}</Link>
    </PageActions>
  )
}
