/**
 * Date formatting helpers that respect the active `CalendarMode`
 * (`'h'` Hijri, `'m'` Masehi/Gregorian, `'both'`).
 *
 * The underlying conversions live in `@athar/hijri`. This module only adds:
 *   - re-export of `formatYear` for ergonomic imports from `@/lib/format/date`
 *   - `formatDate(...)` for full year / month / day rendering
 *   - `ceDateToAh(date)` — a quick rough converter for JS `Date` → AH year
 */
import {
  ahToCe,
  ceToAh,
  formatYear as _formatYear,
  hijriMonthName,
  masehiMonthName,
} from '@athar/hijri'
import type { CalendarMode } from '@athar/shared'

import type { Locale } from '@/lib/i18n/config'

export const formatYear = _formatYear

/** Calendar-aware full-date payload. */
export interface FormatDateInput {
  /** Anno Hegirae (Hijri) year — may be negative for "Sebelum Hijrah" (SH). */
  ah?: number | null
  /** Common Era (Gregorian) year. */
  ce?: number | null
  /** Optional full Hijri date in `YYYY-MM-DD` form (used when mode prefers H). */
  ahFull?: string | null
  /** Optional full Gregorian date — ISO string or JS `Date`. */
  ceFull?: string | Date | null
  /** Active calendar mode. */
  mode: CalendarMode
  /** Locale-aware month names / number formatting (not yet plumbed through). */
  locale?: Locale
  /** Placeholder when the requested side is missing. Defaults to `'?'`. */
  unknown?: string
}

interface ParsedYmd {
  year: number
  month: number
  day: number
}

function parseYmd(value: string): ParsedYmd | null {
  // Accepts `YYYY-MM-DD` optionally prefixed with `-` for BCE / SH years.
  const match = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})/.exec(value)
  if (!match) return null
  const [, yearStr, monthStr, dayStr] = match
  if (yearStr == null || monthStr == null || dayStr == null) return null
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const day = Number.parseInt(dayStr, 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatHijriFull(ymd: ParsedYmd): string {
  const monthName = hijriMonthName(ymd.month)
  const yearStr = ymd.year < 0 ? `${Math.abs(ymd.year)} SH` : `${ymd.year} H`
  return `${ymd.day} ${monthName} ${yearStr}`
}

function formatMasehiFull(date: Date): string {
  const monthName = masehiMonthName(date.getMonth() + 1)
  return `${date.getDate()} ${monthName} ${date.getFullYear()} M`
}

/**
 * Format a full date (with month/day when available) per calendar mode.
 *
 * Falls back gracefully to year-only rendering (`formatYear`) when only the
 * year is supplied. `mode === 'both'` renders the Hijri side first, then the
 * Gregorian side, separated by ` / `.
 */
export function formatDate(opts: FormatDateInput): string {
  const unknown = opts.unknown ?? '?'

  const ahParsed = opts.ahFull ? parseYmd(opts.ahFull) : null
  const ceDate = opts.ceFull ? toDate(opts.ceFull) : null

  // Prefer full-date strings when we have them; otherwise fall back to years.
  const ahSide = ahParsed
    ? formatHijriFull(ahParsed)
    : opts.ah != null
      ? formatYear({ ah: opts.ah, mode: 'h', unknown })
      : unknown

  const ceSide = ceDate
    ? formatMasehiFull(ceDate)
    : opts.ce != null
      ? formatYear({ ce: opts.ce, mode: 'm', unknown })
      : unknown

  switch (opts.mode) {
    case 'h':
      return ahSide
    case 'm':
      return ceSide
    case 'both':
      return `${ahSide} / ${ceSide}`
  }
}

/**
 * Rough conversion: JS `Date` → AH year (year-only precision).
 * Uses the linear approximation from `@athar/hijri` (good enough for indexing
 * and year-bucket grouping; not suitable for liturgical date display).
 */
export function ceDateToAh(date: Date): number {
  return ceToAh(date.getFullYear())
}

// Convenience re-exports so consumers can grab the converters from a single path.
export { ahToCe, ceToAh, hijriMonthName, masehiMonthName }
