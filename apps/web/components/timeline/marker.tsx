'use client'

/**
 * Atsar — Timeline event marker.
 *
 * A small presentational client component that renders a single event's
 * formatted date + a category-coloured dot, optionally with the Arabic title
 * underneath. Used both by `<TimelineSingle/>` (as the `title` slot inside a
 * react-chrono item) and standalone in compact lists (e.g. figure card popovers).
 *
 * Colour mapping (per WIREFRAMES §7 + UI_UX palette):
 *   birth    → green
 *   death    → gray
 *   battle   → red
 *   dakwah   → gold (amber)
 *   hijrah   → blue
 *   milestone→ emerald
 */

import type { CalendarMode } from '@athar/shared'
import { formatYear } from '@athar/hijri'

import { cn } from '@/lib/utils'

import type { TimelineEventCategory } from './timeline-types'

export interface MarkerProps {
  titleId: string
  titleAr?: string
  dateAh?: number | null
  dateCe?: number | null
  mode: CalendarMode
  category?: TimelineEventCategory
  className?: string
}

const CATEGORY_DOT: Record<TimelineEventCategory, string> = {
  birth: 'bg-green-500',
  death: 'bg-gray-400',
  battle: 'bg-red-500',
  dakwah: 'bg-amber-500',
  hijrah: 'bg-blue-500',
  milestone: 'bg-emerald-500',
}

const CATEGORY_LABEL_ID: Record<TimelineEventCategory, string> = {
  birth: 'Kelahiran',
  death: 'Wafat',
  battle: 'Peperangan',
  dakwah: 'Dakwah',
  hijrah: 'Hijrah',
  milestone: 'Peristiwa',
}

export function Marker({
  titleId,
  titleAr,
  dateAh,
  dateCe,
  mode,
  category,
  className,
}: MarkerProps) {
  const dot = category ? CATEGORY_DOT[category] : 'bg-[rgb(var(--text-faint))]'
  const srLabel = category ? CATEGORY_LABEL_ID[category] : 'Peristiwa'
  const dateStr = formatYear({ ah: dateAh ?? null, ce: dateCe ?? null, mode })

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <span
        aria-label={srLabel}
        role="img"
        className={cn(
          'mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[rgb(var(--surface))]',
          dot,
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[rgb(var(--text-muted))]">
          {dateStr}
        </div>
        <div className="text-sm font-semibold text-[rgb(var(--text))]">
          {titleId}
        </div>
        {titleAr ? (
          <div
            lang="ar"
            dir="rtl"
            className="text-sm text-[rgb(var(--text-muted))]"
            style={{ fontFamily: 'var(--font-body-arab)' }}
          >
            {titleAr}
          </div>
        ) : null}
      </div>
    </div>
  )
}
