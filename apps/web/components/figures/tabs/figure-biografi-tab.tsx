// Tab "Biografi" — readability-overhauled biography renderer.
//
// The schema carries three Indonesian variants (pre-wafat, post-wafat, and
// a legacy single-block fallback) plus their Arabic mirrors.
//
// User feedback ("belum menarik untuk dibaca") drove this rewrite:
//
//   - A drop cap on the first paragraph (3-line height, accent colour).
//   - `space-y-4` between paragraphs, `leading-relaxed` for body type.
//   - Auto-detected pull quote: if the first matched `"…"` ≥ 30 chars exists
//     in the Indonesian text, render it centred as a pull-out.
//   - A muted "Wafat: …" callout at the end if `deathDateNotes` is set.
//   - On wide screens (≥1024px) we lay Indonesian + Arabic side-by-side
//     (grid `lg:grid-cols-2 gap-8`). On narrow screens we stack vertically
//     with the existing ID/AR toggle.
//   - Lightweight markdown: split on blank lines into <p>; keep single
//     newlines as <br>. No external markdown library.
//
// Empty-state stays clean ("Biografi sedang dipersiapkan…") with an admin
// CTA to open the re-ingest dialog (via the parent passing `onCrawl`).

'use client'

import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FigureDetailData } from '../figure-detail'

type Lang = 'id' | 'ar'

export interface FigureBiografiTabProps {
  data: FigureDetailData
  /** Admin sees a "Crawl via AI" CTA in the empty state. */
  isAdmin?: boolean
  /** Called when admin hits "Crawl via AI" in the empty state. */
  onRequestCrawl?: () => void
}

interface BiographySection {
  /** Section heading shown in the chosen language. */
  title: string
  /** Block content (may contain newlines — paragraphs split on blank lines). */
  body: string
}

function pickBiography(data: FigureDetailData, lang: Lang): BiographySection[] {
  const sections: BiographySection[] = []
  if (lang === 'id') {
    if (data.biographyPreWafatId?.trim()) {
      sections.push({ title: 'Sebelum Wafat', body: data.biographyPreWafatId.trim() })
    }
    if (data.biographyPostWafatId?.trim()) {
      sections.push({ title: 'Sepeninggal', body: data.biographyPostWafatId.trim() })
    }
    if (sections.length === 0 && data.biographyId?.trim()) {
      sections.push({ title: 'Biografi', body: data.biographyId.trim() })
    }
  } else {
    if (data.biographyPreWafatAr?.trim()) {
      sections.push({ title: 'قبل الوفاة', body: data.biographyPreWafatAr.trim() })
    }
    if (data.biographyPostWafatAr?.trim()) {
      sections.push({ title: 'بعد الوفاة', body: data.biographyPostWafatAr.trim() })
    }
    if (sections.length === 0 && data.biographyAr?.trim()) {
      sections.push({ title: 'الترجمة', body: data.biographyAr.trim() })
    }
  }
  return sections
}

// ─── Markdown-lite paragraph splitter ─────────────────────────────────
// We treat `\n\n` (or any blank-line run) as a paragraph break and single
// newlines inside a paragraph as a soft <br>. No other markdown features
// are honoured — by design, per task constraints.
function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

// Regex extract the first quoted string >= 30 chars. Both ASCII "…" and
// Arabic «…» / ﴿…﴾ / curly “…” are supported.
const PULL_QUOTE_RE = /(?:"([^"\n]{30,300})"|“([^”\n]{30,300})”|«([^»\n]{30,300})»)/u
function extractPullQuote(body: string): string | null {
  const m = PULL_QUOTE_RE.exec(body)
  if (!m) return null
  return m[1] || m[2] || m[3] || null
}

