'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '@/lib/theme'

interface ThemeOption {
  value: ThemeMode
  label: string
  Icon: typeof Sun
}

const OPTIONS: readonly ThemeOption[] = [
  { value: 'light', label: 'Terang', Icon: Sun },
  { value: 'dark', label: 'Gelap', Icon: Moon },
  { value: 'auto', label: 'Otomatis', Icon: Monitor },
] as const

interface ThemeToggleProps {
  /** Extra classes applied to the trigger button. */
  className?: string
  /** Render style — defaults to a dropdown menu. */
  variant?: 'dropdown' | 'segmented'
}

/**
 * Theme toggle — 3-state control (Light / Dark / Auto).
 *
 * Defaults to a dropdown variant; pass `variant="segmented"` for an inline row
 * of icon buttons. F1's `@/components/ui/dropdown-menu` isn't a hard dependency
 * yet, so this uses a plain accessible `<button>` + popover pattern.
 */
export function ThemeToggle({ className, variant = 'dropdown' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  if (variant === 'segmented') {
    return <SegmentedToggle className={className} theme={theme} onChange={setTheme} />
  }

  return <DropdownToggle className={className} theme={theme} onChange={setTheme} />
}

/* ------------------------------------------------------------------ */
/* Dropdown variant                                                    */
/* ------------------------------------------------------------------ */

interface VariantProps {
  className?: string
  theme: ThemeMode
  onChange: (mode: ThemeMode) => void
}

function DropdownToggle({ className, theme, onChange }: VariantProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2]!
  const CurrentIcon = current.Icon

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-label="Ubah tema"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md',
          'border border-[color:var(--border,transparent)] bg-[color:var(--bg,transparent)]',
          'text-[color:var(--text)] transition-colors',
          'hover:bg-[color:var(--surface,rgba(0,0,0,0.04))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]',
        )}
      >
        <CurrentIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Pilihan tema"
          className={cn(
            'absolute right-0 z-50 mt-2 min-w-[10rem] overflow-hidden rounded-md',
            'border border-[color:var(--border,rgba(0,0,0,0.08))]',
            'bg-[color:var(--surface,var(--bg))] text-[color:var(--text)]',
            'shadow-lg',
          )}
        >
          {OPTIONS.map(({ value, label, Icon }) => {
            const active = value === theme
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm',
                  'transition-colors',
                  'hover:bg-[color:var(--primary)]/10',
                  active && 'text-[color:var(--primary)]',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1 text-left">{label}</span>
                {active && (
                  <span aria-hidden="true" className="text-xs">
                    {'✓'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented variant                                                   */
/* ------------------------------------------------------------------ */

function SegmentedToggle({ className, theme, onChange }: VariantProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Pilihan tema"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border p-1',
        'border-[color:var(--border,rgba(0,0,0,0.08))]',
        'bg-[color:var(--surface,var(--bg))]',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = value === theme
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(value)}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]',
              active
                ? 'bg-[color:var(--primary)] text-[color:var(--on-primary,white)]'
                : 'text-[color:var(--text)] hover:bg-[color:var(--primary)]/10',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
