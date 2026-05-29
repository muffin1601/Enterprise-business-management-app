'use client'

import { useQuery } from '@tanstack/react-query'
import type {
  DashboardActivity,
  DashboardNotices,
  DashboardOverview,
} from '@/features/dashboard/server/queries'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

/** Shared across KPI/Org/User widgets — one fetch, deduped by React Query. */
export function useOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => fetchJson<DashboardOverview>('/api/dashboard/overview'),
  })
}

export function useActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => fetchJson<DashboardActivity>('/api/dashboard/activity'),
  })
}

export function useNotices() {
  return useQuery({
    queryKey: ['dashboard', 'notices'],
    queryFn: () => fetchJson<DashboardNotices>('/api/dashboard/notices'),
  })
}
