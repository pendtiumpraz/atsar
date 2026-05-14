// `<FigureHero />` — the visual masthead at the top of `/figures/[slug]`.
//
// Replaces the old plain-text header (Arabic + Indonesian name + a row of
// metadata badges) with a real biographical card:
//
//   - Category-tinted Islamic geometric (8-point star) SVG pattern as the
//     background watermark.
//   - Big display-Arab name (RTL) over big display-Latin name.
//   - Honorifics + category + gender chips row.
//   - Kunyah / laqab inline italic line.
//   - Date range badge ("53 SH – 13 H · ≈573 – 634 M").
//   - 4-up quick-stat chips (hadith count, specialty, madhab, rijal).
//   - Reading-time estimate + share link.
//   - Admin-only buttons: "Edit" → /admin/figures/[slug]/edit, "Perbarui via
//     AI" → opens <FigureReingestDialog />.
//
// All copy in Indonesian. No new deps.

'use client'

import * as React from 'react'
import Link from 'next/link'
import { BookOpen, CalendarDays, Link2, Pencil, Scale, Sparkles, Star, User2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FigureReingestDialog } from './figure-reingest-dialog'
import type { FigureDetailData } from './figure-detail'
import type { FigureReingestCurrentSnapshot } from '@/components/admin/figures/figure-reingest-panel'

// ─── Category palette ─────────────────────────────────────────────────
//
// We tint the hero (pattern + ring accents) based on the figure's category.
// Tailwind class strings are spelled out fully so the JIT picks them up at
// build time — no dynamic concatenation.

interface CategoryTheme {
  /** Hex for the SVG pattern stroke. Picked from Tailwind's 600 shade so it
   *  reads well on both light and dark surfaces at 6% opacity. */
  patternStroke: string
  /** Soft tinted background gradient (top-right corner glow). */
  glow: string
  /** Outer card ring/border accent. */
  ring: string
  /** Pill / chip text colour. */
  pillFg: string
  /** Pill / chip background colour. */
  pillBg: string
  /** Indonesian category label fallback if `data.category.nameId` is null. */
  fallbackLabel: string
}

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  nabi: {
    patternStroke: '#059669',
    glow: 'from-emerald-500/10 via-transparent to-transparent',
    ring: 'ring-emerald-500/25',
    pillFg: 'text-emerald-700 dark:text-emerald-300',
    pillBg: 'bg-emerald-500/10',
    fallbackLabel: 'Nabi',
  },
  sahabat: {
    patternStroke: '#d97706',
    glow: 'from-amber-500/10 via-transparent to-transparent',
    ring: 'ring-amber-500/25',
    pillFg: 'text-amber-700 dark:text-amber-300',
    pillBg: 'bg-amber-500/10',
    fallbackLabel: 'Sahabat',
  },
  tabiin: {
    patternStroke: '#0284c7',
    glow: 'from-sky-500/10 via-transparent to-transparent',
    ring: 'ring-sky-500/25',
    pillFg: 'text-sky-700 dark:text-sky-300',
    pillBg: 'bg-sky-500/10',
    fallbackLabel: "Tabi'in",
  },
  tabiut_tabiin: {
    patternStroke: '#7c3aed',
    glow: 'from-violet-500/10 via-transparent to-transparent',
    ring: 'ring-violet-500/25',
    pillFg: 'text-violet-700 dark:text-violet-300',
    pillBg: 'bg-violet-500/10',
    fallbackLabel: "Tabi'ut Tabi'in",
  },
  shalih_pasca_rasul: {
    patternStroke: '#e11d48',
    glow: 'from-rose-500/10 via-transparent to-transparent',
    ring: 'ring-rose-500/25',
    pillFg: 'text-rose-700 dark:text-rose-300',
    pillBg: 'bg-rose-500/10',
    fallbackLabel: 'Pasca-Salaf',
  },
  shalih_pre_rasul: {
    patternStroke: '#0d9488',
    glow: 'from-teal-500/10 via-transparent to-transparent',
    ring: 'ring-teal-500/25',
    pillFg: 'text-teal-700 dark:text-teal-300',
    pillBg: 'bg-teal-500/10',
    fallbackLabel: 'Shalih pra-Rasul',
  },
}

