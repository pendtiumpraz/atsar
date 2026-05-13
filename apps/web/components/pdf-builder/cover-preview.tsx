// Step 4 — visual cover preview.
//
// Renders a styled book cover using the user's chosen title (AR + ID) and
// auto-filled author block (locked to the session user — see wireframes §16).
// The Emerald Turats theme is applied via inline gradient + Atsar token
// fonts so the preview matches the eventual PDF render closely enough.

'use client'

import { cn } from '@/lib/utils'

export interface CoverPreviewProps {
  titleAr?: string
  titleId?: string
  authorName: string
  authorEmail: string
  template: 'classic' | 'modern' | 'calligraphy' | 'minimalist'
}

const PALETTES: Record<CoverPreviewProps['template'], string> = {
  classic: 'from-[#0e5c4a] via-[#0b4a3d] to-[#063b30]',
  modern: 'from-slate-700 via-slate-800 to-slate-900',
  calligraphy: 'from-[#7c4a1e] via-[#5c3414] to-[#3a200a]',
  minimalist: 'from-stone-600 via-stone-700 to-stone-800',
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
          'relative flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-between rounded-lg bg-gradient-to-br p-8 text-white shadow-2xl',
          palette,
        )}
        aria-label="Pratinjau sampul buku"
      >
        {/* Decorative top ornament */}
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="text-2xl leading-none text-white/60"
          >
            ⌬
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-white/70">
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
            <div className="text-2xl italic text-white/40">— Judul Arab —</div>
          )}
          {titleId ? (
            <div
              className="text-lg text-white/90"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              {titleId}
            </div>
          ) : (
            <div className="text-sm italic text-white/40">— Judul Indonesia —</div>
          )}
        </div>

        {/* Author block */}
        <div className="flex w-full flex-col items-center gap-0.5 text-center text-xs text-white/80">
          <span className="text-sm font-medium text-white">
            {authorName || 'Pengguna Atsar'}
          </span>
          {authorEmail ? (
            <span className="text-[10px] text-white/60">{authorEmail}</span>
          ) : null}
          <span className="mt-2 text-[10px] uppercase tracking-widest text-white/50">
            Dibuat oleh Atsar
          </span>
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-[rgb(var(--text-muted))]">
        Penulis &amp; email diambil dari profil Anda dan tidak dapat diubah.
      </p>
    </div>
  )
}
