// Live-source preview for the reviewer side-by-side view (WIREFRAMES §27).
//
// Many publishers (islamqa.info, dorar.net, …) ship `X-Frame-Options: SAMEORIGIN`
// or strict CSP, which silently blanks a sandboxed iframe. We cannot read the
// frame's contentDocument cross-origin, so we infer "blocked" by waiting for
// `load` for a short window — when no load event fires within `LOAD_TIMEOUT_MS`
// we treat the source as un-embeddable and fall back to:
//
//   1. The text excerpt the extractor stored on the citation
//      (`sourceExcerptId` / `sourceExcerptAr`).
//   2. A prominent "Buka di tab baru" link.
//
// The fallback path is also surfaced as an "Open in new tab" affordance even
// when the iframe loads successfully — some PDFs and JS-heavy pages render
// inside the iframe but are still easier to inspect in a real tab.

'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Time we wait for the iframe `load` event before assuming X-Frame-Options blocked it. */
const LOAD_TIMEOUT_MS = 4000

export interface SourceIframeProps {
  /** Absolute URL of the source document. */
  url: string
  /** Optional plain-text excerpt to show when the embed is blocked. */
  excerpt?: string | null
  /** RTL when the excerpt is Arabic. */
  excerptDir?: 'ltr' | 'rtl'
  /** Short label rendered above the iframe (e.g. domain). */
  label?: string | null
  className?: string
}

type LoadState = 'loading' | 'loaded' | 'blocked'

export function SourceIframe({
  url,
  excerpt,
  excerptDir = 'ltr',
  label,
  className,
}: SourceIframeProps) {
  const [state, setState] = useState<LoadState>('loading')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    setState('loading')
    const timer = setTimeout(() => {
      // Heuristic: if `load` never fired we very likely got X-Frame-Options
      // refused. Promote to "blocked" so the fallback UI takes over.
      setState((prev) => (prev === 'loading' ? 'blocked' : prev))
    }, LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [url])

  const onIframeLoad = () => setState('loaded')

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[rgb(var(--border))] px-3 py-2 text-xs">
        <div className="min-w-0 truncate text-[rgb(var(--text-muted))]">
          {label ?? 'Sumber'}
          <span className="mx-1 text-[rgb(var(--text-faint))]">·</span>
          <span className="truncate text-[rgb(var(--text-faint))]">{url}</span>
        </div>
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer">
            ↗ Buka tab baru
          </a>
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {state !== 'blocked' ? (
          <iframe
            ref={iframeRef}
            src={url}
            title={label ?? 'Sumber'}
            // `allow-same-origin` is intentionally omitted — combining it with
            // `allow-scripts` would let the framed page escape the sandbox.
            sandbox="allow-scripts allow-popups allow-forms"
            referrerPolicy="no-referrer"
            onLoad={onIframeLoad}
            className={cn(
              'h-full w-full bg-white transition-opacity',
              state === 'loading' && 'opacity-60',
            )}
          />
        ) : (
          <div className="h-full overflow-auto p-4">
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Halaman sumber tidak dapat ditampilkan dalam iframe (kemungkinan
              ada CSP / X-Frame-Options). Buka di tab baru, atau gunakan
              kutipan di bawah.
            </p>
            {excerpt ? (
              <div
                lang={excerptDir === 'rtl' ? 'ar' : undefined}
                dir={excerptDir}
                className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[rgb(var(--text))]"
                style={excerptDir === 'rtl' ? { fontFamily: 'var(--font-body-arab)' } : undefined}
              >
                {excerpt}
              </div>
            ) : (
              <p className="text-sm text-[rgb(var(--text-muted))]">
                Tidak ada kutipan tersimpan untuk citation ini.
              </p>
            )}
          </div>
        )}

        {state === 'loading' ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgb(var(--surface))]/70 text-xs text-[rgb(var(--text-muted))]">
            Memuat sumber…
          </div>
        ) : null}
      </div>
    </div>
  )
}
