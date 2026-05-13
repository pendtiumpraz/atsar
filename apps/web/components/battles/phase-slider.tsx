// Battle phase slider (WIREFRAMES §13).
//
// Controlled slider input that drives which phase is currently active on the
// `<BattleMap />`.  Mirrors the wireframe:
//
//   Phase Slider: 2/5  [◀]  [─────●────────]  [▶]   [▶ Auto]
//   Fase 2: Penyergapan sumur
//   (deskripsi singkat)
//
// Public API:
//   - `phases`         — array of phases (in display order).
//   - `currentIndex`   — controlled index (0-based).
//   - `onChange`       — fires with the next index whenever it changes
//                        (slider, prev/next, or autoplay tick).
//
// Autoplay is local UI state — when enabled the component advances `current`
// by 1 every `autoplayIntervalMs` and stops at the last phase. Toggling off
// halts the timer immediately.

'use client'

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Loose phase shape — only the fields the slider renders.  The backend
// `BattlePhase` row also carries lat/lng + GeoJSON which the map consumes
// directly.
export interface PhaseSliderPhase {
  id?: string
  phaseOrder?: number | null
  titleAr?: string | null
  titleId?: string | null
  descriptionAr?: string | null
  descriptionId?: string | null
}

export interface PhaseSliderProps {
  phases: PhaseSliderPhase[]
  currentIndex: number
  onChange: (index: number) => void
  autoplayIntervalMs?: number
  className?: string
}

export function PhaseSlider({
  phases,
  currentIndex,
  onChange,
  autoplayIntervalMs = 3000,
  className,
}: PhaseSliderProps) {
  const total = phases.length
  const [autoplay, setAutoplay] = useState(false)
  const onChangeRef = useRef(onChange)

  // Keep the latest onChange in a ref so the interval doesn't restart when
  // the parent passes a fresh function on every render.
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Autoplay loop — advances every `autoplayIntervalMs` and stops at the end.
  useEffect(() => {
    if (!autoplay || total <= 1) return
    const id = window.setInterval(() => {
      const next = currentIndex + 1
      if (next >= total) {
        setAutoplay(false)
        return
      }
      onChangeRef.current(next)
    }, autoplayIntervalMs)
    return () => window.clearInterval(id)
  }, [autoplay, currentIndex, total, autoplayIntervalMs])

  if (total === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-xs text-[rgb(var(--text-muted))]',
          className,
        )}
      >
        Belum ada data fase untuk pertempuran ini.
      </div>
    )
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), total - 1)
  const current = phases[safeIndex]
  const titleLatin = current?.titleId || `Fase ${safeIndex + 1}`
  const titleArabic = current?.titleAr
  const description = current?.descriptionId || current?.descriptionAr

  function step(delta: number) {
    const next = Math.min(Math.max(safeIndex + delta, 0), total - 1)
    if (next !== safeIndex) onChange(next)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium tabular-nums text-[rgb(var(--text-muted))]">
          {safeIndex + 1}/{total}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => step(-1)}
          disabled={safeIndex === 0}
          aria-label="Fase sebelumnya"
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>

        <input
          type="range"
          min={0}
          max={total - 1}
          step={1}
          value={safeIndex}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Pilih fase pertempuran"
          aria-valuetext={titleLatin}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[rgb(var(--bg-elevated))] accent-[rgb(var(--accent))]"
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => step(1)}
          disabled={safeIndex >= total - 1}
          aria-label="Fase berikutnya"
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>

        <Button
          type="button"
          variant={autoplay ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setAutoplay((v) => !v)}
          disabled={total <= 1}
          aria-pressed={autoplay}
          aria-label={autoplay ? 'Hentikan autoplay' : 'Mulai autoplay'}
          className="h-8 gap-1 px-2 text-xs"
        >
          {autoplay ? (
            <Pause className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          <span>Auto</span>
        </Button>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">{titleLatin}</div>
          {titleArabic ? (
            <div
              lang="ar"
              dir="rtl"
              className="text-sm text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {titleArabic}
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="text-xs text-[rgb(var(--text-muted))]">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
