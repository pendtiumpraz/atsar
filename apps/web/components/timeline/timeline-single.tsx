'use client'

/**
 * Atsar — Timeline Single (figure detail tab).
 *
 * Renders a vertical react-chrono timeline of a single figure's life events
 * (birth, masuk Islam, hijrah, battles, dakwah milestones, death). Data is
 * provided fully by the caller via `events: TimelineEvent[]` — this component
 * is intentionally source-agnostic so it can be reused across:
 *   - Figure detail page (the eventual F10 "Timeline" tab)
 *   - Comparator (`/timeline`) for per-figure tracks
 *   - PDF export pre-render
 *
 * Calendar mode comes from `useCalendarMode()` unless the caller pins a `mode`
 * prop. Theme colours are wired to CSS vars so the component follows the
 * active palette (light / dark / dawn).
 *
 * See `docs/WIREFRAMES.md` §7.
 */

import { Chrono } from 'react-chrono'
import { useMemo } from 'react'

import type { CalendarMode } from '@athar/shared'
import { formatYear } from '@athar/hijri'

import { useCalendarMode } from '@/hooks/use-calendar-mode'
import { cn } from '@/lib/utils'

import type { TimelineEvent, TimelineSingleProps } from './timeline-types'

const CHRONO_THEME = {
  primary: 'rgb(var(--primary))',
  secondary: 'rgb(var(--bg-elevated))',
  cardBgColor: 'rgb(var(--surface))',
  cardForeColor: 'rgb(var(--text))',
  titleColor: 'rgb(var(--text))',
  titleColorActive: 'rgb(var(--accent))',
  cardTitleColor: 'rgb(var(--text))',
  cardSubtitleColor: 'rgb(var(--text-muted))',
  cardDetailsColor: 'rgb(var(--text-muted))',
} as const

const CHRONO_FONT_SIZES = {
  title: '0.875rem',
  cardTitle: '1rem',
  cardSubtitle: '0.875rem',
  cardText: '0.875rem',
} as const

function toChronoItems(events: TimelineEvent[], mode: CalendarMode) {
  return events.map((e) => ({
    id: e.id,
    title: formatYear({ ah: e.dateAh ?? null, ce: e.dateCe ?? null, mode }),
    cardTitle: e.titleId,
    cardSubtitle: e.titleAr,
    cardDetailedText: e.descriptionId,
    url: e.href,
  }))
}

export function TimelineSingle({
  events,
  mode: modeProp,
  layout = 'vertical',
  className,
}: TimelineSingleProps) {
  const { mode: hookMode } = useCalendarMode()
  const mode = modeProp ?? hookMode

  // react-chrono crashes on empty `items`, so we render a friendly placeholder
  // until the caller has data.
  const items = useMemo(() => toChronoItems(events, mode), [events, mode])

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-[rgb(var(--border))]',
          'bg-[rgb(var(--surface))] p-6 text-center',
          'text-sm text-[rgb(var(--text-muted))]',
          className,
        )}
        role="status"
      >
        Belum ada peristiwa untuk ditampilkan di timeline.
      </div>
    )
  }

  const chronoMode = layout === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL_ALTERNATING'

  return (
    <div
      className={cn(
        'timeline-single w-full',
        // react-chrono needs an explicit height in vertical scroll mode.
        layout === 'horizontal' ? 'h-[24rem]' : 'min-h-[24rem]',
        className,
      )}
    >
      {/*
        react-chrono v3's `TimelinePropsV2` typing is strict about its mode union
        ('horizontal' | 'vertical' | 'alternating' | 'horizontal-all') but the
        runtime still accepts the legacy uppercase variants used widely in
        existing examples. We cast through `unknown` to silence the prop diff
        until we migrate to the new grouped config shape.
      */}
      <Chrono
        items={items}
        mode={chronoMode as unknown as 'vertical' | 'alternating' | 'horizontal'}
        theme={CHRONO_THEME}
        fontSizes={CHRONO_FONT_SIZES}
        scrollable={{ scrollbar: true }}
        useReadMore={false}
        cardHeight={120}
        disableToolbar
        disableNavOnKey={false}
      />
    </div>
  )
}

export default TimelineSingle
