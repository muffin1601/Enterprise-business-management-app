import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { createQuote } from '@/features/quotes/server/actions'

export const metadata = { title: 'New Quote · Watcon' }

// This page runs server-side: creates a draft quote then immediately redirects
// to the editor. revalidatePath is NOT called inside createQuote to comply with
// Next.js 15 which forbids revalidatePath during render.
export default async function NewQuotePage() {
  const ctx = await getActionContext()
  if (!ctx.has('quotes.create')) redirect('/quotes')

  const today = new Date().toISOString().split('T')[0]!

  const result = await createQuote({
    date:              today,
    status:            'draft',
    gstMode:           'add',
    gstPct:            18,
    transport:         0,
    includeBoqSummary: true,
    terms:             [],
  })

  if (result.ok) {
    redirect(`/quotes/${result.data.id}/edit`)
  }

  // createQuote failed — show inline error (rare)
  return (
    <main style={{ padding: '48px 32px', fontFamily: 'var(--font-body)' }}>
      <div style={{
        padding: '14px 18px',
        background: 'var(--c-danger-bg)', color: 'var(--c-danger)',
        border: '1px solid var(--c-danger)', borderLeft: '3px solid var(--c-danger)',
        borderRadius: 'var(--radius-sm)', fontSize: 14,
      }}>
        Could not create quote: {result.error.message}
      </div>
    </main>
  )
}
