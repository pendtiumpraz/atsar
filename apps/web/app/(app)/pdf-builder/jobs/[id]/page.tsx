// `/pdf-builder/jobs/[id]` — per-job status & download.
//
// Polls `pdfApi.get(id)` every 5 seconds while the job is in flight
// (`queued` / `processing`). Once the worker reports `done` or `failed` the
// polling stops automatically — TanStack Query's `refetchInterval` accepts a
// callback that returns `false` to short-circuit.

'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { use } from 'react'
import { ArrowLeft, Download } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { pdfApi } from '@/lib/api/endpoints'

interface PdfJobDetail {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  templateSlug?: string | null
  titleId?: string | null
  titleAr?: string | null
  paperSize?: string | null
  orientation?: string | null
  languageMode?: string | null
  figureIds?: string[] | null
  figureCount?: number | null
  createdAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  downloadUrl?: string | null
  errorMessage?: string | null
  /** 0..100 percent — optional, backend may not always supply. */
  progress?: number | null
}

const STATUS_LABEL: Record<PdfJobDetail['status'], string> = {
  queued: 'Antri',
  processing: 'Memproses',
  done: 'Selesai',
  failed: 'Gagal',
}

const STATUS_VARIANT: Record<
  PdfJobDetail['status'],
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

interface PageProps {
  // Next 15: `params` is now a Promise.
  params: Promise<{ id: string }>
}

export default function PdfJobDetailPage({ params }: PageProps) {
  // `use()` unwraps the Promise in a client component — fine in Next 15.
  const { id } = use(params)

  const { data, isPending, isError, error } = useQuery<PdfJobDetail>({
    queryKey: ['pdf-job', id],
    queryFn: () => pdfApi.get(id) as Promise<PdfJobDetail>,
    // Poll every 5s until terminal state. Returning `false` stops polling.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'done' || status === 'failed') return false
      return 5_000
    },
    refetchIntervalInBackground: false,
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/pdf-builder/jobs">
            <ArrowLeft className="h-4 w-4" />
            Riwayat
          </Link>
        </Button>
      </div>

      {isPending ? (
        <DetailSkeleton />
      ) : isError ? (
        <div
          role="alert"
          className="rounded-lg border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-6 text-sm text-[rgb(var(--danger))]"
        >
          Gagal memuat status job.
          {error instanceof Error ? (
            <div className="mt-1 opacity-80">{error.message}</div>
          ) : null}
        </div>
      ) : data ? (
        <JobBody job={data} />
      ) : null}
    </div>
  )
}

function JobBody({ job }: { job: PdfJobDetail }) {
  const title = job.titleId || job.titleAr || `Job ${job.id.slice(0, 8)}`
  const isTerminal = job.status === 'done' || job.status === 'failed'

  return (
    <article className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[rgb(var(--border))] pb-4">
        <div className="min-w-0">
          <h1
            className="truncate text-xl font-semibold text-[rgb(var(--text))] sm:text-2xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            {title}
          </h1>
          {job.titleAr && job.titleId ? (
            <div
              lang="ar"
              dir="rtl"
              className="mt-0.5 text-sm text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {job.titleAr}
            </div>
          ) : null}
        </div>
        <Badge variant={STATUS_VARIANT[job.status]} className="shrink-0">
          {STATUS_LABEL[job.status]}
        </Badge>
      </header>

      {!isTerminal ? (
        <div
          className="mt-4 flex items-center gap-3 rounded-md border border-dashed border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] px-4 py-3 text-sm"
          aria-live="polite"
        >
          <span
            aria-hidden
            className="inline-block h-3 w-3 animate-pulse rounded-full bg-[rgb(var(--accent))]"
          />
          <span>
            {job.status === 'queued'
              ? 'Job sedang menunggu pekerja…'
              : 'Worker sedang merender PDF…'}
            {typeof job.progress === 'number' ? ` (${job.progress}%)` : null}
          </span>
        </div>
      ) : null}

      {job.status === 'failed' ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] px-4 py-3 text-sm text-[rgb(var(--danger))]"
        >
          {job.errorMessage || 'Gagal merender PDF. Silakan coba lagi.'}
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <dt className="text-[rgb(var(--text-muted))]">Template</dt>
        <dd className="font-medium capitalize sm:col-span-2">
          {job.templateSlug ?? '—'}
        </dd>

        <dt className="text-[rgb(var(--text-muted))]">Kertas</dt>
        <dd className="font-medium uppercase sm:col-span-2">
          {job.paperSize ?? '—'}
          {job.orientation ? ` · ${job.orientation}` : ''}
        </dd>

        <dt className="text-[rgb(var(--text-muted))]">Bahasa</dt>
        <dd className="font-medium uppercase sm:col-span-2">
          {job.languageMode ?? '—'}
        </dd>

        <dt className="text-[rgb(var(--text-muted))]">Tokoh</dt>
        <dd className="font-medium sm:col-span-2">
          {job.figureCount ?? job.figureIds?.length ?? '—'}
        </dd>

        <dt className="text-[rgb(var(--text-muted))]">Dibuat</dt>
        <dd className="font-medium sm:col-span-2">{formatTs(job.createdAt)}</dd>

        {job.startedAt ? (
          <>
            <dt className="text-[rgb(var(--text-muted))]">Mulai</dt>
            <dd className="font-medium sm:col-span-2">{formatTs(job.startedAt)}</dd>
          </>
        ) : null}

        {job.completedAt ? (
          <>
            <dt className="text-[rgb(var(--text-muted))]">Selesai</dt>
            <dd className="font-medium sm:col-span-2">
              {formatTs(job.completedAt)}
            </dd>
          </>
        ) : null}
      </dl>

      <footer className="mt-6 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border))] pt-4">
        {job.status === 'done' && job.downloadUrl ? (
          <Button asChild>
            <a href={job.downloadUrl} target="_blank" rel="noopener noreferrer" download>
              <Download className="h-4 w-4" />
              Unduh PDF
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/pdf-builder">Buat Buku Baru</Link>
        </Button>
      </footer>
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div
      aria-hidden
      className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6"
    >
      <div className="h-7 w-1/2 animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
      <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="h-4 w-full animate-pulse rounded bg-[rgb(var(--bg-elevated))]"
          />
        ))}
      </div>
    </div>
  )
}