const FALLBACK_THEME: CategoryTheme = {
  patternStroke: '#64748b',
  glow: 'from-slate-500/10 via-transparent to-transparent',
  ring: 'ring-slate-500/25',
  pillFg: 'text-slate-700 dark:text-slate-300',
  pillBg: 'bg-slate-500/10',
  fallbackLabel: 'Tokoh',
}

function themeFor(slug: string | undefined | null): CategoryTheme {
  if (!slug) return FALLBACK_THEME
  return CATEGORY_THEMES[slug] ?? FALLBACK_THEME
}

// ─── Honorifics ───────────────────────────────────────────────────────
// Pick the right post-name honorific from category + gender. A real
// editorial pass would override per-figure but this default covers >95%.
function honorificFor(
  categorySlug: string | undefined | null,
  gender: 'male' | 'female' | null | undefined,
): { label: string; arabic: string; tone: 'green' | 'gold' | 'slate' } {
  if (categorySlug === 'nabi') {
    return { label: 'ﷺ', arabic: 'ﷺ', tone: 'green' }
  }
  if (categorySlug === 'sahabat') {
    return {
      label: gender === 'female' ? 'radhiyallahu ‘anha' : 'radhiyallahu ‘anhu',
      arabic: gender === 'female' ? 'رضي الله عنها' : 'رضي الله عنه',
      tone: 'gold',
    }
  }
  if (
    categorySlug === 'tabiin' ||
    categorySlug === 'tabiut_tabiin' ||
    categorySlug === 'shalih_pasca_rasul'
  ) {
    return {
      label: gender === 'female' ? 'rahimahallah' : 'rahimahullah',
      arabic: gender === 'female' ? 'رحمها الله' : 'رحمه الله',
      tone: 'slate',
    }
  }
  if (categorySlug === 'shalih_pre_rasul') {
    return { label: '‘alaihissalam', arabic: 'عليه السلام', tone: 'green' }
  }
  return { label: '', arabic: '', tone: 'slate' }
}

// ─── Date range formatter ─────────────────────────────────────────────
function formatDateRange(
  birthAh: number | null | undefined,
  birthCe: number | null | undefined,
  deathAh: number | null | undefined,
  deathCe: number | null | undefined,
): { hijri: string; gregorian: string } | null {
  const hasAnyAh = typeof birthAh === 'number' || typeof deathAh === 'number'
  const hasAnyCe = typeof birthCe === 'number' || typeof deathCe === 'number'
  if (!hasAnyAh && !hasAnyCe) return null

  // Format AH side. Negative birth year = SH (Sebelum Hijra).
  function ah(): string {
    const b = typeof birthAh === 'number'
      ? birthAh < 0
        ? `${-birthAh} SH`
        : `${birthAh} H`
      : '≈?'
    const d = typeof deathAh === 'number' ? `${deathAh} H` : '≈?'
    if (b === '≈?' && d === '≈?') return ''
    return `${b} – ${d}`
  }

  function ce(): string {
    const b = typeof birthCe === 'number' ? `${birthCe}` : '≈?'
    const d = typeof deathCe === 'number' ? `${deathCe}` : '≈?'
    if (b === '≈?' && d === '≈?') return ''
    return `≈${b} – ${d} M`
  }

  return { hijri: ah(), gregorian: ce() }
}

// ─── Rijal pill colour ────────────────────────────────────────────────
function rijalPillClass(grade: string | null | undefined): {
  label: string
  className: string
} | null {
  if (!grade) return null
  const lower = String(grade).toLowerCase()
  if (lower === 'sahabi_udul' || lower === 'sahabi') {
    return {
      label: 'Sahabi ‘udul',
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    }
  }
  if (lower === 'thiqah') {
    return {
      label: 'Thiqah',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    }
  }
  if (lower === 'saduq' || lower === 'shaduq') {
    return {
      label: 'Shaduq',
      className: 'bg-lime-500/15 text-lime-700 dark:text-lime-300',
    }
  }
  if (lower.startsWith('daif') || lower.startsWith('dha') || lower.startsWith('da\'')) {
    return {
      label: "Dha'if",
      className: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    }
  }
  if (lower === 'matruk' || lower === 'matruuk') {
    return {
      label: 'Matruk',
      className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    }
  }
  return {
    label: grade,
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  }
}

