/**
 * Atsar — Timeline (single) shared types.
 *
 * Used by `<TimelineSingle/>` and the `<Marker/>` helper. Designed to be
 * data-source agnostic: callers translate Figure events (birth, masuk Islam,
 * hijrah, battles, death, dakwah milestones) into `TimelineEvent[]` and pass
 * them in. The component never reaches back to fetch data — it just renders.
 *
 * See `docs/WIREFRAMES.md` §7.
 */

import type { CalendarMode } from '@athar/shared'

/**
 * Categorisation drives marker colour + screen-reader label. Kept as a union
 * (not an enum) so callers can do exhaustive `switch` checks and the bundle
 * stays tree-shakeable.
 */
export type TimelineEventCategory =
  | 'birth'
  | 'death'
  | 'battle'
  | 'dakwah'
  | 'hijrah'
  | 'milestone'

export type TimelineEventPrecision = 'year' | 'month' | 'day' | 'approximate'

export interface TimelineEvent {
  id: string
  /** Indonesian title (always required — the canonical display label). */
  titleId: string
  /** Optional Arabic title — rendered RTL with `font-body-arab`. */
  titleAr?: string
  descriptionId?: string
  descriptionAr?: string
  /** Anno Hijrae — pre-Hijra years are stored as negatives (e.g. -50 → 50 SH). */
  dateAh?: number | null
  /** Common Era year (Masehi/Gregorian). */
  dateCe?: number | null
  precision?: TimelineEventPrecision
  category?: TimelineEventCategory
  /** Optional outbound link — e.g. to a battle or figure detail page. */
  href?: string
  /** Optional citation/source URL surfaced on hover (future enhancement). */
  citationUrl?: string
}

export interface TimelineSingleProps {
  events: TimelineEvent[]
  /** Calendar mode override. When omitted, the hook is the source of truth. */
  mode?: CalendarMode
  layout?: 'vertical' | 'horizontal'
  className?: string
}
