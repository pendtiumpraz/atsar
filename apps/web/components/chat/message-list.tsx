'use client'

// Streaming message transcript for /chat (WIREFRAMES §15).
//
// - User bubbles right-align on accent surface.
// - Assistant bubbles left-align on the elevated surface and render
//   markdown via `react-markdown` (+ `remark-gfm` for tables/links).
// - Tool-invocation parts (Vercel AI SDK v4 structured output) render as
//   chips inside the assistant bubble: amber + spinner while running,
//   emerald + collapsible result when done. Indonesian labels for each
//   tool name.
// - Citation chips appear under each assistant message when its content
//   contains URLs (parsed by <CitationLink/>).
// - Arabic content is detected per message and flipped to RTL.
// - Auto-scrolls to bottom on new tokens, including during streaming.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Message } from 'ai/react'
import type { ToolInvocation } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Wrench,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { CitationLink, extractUrls } from './citation-link'

interface MessageListProps {
  messages: ReadonlyArray<Message>
  isLoading: boolean
  error?: Error
}

// Arabic block — covers core letters, presentation forms, and supplemental ranges.
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

function isArabicHeavy(text: string): boolean {
  if (!text) return false
  // Count Arabic glyphs vs total letters — flip to RTL when >40% are Arabic.
  let arabic = 0
  let letters = 0
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) {
      letters++
      if (ARABIC_RE.test(ch)) arabic++
    }
  }
  return letters > 0 && arabic / letters > 0.4
}

// ─── Tool name → Indonesian label ────────────────────────────────────────
// Keep these in sync with `packages/ai/src/chat-tools.ts`. Unknown names
// fall back to the raw tool id wrapped in backticks.
const TOOL_LABELS: Record<string, string> = {
  search_figures: 'Mencari tokoh',
  get_figure_detail: 'Membaca detail tokoh',
  search_locations: 'Mencari lokasi',
  search_battles: 'Mencari perang',
  search_web: 'Mencari di whitelist web',
  discover_figures: 'Menelusuri kandidat tokoh',
  discover_battles: 'Menelusuri kandidat perang',
  ingest_figure: 'Antrekan crawl tokoh',
  ingest_figure_batch: 'Antrekan crawl batch tokoh',
  reingest_figure: 'Refresh tokoh',
  reingest_figure_batch: 'Refresh batch tokoh',
  ingest_battle: 'Antrekan crawl perang',
  ingest_battle_batch: 'Antrekan crawl batch perang',
  reingest_battle: 'Refresh perang',
  list_pending_jobs: 'Cek status antrian',
  get_recent_drafts: 'Cek draf terbaru',
}

function labelForTool(name: string): string {
  return TOOL_LABELS[name] ?? name
}

// ─── Main list ────────────────────────────────────────────────────────────

export function MessageList({ messages, isLoading, error }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on every render that adds content. We tie it to message
  // length AND the last message's content length so streaming tokens push
  // the viewport too. We also include the count of last-message parts so
  // tool-invocation appearance pushes scroll.
  const tail =
    messages.length > 0 ? messages[messages.length - 1]!.content.length : 0
  const partsTail =
    messages.length > 0 ? messages[messages.length - 1]!.parts?.length ?? 0 : 0
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, tail, partsTail, isLoading])

  const empty = messages.length === 0
  const lastAssistantIsStreaming =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]!.role === 'assistant'

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6 md:px-8"
      role="log"
      aria-live="polite"
      aria-busy={isLoading}
    >
      {empty ? <EmptyState /> : null}

      <ul className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {/* Typing indicator: only shown when waiting for the FIRST assistant
            token. Once tokens stream in, the bubble itself shows progress. */}
        {isLoading && !lastAssistantIsStreaming ? (
          <li className="flex items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>AI sedang mengetik…</span>
          </li>
        ) : null}

        {error ? (
          <li className="flex items-start gap-2 rounded-md border border-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.08)] px-3 py-2 text-xs text-[rgb(var(--danger))]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
            <span>{error.message || 'Gagal memuat respons AI.'}</span>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const content = message.content ?? ''
  // For RTL detection use the full text (parts + content) so multi-part
  // Arabic messages still flip.
  const fullText = useMemo(() => collectText(message), [message])
  const rtl = useMemo(() => isArabicHeavy(fullText), [fullText])
  const urls = useMemo(
    () => (message.role === 'assistant' ? extractUrls(fullText) : []),
    [fullText, message.role],
  )

  // Build the renderable parts list. Prefer `message.parts` (AI SDK v4
  // structured output); fall back to a single text part if absent.
  // MUST be called before any early return — hooks ordering rule.
  const parts = useMemo(() => normaliseParts(message), [message])

  if (message.role === 'system') return null

  return (
    <li
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-2 rounded-lg border px-4 py-3 text-sm shadow-sm md:max-w-[75%]',
          isUser
            ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--text))]'
            : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text))]',
        )}
        dir={rtl ? 'rtl' : 'ltr'}
        lang={rtl ? 'ar' : undefined}
      >
        <header className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          {isUser ? (
            <span>Kamu</span>
          ) : (
            <>
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>Athar AI</span>
            </>
          )}
        </header>

        <div className="flex flex-col gap-2">
          {parts.map((part, idx) => {
            if (part.kind === 'text') {
              // Empty placeholder for streaming start: render a single
              // ellipsis so the bubble has *some* content visible.
              const text = part.text || (isUser ? content : '…')
              return (
                <ProseBlock
                  key={`text-${idx}`}
                  text={text}
                  isUser={isUser}
                />
              )
            }
            // tool-invocation
            return (
              <ToolChip
                key={part.toolInvocation.toolCallId || `tool-${idx}`}
                invocation={part.toolInvocation}
              />
            )
          })}
        </div>

        {urls.length > 0 ? (
          <footer className="flex flex-wrap gap-1.5 pt-1">
            {urls.map((url) => (
              <CitationLink key={url} url={url} />
            ))}
          </footer>
        ) : null}
      </div>
    </li>
  )
}

