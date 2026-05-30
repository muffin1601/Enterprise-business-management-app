'use client'

import Link from 'next/link'
import { PageActions } from '@/components/app-shell/page-actions'
import styles from './customers.module.scss'

export function CustomerTopbarAction() {
  return (
    <PageActions>
      <Link href="/customers/new" className={styles.btnPrimary}>
        + New Customer
      </Link>
    </PageActions>
  )
}
