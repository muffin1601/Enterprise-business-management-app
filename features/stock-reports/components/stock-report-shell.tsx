'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import type { Route } from 'next'
import { Suspense } from 'react'
import type { ReportView } from '@/validations/stock-report'
import { REPORT_PAGE_SIZE } from '@/validations/stock-report'
import { StockReportNav }       from './stock-report-nav'
import { StockFilters }         from './stock-filters'
import { StockValueChart }      from './stock-chart'
import { CurrentStockTable }    from './current-stock-table'
import { LowStockTable }        from './low-stock-table'
import { ValuationTable }       from './valuation-table'
import { MovementLedgerTable }  from './movement-ledger-table'
import { ItemMovementSummary }  from './item-movement-summary'
import { DispatchSummaryTable } from './dispatch-summary-table'
import type {
  CurrentStockRow, LowStockRow, ValuationRow, ValuationSummary,
  MovementRow, ItemMovementRow, DispatchRow,
} from '../server/queries'
import styles from './stock-reports.module.scss'

interface Props {
  activeView:    ReportView
  families:      { id: string; name: string }[]
  brands:        { id: string; name: string }[]
  canExport:     boolean
  // Report data (only the active view's data is non-null)
  currentRows?:  CurrentStockRow[];  currentTotal?: number
  lowStockRows?: LowStockRow[]
  valRows?:      ValuationRow[];     valSummary?: ValuationSummary; valTotal?: number
  movRows?:      MovementRow[];      movTotal?: number
  itemMovRows?:  ItemMovementRow[]
  dispRows?:     DispatchRow[];      dispTotal?: number
  chartData?:    { name: string; purchaseValue: number; sellingValue: number }[]
}

export function StockReportShell({
  activeView, families, brands, canExport,
  currentRows = [], currentTotal = 0,
  lowStockRows = [],
  valRows = [], valSummary, valTotal = 0,
  movRows = [], movTotal = 0,
  itemMovRows = [],
  dispRows = [], dispTotal = 0,
  chartData = [],
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const currentPage = Number(sp.get('page') ?? '1')

  function setPage(p: number) {
    const next = new URLSearchParams(sp.toString())
    next.set('page', String(p))
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  const showStatus = activeView === 'current'
  const showDates  = ['movements', 'item_movements', 'dispatches'].includes(activeView)

  function getTotal() {
    if (activeView === 'current')        return currentTotal
    if (activeView === 'low_stock')      return lowStockRows.length
    if (activeView === 'valuation')      return valTotal
    if (activeView === 'movements')      return movTotal
    if (activeView === 'item_movements') return itemMovRows.length
    if (activeView === 'dispatches')     return dispTotal
    return 0
  }

  const totalPages = Math.ceil(getTotal() / REPORT_PAGE_SIZE)

  return (
    <div className={styles.shell}>
      <div className={styles.body}>
        {/* Left nav */}
        <aside className={styles.sidebar}>
          <Suspense>
            <StockReportNav activeView={activeView} />
          </Suspense>
        </aside>

        {/* Main report area */}
        <main className={styles.main}>
          {/* Filters */}
          <Suspense>
            <StockFilters
              view={activeView}
              families={families}
              brands={brands}
              showStatus={showStatus}
              showDates={showDates}
              total={getTotal()}
            />
          </Suspense>

          {/* Report table */}
          {activeView === 'current' && (
            <CurrentStockTable
              rows={currentRows}
              total={currentTotal}
              canExport={canExport}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}

          {activeView === 'low_stock' && (
            <LowStockTable rows={lowStockRows} canExport={canExport} />
          )}

          {activeView === 'valuation' && valSummary && (
            <ValuationTable
              rows={valRows}
              summary={valSummary}
              canExport={canExport}
              currentPage={currentPage}
              totalRows={valTotal}
            />
          )}

          {activeView === 'movements' && (
            <MovementLedgerTable
              rows={movRows}
              total={movTotal}
              canExport={canExport}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}

          {activeView === 'item_movements' && (
            <ItemMovementSummary rows={itemMovRows} canExport={canExport} />
          )}

          {activeView === 'dispatches' && (
            <DispatchSummaryTable
              rows={dispRows}
              total={dispTotal}
              canExport={canExport}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </main>
      </div>
    </div>
  )
}
