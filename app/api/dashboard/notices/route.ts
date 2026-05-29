import { NextResponse } from 'next/server'
import { getNotices } from '@/features/dashboard/server/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getNotices())
  } catch {
    return NextResponse.json({ invitations: [] })
  }
}
