// Detail-pane back navigation button.
//
// Behaviour:
//   - If the URL has a `?from=` param (set by deep links / external nav), prefer
//     that destination so users return to where they came from.
//   - Otherwise fall back to `/figures` with the current filter query params
//     preserved (q, category, gender, page) so the list re-opens in the same
//     state. The `modal` and `from` params are stripped.
//
// Client component because we need access to `useRouter` for client-side nav
// (preserves scroll position on the list pane) and `useSearchParams` to read
// the filter context.

'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

const PRESERVED_FILTER_KEYS = ['q', 'category', 'gender', 'page'] as const

export interface BackButtonProps {
  /** Fallback base path; defaults to `/figures`. */
  fallbackHref?: string
  /** Optional label override (Indonesian default). */
  label?: string
  className?: string
}

export function BackButton({
  fallbackHref = '/figures',
  label = 'Kembali',
  className,
}: BackButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function buildHref(): string {
    const explicitFrom = searchParams.get('from')
    if (explicitFrom && explicitFrom.startsWith('/')) {
      // Trust same-origin paths only — never honour absolute URLs here.
      return explicitFrom
    }

    const next = new URLSearchParams()
    for (const key of PRESERVED_FILTER_KEYS) {
      const value = searchParams.get(key)
      if (value) next.set(key, value)
    }
    const qs = next.toString()
    return qs.length > 0 ? `${fallbackHref}?${qs}` : fallbackHref
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => router.push(buildHref())}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      <span>{label}</span>
    </Button>
  )
}