// ─── Prose block (text part) ─────────────────────────────────────────────

function ProseBlock({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none leading-relaxed',
        'prose-headings:text-[rgb(var(--text))] prose-p:text-[rgb(var(--text))] prose-strong:text-[rgb(var(--text))]',
        'prose-a:text-[rgb(var(--accent))] prose-a:no-underline hover:prose-a:underline',
        'prose-code:rounded prose-code:bg-[rgb(var(--bg-elevated))] prose-code:px-1 prose-code:py-0.5 prose-code:text-xs',
        'prose-pre:bg-[rgb(var(--bg-elevated))] prose-pre:text-[rgb(var(--text))]',
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words">{text}</p>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Open links in a new tab — answers commonly reference external
            // hadith / sirah sources.
            a: ({ href, children, ...rest }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...rest}
              >
                {children}
              </a>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      )}
    </div>
  )
}

// ─── Tool invocation chip ────────────────────────────────────────────────

function ToolChip({ invocation }: { invocation: ToolInvocation }) {
  const [expanded, setExpanded] = useState(false)
  const label = labelForTool(invocation.toolName)
  const state = invocation.state

  // Detect error state: AI SDK packs tool errors into `result` with shape
  // `{ error: ... }` (also our chat-tools convention). Keep the heuristic
  // permissive so the chip turns red on anything that looks wrong.
  const hasError =
    state === 'result' &&
    !!invocation.result &&
    typeof invocation.result === 'object' &&
    'error' in (invocation.result as Record<string, unknown>) &&
    (invocation.result as { error?: unknown }).error != null

  const tone = hasError
    ? 'error'
    : state === 'result'
      ? 'done'
      : 'running'

  const borderClass =
    tone === 'error'
      ? 'border-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.08)]'
      : tone === 'done'
        ? 'border-[rgb(var(--success,16_185_129))] bg-[rgb(var(--success,16_185_129)/0.08)]'
        : 'border-[rgb(var(--warning,245_158_11))] bg-[rgb(var(--warning,245_158_11)/0.10)]'

  const iconColorClass =
    tone === 'error'
      ? 'text-[rgb(var(--danger))]'
      : tone === 'done'
        ? 'text-[rgb(var(--success,16_185_129))]'
        : 'text-[rgb(var(--warning,245_158_11))]'

  // Args preview. While streaming the partial args, show "Menyiapkan…".
  const argsPreview = useMemo(() => {
    if (state === 'partial-call') return null
    try {
      const json = JSON.stringify(invocation.args ?? {})
      if (json === '{}') return null
      return json.length > 120 ? `${json.slice(0, 117)}…` : json
    } catch {
      return null
    }
  }, [invocation.args, state])

  // Result preview (collapsible).
  const resultJson = useMemo(() => {
    if (state !== 'result') return null
    try {
      return JSON.stringify(invocation.result, null, 2)
    } catch {
      return String(invocation.result)
    }
  }, [invocation, state])

  const resultPreviewShort = useMemo(() => {
    if (!resultJson) return null
    const flat = resultJson.replace(/\s+/g, ' ').trim()
    return flat.length > 120 ? `${flat.slice(0, 117)}…` : flat
  }, [resultJson])

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-md border px-2.5 py-2 text-xs',
        borderClass,
        tone === 'running' && 'animate-pulse',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5">
        {tone === 'running' ? (
          <Loader2
            className={cn('h-3.5 w-3.5 flex-none animate-spin', iconColorClass)}
            aria-hidden="true"
          />
        ) : tone === 'done' ? (
          <Check
            className={cn('h-3.5 w-3.5 flex-none', iconColorClass)}
            aria-hidden="true"
          />
        ) : (
          <AlertCircle
            className={cn('h-3.5 w-3.5 flex-none', iconColorClass)}
            aria-hidden="true"
          />
        )}
        <Wrench className="h-3 w-3 flex-none text-[rgb(var(--text-muted))]" aria-hidden="true" />
        <span className="font-medium text-[rgb(var(--text))]">{label}</span>
        {tone === 'done' && !hasError ? (
          <span className="text-[rgb(var(--text-muted))]">selesai</span>
        ) : null}
        {hasError ? (
          <span className="text-[rgb(var(--danger))]">gagal</span>
        ) : null}
      </div>

      {/* Args / partial state */}
      {state === 'partial-call' ? (
        <span className="font-mono text-[0.7rem] text-[rgb(var(--text-muted))]">
          Menyiapkan…
        </span>
      ) : argsPreview ? (
        <span
          className="break-all font-mono text-[0.7rem] text-[rgb(var(--text-muted))]"
          title={(() => {
            try {
              return JSON.stringify(invocation.args, null, 2)
            } catch {
              return ''
            }
          })()}
        >
          {argsPreview}
        </span>
      ) : null}

      {/* Result block (collapsible) */}
      {state === 'result' && resultJson ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 self-start text-[0.7rem] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] focus-visible:outline-none focus-visible:underline"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
            {expanded ? 'Sembunyikan detail' : 'Lihat detail'}
          </button>
          {expanded ? (
            <pre className="max-h-64 overflow-auto rounded bg-[rgb(var(--bg-elevated))] p-2 text-[0.7rem] leading-snug text-[rgb(var(--text))]">
              {resultJson}
            </pre>
          ) : resultPreviewShort ? (
            <span className="break-all font-mono text-[0.7rem] text-[rgb(var(--text-muted))]">
              {resultPreviewShort}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ─── Parts normalisation ─────────────────────────────────────────────────

type RenderPart =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolInvocation: ToolInvocation }

/**
 * Walks `message.parts` (AI SDK v4 structured output) and yields a flat
 * list of renderable items. Falls back to a single text part when `parts`
 * is missing (e.g. user messages or rehydrated history).
 */
function normaliseParts(message: Message): RenderPart[] {
  const parts = message.parts
  if (!parts || parts.length === 0) {
    return [{ kind: 'text', text: message.content ?? '' }]
  }
  const out: RenderPart[] = []
  for (const part of parts) {
    if (part.type === 'text') {
      out.push({ kind: 'text', text: part.text })
    } else if (part.type === 'tool-invocation') {
      out.push({ kind: 'tool', toolInvocation: part.toolInvocation })
    }
    // We currently ignore `reasoning`, `source`, `file`, `step-start`
    // parts — none are used by our server route. Reasoning could be
    // surfaced later via a collapsible "Pemikiran model" block.
  }
  if (out.length === 0) {
    // All-skipped fallback so the bubble still renders something.
    out.push({ kind: 'text', text: message.content ?? '' })
  }
  return out
}

/** Concatenates text + tool-args text for RTL / URL extraction passes. */
function collectText(message: Message): string {
  if (!message.parts || message.parts.length === 0) return message.content ?? ''
  const buf: string[] = []
  for (const part of message.parts) {
    if (part.type === 'text') buf.push(part.text)
  }
  return buf.join('\n')
}

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyState() {
  const suggestions = [
    'Siapa istri pertama Nabi ﷺ?',
    'Apa perbedaan antara tabi’in dan tabi’ut tabi’in?',
    'Ceritakan tokoh ulama Andalusia.',
  ]
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--primary)/0.12)] text-[rgb(var(--primary))]">
        <Sparkles className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-[rgb(var(--text))]">
          Tanya apa saja tentang sirah dan tokoh salaf
        </h2>
        <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
          Jawaban bersumber dari kitab klasik dan referensi tepercaya. Selalu
          verifikasi dengan ulama.
        </p>
      </div>
      <ul className="flex w-full flex-col gap-2 text-left">
        {suggestions.map((s) => (
          <li
            key={s}
            className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-xs text-[rgb(var(--text-muted))]"
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}
