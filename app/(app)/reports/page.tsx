import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { stockReportFilterSchema, type ReportView } from '@/validations/stock-report'
import {
  getCurrentStockReport,
  getLowStockReport,
  getValuationReport,
  getMovementLedger,
  getItemMovementSummary,
  getDispatchSummary,
  getTopItemsByValue,
} from '@/features/stock-reports/server/queries'
import { StockReportShell } from '@/features/stock-reports/components/stock-report-shell'

export const metadata = { title: 'Stock Reports · Watcon' }

export default async function StockReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await getActionContext()
  if (!ctx.has('stock_report.view')) redirect('/dashboard')

  const sp     = await searchParams
  const parsed = stockReportFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : stockReportFilterSchema.parse({})

  const view = filter.view as ReportView

  // Fetch lookups for filter dropdowns
  const orgId    = await getActiveOrgId()
  const supabase = await createSupabaseServerClient()

  const [{ data: fams }, { data: brands }] = await Promise.all([
    supabase.from('item_families').select('id,name').eq('org_id', orgId!).is('deleted_at', null).order('name'),
    supabase.from('brands').select('id,name').eq('org_id', orgId!).is('deleted_at', null).order('name'),
  ])

  const families = (fams ?? []).map(f => ({ id: f.id as string, name: f.name as string }))
  const brandsList = (brands ?? []).map(b => ({ id: b.id as string, name: b.name as string }))

  // Fetch only the active view's data (parallel where independent)
  const [
    currentResult, lowStockRows, valResult, movResult, itemMovRows, dispResult, chartData,
  ] = await Promise.all([
    view === 'current'        ? getCurrentStockReport(filter)   : null,
    view === 'low_stock'      ? getLowStockReport()              : null,
    view === 'valuation'      ? getValuationReport(filter)       : null,
    view === 'movements'      ? getMovementLedger(filter)        : null,
    view === 'item_movements' ? getItemMovementSummary(filter)   : null,
    view === 'dispatches'     ? getDispatchSummary(filter)       : null,
    view === 'current'        ? getTopItemsByValue(10)           : null,
  ])

  return (
    <Suspense>
      <StockReportShell
        activeView={view}
        families={families}
        brands={brandsList}
        canExport={ctx.has('stock_report.export')}
        // Current stock
        currentRows={currentResult?.rows}
        currentTotal={currentResult?.total}
        // Low stock
        lowStockRows={lowStockRows ?? undefined}
        // Valuation
        valRows={valResult?.rows}
        valSummary={valResult?.summary}
        valTotal={valResult?.rows.length}
        // Movements
        movRows={movResult?.rows}
        movTotal={movResult?.total}
        // Item movements
        itemMovRows={itemMovRows ?? undefined}
        // Dispatches
        dispRows={dispResult?.rows}
        dispTotal={dispResult?.total}
        // Chart
        chartData={chartData ?? undefined}
      />
    </Suspense>
  )
}
