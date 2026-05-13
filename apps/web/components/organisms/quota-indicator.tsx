'use client'

/**
 * QuotaIndicator — Navbar PDF quota mini-progress.
 *
 * Spec: docs/UI_UX.md §5.5 — `📥 47/100` PDF, hover shows AI chat too,
 * click → /billing/usage.
 * Data: GET /api/v1/subscriptions/me/quota
 *       Falls back gracefully if endpoint is missing or returns 4xx.
 * TODO: replace inline tooltip with `@/components/ui/tooltip` once F1 ships it.
 */

import * as React from 'react'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface Quota {
  pdfUsed: number
  pdfLimit: number
  chatUsed?: number
  chatLimit?: number
}

async function fetchQuota(): Promise<Quota | null> {
  const res = await fetch('/api/v1/subscriptions/me/quota', {
    credentials: 'include',
  })
  if (!res.ok) return null
  const raw = (await res.json()) as {
    pdf?: { used?: number; limit?: number }
    chat?: { used?: number; limit?: number }
    pdfUsed?: number
    pdfLimit?: number
  }
  return {
    pdfUsed: Number(raw.pdf?.used ?? raw.pdfUsed ?? 0),
    pdfLimit: Number(raw.pdf?.limit ?? raw.pdfLimit ?? 0),
    chatUsed: raw.chat?.used,
    chatLimit: raw.chat?.limit,
  }
}

export function QuotaIndicator() {
  const { data, isLoading } = useQuery({
    queryKey: ['subscription', 'quota'],
    queryFn: fetchQuota,
    staleTime: 60_000,
  })

  const used = data?.pdfUsed ?? 0
  const limit = data?.pdfLimit ?? 0
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const tone =
    pct >= 90
      ? 'text-[rgb(var(--danger))]'
      : pct >= 70
        ? 'text-[rgb(var(--warning))]'
        : 'text-[rgb(var(--text))]'

  return (
    <div className="relative group">
      <Link
        href="/billing/usage"
        aria-label={`Kuota PDF: ${used} dari ${limit}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 h-8',
          'bg-[rgb(var(--bg-elevated))] hover:bg-[rgb(var(--border))]',
          'text-xs font-medium transition-colors',
          tone,
        )}
      >
        <Inbox className="h-3.5 w-3.5 text-[rgb(var(--sidebar-icon))]" />
        <span>
          {isLoading ? '…/…' : `${used}/${limit || '∞'}`}
        </span>
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
        <p className="font-semibold text-[rgb(var(--text))]">Kuota Bulan Ini</p>
        <p className="mt-1 text-[rgb(var(--text-muted))]">
          PDF: {used} / {limit || '∞'}
        </p>
        {data?.chatLimit !== undefined && (
          <p className="text-[rgb(var(--text-muted))]">
            AI Chat: {data.chatUsed ?? 0} / {data.chatLimit}
          </p>
        )}
        <p className="mt-2 text-[rgb(var(--accent))]">Lihat penggunaan →</p>
      </div>
    </div>
  )
}

export default QuotaIndicator
