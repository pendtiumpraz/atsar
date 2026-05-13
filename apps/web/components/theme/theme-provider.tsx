'use client'

import type { ReactNode } from 'react'
import { useTheme } from '@/hooks/use-theme'

/**
 * ThemeProvider — mounts the `useTheme` side effects (localStorage read,
 * `prefers-color-scheme` listener, `<html data-theme>` sync).
 *
 * Place this once near the root of the client tree. The actual initial value
 * is set by the anti-flash inline script in `app/layout.tsx`; this provider
 * keeps the document in sync after hydration and across system changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useTheme()
  return <>{children}</>
}
