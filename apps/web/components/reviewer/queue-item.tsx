// Single row in the reviewer queue (`/reviewer/queue` — WIREFRAMES §26).
//
// Renders a compact card with:
//   - content-type marker (figure ⌬ / battle ⚔)
//   - title (Arabic + Indonesian) and content type label
//   - "di-assign N jam lalu" — humanised relative time
//   - source-citation count (defaults to 0)
//   - aggregate AI confidence (average of citation confidence scores) when
//     at least one citation reports a score. The number lives on
//     `citations.confidenceScore` (see DATABASE §citations) — there's no
//     top-level confidence on figures/battles, so we average per-row.
//   - "Review →" CTA that navigates to `/review/[assignmentId]`.
//
// All copy is Indonesian (this surface is reviewer-only).

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Lightweight assignment + content shape rendered by the card. */
export interface QueueItemData {
  id: string
  contentType: 'figure' | 'battle' | string
  contentId: string
  assignedAt: string | Date | null
  status: 'pending' | 'in_progress' | 'completed' | string
  /** Title halves — supplied by the server page after joining the content row. */
  titleAr?: string | null
  titleId?: string | null
  /** Pre-counted to keep the card render cheap. */
  citationCount?: number
  /** Average AI confidence across citations (0..1). */
  aiConfidence?: number | null
}

export interface QueueItemProps {
  item: QueueItemData
  className?: string
}

const CONTENT_TYPE_GLYPH: Record<string, string> = {
  figure: '⌬',
  battle: '⚔',
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  figure: 'Tokoh',
  battle: 'Pertempuran',
}

/** Indonesian relative-time formatter — coarse buckets are enough here. */
function formatRelativeId(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  const ms = Date.now() - date.getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'baru saja'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return 'baru saja'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} hari lalu`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} bulan lalu`
  const years = Math.round(months / 12)
  return `${years} tahun lalu`
}

/** Map a 0..1 confidence to a tone label + colour token. */
function confidenceTone(score: number): { tone: string; cls: string } {
  if (score >= 0.85) return { tone: 'Tinggi', cls: 'text-emerald-600 dark:text-emerald-400' }
  if (score >= 0.6) return { tone: 'Sedang', cls: 'text-amber-600 dark:text-amber-400' }
  return { tone: 'Rendah', cls: 'text-rose-600 dark:text-rose-400' }
}

export function QueueItem({ item, className }: QueueItemProps) {
  const glyph = CONTENT_TYPE_GLYPH[item.contentType] ?? '◆'
  const typeLabel = CONTENT_TYPE_LABEL[item.contentType] ?? item.contentType
  const title = item.titleId || item.titleAr || `(tanpa judul) · ${item.contentId.slice(0, 8)}`
  const citationCount = item.citationCount ?? 0
  const href = `/review/${item.id}`

  const confidencePct =
    typeof item.aiConfidence === 'number' && Number.isFinite(item.aiConfidence)
      ? Math.round(item.aiConfidence * 100)
      : null
  const confidenceMeta = confidencePct != null ? confidenceTone(item.aiConfidence ?? 0) : null

  return (
    <article
      className={cn(
        'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition-colors',
        'hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 text-2xl leading-none text-[rgb(var(--accent))]"
        >
          {glyph}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
                {title}
              </div>
              {item.titleAr ? (
                <div
                  lang="ar"
                  dir="rtl"
                  className="truncate text-base text-[rgb(var(--text-muted))]"
                  style={{ fontFamily: 'var(--font-body-arab)' }}
                >
                  {item.titleAr}
                </div>
              ) : null}
            </div>

            <Badge variant="secondary" className="shrink-0">
              {typeLabel}
            </Badge>
          </div>

          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
            <div className="flex items-center gap-1">
              <dt className="sr-only">Waktu di-assign</dt>
              <dd>di-assign {formatRelativeId(item.assignedAt)}</dd>
            </div>
            <div className="flex items-center gap-1">
              <dt className="sr-only">Jumlah sumber</dt>
              <dd>
                Sumber: {citationCount} citation
                {citationCount === 1 ? '' : 's'}
              </dd>
            </div>
            {confidenceMeta && confidencePct != null ? (
              <div className="flex items-center gap-1">
                <dt className="sr-only">AI confidence</dt>
                <dd className={confidenceMeta.cls}>
                  AI confidence: {confidencePct}% ({confidenceMeta.tone})
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <Button asChild size="sm" className="shrink-0">
          <Link href={href} aria-label={`Review ${title}`}>
            Review →
          </Link>
        </Button>
      </div>
    </article>
  )
}
