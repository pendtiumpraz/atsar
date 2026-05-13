// `/pdf-builder/jobs` — paginated history of the current user's PDF jobs.
//
// Client component: uses TanStack Query to fetch `pdfApi.list()` and keeps
// pagination state in `useState`. Server-side filtering by user is enforced
// by the API; the UI just renders rows.

'use client'

import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { pdfApi, type Paginated } from '@/lib/api/endpoints'

interface PdfJobRow {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  templateSlug?: string | null
  titleId?: string | null
  titleAr?: string | null
  createdAt?: string | null
  completedAt?: string | null
  figureCount?: number | null
}

const STATUS_LABEL: Record<PdfJobRow['status'], string> = {
  queued: 'Antri',
  processing: 'Memproses',
  done: 'Selesai',
  failed: 'Gagal',
}

const STATUS_VARIANT: Record<
  PdfJobRow['status'],
  'secondary' | 'warning' | 'success' | 'destructive'
> = {
  queued: 'secondary',
  processing: 'warning',
  done: 'success',
  failed: 'destructive',
}

const ID_DATETIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return ID_DATETIME.format(d)
}

export default function PdfJobsListPage() {
  const [page, setPage] = useState(1)
  const params = useMemo(() => ({ page, perPage: 20 }), [page])

  const { data, isPending, isError, isFetching } = useQuery<Paginated<PdfJobRow>>({
    queryKey: ['pdf-jobs', params],
    queryFn: () => pdfApi.list(params) as Promise<Paginated<PdfJobRow>>,
    placeholderData: keepPreviousData,
    // Refetch every 15s so in-flight jobs surface their final state without
    // the user manually refreshing the list.
    refetchInterval: 15_000,
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const perPage = data?.perPage ?? 20
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Riwayat PDF
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">
            Daftar buku PDF yang Anda buat. Klik untuk melihat status atau
            mengunduh.
          </p>
        </div>
        <Button asChild>
          <Link href="/pdf-builder">+ Buat Buku Baru</Link>
        </Button>
      </header>

      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        {isPending ? (
          <JobsListSkeleton />
        ) : isError ? (
          <div
            role="alert"
            className="p-6 text-center text-sm text-[rgb(var(--danger))]"
          >
            Gagal memuat riwayat PDF.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[rgb(var(--text-muted))]">
            Belum ada PDF yang dibuat.
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/pdf-builder">Mulai buat sekarang →</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul aria-busy={isFetching ? 'true' : 'false'} className="divide-y divide-[rgb(var(--border))]">
            {rows.map((job) => {
              const title = job.titleId || job.titleAr || `Job ${job.id.slice(0, 8)}`
              return (
                <li key={job.id}>
                  <Link
                    href={`/pdf-builder/jobs/${job.id}`}
                    className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-[rgb(var(--bg-elevated))] focus-visible:bg-[rgb(var(--bg-elevated))] focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
                        {title}
                      </div>
                      <div className="mt-0.5 text-xs text-[rgb(var(--text-muted))]">
                        {job.templateSlug ? (
                          <span className="capitalize">{job.templateSlug}</span>
                        ) : null}
                        {typeof job.figureCount === 'number' ? (
                          <span> · {job.figureCount} tokoh</span>
                        ) : null}
                        <span> · {formatTs(job.createdAt)}</span>
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[job.status]} className="shrink-0">
                      {STATUS_LABEL[job.status]}
                    </Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-[rgb(var(--text-muted))]">
          <span>
            Halaman {page} / {totalPages} · {total} job
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function JobsListSkeleton() {
  return (
    <ul className="divide-y divide-[rgb(var(--border))]" aria-hidden>
      {Array.from({ length: 5 }).map((_, idx) => (
        <li key={idx} className="flex items-center gap-3 p-4">
          <div className="h-10 flex-1 animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-[rgb(var(--bg-elevated))]" />
        </li>
      ))}
    </ul>
  )
}
