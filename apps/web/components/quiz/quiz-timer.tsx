// Countdown timer for an active quiz attempt (WIREFRAMES §14).
//
// - 'use client' — uses `setInterval` and `Date.now()`.
// - Computes remaining time from `startedAtIso + durationSeconds * 1000` so a
//   page refresh / re-mount picks up the correct value (no drift from a
//   stored "remaining" counter).
// - Fires `onExpire` exactly once when the timer crosses zero. The session
//   page uses this to auto-submit the attempt.
// - Renders a subtle warning state in the final 60 seconds.

'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export interface QuizTimerProps {
  /** ISO string of when the attempt was created (server time). */
  startedAtIso: string
  /** Quiz duration in seconds. Null/0 means no time limit — timer hides. */
  durationSeconds: number | null
  /** Called exactly once when the timer reaches zero. */
  onExpire?: () => void
  className?: string
}

function format(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function QuizTimer({
  startedAtIso,
  durationSeconds,
  onExpire,
  className,
}: QuizTimerProps) {
  // Memoize the deadline timestamp from the inputs. Parsing happens once per
  // prop change — keeps the tick effect cheap.
  const deadlineMs =
    durationSeconds && durationSeconds > 0
      ? new Date(startedAtIso).getTime() + durationSeconds * 1000
      : null

  const [now, setNow] = useState<number>(() => Date.now())
  const firedRef = useRef(false)

  useEffect(() => {
    if (deadlineMs === null) return
    const handle = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(handle)
  }, [deadlineMs])

  useEffect(() => {
    if (deadlineMs === null) return
    if (firedRef.current) return
    if (now >= deadlineMs) {
      firedRef.current = true
      onExpire?.()
    }
  }, [now, deadlineMs, onExpire])

  if (deadlineMs === null) return null

  const remainingMs = Math.max(0, deadlineMs - now)
  const remainingSec = Math.ceil(remainingMs / 1000)
  const isWarning = remainingSec <= 60
  const isExpired = remainingSec === 0

  return (
    <div
      role="timer"
      aria-live={isWarning ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-mono tabular-nums',
        'bg-[rgb(var(--surface))]',
        isExpired
          ? 'border-[rgb(var(--danger))] text-[rgb(var(--danger))]'
          : isWarning
            ? 'border-[rgb(var(--warning))] text-[rgb(var(--warning))]'
            : 'border-[rgb(var(--border))] text-[rgb(var(--text))]',
        className,
      )}
    >
      <span aria-hidden>⏱</span>
      <span>{format(remainingSec)}</span>
    </div>
  )
}
