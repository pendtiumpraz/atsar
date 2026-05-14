// Step 4 — visual cover preview.
//
// Renders a styled book cover using the user's chosen title (AR + ID) and
// auto-filled author block (locked to the session user — see wireframes §16).
// The four palettes mirror the four PDF templates so the in-app preview
// stays faithful to the rendered output (see
// `apps/web/lib/server/pdf/templates/*.ts`).

'use client'

import { cn } from '@/lib/utils'

export interface CoverPreviewProps {
  titleAr?: string
  titleId?: string
  authorName: string
  authorEmail: string
  template: 'classic' | 'modern' | 'calligraphy' | 'minimalist'
}

/**
 * Per-template palette + text colour pairing. Light templates need dark
 * text so the title remains readable; the navy "Lentera" cover keeps
 * the original cream-on-navy ink.
 */
interface CoverPalette {
  gradient: string
  ink: string
  inkMuted: string
  inkAccent: string
}

const PALETTES: Record<CoverPreviewProps['template'], CoverPalette> = {
  // Klasik Naskh — warm cream paper, deep emerald ink + gold accent.
  classic: {
    gradient: 'from-[#FAF5EB] via-[#F2EBD9] to-[#E8DFC8]',
    ink: 'text-[#0A3A2C]',
    inkMuted: 'text-[#6B5E4D]',
    inkAccent: 'text-[#8E7349]',
  },
  // Kontemporer — bright white with emerald rule + dark slate ink.
  modern: {
    gradient: 'from-white via-slate-50 to-slate-100',
    ink: 'text-slate-900',
    inkMuted: 'text-slate-500',
    inkAccent: 'text-emerald-700',
  },
  // Lentera Premium — deep navy radial; cream ink + gold accent.
  calligraphy: {
    gradient: 'from-[#1A2E48] via-[#0F1D2E] to-[#08111B]',
    ink: 'text-[#F5EAD2]',
    inkMuted: 'text-[#BFA974]',
    inkAccent: 'text-[#D4BC93]',
  },
  // Edisi Mahasiswa — off-white notebook; ink + emerald accent.
  minimalist: {
    gradient: 'from-[#FDFCF8] via-[#F8F4E8] to-[#F2EBD9]',
    ink: 'text-[#1F1810]',
    inkMuted: 'text-[#A89A85]',
    inkAccent: 'text-[#0F4C3A]',
  },
}

export function CoverPreview({
  titleAr,
  titleId,
  authorName,
  authorEmail,
  template,
}: CoverPreviewProps) {
  const palette = PALETTES[template]

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          'relative flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-between rounded-lg bg-gradient-to-br p-8 shadow-2xl',
          palette.gradient,
          palette.ink,
        )}
        aria-label="Pratinjau sampul buku"
      >
        {/* Decorative top ornament */}
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className={cn('text-2xl leading-none opacity-70', palette.inkAccent)}
          >
            ⌬
          </span>
          <span
            className={cn(
              'text-xs uppercase tracking-[0.3em]',
              palette.inkAccent,
            )}
          >
            Atsar
          </span>
        </div>

        {/* Title block */}
        <div className="flex w-full flex-col items-center gap-3 text-center">
          {titleAr ? (
            <div
              lang="ar"
              dir="rtl"
              className="text-3xl leading-tight"
              style={{ fontFamily: 'var(--font-display-arab)' }}
            >
              {titleAr}
            </div>
          ) : (
            <div className={cn('text-2xl italic', palette.inkMuted)}>
              — Judul Arab —
            </div>
          )}
          {titleId ? (
            <div
              className="text-lg"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              {titleId}
            </div>
          ) : (
            <div className={cn('text-sm italic', palette.inkMuted)}>
              — Judul Indonesia —
            </div>
          )}
        </div>

        {/* Author block */}
        <div className="flex w-full flex-col items-center gap-0.5 text-center text-xs">
          <span className="text-sm font-medium">
            {authorName || 'Pengguna Atsar'}
          </span>
          {authorEmail ? (
            <span className={cn('text-[10px]', palette.inkMuted)}>
              {authorEmail}
            </span>
          ) : null}
          <span
            className={cn(
              'mt-2 text-[10px] uppercase tracking-widest',
              palette.inkAccent,
            )}
          >
            Atsar Book Generator
          </span>
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-[rgb(var(--text-muted))]">
        Penulis &amp; email diambil dari profil Anda dan tidak dapat diubah.
      </p>
    </div>
  )
}
