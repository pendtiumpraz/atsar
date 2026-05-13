// Compact figure card used in the list pane of `/figures` (WIREFRAMES §6).
//
// Layout:
//   ┌────────────────────────────────┐
//   │ ⌬  Abu Bakr ash-Shiddiq        │   ← latin name + arabic name (RTL)
//   │    أبو بكر الصديق                │
//   │    [Sahabat] ♂  • 13 H          │   ← category badge + gender + death
//   │    Thiqah · Khalifah I          │   ← optional rijal grade
//   └────────────────────────────────┘
//
// Renders as a `<Link>` so the whole card is clickable and Next.js can
// prefetch the detail route. Active state highlights the card when its slug
// matches the currently open figure.

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Loose shape — `figuresApi` currently returns `any` so we only rely on the
// fields we render. Tighten once F11 lands the Drizzle-derived `Figure` type.
export interface FigureCardData {
  id: string
  slug: string
  gender?: 'male' | 'female' | null
  nameFullAr?: string | null
  nameFullId?: string | null
  nameShortAr?: string | null
  nameShortId?: string | null
  kunyahAr?: string | null
  kunyahId?: string | null
  deathDateAh?: number | null
  rijalGrade?: string | null
  category?: { slug?: string; nameId?: string | null; nameAr?: string | null } | null
}

export interface FigureCardProps {
  figure: FigureCardData
  isActive?: boolean
  href: string
}

// Map rijal_grade enum → short Indonesian label. Mirrors enum from
// figure.schemas.ts. `not_narrator` / `unverified` are intentionally omitted
// (the card only surfaces a grade when it adds value).
const RIJAL_LABEL: Record<string, string> = {
  sahabi_udul: 'Sahabi (Adl)',
  thiqah_thiqah: 'Tsiqah Tsiqah',
  thiqah_hafidz: 'Tsiqah Hafidz',
  thiqah: 'Tsiqah',
  saduq: 'Shaduq',
  la_basa_bih: 'La Ba’sa Bih',
  shalih_al_hadith: 'Shalih al-Hadith',
  layyin: 'Layyin',
  daif: 'Dha’if',
  matruk: 'Matruk',
  kadhdhab: 'Kadzdzab',
}

function shouldShowRijalGrade(grade: string | null | undefined): grade is string {
  if (!grade) return false
  return grade !== 'not_narrator' && grade !== 'unverified' && grade in RIJAL_LABEL
}

export function FigureCard({ figure, isActive = false, href }: FigureCardProps) {
  const latinName =
    figure.nameShortId || figure.nameFullId || figure.kunyahId || figure.slug
  const arabicName = figure.nameShortAr || figure.nameFullAr || figure.kunyahAr

  const categoryLabel = figure.category?.nameId || figure.category?.slug
  const showRijal = shouldShowRijalGrade(figure.rijalGrade)

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group block rounded-lg border bg-[rgb(var(--surface))] p-3 transition-colors',
        'hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
        isActive
          ? 'border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] shadow-sm'
          : 'border-[rgb(var(--border))]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Decorative star/marker — purely visual */}
        <span
          aria-hidden
          className={cn(
            'mt-1 text-lg leading-none',
            isActive
              ? 'text-[rgb(var(--accent))]'
              : 'text-[rgb(var(--text-faint))] group-hover:text-[rgb(var(--accent))]',
          )}
        >
          ⌬
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
                {latinName}
              </div>
              {arabicName ? (
                <div
                  lang="ar"
                  dir="rtl"
                  className="truncate text-base text-[rgb(var(--text-muted))]"
                  style={{ fontFamily: 'var(--font-body-arab)' }}
                >
                  {arabicName}
                </div>
              ) : null}
            </div>

            {figure.gender ? (
              <span
                aria-label={figure.gender === 'female' ? 'Perempuan' : 'Laki-laki'}
                title={figure.gender === 'female' ? 'Perempuan' : 'Laki-laki'}
                className="mt-0.5 shrink-0 text-sm leading-none text-[rgb(var(--text-faint))]"
                aria-hidden={false}
              >
                {figure.gender === 'female' ? '♀' : '♂'}
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[rgb(var(--text-muted))]">
            {categoryLabel ? (
              <Badge variant="secondary" className="px-2 py-0">
                {categoryLabel}
              </Badge>
            ) : null}
            {typeof figure.deathDateAh === 'number' ? (
              <span className="text-[rgb(var(--text-faint))]">
                w. {figure.deathDateAh} H
              </span>
            ) : null}
            {showRijal ? (
              <span className="text-[rgb(var(--accent))]">
                · {RIJAL_LABEL[figure.rijalGrade as string]}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
