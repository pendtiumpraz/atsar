// Tab "Sumber" — citation list, grouped by domain.
//
// Citations are stored in the `citations` table with
// `contentType = 'figure'` and `contentId = <figureId>`. The
// `getBySlug` payload LEFT-JOINs `whitelist_domains` so trusted sources
// surface their display name and priority for sorting.
//
// Additions vs the v1 layout:
//   - "Data direfresh terakhir: …" line at top (admin only — data source is
//     the admin re-ingest-jobs endpoint).
//   - Admin "Perbarui sekarang" link → opens the same <FigureReingestDialog />
//     used by the hero, so refreshes are one click from any tab.

'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { FigureReingestDialog } from '../figure-reingest-dialog'
import type { FigureReingestCurrentSnapshot } from '@/components/admin/figures/figure-reingest-panel'
import type { FigureCitationEntry, FigureDetailData } from '../figure-detail'

export interface FigureSumberTabProps {
  data: FigureDetailData
  isAdmin?: boolean
}

interface DomainGroup {
  domain: string
  displayName: string
  priority: number
  items: FigureCitationEntry[]
}

interface ReingestJobLite {
  id: string
  type: string
  status: string
  finishedAt: string | null
  createdAt: string | null
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

function formatRelative(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const then = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'baru saja'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`
  return `${Math.floor(diff / 86_400_000)} hari lalu`
}

function buildReingestSnapshot(data: FigureDetailData): FigureReingestCurrentSnapshot {
  const r = data as unknown as Record<string, unknown>
  return {
    biographyId: data.biographyId ?? null,
    biographyAr: data.biographyAr ?? null,
    summaryId: data.summaryId ?? null,
    summaryAr: data.summaryAr ?? null,
    kunyahId: data.kunyahId ?? null,
    kunyahAr: data.kunyahAr ?? null,
    laqabId: data.laqabId ?? null,
    laqabAr: data.laqabAr ?? null,
    birthDateAh: data.birthDateAh ?? null,
    birthDateCe: data.birthDateCe ?? null,
    deathDateAh: data.deathDateAh ?? null,
    deathDateCe: data.deathDateCe ?? null,
    specialty: (r['specialty'] as string[] | null) ?? null,
    madhab: (r['madhab'] as string | null) ?? null,
    rijalGrade: data.rijalGrade ?? null,
  }
}

export function FigureSumberTab({ data, isAdmin = false }: FigureSumberTabProps) {
  const citations = data.citations ?? []
  const groups = useMemo(() => groupByDomain(citations), [citations])
  const [reingestOpen, setReingestOpen] = useState(false)

  // Admin-only: fetch latest re-ingest job to render "Data direfresh terakhir".
  const recentQuery = useQuery<ReingestJobLite[]>({
    queryKey: ['figure', data.slug, 're-ingest-jobs'],
    queryFn: () =>
      api.get<ReingestJobLite[]>(
        `/admin/figures/${encodeURIComponent(data.slug)}/re-ingest-jobs?limit=1`,
      ),
    enabled: isAdmin,
    staleTime: 60_000,
    retry: false,
  })

  const latest = recentQuery.data?.[0] ?? null
  const lastRefreshedAt = latest?.finishedAt ?? latest?.createdAt ?? null

  return (
    <div className="flex flex-col gap-5">
      {/* Refresh meta row (admin only) */}
      {isAdmin ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/60 px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
          <span>
            {lastRefreshedAt ? (
              <>
                Data direfresh terakhir oleh AI:{' '}
                <span className="font-medium text-[rgb(var(--text))]">
                  {formatRelative(lastRefreshedAt)}
                </span>
              </>
            ) : (
              <>Data awal seed Atsar — belum pernah di-refresh ulang.</>
            )}
          </span>
          <button
            type="button"
            onClick={() => setReingestOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--accent))]/10 px-2 py-1 font-medium text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/15"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Perbarui sekarang
          </button>
        </div>
      ) : null}

      {citations.length === 0 ? (
        <EmptyState
          title="Belum ada sumber citation"
          body="Konten tokoh ini masih dalam tahap draf atau menunggu review. Sumber-sumber rujukan akan terlampir di sini setelah proses extraction dan verifikasi selesai."
          extra={
            isAdmin ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setReingestOpen(true)}
                className="mt-3"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Crawl via AI sekarang
              </Button>
            ) : null
          }
        />
      ) : (
        <>
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
        </>
      )}

      {isAdmin ? (
        <FigureReingestDialog
          open={reingestOpen}
          onOpenChange={setReingestOpen}
          slug={data.slug}
          current={buildReingestSnapshot(data)}
        />
      ) : null}
    </div>
  )
}

function EmptyState({
  title,
  body,
  extra,
}: {
  title: string
  body: string
  extra?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
      {extra}
    </div>
  )
}
