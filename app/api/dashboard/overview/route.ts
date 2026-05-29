import { NextResponse } from 'next/server'
import { getOverview, type DashboardOverview } from '@/features/dashboard/server/queries'

export const dynamic = 'force-dynamic'

const EMPTY: DashboardOverview = {
  user: { fullName: '', email: '', roles: [] },
  org: { name: '', currency: 'INR', gstin: null, createdAt: new Date(0).toISOString(), ageDays: 0 },
  kpis: { members: 0, activeMembers: 0, pendingInvites: 0, rolesInUse: 0 },
  perms: { canManageUsers: false, canViewAudit: false },
}

export async function GET() {
  try {
    return NextResponse.json(await getOverview(new Date()))
  } catch {
    // Unauthenticated / schema not yet deployed → render empty states.
    return NextResponse.json(EMPTY)
  }
}
