'use client'

/**
 * AICreditChip — Navbar AI credit summary.
 *
 * Spec: docs/UI_UX.md §5.6 — `✨ 1,234` + hover tooltip breakdown.
 * Data: GET /api/v1/ai/usage  (assumed summary { totalCredits, chat, pdf, resetAt }).
 * TODO: replace inline tooltip with `@/components/ui/tooltip` once F1 ships it.
 */

import * as React from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface UsageSummary {
  totalCredits: number
  chat?: number
  pdf?: number
  resetAt?: string
}

async function fetchUsage(): Promise<UsageSummary | null> {
  const res = await fetch('/api/v1/ai/usage', { credentials: 'include' })
  if (!res.ok) return null
  const data = (await res.json()) as Partial<UsageSummary> & {
    summary?: Partial<UsageSummary>
  }
  const s = data.summary ?? data
  return {
    totalCredits: Number(s.totalCredits ?? 0),
    chat: typeof s.chat === 'number' ? s.chat : undefined,
    pdf: typeof s.pdf === 'number' ? s.pdf : undefined,
    resetAt: typeof s.resetAt === 'string' ? s.resetAt : undefined,
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

function formatDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function AICreditChip() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai', 'usage', 'summary'],
    queryFn: fetchUsage,
    staleTime: 60_000,
  })

  const credits = data?.totalCredits ?? 0
  const reset = formatDate(data?.resetAt)

  return (
    <div className="relative group">
      <Link
        href="/billing/ai-usage"
        aria-label={`Sisa kredit AI: ${formatNumber(credits)}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 h-8',
          'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text))]',
          'text-xs font-medium hover:bg-[rgb(var(--border))]',
          'transition-colors',
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-[rgb(var(--accent))]" />
        <span>{isLoading ? '…' : formatNumber(credits)}</span>
      </Link>
      <div
        role="tooltip"
        className={cn(
          'pointer-events-none absolute right-0 top-full mt-2 z-[500] w-56',
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          'transition-opacity duration-150',
          'rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
          'p-3 text-xs shadow-md',
        )}
      >
        <p className="font-semibold text-[rgb(var(--text))]">
          AI Credits: {formatNumber(credits)}
        </p>
        {(data?.chat !== undefined || data?.pdf !== undefined) && (
          <p className="mt-1 text-[rgb(var(--text-muted))]">
            Bulan ini: {data?.chat ?? 0} chat, {data?.pdf ?? 0} PDF
          </p>
        )}
        {reset && (
          <p className="mt-1 text-[rgb(var(--text-muted))]">Reset: {reset}</p>
        )}
        <p className="mt-2 text-[rgb(var(--accent))]">Lihat detail →</p>
      </div>
    </div>
  )
}

export default AICreditChip
