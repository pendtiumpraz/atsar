'use client'

// Citation chips for assistant messages (WIREFRAMES §15).
//
// The chat model is encouraged (via system prompt) to cite sources inline.
// We don't trust it to emit structured citations, so we post-process every
// assistant message body, extract `http(s)://…` URLs, dedupe, and surface
// them as small footer chips. Clicking opens the source in a new tab.

import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'

interface CitationLinkProps {
  url: string
  /** Optional label; defaults to the URL hostname. */
  label?: string
  className?: string
}

// Greedy URL matcher that stops at whitespace and common closing punctuation.
// Bracketed/parenthesised wrappers from markdown (e.g. `(https://…)`, `[…]`)
// are stripped after the fact. Backticks/quotes likewise.
const URL_REGEX = /https?:\/\/[^\s<>[\]()"'`]+/gi
const TRAILING_PUNCT_RE = /[.,;:!?)\]}'"`]+$/

/** Extract unique URLs from a free-form string, preserving order of appearance. */
export function extractUrls(input: string): string[] {
  if (!input) return []
  const matches = input.match(URL_REGEX)
  if (!matches) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of matches) {
    const url = raw.replace(TRAILING_PUNCT_RE, '')
    if (!url) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/** Best-effort hostname; falls back to the raw URL if parsing fails. */
function deriveLabel(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function CitationLink({ url, label, className }: CitationLinkProps) {
  const display = label ?? deriveLabel(url)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={cn(
        'inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-0.5 text-[0.65rem] font-medium text-[rgb(var(--text-muted))] transition-colors hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
        className,
      )}
    >
      <ExternalLink className="h-2.5 w-2.5 flex-none" aria-hidden="true" />
      <span className="truncate">{display}</span>
    </a>
  )
}
