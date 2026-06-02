'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { DcDetail } from '../server/queries'
import { DcHeaderCard }         from './dc-header-card'
import { DcItemsTab }           from './dc-items-tab'
import { DcDispatchTab }        from './dc-dispatch-tab'
import { DcStatusHistoryTab }   from './dc-status-history-tab'
import { DcStatusActions }      from './dc-status-actions'
import { Icon } from '@/components/ui'
import styles from './delivery-challans.module.scss'

type Tab = 'items' | 'dispatch' | 'history'

interface Props {
  dc:        DcDetail
  canEdit:   boolean
  canPost:   boolean
  canDelete: boolean
}

export function DcDetailView({ dc, canEdit, canPost, canDelete }: Props) {
  const [tab, setTab] = useState<Tab>('items')

  return (
    <div className={styles.detailLayout}>
      <nav className={styles.breadcrumb}>
        <Link href="/delivery-challans" className={styles.breadcrumbLink}>Delivery Challans</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{dc.dcNo}</span>
      </nav>

      <div className={styles.detailTop}>
        <div className={styles.detailMain}>
          <DcHeaderCard dc={dc} />
          <DcStatusActions
            dcId={dc.id} status={dc.status}
            canEdit={canEdit} canPost={canPost} canDelete={canDelete}
            stockDeducted={dc.stockDeducted}
          />
        </div>
        <div className={styles.detailSide}>
          <Link
            href={`/delivery-challans/${dc.id}/preview` as Route}
            className={styles.btnSecondary}
            style={{ display:'flex', alignItems:'center', gap:6 }}
          >
            <Icon name="file-text" size={14} /> Preview / Print
          </Link>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'items' ? styles.tabActive : ''}`} onClick={() => setTab('items')} type="button">
          Items ({dc.items.length})
        </button>
        <button className={`${styles.tab} ${tab === 'dispatch' ? styles.tabActive : ''}`} onClick={() => setTab('dispatch')} type="button">
          Dispatch Details
        </button>
        <button className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`} onClick={() => setTab('history')} type="button">
          Status History
        </button>
      </div>

      <div className={styles.tabContent}>
        {tab === 'items'    && <DcItemsTab       dc={dc} canEdit={canEdit && dc.status === 'draft'} />}
        {tab === 'dispatch' && <DcDispatchTab     dc={dc} canEdit={canEdit && dc.status === 'draft'} />}
        {tab === 'history'  && <DcStatusHistoryTab history={dc.statusHistory} />}
      </div>

      {dc.internalNotes && (
        <div className={styles.internalNotes}>
          <span className={styles.metaLabel}>Internal Notes (Staff Only)</span>
          <p className={styles.notesText}>{dc.internalNotes}</p>
        </div>
      )}
    </div>
  )
}
