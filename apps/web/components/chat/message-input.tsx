'use client'

// Composer for AI Chat (WIREFRAMES §15).
//
// - Textarea autosizes up to ~6 rows.
// - `Enter` submits, `Shift+Enter` inserts a newline.
// - While streaming, the send button morphs into a Stop button that aborts.
// - Token estimate uses the 1-token ≈ 4-char rule of thumb. It's only meant
//   to give the user a rough feel for cost — accurate billing happens
//   server-side via the AI SDK `usage` callback.

import { useEffect, useRef } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface MessageInputProps {
  value: string
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (event?: { preventDefault?: () => void }) => void
  onStop: () => void
  isLoading: boolean
  /** Disable submission with a tooltip when set (e.g. quota exceeded). */
  disabledReason?: string
}

const MAX_ROWS = 6
const LINE_HEIGHT_PX = 24

/** Rough token estimate — 1 token ≈ 4 characters (GPT-style heuristic). */
function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function MessageInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  disabledReason,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize: reset to `auto` first so the scrollHeight shrinks when the
  // user deletes text. Cap growth at MAX_ROWS lines, then let the textarea
  // become scrollable.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxPx = MAX_ROWS * LINE_HEIGHT_PX + 16 // +padding
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`
  }, [value])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (!canSend) return
      onSubmit()
    }
  }

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSend) return
    onSubmit(event)
  }

  const trimmed = value.trim()
  const tokens = estimateTokens(value)
  const canSend = !isLoading && trimmed.length > 0 && !disabledReason

  return (
    <form
      onSubmit={handleFormSubmit}
      className="border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 md:px-8"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={
              disabledReason
                ? disabledReason
                : 'Ketik pesan… (Enter kirim, Shift+Enter baris baru)'
            }
            disabled={!!disabledReason}
            rows={1}
            className="min-h-[44px] flex-1 resize-none py-3"
            aria-label="Ketik pesan ke AI Chat"
          />
          {isLoading ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onStop}
              aria-label="Hentikan respons"
              title="Hentikan respons"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="icon"
              disabled={!canSend}
              aria-label="Kirim pesan"
              title="Kirim pesan (Enter)"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-[0.65rem] text-[rgb(var(--text-muted))]">
          <span>
            {disabledReason
              ? disabledReason
              : 'Tekan Enter untuk kirim, Shift+Enter untuk baris baru.'}
          </span>
          <span aria-live="polite">
            ≈ {tokens.toLocaleString('id-ID')} token
          </span>
        </div>
      </div>
    </form>
  )
}
