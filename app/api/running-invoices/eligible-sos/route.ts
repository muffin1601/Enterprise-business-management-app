import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { getActionContext } from '@/lib/auth/action-context'

export async function GET(req: Request) {
  try {
    const ctx = await getActionContext()
    if (!ctx.has('running_bill.create')) return NextResponse.json([], { status: 403 })

    const url    = new URL(req.url)
    const search = url.searchParams.get('q') ?? ''
    const soId   = url.searchParams.get('soId')

    const orgId    = await getActiveOrgId()
    const supabase = await createSupabaseServerClient()

    // Any active (non-cancelled) SO — RI eligibility is driven by delivered,
    // unbilled challans (counted below), not by SO status.
    let q = supabase
      .from('sales_orders')
      .select('id,so_no,status,customer_id,customers(id,name)')
      .eq('org_id', orgId!)
      .neq('status', 'cancelled')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(100)

    if (search) {
      const t = search.replace(/[%_]/g, '\\$&').trim()
      q = q.or(`so_no.ilike.%${t}%`)
    }
    if (soId) q = q.eq('id', soId)

    const { data: sos } = await q

    // For each SO, count undelivered+unbilled challans
    const soIds = (sos ?? []).map(s => s.id as string)
    const dcCountBySo: Record<string, number> = {}
    if (soIds.length > 0) {
      const { data: dcs } = await supabase
        .from('delivery_challans')
        .select('so_id').eq('org_id', orgId!).in('so_id', soIds)
        .eq('status', 'delivered').is('invoiced_at', null).is('deleted_at', null)
      for (const dc of dcs ?? []) {
        const sid = dc.so_id as string
        dcCountBySo[sid] = (dcCountBySo[sid] ?? 0) + 1
      }
    }

    return NextResponse.json(
      (sos ?? [])
        .filter(s => (dcCountBySo[s.id as string] ?? 0) > 0)
        .map(s => {
          const cust = s.customers as unknown as { name: string } | null
          return { id: s.id, soNo: s.so_no, customerName: cust?.name ?? null, status: s.status, dcCount: dcCountBySo[s.id as string] ?? 0 }
        })
    )
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