// ─── Paragraph renderer with optional drop cap ────────────────────────
function Paragraph({
  text,
  isFirst,
  lang,
  withDropCap,
}: {
  text: string
  isFirst: boolean
  lang: Lang
  withDropCap: boolean
}) {
  const lines = text.split('\n')
  // Lift the first character out as a drop-cap if requested AND this is the
  // first paragraph AND the language is Indonesian (drop caps look awkward
  // in RTL Arabic display fonts at small sizes — skip for AR).
  if (isFirst && withDropCap && lang === 'id' && lines[0] && lines[0].length > 1) {
    const first = lines[0]
    const initial = first.slice(0, 1)
    const rest = first.slice(1)
    return (
      <p
        className="text-[15px] leading-relaxed text-[rgb(var(--text))] sm:text-base"
        style={{ fontFamily: 'var(--font-body-latin)' }}
      >
        <span
          aria-hidden
          className="float-left mr-2 mt-1 text-5xl font-semibold leading-[0.85] text-[rgb(var(--accent))] sm:text-6xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          {initial}
        </span>
        {rest}
        {lines.slice(1).map((ln, i) => (
          <React.Fragment key={i}>
            <br />
            {ln}
          </React.Fragment>
        ))}
      </p>
    )
  }
  return (
    <p
      className={cn(
        lang === 'ar'
          ? 'text-base leading-[1.9] text-[rgb(var(--text))]'
          : 'text-[15px] leading-relaxed text-[rgb(var(--text))] sm:text-base',
      )}
      style={{
        fontFamily: lang === 'ar' ? 'var(--font-body-arab)' : 'var(--font-body-latin)',
      }}
    >
      {lines.map((ln, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <br /> : null}
          {ln}
        </React.Fragment>
      ))}
    </p>
  )
}

function PullQuote({ text, lang }: { text: string; lang: Lang }) {
  return (
    <blockquote
      lang={lang}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="not-prose my-2 border-y border-[rgb(var(--border))] py-4 text-center text-lg italic leading-snug text-[rgb(var(--text))] sm:text-xl"
      style={{
        fontFamily:
          lang === 'ar' ? 'var(--font-display-arab)' : 'var(--font-display-latin)',
      }}
    >
      <span aria-hidden className="mr-1 align-top text-2xl text-[rgb(var(--accent))]">
        “
      </span>
      {text}
      <span aria-hidden className="ml-1 align-top text-2xl text-[rgb(var(--accent))]">
        ”
      </span>
    </blockquote>
  )
}

