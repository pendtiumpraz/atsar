import type { CalendarMode } from '@athar/shared'
import { HIJRI_MONTHS, MASEHI_MONTHS } from '@athar/shared'

// Approximate conversion AH ↔ CE for year-only data.
// For full-date conversion use a proper hijri converter (umalqura) — added later.
// Hijra epoch: 16 July 622 CE.

const HIJRI_YEAR_DAYS = 354.367
const GREGORIAN_YEAR_DAYS = 365.2425

export function ahToCe(ah: number): number {
  // CE ≈ AH * (354.367 / 365.2425) + 622
  return Math.round(ah * (HIJRI_YEAR_DAYS / GREGORIAN_YEAR_DAYS) + 622)
}

export function ceToAh(ce: number): number {
  return Math.round(((ce - 622) * GREGORIAN_YEAR_DAYS) / HIJRI_YEAR_DAYS)
}

export function formatYear(opts: {
  ah?: number | null
  ce?: number | null
  mode: CalendarMode
  unknown?: string
}): string {
  const unknown = opts.unknown ?? '?'
  const ah = opts.ah ?? null
  const ce = opts.ce ?? null
  const ahStr = ah !== null ? `${ah > 0 ? ah : Math.abs(ah)} ${ah < 0 ? 'SH' : 'H'}` : unknown
  const ceStr = ce !== null ? `${ce} M` : unknown
  switch (opts.mode) {
    case 'h':
      return ahStr
    case 'm':
      return ceStr
    case 'both':
      return `${ahStr} / ${ceStr}`
  }
}

export function hijriMonthName(monthNumber: number): string {
  return HIJRI_MONTHS[monthNumber - 1] ?? `Bulan ${monthNumber}`
}

export function masehiMonthName(monthNumber: number): string {
  return MASEHI_MONTHS[monthNumber - 1] ?? `Bulan ${monthNumber}`
}
