import { NextResponse } from 'next/server'
import { getActivity } from '@/features/dashboard/server/queries'
import { buildDailySeries } from '@/features/dashboard/series'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  try {
    return NextResponse.json(await getActivity(now))
  } catch {
    return NextResponse.json({ recent: [], series: buildDailySeries([], 14, now), canView: false })
  }
}