// ─── Madhab label ─────────────────────────────────────────────────────
const MADHAB_LABELS: Record<string, string> = {
  hanafi: 'Hanafi',
  maliki: 'Maliki',
  syafii: "Syafi'i",
  hanbali: 'Hanbali',
  no_madhab: 'Sebelum madhab',
  other: 'Lainnya',
}

// ─── 8-point star SVG pattern (inline, no asset) ──────────────────────
// We render a single <pattern> tile via <svg> as an absolute layer.
// The geometry is a classic Islamic 8-point star drawn at 64×64; we tile
// it across the full hero. Stroke colour comes from the category theme.
function ArabesquePattern({ stroke }: { stroke: string }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07] mix-blend-multiply dark:opacity-[0.10] dark:mix-blend-screen"
    >
      <defs>
        <pattern
          id="arabesque-tile"
          x="0"
          y="0"
          width="64"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          {/* 8-point star = two squares rotated 45deg */}
          <g
            fill="none"
            stroke={stroke}
            strokeWidth={1.2}
            transform="translate(32 32)"
          >
            <rect x="-14" y="-14" width="28" height="28" />
            <rect x="-14" y="-14" width="28" height="28" transform="rotate(45)" />
            <circle cx="0" cy="0" r="20" />
          </g>
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#arabesque-tile)" />
    </svg>
  )
}

// ─── Reading-time helper ──────────────────────────────────────────────
function readingTimeMinutes(text: string | null | undefined): number {
  if (!text) return 0
  const len = text.length
  return Math.max(1, Math.ceil(len / 1100))
}

// ─── Build snapshot for the re-ingest dialog ──────────────────────────
function buildReingestSnapshot(data: FigureDetailData): FigureReingestCurrentSnapshot {
  // `socialCategory` is the closest thing the public payload exposes for
  // specialty — but the reingest snapshot expects `specialty: string[] | null`.
  // The figure row carries both columns; getBySlug spreads them via `...row`
  // so we read either if present.
  const r = data as unknown as Record<string, unknown>
  return {
    biographyId: data.biographyId ?? null,
    biographyAr: data.biographyAr ?? null,
    summaryId: data.summaryId ?? null,
    summaryAr: data.summaryAr ?? null,
    kunyahId: data.kunyahId ?? null,
    kunyahAr: data.kunyahAr ?? null,
    laqabId: data.laqabId ?? null,
    laqabAr: data.laqabAr ?? null,
    birthDateAh: data.birthDateAh ?? null,
    birthDateCe: data.birthDateCe ?? null,
    deathDateAh: data.deathDateAh ?? null,
    deathDateCe: data.deathDateCe ?? null,
    specialty: (r['specialty'] as string[] | null) ?? null,
    madhab: (r['madhab'] as string | null) ?? null,
    rijalGrade: data.rijalGrade ?? null,
  }
}

// ─── Component ────────────────────────────────────────────────────────

export interface FigureHeroProps {
  data: FigureDetailData
  isAdmin?: boolean
}

