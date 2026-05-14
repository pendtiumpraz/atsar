// Tab "Sumber" — citation list, grouped by domain.
//
// Citations are stored in the `citations` table with
// `contentType = 'figure'` and `contentId = <figureId>`. The
// `getBySlug` payload LEFT-JOINs `whitelist_domains` so trusted sources
// surface their display name and priority for sorting.

'use client'

import { useMemo } from 'react'

import type { FigureCitationEntry, FigureDetailData } from '../figure-detail'

export interface FigureSumberTabProps {
  data: FigureDetailData
}

interface DomainGroup {
  domain: string
  displayName: string
  priority: number
  items: FigureCitationEntry[]
}

function groupByDomain(citations: FigureCitationEntry[]): DomainGroup[] {
  const buckets = new Map<string, DomainGroup>()
  for (const c of citations) {
    const domain = c.sourceDomain ?? safeDomain(c.sourceUrl) ?? '(tanpa domain)'
    const displayName = c.domain?.displayName ?? domain
    const priority = c.domain?.priority ?? 0
    const existing = buckets.get(domain)
    if (existing) {
      existing.items.push(c)
    } else {
      buckets.set(domain, { domain, displayName, priority, items: [c] })
    }
  }
  return Array.from(buckets.values()).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.displayName.localeCompare(b.displayName, 'id')
  })
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function formatDate(value: string | Date | null): string | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function FigureSumberTab({ data }: FigureSumberTabProps) {
  const citations = data.citations ?? []
  const groups = useMemo(() => groupByDomain(citations), [citations])

  if (citations.length === 0) {
    return (
      <EmptyState
        title="Belum ada sumber citation"
        body="Konten tokoh ini masih dalam tahap draf atau menunggu review. Sumber-sumber rujukan akan terlampir di sini setelah proses extraction dan verifikasi selesai."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-[rgb(var(--text-muted))]">
        {citations.length} sumber tercatat untuk tokoh ini, dikelompokkan menurut domain dan
        diurutkan berdasarkan prioritas whitelist.
      </p>

      {groups.map((g) => (
        <section key={g.domain} className="flex flex-col gap-2">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
            <span className="text-[rgb(var(--text))] normal-case">{g.displayName}</span>
            <span className="text-xs font-normal text-[rgb(var(--text-faint))]">
              · {g.domain} · {g.items.length} kutipan
            </span>
          </h3>
          <ul className="flex flex-col gap-2">
            {g.items.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-sm"
              >
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[rgb(var(--primary))] hover:underline"
                >
                  {c.sourceUrl}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
                  {c.fieldPath ? (
                    <span>
                      Field:{' '}
                      <code className="rounded bg-[rgb(var(--surface))] px-1 py-0.5 text-[rgb(var(--text))]">
                        {c.fieldPath}
                      </code>
                    </span>
                  ) : null}
                  {c.sourceLang ? <span>Bahasa: {c.sourceLang.toUpperCase()}</span> : null}
                  {c.confidenceScore ? (
                    <span>Skor: {Number(c.confidenceScore).toFixed(2)}</span>
                  ) : null}
                  {(() => {
                    const dt = formatDate(c.extractedAt ?? c.createdAt)
                    return dt ? <span>Diakses: {dt}</span> : null
                  })()}
                </div>
                {c.sourceExcerptId ? (
                  <blockquote className="mt-2 border-l-2 border-[rgb(var(--border))] pl-3 text-xs text-[rgb(var(--text))]">
                    {c.sourceExcerptId}
                  </blockquote>
                ) : null}
                {c.sourceExcerptAr ? (
                  <blockquote
                    dir="rtl"
                    lang="ar"
                    className="mt-2 border-r-2 border-[rgb(var(--border))] pr-3 text-xs text-[rgb(var(--text))]"
                    style={{ fontFamily: 'var(--font-body-arab)' }}
                  >
                    {c.sourceExcerptAr}
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
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
