// React-Query provider used by the root layout.
//
// One `QueryClient` per browser tab — created lazily via `useState` so the
// instance survives hot-reloads but isn't shared across server renders
// (which would leak data between users). Defaults tuned for the Atsar
// dashboard: 30s stale time keeps lists snappy without hammering the API,
// retries kept low so user-visible errors surface promptly.

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