export function FigureHero({ data, isAdmin = false }: FigureHeroProps) {
  const [reingestOpen, setReingestOpen] = React.useState(false)

  const theme = themeFor(data.category?.slug)
  const honorific = honorificFor(data.category?.slug, data.gender)
  const dateRange = formatDateRange(
    data.birthDateAh,
    data.birthDateCe,
    data.deathDateAh,
    data.deathDateCe,
  )

  const latin = data.nameFullId || data.nameShortId || data.slug
  const arabic = data.nameFullAr || data.nameShortAr || null

  const categoryLabel = data.category?.nameId || theme.fallbackLabel

  // Kunyah + laqab joined inline (italic).
  const kunyahLaqab: string[] = []
  if (data.kunyahId || data.kunyahAr) kunyahLaqab.push(data.kunyahId || data.kunyahAr!)
  if (data.laqabId || data.laqabAr) kunyahLaqab.push(data.laqabId || data.laqabAr!)
  if (data.nameShortId && data.nameShortId !== latin) kunyahLaqab.push(data.nameShortId)

  const readMin = readingTimeMinutes(
    data.biographyId ||
      data.biographyPreWafatId ||
      data.biographyPostWafatId ||
      data.summaryId ||
      null,
  )

  // Quick stats — show up to 4 chips. Each chip has a label + value; we
  // emit "—" sentinel so the layout doesn't jump when fields are missing.
  const dataRecord = data as unknown as Record<string, unknown>
  const specialty = (dataRecord['specialty'] as string[] | null) ?? null
  const madhab = (dataRecord['madhab'] as string | null) ?? null
  const hadithMin = (dataRecord['hadithCountMin'] as number | null) ?? null
  const hadithMax = (dataRecord['hadithCountMax'] as number | null) ?? null

  const rijalPill = rijalPillClass(data.rijalGrade)

  function hadithText(): string {
    if (typeof hadithMin === 'number' && typeof hadithMax === 'number') {
      if (hadithMin === hadithMax) return hadithMin.toLocaleString('id-ID')
      return `${hadithMin.toLocaleString('id-ID')}–${hadithMax.toLocaleString('id-ID')}`
    }
    if (typeof hadithMin === 'number') return `≥${hadithMin.toLocaleString('id-ID')}`
    if (typeof hadithMax === 'number') return `≤${hadithMax.toLocaleString('id-ID')}`
    return '—'
  }

  function specialtyText(): string {
    if (!specialty || specialty.length === 0) return '—'
    return specialty.slice(0, 2).join(', ')
  }

  function madhabText(): string {
    if (!madhab) return '—'
    return MADHAB_LABELS[madhab] ?? madhab
  }

  // ── Share link ──────────────────────────────────────────────────────
  async function copyLink() {
    if (typeof window === 'undefined') return
    const href = `${window.location.origin}/figures/${data.slug}`
    try {
      await navigator.clipboard.writeText(href)
      toast.success('Tautan disalin')
    } catch {
      toast.error('Gagal menyalin tautan')
    }
  }

  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-sm ring-1',
        theme.ring,
      )}
      aria-labelledby="figure-hero-name"
    >
      {/* Arabesque background */}
      <ArabesquePattern stroke={theme.patternStroke} />
      {/* Soft corner glow */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br',
          theme.glow,
        )}
      />

      <div className="relative flex flex-col gap-5 p-5 sm:p-7">
        {/* Top row: chips + admin actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                theme.pillBg,
                theme.pillFg,
              )}
            >
              {categoryLabel}
            </span>

            {honorific.label ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  honorific.tone === 'green' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  honorific.tone === 'gold' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  honorific.tone === 'slate' && 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
                )}
                title={honorific.arabic}
              >
                <Star className="h-3 w-3" aria-hidden />
                {honorific.label}
              </span>
            ) : null}

            {data.gender ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--bg-elevated))] px-2.5 py-0.5 text-xs text-[rgb(var(--text-muted))]"
                title={data.gender === 'female' ? 'Perempuan' : 'Laki-laki'}
              >
                <User2 className="h-3 w-3" aria-hidden />
                {data.gender === 'female' ? 'Perempuan' : 'Laki-laki'}
              </span>
            ) : null}

            {rijalPill ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  rijalPill.className,
                )}
                title={`Tingkat rijal: ${rijalPill.label}`}
              >
                {rijalPill.label}
              </span>
            ) : null}
          </div>

          {/* Admin action cluster */}
          {isAdmin ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/figures/${data.slug}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setReingestOpen(true)}
                aria-label="Perbarui via AI Websearch"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Perbarui via AI</span>
              </Button>
            </div>
          ) : null}
        </div>

        {/* Names */}
        <div className="flex flex-col gap-1">
          {arabic ? (
            <h1
              lang="ar"
              dir="rtl"
              id="figure-hero-name"
              className="text-4xl font-semibold leading-[1.15] text-[rgb(var(--text))] sm:text-5xl lg:text-6xl"
              style={{ fontFamily: 'var(--font-display-arab)' }}
            >
              {arabic}
            </h1>
          ) : null}
          <div
            className="text-2xl font-semibold leading-tight text-[rgb(var(--text))] sm:text-3xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
            id={arabic ? undefined : 'figure-hero-name'}
          >
            {latin}
          </div>
          {kunyahLaqab.length > 0 ? (
            <p className="mt-1 text-sm italic text-[rgb(var(--text-muted))] sm:text-base">
              {kunyahLaqab.join(' · ')}
            </p>
          ) : null}
        </div>

        {/* Date range row */}
        {dateRange ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--bg-elevated))] px-2.5 py-1 text-[rgb(var(--text))]">
              <CalendarDays className="h-4 w-4 text-[rgb(var(--text-muted))]" aria-hidden />
              <span className="font-medium">{dateRange.hijri || '—'}</span>
              {dateRange.gregorian ? (
                <span className="text-xs text-[rgb(var(--text-muted))]">
                  · {dateRange.gregorian}
                </span>
              ) : null}
            </span>
            {readMin > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--bg-elevated))] px-2.5 py-1 text-xs text-[rgb(var(--text-muted))]">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                ≈{readMin} menit baca
              </span>
            ) : null}
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-elevated))] hover:text-[rgb(var(--text))]"
              aria-label="Salin tautan"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Salin tautan
            </button>
          </div>
        ) : null}

        {/* Quick stats grid (4-up on wide, 2-up on narrow) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickStat
            icon={<BookOpen className="h-4 w-4" aria-hidden />}
            label="Riwayat hadits"
            value={hadithText()}
          />
          <QuickStat
            icon={<Star className="h-4 w-4" aria-hidden />}
            label="Spesialisasi"
            value={specialtyText()}
          />
          <QuickStat
            icon={<Scale className="h-4 w-4" aria-hidden />}
            label="Madhab"
            value={madhabText()}
          />
          <QuickStat
            icon={<User2 className="h-4 w-4" aria-hidden />}
            label="Rijal"
            value={rijalPill?.label ?? '—'}
            valueClassName={rijalPill?.className}
          />
        </div>

        {/* Summary — kept as an italic lead line for visual relief above the
            tabs. Truncated at ~280 chars; the full text shows in the Biografi
            tab below. */}
        {data.summaryId || data.summaryAr ? (
          <p
            className="max-w-3xl border-l-2 border-[rgb(var(--border))] pl-3 text-sm italic leading-relaxed text-[rgb(var(--text-muted))] sm:text-base"
            lang={data.summaryId ? 'id' : 'ar'}
            dir={data.summaryId ? 'ltr' : 'rtl'}
          >
            {truncate(data.summaryId || data.summaryAr || '', 320)}
          </p>
        ) : null}
      </div>

      {/* Re-ingest dialog (admin only) */}
      {isAdmin ? (
        <FigureReingestDialog
          open={reingestOpen}
          onOpenChange={setReingestOpen}
          slug={data.slug}
          current={buildReingestSnapshot(data)}
        />
      ) : null}
    </section>
  )
}

function QuickStat({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/60 px-3 py-2 backdrop-blur-sm">
      <span className="mt-0.5 text-[rgb(var(--text-muted))]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-faint))]">
          {label}
        </div>
        <div
          className={cn(
            'truncate text-sm font-medium text-[rgb(var(--text))]',
            valueClassName,
          )}
          title={value}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

// Re-export for tests / storybook ergonomics.
export { CATEGORY_THEMES, themeFor, honorificFor, formatDateRange }
