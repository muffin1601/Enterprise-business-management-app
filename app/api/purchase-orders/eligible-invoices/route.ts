import { NextResponse } from 'next/server'
import { getEligibleInvoicesForPo } from '@/features/purchase-orders/server/queries'
import { getActionContext } from '@/lib/auth/action-context'

export async function GET(req: Request) {
  try {
    const ctx = await getActionContext()
    if (!ctx.has('purchase_orders.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url    = new URL(req.url)
    const search = url.searchParams.get('q') ?? undefined
    const page   = Number(url.searchParams.get('page') ?? '1')
    const limit  = Number(url.searchParams.get('limit') ?? '20')
    const result = await getEligibleInvoicesForPo(search, page, limit)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 200 })
  }
}
