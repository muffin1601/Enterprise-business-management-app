import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveOrgId } from '@/lib/auth/session'
import { getActionContext } from '@/lib/auth/action-context'

export async function GET(req: Request) {
  try {
    const ctx = await getActionContext()
    if (!ctx.has('challans.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url    = new URL(req.url)
    const search = url.searchParams.get('q') ?? ''
    const page   = Number(url.searchParams.get('page') ?? '1')
    const limit  = Number(url.searchParams.get('limit') ?? '20')

    const orgId    = await getActiveOrgId()
    const supabase = await createSupabaseServerClient()

    let q = supabase
      .from('invoices')
      .select('id,invoice_no,subject,grand_total,date,customers(id,name)')
      .eq('org_id', orgId!)
      .eq('status', 'issued')
      .is('deleted_at', null)
      .order('date', { ascending: false })

    if (search) {
      const t = search.replace(/[%_]/g, '\\$&').trim()
      q = q.or(`invoice_no.ilike.%${t}%,subject.ilike.%${t}%`)
    }

    const { data } = await q.limit(500)

    const items = (data ?? []).map(r => {
      const cust = r.customers as unknown as { name: string } | null
      return {
        id:           r.id,
        invoiceNo:    r.invoice_no,
        subject:      r.subject,
        customerName: cust?.name ?? null,
        grandTotal:   Number(r.grand_total) || 0,
        date:         r.date,
      }
    })

    const total = items.length
    const from  = (page - 1) * limit
    return NextResponse.json({ items: items.slice(from, from + limit), total })
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 200 })
  }
}
