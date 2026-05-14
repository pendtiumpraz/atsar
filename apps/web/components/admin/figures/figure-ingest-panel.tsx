// `<FigureIngestPanel />` — Tambah Tokoh (AI) + recent ingest jobs list.
//
// Two responsibilities glued together so the admin doesn't have to navigate
// between pages while watching their job complete:
//
//   1. A hero card with a "Tambah Tokoh (AI)" button that opens the
//      `<FigureIngestDialog />`. On submit it POSTs to
//      `/api/v1/admin/figures/ingest` and starts polling
//      `/api/v1/admin/figures/ingest-jobs/[jobId]` every 5s.
//
//   2. A history list at the bottom of recent ingest jobs (pending, running,
//      completed, failed) with deep-links into the draft edit page once a
//      figure id is available.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { FigureIngestDialog } from './figure-ingest-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, ApiClientError } from '@/lib/api/client'

const JOBS_QUERY_KEY = ['admin', 'figure-ingest-jobs'] as const

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

interface IngestJobRow {
  id: string
  status: JobStatus
  payload: { name: string; category: string; gender?: string; hints?: string }
  resultFigureId: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
}

interface JobDetail extends IngestJobRow {
  figureSlug: string | null
  startedAt: string | null
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'Antri',
  running: 'Berjalan',
  completed: 'Selesai',
  failed: 'Gagal',
}

const STATUS_VARIANT: Record<JobStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  running: 'secondary',
  completed: 'default',
  failed: 'destructive',
}

export function FigureIngestPanel() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  /** Job ids the user has submitted in this tab and wants polled. */
  const [activeJobIds, setActiveJobIds] = useState<string[]>([])

  // Recent jobs list — refetched on demand + every 10s when an active job is
  // in flight so the list stays in step with the per-job poll.
  const jobsQuery = useQuery({
    queryKey: JOBS_QUERY_KEY,
    queryFn: () => api.get<IngestJobRow[]>('/admin/figures/ingest'),
    refetchInterval: activeJobIds.length > 0 ? 10_000 : false,
  })

  const submit = useMutation({
    mutationFn: (body: {
      name: string
      category: string
      gender?: string
      hints?: string
    }) => api.post<{ jobId: string; status: JobStatus; publishError?: string }>(
      '/admin/figures/ingest',
      body,
    ),
    onSuccess: (data) => {
      toast.success('Memulai riset AI… proses ~30–60 detik')
      setActiveJobIds((prev) => [...prev, data.jobId])
      void queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY })
      setDialogOpen(false)
      if (data.publishError) {
        toast.warning(
          'QStash gagal publish — job tercatat tapi worker tidak ter-trigger di local dev.',
        )
      }
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal memulai riset'
      toast.error(msg)
    },
  })

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[rgb(var(--accent))]/10 p-2 text-[rgb(var(--accent))]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-[rgb(var(--text))]">
                Tambah Tokoh dengan AI
              </h2>
              <p className="max-w-xl text-sm text-[rgb(var(--text-muted))]">
                Ketik nama tokoh — misal &ldquo;Imam Bukhari&rdquo; — dan asisten
                akan mencari biografi dari domain whitelist, lalu menyusun draf
                bilingual dengan kutipan per fakta untuk Anda tinjau.
              </p>
            </div>
          </div>

          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            Tambah Tokoh (AI)
          </Button>
        </div>
      </section>

      <FigureIngestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(values) => submit.mutate(values)}
        submitting={submit.isPending}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[rgb(var(--text))]">
            Riwayat Riset
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void jobsQuery.refetch()}
            disabled={jobsQuery.isFetching}
          >
            {jobsQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Muat ulang
          </Button>
        </div>

        {jobsQuery.isLoading ? (
          <div className="rounded-lg border border-dashed border-[rgb(var(--border))] p-6 text-sm text-[rgb(var(--text-muted))]">
            Memuat…
          </div>
        ) : (jobsQuery.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgb(var(--border))] p-6 text-sm text-[rgb(var(--text-muted))]">
            Belum ada riset AI yang dijalankan. Klik tombol di atas untuk
            memulai.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {(jobsQuery.data ?? []).map((job) => (
              <ActiveJobRow
                key={job.id}
                job={job}
                pollEnabled={activeJobIds.includes(job.id)}
                onTerminal={() => {
                  setActiveJobIds((prev) => prev.filter((id) => id !== job.id))
                  void queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY })
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

interface ActiveJobRowProps {
  job: IngestJobRow
  /** Tell us to poll this row at 5s; we'll stop on terminal status. */
  pollEnabled: boolean
  onTerminal: () => void
}

function ActiveJobRow({ job, pollEnabled, onTerminal }: ActiveJobRowProps) {
  const isTerminal = job.status === 'completed' || job.status === 'failed'
  const shouldPoll = pollEnabled && !isTerminal

  const detailQuery = useQuery({
    queryKey: ['admin', 'figure-ingest-job', job.id],
    queryFn: () => api.get<JobDetail>(`/admin/figures/ingest-jobs/${job.id}`),
    refetchInterval: shouldPoll ? 5_000 : false,
    enabled: shouldPoll,
  })

  const detail = detailQuery.data
  const effective = useMemo<IngestJobRow & Partial<JobDetail>>(() => {
    return { ...job, ...(detail ?? {}) } as IngestJobRow & Partial<JobDetail>
  }, [job, detail])

  // Surface terminal transitions: toast + invalidate the parent list. Guarded
  // by a ref keyed on jobId so a re-render that re-mounts this row with cached
  // terminal-status data doesn't re-fire the toast (which caused a visible
  // toast loop when the parent list invalidated the query after `onTerminal`).
  const firedTerminalRef = useRef<string | null>(null)
  useEffect(() => {
    if (!detail) return
    if (detail.status !== 'completed' && detail.status !== 'failed') return
    if (firedTerminalRef.current === job.id) return
    firedTerminalRef.current = job.id
    if (detail.status === 'completed') {
      toast.success(`Draft "${detail.payload?.name ?? ''}" siap untuk ditinjau`)
    } else {
      toast.error(detail.errorMessage ?? 'Riset AI gagal')
    }
    onTerminal()
  }, [detail, onTerminal, job.id])

  const figureSlug = effective.figureSlug ?? null
  const status = effective.status as JobStatus

  return (
    <li className="flex items-center justify-between rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-[rgb(var(--text))]">
            {effective.payload?.name ?? '—'}
          </span>
          <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
            {STATUS_LABEL[status] ?? status}
          </Badge>
          {effective.payload?.category ? (
            <Badge variant="outline">{effective.payload.category}</Badge>
          ) : null}
        </div>
        <div className="text-xs text-[rgb(var(--text-muted))]">
          {new Date(effective.createdAt).toLocaleString('id-ID')}
          {effective.errorMessage ? (
            <span className="ml-2 text-[rgb(var(--danger))]">{effective.errorMessage}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status === 'running' || status === 'pending' ? (
          <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--text-muted))]" />
        ) : null}
        {status === 'completed' && figureSlug ? (
          <Button asChild size="sm" variant="outline">
            <a href={`/admin/figures/${figureSlug}/edit`}>Lihat draf</a>
          </Button>
        ) : null}
        {status === 'completed' && !figureSlug && effective.resultFigureId ? (
          <span className="text-xs text-[rgb(var(--text-muted))]">id: {effective.resultFigureId}</span>
        ) : null}
      </div>
    </li>
  )
}
