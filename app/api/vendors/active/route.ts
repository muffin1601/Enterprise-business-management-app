import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { getActionContext } from '@/lib/auth/action-context'

export async function GET(req: Request) {
  try {
    const ctx = await getActionContext()
    if (!ctx.has('purchase_orders.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url    = new URL(req.url)
    const search = url.searchParams.get('q') ?? ''
    const limit  = Number(url.searchParams.get('limit') ?? '100')

    const orgId    = await getActiveOrgId()
    const supabase = await createSupabaseServerClient()

    let q = supabase
      .from('vendors')
      .select('id,code,name,type,payment_terms')
      .eq('org_id', orgId!)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name')
      .limit(limit)

    if (search) {
      const t = search.replace(/[%_]/g, '\\$&').trim()
      q = q.or(`name.ilike.%${t}%,code.ilike.%${t}%`)
    }

    const { data } = await q

    return NextResponse.json(
      (data ?? []).map(r => ({
        id:           r.id,
        code:         r.code,
        name:         r.name,
        type:         r.type,
        paymentTerms: r.payment_terms,
      }))
    )
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
