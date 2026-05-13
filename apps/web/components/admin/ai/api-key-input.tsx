'use client'

// Atsar — API key input with show/hide toggle.
//
// API keys are encrypted server-side (AES-256-GCM with `AI_MASTER_KEY`).
// Once a provider has been created, this UI never displays the raw key
// again. The server returns only the last 4 characters (`apiKeyLast4`)
// so we can render a stable mask like `sk-•••••8d73`.
//
// Modes
// ─────
// 1. **Create** (no `existingLast4` prop): plain text input with eye
//    toggle. The user types the secret once and we POST it as `apiKey`.
// 2. **Display** (`existingLast4` set, `onRotate` is undefined): shows
//    masked key; no editing allowed.
// 3. **Rotate** (`existingLast4` set + `onRotate` callback): shows the
//    masked key plus a "Rotate" button. Clicking flips into edit mode
//    where the user can paste a new key and submit.

import { Eye, EyeOff, RotateCw, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ApiKeyInputProps {
  /** Bound value when the field is editable. */
  value: string
  onChange: (next: string) => void
  /** Last 4 chars of the stored encrypted key. If provided, render mask. */
  existingLast4?: string | null
  /** Show inline "Rotate" affordance + edit mode. */
  onRotate?: (newKey: string) => void | Promise<void>
  /** Optional placeholder. */
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Optional id for label association. */
  id?: string
  /** When true, the parent form is currently submitting. */
  submitting?: boolean
}

export function maskApiKey(last4: string | null | undefined): string {
  const trimmed = (last4 ?? '').trim()
  if (!trimmed) return 'sk-•••••••••'
  return `sk-•••••${trimmed.slice(-4)}`
}

export function ApiKeyInput({
  value,
  onChange,
  existingLast4,
  onRotate,
  placeholder = 'sk-...',
  disabled,
  className,
  id,
  submitting,
}: ApiKeyInputProps) {
  const [reveal, setReveal] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const hasExisting = Boolean(existingLast4)

  // Display-only / masked mode (no rotate handler) ─ never reveal stored key.
  if (hasExisting && !onRotate && !editing) {
    return (
      <div
        className={cn(
          'flex h-10 items-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 font-mono text-sm text-[rgb(var(--text-muted))]',
          className,
        )}
        aria-label="API key tersimpan (tersembunyi)"
      >
        {maskApiKey(existingLast4)}
      </div>
    )
  }

  // Masked mode with a "Rotate" button.
  if (hasExisting && onRotate && !editing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div
          className="flex h-10 flex-1 items-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 font-mono text-sm text-[rgb(var(--text-muted))]"
          aria-label="API key tersimpan (tersembunyi)"
        >
          {maskApiKey(existingLast4)}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange('')
            setReveal(false)
            setEditing(true)
          }}
          disabled={disabled || submitting}
        >
          <RotateCw className="h-3.5 w-3.5" />
          Rotate
        </Button>
      </div>
    )
  }

  // Edit mode (create flow OR rotate-in-progress).
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <Input
          id={id}
          type={reveal ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || submitting}
          className="pr-10 font-mono"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
          aria-label={reveal ? 'Sembunyikan API key' : 'Tampilkan API key'}
          tabIndex={-1}
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Rotate flow: Save / Cancel buttons inline. */}
      {hasExisting && onRotate && editing ? (
        <>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              const next = value.trim()
              if (!next) return
              await onRotate(next)
              onChange('')
              setEditing(false)
              setReveal(false)
            }}
            disabled={disabled || submitting || value.trim().length === 0}
          >
            Simpan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange('')
              setEditing(false)
              setReveal(false)
            }}
            disabled={submitting}
            aria-label="Batal rotate"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : null}
    </div>
  )
}
