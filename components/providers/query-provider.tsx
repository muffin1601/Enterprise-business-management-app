'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * TanStack Query provider for the protected app. One QueryClient per browser
 * session (lazy useState init so it isn't recreated on re-render). Mounted in
 * the (app) layout so every authenticated page can use React Query.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
