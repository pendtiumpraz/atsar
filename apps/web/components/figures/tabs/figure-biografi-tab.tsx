// Tab "Biografi" — renders the figure's biography fields.
//
// The schema carries three Indonesian variants (pre-wafat, post-wafat, and
// a legacy single-block fallback) plus their Arabic mirrors. We surface a
// simple language toggle (ID / AR) and render whichever variants are
// populated — pre/post if available, otherwise the legacy block.
//
// Empty state: a friendly "sedang dipersiapkan" message that names the
// editorial process — NOT the placeholder word "Coming Soon".

'use client'

import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import type { FigureDetailData } from '../figure-detail'

type Lang = 'id' | 'ar'

export interface FigureBiografiTabProps {
  data: FigureDetailData
}

interface BiographySection {
  /** Section heading shown in the chosen language. */
  title: string
  /** Block content (may contain newlines — we preserve them with whitespace-pre-wrap). */
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

export function FigureBiografiTab({ data }: FigureBiografiTabProps) {
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

  // Default to whichever language has content (prefer Indonesian).
  const [lang, setLang] = useState<Lang>(hasId ? 'id' : hasAr ? 'ar' : 'id')

  const sections = useMemo(() => pickBiography(data, lang), [data, lang])

  const summary = lang === 'id'
    ? data.summaryId || data.summaryAr
    : data.summaryAr || data.summaryId

  if (!hasId && !hasAr) {
    return (
      <EmptyState
        title="Biografi belum tersedia"
        body="Biografi sedang dipersiapkan. Akan diperbarui setelah review ustadz selesai."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Language toggle — only show when both variants exist */}
      {hasId && hasAr ? (
        <div className="flex items-center gap-1 self-start rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-1 text-xs">
          <button
            type="button"
            onClick={() => setLang('id')}
            className={
              'rounded px-2 py-1 transition-colors ' +
              (lang === 'id'
                ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--text))] shadow-sm'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]')
            }
          >
            Indonesia
          </button>
          <button
            type="button"
            onClick={() => setLang('ar')}
            className={
              'rounded px-2 py-1 transition-colors ' +
              (lang === 'ar'
                ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--text))] shadow-sm'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]')
            }
          >
            العربية
          </button>
        </div>
      ) : null}

      {summary ? (
        <p
          lang={lang}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className="text-base italic text-[rgb(var(--text-muted))]"
          style={{
            fontFamily:
              lang === 'ar' ? 'var(--font-body-arab)' : 'var(--font-body-latin)',
          }}
        >
          {summary}
        </p>
      ) : null}

      {sections.map((section) => (
        <section
          key={section.title}
          lang={lang}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <h3
              className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
              style={{
                fontFamily:
                  lang === 'ar' ? 'var(--font-body-arab)' : 'var(--font-body-latin)',
              }}
            >
              {section.title}
            </h3>
            {lang === 'ar' && hasId === false ? (
              <Badge variant="secondary">Belum diterjemahkan</Badge>
            ) : null}
          </div>
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed text-[rgb(var(--text))]"
            style={{
              fontFamily:
                lang === 'ar' ? 'var(--font-body-arab)' : 'var(--font-body-latin)',
              fontSize: lang === 'ar' ? '1rem' : undefined,
              lineHeight: lang === 'ar' ? 1.9 : undefined,
            }}
          >
            {section.body}
          </div>
        </section>
      ))}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
    </div>
  )
}
