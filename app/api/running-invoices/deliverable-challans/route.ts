import { NextResponse } from 'next/server'
import { getActionContext } from '@/lib/auth/action-context'
import { getDeliverableChallansForSo } from '@/features/running-invoices/server/queries'

export async function GET(req: Request) {
  try {
    const ctx = await getActionContext()
    if (!ctx.has('running_bill.create')) return NextResponse.json([], { status: 403 })
    const url   = new URL(req.url)
    const soId  = url.searchParams.get('soId')
    if (!soId) return NextResponse.json([], { status: 400 })
    const challans = await getDeliverableChallansForSo(soId)
    return NextResponse.json(challans)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
