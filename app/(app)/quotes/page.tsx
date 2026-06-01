import { Suspense } from 'react'
import { getActionContext } from '@/lib/auth/action-context'
import { listQuotes } from '@/features/quotes/server/queries'
import { quoteFilterSchema } from '@/validations/quote'
import { QuoteFilters } from '@/features/quotes/components/quote-cards'
import { QuoteListClient } from '@/features/quotes/components/quote-list-client'
import { QuoteTopbarAction } from '@/features/quotes/components/quote-topbar-action'

export const metadata = { title: 'Quotes · Watcon' }

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp     = await searchParams
  const parsed = quoteFilterSchema.safeParse(sp)
  const filter = parsed.success ? parsed.data : quoteFilterSchema.parse({})

  const ctx = await getActionContext()

  if (!ctx.has('quotes.view')) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
        <div style={{ padding:'14px 18px', background:'var(--c-danger-bg)', color:'var(--c-danger)', border:'1px solid var(--c-danger)', borderLeft:'3px solid var(--c-danger)', borderRadius:'var(--radius-sm)', fontSize:'var(--fs-500)' }}>
          You do not have permission to view quotes.
        </div>
      </main>
    )
  }

  const page = await listQuotes(filter)

  return (
    <main style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:'var(--font-body)' }}>
      {ctx.has('quotes.create') && <QuoteTopbarAction />}

      <Suspense>
        <QuoteFilters total={page.total} />
      </Suspense>

      <Suspense fallback={
        <div style={{ padding:'60px 0', textAlign:'center', fontFamily:'var(--font-body)', fontSize:'var(--fs-400)', color:'var(--c-tertiary)', letterSpacing:'0.08em' }}>Loading…</div>
      }>
        <QuoteListClient
          page={page}
          canEdit={ctx.has('quotes.edit')}
          canDelete={ctx.has('quotes.delete') || ctx.has('quotes.edit')}
        />
      </Suspense>
    </main>
  )
}
