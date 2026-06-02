'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { REPORT_VIEWS, type ReportView } from '@/validations/stock-report'
import styles from './stock-reports.module.scss'

const VIEW_ICONS: Record<ReportView, string> = {
  current:        'ti-box',
  low_stock:      'ti-alert-triangle',
  valuation:      'ti-currency-rupee',
  movements:      'ti-arrows-exchange',
  item_movements: 'ti-list',
  dispatches:     'ti-truck',
}

export function StockReportNav({ activeView }: { activeView: ReportView }) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  function navigate(view: ReportView) {
    const next = new URLSearchParams(sp.toString())
    next.set('view', view)
    next.delete('page')
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  return (
    <nav className={styles.reportNav}>
      {(Object.keys(REPORT_VIEWS) as ReportView[]).map(v => (
        <button
          key={v}
          type="button"
          className={`${styles.navItem} ${activeView === v ? styles.navItemActive : ''}`}
          onClick={() => navigate(v)}
        >
          <i className={`ti ${VIEW_ICONS[v]} ${styles.navIcon}`} />
          <span>{REPORT_VIEWS[v]}</span>
          {v === 'low_stock' && <span className={styles.alertDot} />}
        </button>
      ))}
    </nav>
  )
}
