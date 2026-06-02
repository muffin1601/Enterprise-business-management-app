'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { PoDetail } from '../server/queries'
import { PoHeaderCard }         from './po-header-card'
import { PoFinancialsCard }     from './po-financials-card'
import { PoItemsTab }           from './po-items-tab'
import { PoGrnTab }             from './po-grn-tab'
import { PoStatusHistoryTab }   from './po-status-history-tab'
import { PoStatusActions }      from './po-status-actions'
import { Icon } from '@/components/ui'
import styles from './purchase-orders.module.scss'

type Tab = 'items' | 'grn' | 'history'

interface Props {
  po:         PoDetail
  canEdit:    boolean
  canApprove: boolean
  canDelete:  boolean
  canReceive: boolean
}

export function PoDetail({ po, canEdit, canApprove, canDelete, canReceive }: Props) {
  const [tab, setTab] = useState<Tab>('items')

  return (
    <div className={styles.detailLayout}>
      <nav className={styles.breadcrumb}>
        <Link href="/purchase-orders" className={styles.breadcrumbLink}>Purchase Orders</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{po.poNo}</span>
      </nav>

      <div className={styles.detailTop}>
        <div className={styles.detailMain}>
          <PoHeaderCard po={po} />
          <PoStatusActions
            poId={po.id} status={po.status}
            canEdit={canEdit} canApprove={canApprove} canDelete={canDelete}
          />
        </div>
        <div className={styles.detailSide}>
          <PoFinancialsCard po={po} />
          <Link
            href={`/purchase-orders/${po.id}/preview` as Route}
            className={styles.btnSecondary}
            style={{ marginTop: 12, display:'flex', alignItems:'center', gap:6 }}
          >
            <Icon name="file-text" size={14} /> Preview / Print
          </Link>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'items' ? styles.tabActive : ''}`} onClick={() => setTab('items')} type="button">
          Line Items ({po.items.length})
        </button>
        <button className={`${styles.tab} ${tab === 'grn' ? styles.tabActive : ''}`} onClick={() => setTab('grn')} type="button">
          Goods Receipts ({po.grns.length})
        </button>
        <button className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`} onClick={() => setTab('history')} type="button">
          Status History
        </button>
      </div>

      <div className={styles.tabContent}>
        {tab === 'items'   && <PoItemsTab po={po} canEdit={canEdit && po.status === 'draft'} />}
        {tab === 'grn'     && <PoGrnTab   po={po} canReceive={canReceive} />}
        {tab === 'history' && <PoStatusHistoryTab history={po.statusHistory} />}
      </div>

      {po.internalNotes && (
        <div className={styles.internalNotes}>
          <span className={styles.metaLabel}>Internal Notes (Staff Only)</span>
          <p className={styles.notesText}>{po.internalNotes}</p>
        </div>
      )}
    </div>
  )
}
