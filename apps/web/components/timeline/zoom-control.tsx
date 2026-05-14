// Zoom ruler for the SVG timeline renderers.
//
// Renders a horizontal toolbar with:
//   - "−" / "+" buttons (decrement / increment by `step`).
//   - Native `<input type="range">` slider (50 % – 500 %, step 25).
//   - Current-value pill (mono, accent border).
//   - "Reset" button → 100 %.
//
// Keyboard shortcuts attached while the component is mounted:
//   - Ctrl/Cmd + 0  → reset to 100 %
//   - Ctrl/Cmd + =  → zoom in by `step`
//   - Ctrl/Cmd + -  → zoom out by `step`
// Shortcuts are no-ops when the user is typing into an input / textarea /
// contenteditable, so they don't trample regular form keystrokes.
//
// State is owned by the parent; this component is purely controlled. The
// parent decides whether to persist to localStorage etc.

'use client'

import { useCallback, useEffect } from 'react'

export interface ZoomControlProps {
  /** Current value as a percent (100 = 1x baseline). */
  value: number
  onChange: (next: number) => void
  /** Min percent (default 50). */
  min?: number
  /** Max percent (default 500). */
  max?: number
  /** Step in percent (default 25). */
  step?: number
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (t.isContentEditable) return true
  return false
}

export function ZoomControl({
  value,
  onChange,
  min = 50,
  max = 500,
  step = 25,
}: ZoomControlProps) {
  const setClamped = useCallback(
    (next: number) => onChange(clamp(Math.round(next), min, max)),
    [onChange, min, max],
  )

  const handleDecrement = useCallback(() => setClamped(value - step), [setClamped, value, step])
  const handleIncrement = useCallback(() => setClamped(value + step), [setClamped, value, step])
  const handleReset = useCallback(() => onChange(100), [onChange])

  // Global keyboard shortcuts. Skip when focus is in an editable field so
  // typing "-" in a name search doesn't zoom the timeline.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (isEditableTarget(e.target)) return
      // `e.key` is the printed character; on most layouts "=" is the
      // unshifted glyph on the "+" key, and "-" is itself. We accept
      // both "+" and "=" for zoom-in to cover layouts where the user
      // holds shift.
      if (e.key === '0') {
        e.preventDefault()
        onChange(100)
        return
      }
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setClamped(value + step)
        return
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setClamped(value - step)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChange, setClamped, value, step])

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2"
      role="group"
      aria-label="Kontrol zoom timeline"
    >
      <span className="text-xs font-medium text-[rgb(var(--text-muted))]">Zoom</span>

      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        title="Perkecil (Ctrl/Cmd + -)"
        aria-label="Perkecil zoom"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-semibold text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))] disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setClamped(Number(e.target.value))}
        aria-label={`Zoom timeline (${value}%)`}
        title={`Zoom ${value}% (geser untuk mengubah)`}
        className="h-2 w-[200px] cursor-pointer appearance-none rounded-full bg-[rgb(var(--border))] accent-[rgb(var(--accent))]"
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        title="Perbesar (Ctrl/Cmd + =)"
        aria-label="Perbesar zoom"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-semibold text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))] disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>

      <span
        className="inline-flex min-w-[3.5rem] items-center justify-center rounded-md border border-[rgb(var(--accent))] px-2 py-0.5 text-xs font-semibold text-[rgb(var(--accent))]"
        style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
        aria-live="polite"
      >
        {value}%
      </span>

      <button
        type="button"
        onClick={handleReset}
        disabled={value === 100}
        title="Reset zoom ke 100% (Ctrl/Cmd + 0)"
        className="ml-1 text-xs font-medium text-[rgb(var(--text-muted))] underline-offset-2 hover:text-[rgb(var(--text))] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset
      </button>
    </div>
  )
}