// ─── Rendered section (lang-specific column) ──────────────────────────
function SectionColumn({
  sections,
  lang,
  pullQuoteText,
}: {
  sections: BiographySection[]
  lang: Lang
  /** Optional pull-quote string — placed between paragraph 1 & 2 of the
   *  first section to give the article a visual breath. */
  pullQuoteText: string | null
}) {
  if (sections.length === 0) return null
  return (
    <div className="flex flex-col gap-6" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {sections.map((section, sIdx) => {
        const paragraphs = splitParagraphs(section.body)
        return (
          <section key={section.title} className="flex flex-col gap-3">
            <h3
              className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--text-muted))]"
              style={{
                fontFamily:
                  lang === 'ar' ? 'var(--font-body-arab)' : 'var(--font-body-latin)',
              }}
            >
              {section.title}
            </h3>
            <div className="flex flex-col gap-4">
              {paragraphs.map((p, idx) => (
                <React.Fragment key={idx}>
                  <Paragraph
                    text={p}
                    isFirst={sIdx === 0 && idx === 0}
                    lang={lang}
                    withDropCap
                  />
                  {/* Slot the pull-quote after the first paragraph of the very
                      first section, only on the Indonesian column. */}
                  {sIdx === 0 && idx === 0 && pullQuoteText && lang === 'id' ? (
                    <PullQuote text={pullQuoteText} lang="id" />
                  ) : null}
                </React.Fragment>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────

export function FigureBiografiTab({
  data,
  isAdmin = false,
  onRequestCrawl,
}: FigureBiografiTabProps) {
  const hasId = Boolean(
    data.biographyPreWafatId?.trim() ||
      data.biographyPostWafatId?.trim() ||
      data.biographyId?.trim(),
  )
  const hasAr = Boolean(
    data.biographyPreWafatAr?.trim() ||
      data.biographyPostWafatAr?.trim() ||
      data.biographyAr?.trim(),
  )

  // On narrow viewports we expose the legacy ID/AR toggle. On wide
  // viewports the two columns sit side-by-side so the toggle is hidden.
  const [narrowLang, setNarrowLang] = React.useState<Lang>(hasId ? 'id' : 'ar')

  const idSections = React.useMemo(() => pickBiography(data, 'id'), [data])
  const arSections = React.useMemo(() => pickBiography(data, 'ar'), [data])

  // Extract the pull quote from the Indonesian text once.
  const pullQuoteText = React.useMemo(() => {
    const joined = idSections.map((s) => s.body).join('\n\n')
    return joined ? extractPullQuote(joined) : null
  }, [idSections])

  // Empty state
  if (!hasId && !hasAr) {
    return (
      <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
        <div className="mb-1 font-semibold text-[rgb(var(--text))]">
          Biografi belum tersedia
        </div>
        <p>Biografi sedang dipersiapkan. Akan diperbarui setelah review ustadz selesai.</p>
        {isAdmin && onRequestCrawl ? (
          <div className="mt-3">
            <Button type="button" size="sm" onClick={onRequestCrawl}>
              Crawl via AI
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  // ── Wide-screen dual column ─────────────────────────────────────────
  // We render BOTH languages simultaneously on lg+ screens via CSS Grid.
  // Below lg we collapse to the active toggle.
  const showBothBigScreen = hasId && hasAr

  // Summary lead — rendered above the columns in whichever language the
  // toggle selected (narrow) or Indonesian preferred (wide).
  const summary = hasId
    ? data.summaryId || data.summaryAr
    : data.summaryAr || data.summaryId

  return (
    <div className="flex flex-col gap-5">
      {/* Narrow-screen toggle (hidden on lg+) */}
      {hasId && hasAr ? (
        <div className="flex items-center gap-1 self-start rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-1 text-xs lg:hidden">
          <button
            type="button"
            onClick={() => setNarrowLang('id')}
            className={
              'rounded px-2 py-1 transition-colors ' +
              (narrowLang === 'id'
                ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--text))] shadow-sm'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]')
            }
          >
            Indonesia
          </button>
          <button
            type="button"
            onClick={() => setNarrowLang('ar')}
            className={
              'rounded px-2 py-1 transition-colors ' +
              (narrowLang === 'ar'
                ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--text))] shadow-sm'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]')
            }
          >
            العربية
          </button>
        </div>
      ) : null}

      {/* Summary lead — lang-aware */}
      {summary ? (
        <p
          lang={hasId ? 'id' : 'ar'}
          dir={hasId ? 'ltr' : 'rtl'}
          className="text-base italic leading-relaxed text-[rgb(var(--text-muted))] sm:text-lg"
          style={{
            fontFamily: hasId ? 'var(--font-body-latin)' : 'var(--font-body-arab)',
          }}
        >
          {summary}
        </p>
      ) : null}

      {showBothBigScreen ? (
        <>
          {/* Wide-screen dual column */}
          <div className="hidden gap-10 lg:grid lg:grid-cols-2">
            <SectionColumn sections={idSections} lang="id" pullQuoteText={pullQuoteText} />
            <SectionColumn sections={arSections} lang="ar" pullQuoteText={null} />
          </div>
          {/* Narrow-screen single column (driven by toggle) */}
          <div className="lg:hidden">
            {narrowLang === 'id' ? (
              <SectionColumn sections={idSections} lang="id" pullQuoteText={pullQuoteText} />
            ) : (
              <SectionColumn sections={arSections} lang="ar" pullQuoteText={null} />
            )}
          </div>
        </>
      ) : hasId ? (
        <SectionColumn sections={idSections} lang="id" pullQuoteText={pullQuoteText} />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Belum diterjemahkan</Badge>
          </div>
          <SectionColumn sections={arSections} lang="ar" pullQuoteText={null} />
        </>
      )}

      {/* Wafat note callout */}
      {data.deathDateNotes ? (
        <aside className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/60 px-4 py-3 text-sm text-[rgb(var(--text-muted))]">
          <span className="font-semibold text-[rgb(var(--text))]">Wafat: </span>
          {data.deathDateNotes}
        </aside>
      ) : null}
    </div>
  )
}

// `deathDateNotes` isn't in the strict `FigureDetailData` interface but it's
// in the spread `...row` from the server. Tell TS via module augmentation.
declare module '../figure-detail' {
  interface FigureDetailData {
    deathDateNotes?: string | null
  }
}
