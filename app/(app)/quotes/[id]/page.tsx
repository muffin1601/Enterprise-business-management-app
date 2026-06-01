import { notFound, redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import { getQuote } from '@/features/quotes/server/queries'

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [ctx, quote] = await Promise.all([
    getActionContext(),
    getQuote(id),
  ])

  if (!quote) notFound()

  if (ctx.has('quotes.edit')) {
    redirect(`/quotes/${id}/edit`)
  }

  redirect(`/quotes/${id}/preview`)
}
