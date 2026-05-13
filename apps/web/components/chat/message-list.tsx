'use client'

// Streaming message transcript for /chat (WIREFRAMES §15).
//
// - User bubbles right-align on accent surface.
// - Assistant bubbles left-align on the elevated surface and render
//   markdown via `react-markdown` (+ `remark-gfm` for tables/links).
// - Citation chips appear under each assistant message when its content
//   contains URLs (parsed by <CitationLink/>).
// - Arabic content is detected per message and flipped to RTL.
// - Auto-scrolls to bottom on new tokens, including during streaming.

import { useEffect, useMemo, useRef } from 'react'
import type { Message } from 'ai/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'

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

export function MessageList({ messages, isLoading, error }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on every render that adds content. We tie it to message
  // length AND the last message's content length so streaming tokens push
  // the viewport too.
  const tail =
    messages.length > 0 ? messages[messages.length - 1]!.content.length : 0
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, tail, isLoading])

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
  const rtl = useMemo(() => isArabicHeavy(content), [content])
  const urls = useMemo(
    () => (message.role === 'assistant' ? extractUrls(content) : []),
    [content, message.role],
  )

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
            <p className="whitespace-pre-wrap break-words">{content}</p>
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
              {content || '…'}
            </ReactMarkdown>
          )}
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
