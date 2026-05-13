// Side-by-side review surface (WIREFRAMES §27).
//
// Two columns:
//   - Left: live source preview via `<SourceIframe />`. When there are multiple
//     citations we render a tab strip so the reviewer can flip between them.
//   - Right: rendered Indonesian biography (`biography_id` / `description_id`)
//     with each citation rendered as an inline pill that, when clicked,
//     switches the active source tab in the left panel.
//
// Citation linkage strategy:
//   The DB stores citations with an optional `fieldPath` (e.g. `biographyId`,
//   `narrationsId`). We do NOT yet have anchor positions inside the prose, so
//   citations are listed as chips beneath the body. Clicking a chip swaps the
//   active source — that's the minimum viable bidirectional link.

'use client'

import { useMemo, useState } from 'react'

import { SourceIframe } from '@/components/reviewer/source-iframe'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Minimum citation shape we render. Matches `citations.$inferSelect`. */
export interface ReviewCitation {
  id: string
  sourceUrl: string
  sourceDomain?: string | null
  sourceExcerptId?: string | null
  sourceExcerptAr?: string | null
  sourceLang?: string | null
  fieldPath?: string | null
  confidenceScore?: number | string | null
}

export interface ReviewSideBySideProps {
  /** Indonesian body text (biography for figures, description for battles). */
  bodyId?: string | null
  /** Arabic body text — rendered as a small RTL aside when present. */
  bodyAr?: string | null
  /** Title shown above the right panel. */
  title?: string
  citations: ReviewCitation[]
}

/** Derive a friendly label from a citation row. */
function citationLabel(c: ReviewCitation, idx: number): string {
  if (c.sourceDomain) return c.sourceDomain
  try {
    return new URL(c.sourceUrl).hostname
  } catch {
    return `Sumber ${idx + 1}`
  }
}

/** Best-effort excerpt for the iframe fallback (prefer Indonesian, fall back to Arabic). */
function citationExcerpt(c: ReviewCitation): { text: string | null; dir: 'ltr' | 'rtl' } {
  if (c.sourceExcerptId) return { text: c.sourceExcerptId, dir: 'ltr' }
  if (c.sourceExcerptAr) return { text: c.sourceExcerptAr, dir: 'rtl' }
  return { text: null, dir: 'ltr' }
}

export function ReviewSideBySide({
  bodyId,
  bodyAr,
  title,
  citations,
}: ReviewSideBySideProps) {
  // Active citation index for the source-tab switcher. Defaults to first.
  const [activeIdx, setActiveIdx] = useState(0)

  // Empty array guard — keeps activeIdx logic simple.
  const hasCitations = citations.length > 0
  const safeIdx = hasCitations ? Math.min(activeIdx, citations.length - 1) : 0
  const active = hasCitations ? citations[safeIdx] : null

  // Memoise excerpt to avoid recomputing on every render.
  const excerpt = useMemo(
    () => (active ? citationExcerpt(active) : { text: null, dir: 'ltr' as const }),
    [active],
  )

  // Split the body into paragraphs (markdown-ish: blank-line separated).
  // We don't render full markdown here — the editor passes plain text /
  // newline-delimited paragraphs. F18 will plug in MDX rendering.
  const paragraphs = useMemo(() => {
    if (!bodyId) return []
    return bodyId
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
  }, [bodyId])

  return (
    <div className="grid min-h-[60vh] gap-4 lg:grid-cols-2">
      {/* ─── Left: source ─────────────────────────────────────────── */}
      <section className="flex min-h-[60vh] flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Sumber (live fetch)
        </h2>
        {hasCitations && citations.length > 1 ? (
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Daftar sumber">
            {citations.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={idx === safeIdx}
                onClick={() => setActiveIdx(idx)}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs transition-colors',
                  idx === safeIdx
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-white'
                    : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] hover:border-[rgb(var(--accent))]',
                )}
              >
                {idx + 1}. {citationLabel(c, idx)}
              </button>
            ))}
          </div>
        ) : null}

        {active ? (
          <SourceIframe
            url={active.sourceUrl}
            label={active.sourceDomain ?? citationLabel(active, safeIdx)}
            excerpt={excerpt.text}
            excerptDir={excerpt.dir}
            className="min-h-[55vh] flex-1"
          />
        ) : (
          <div className="flex min-h-[55vh] flex-1 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-sm text-[rgb(var(--text-muted))]">
            Konten ini belum memiliki citation sumber.
          </div>
        )}
      </section>

      {/* ─── Right: drafted content ───────────────────────────────── */}
      <section className="flex min-h-[60vh] flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Konten Atsar (draft)
        </h2>
        <article className="flex-1 overflow-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
          {title ? (
            <h3
              className="mb-3 text-xl font-semibold text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              {title}
            </h3>
          ) : null}

          {bodyAr ? (
            <aside
              lang="ar"
              dir="rtl"
              className="mb-4 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-base text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {bodyAr}
            </aside>
          ) : null}

          {paragraphs.length === 0 ? (
            <p className="text-sm italic text-[rgb(var(--text-muted))]">
              Konten Indonesia belum tersedia.
            </p>
          ) : (
            <div className="prose prose-sm max-w-none text-[rgb(var(--text))]">
              {paragraphs.map((p, idx) => (
                <p key={idx} className="mb-3 whitespace-pre-wrap leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* Citation chips — click to switch active source. Until we have
              true inline anchor positions, this is the bidirectional link. */}
          {hasCitations ? (
            <div className="mt-6 border-t border-[rgb(var(--border))] pt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
                Citation ({citations.length})
              </h4>
              <ul className="flex flex-wrap gap-2" role="list">
                {citations.map((c, idx) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(idx)}
                      aria-pressed={idx === safeIdx}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                        idx === safeIdx
                          ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                          : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] hover:border-[rgb(var(--accent))]',
                      )}
                      title={c.sourceUrl}
                    >
                      <span className="font-mono text-[10px] text-[rgb(var(--text-faint))]">
                        [{idx + 1}]
                      </span>
                      <span className="max-w-[18ch] truncate">
                        {citationLabel(c, idx)}
                      </span>
                      {c.fieldPath ? (
                        <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                          {c.fieldPath}
                        </Badge>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  )
}
