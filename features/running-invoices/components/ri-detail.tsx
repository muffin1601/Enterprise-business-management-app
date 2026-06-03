'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { RiDetail } from '../server/queries'
import { RiHeaderCard }        from './ri-header-card'
import { RiFinancialsCard }    from './ri-financials-card'
import { RiItemsTab }          from './ri-items-tab'
import { RiSourcesTab }        from './ri-sources-tab'
import { RiValidationTab }     from './ri-validation-tab'
import { RiStatusHistoryTab }  from './ri-status-history-tab'
import { RiStatusActions }     from './ri-status-actions'
import { Icon } from '@/components/ui'
import styles from './running-invoices.module.scss'

type Tab = 'items' | 'sources' | 'validation' | 'history'

interface Props {
  ri:        RiDetail
  canEdit:   boolean
  canPost:   boolean
  canDelete: boolean
}

export function RiDetailView({ ri, canEdit, canPost, canDelete }: Props) {
  const [tab, setTab] = useState<Tab>('items')

  return (
    <div className={styles.detailLayout}>
      <nav className={styles.breadcrumb}>
        <Link href="/running-invoices" className={styles.breadcrumbLink}>Running Invoices</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{ri.riNo}</span>
      </nav>

      <div className={styles.detailTop}>
        <div className={styles.detailMain}>
          <RiHeaderCard ri={ri} />
          <RiStatusActions
            riId={ri.id} status={ri.status}
            canEdit={canEdit} canPost={canPost} canDelete={canDelete}
          />
        </div>
        <div className={styles.detailSide}>
          <RiFinancialsCard ri={ri} />
          <Link
            href={`/running-invoices/${ri.id}/preview` as Route}
            className={styles.btnSecondary}
            style={{ marginTop:12, display:'flex', alignItems:'center', gap:6 }}
          >
            <Icon name="file-text" size={14} /> Preview / Print
          </Link>
        </div>
      </div>

      <div className={styles.tabs}>
        {(['items','sources','validation','history'] as Tab[]).map(t => (
          <button key={t} type="button"
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'items'       ? `Line Items (${ri.items.length})`
              : t === 'sources'  ? `Source Challans (${ri.challans.length})`
              : t === 'validation' ? 'Validation'
              : 'Status History'}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === 'items'      && <RiItemsTab       ri={ri} />}
        {tab === 'sources'    && <RiSourcesTab      ri={ri} canEdit={canEdit} />}
        {tab === 'validation' && <RiValidationTab   riId={ri.id} status={ri.status} canEdit={canEdit} />}
        {tab === 'history'    && <RiStatusHistoryTab history={ri.statusHistory} />}
      </div>

      {ri.internalNotes && (
        <div className={styles.internalNotes}>
          <span className={styles.metaLabel}>Internal Notes (Staff Only)</span>
          <p className={styles.notesText}>{ri.internalNotes}</p>
        </div>
      )}
    </div>
  )
}
