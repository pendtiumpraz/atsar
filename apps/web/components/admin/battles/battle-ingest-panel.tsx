// `<BattleIngestPanel />` — Tambah Perang (AI) + recent ingest jobs list.
//
// Two responsibilities glued together so the admin doesn't have to navigate
// between pages while watching their job complete:
//
//   1. A hero card with a "Tambah Perang (AI)" button that opens the
//      `<BattleIngestDialog />`. On submit it POSTs to
//      `/api/v1/admin/battles/ingest` and starts polling
//      `/api/v1/admin/battles/ingest-jobs/[jobId]` every 5s.
//
//   2. A history list at the bottom of recent ingest jobs (pending, running,
//      completed, failed) with deep-links into the draft edit page once a
//      battle id is available.
//
// Mirrors `<FigureIngestPanel />`.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { BattleIngestDialog } from './battle-ingest-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, ApiClientError } from '@/lib/api/client'

const JOBS_QUERY_KEY = ['admin', 'battle-ingest-jobs'] as const

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

interface IngestJobRow {
  id: string
  status: JobStatus
  payload: { name: string; type?: string; hints?: string }
  resultBattleId: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
}

interface JobDetail extends IngestJobRow {
  battleSlug: string | null
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

export function BattleIngestPanel() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  /** Job ids the user has submitted in this tab and wants polled. */
  const [activeJobIds, setActiveJobIds] = useState<string[]>([])

  const jobsQuery = useQuery({
    queryKey: JOBS_QUERY_KEY,
    queryFn: () => api.get<IngestJobRow[]>('/admin/battles/ingest'),
    refetchInterval: activeJobIds.length > 0 ? 10_000 : false,
  })

  const submit = useMutation({
    mutationFn: (body: { name: string; type?: string; hints?: string }) =>
      api.post<{ jobId: string; status: JobStatus; publishError?: string }>(
        '/admin/battles/ingest',
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
                Tambah Perang dengan AI
              </h2>
              <p className="max-w-xl text-sm text-[rgb(var(--text-muted))]">
                Ketik nama perang — misal &ldquo;Perang Badar&rdquo; — dan
                asisten akan mencari narasi dari domain whitelist, lalu
                menyusun draf bilingual dengan kutipan per fakta.
              </p>
            </div>
          </div>

          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            Tambah Perang (AI)
          </Button>
        </div>
      </section>

      <BattleIngestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(values) => submit.mutate(values)}
        submitting={submit.isPending}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[rgb(var(--text))]">Riwayat Riset</h3>
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
            Belum ada riset AI yang dijalankan. Klik tombol di atas untuk memulai.
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
  pollEnabled: boolean
  onTerminal: () => void
}

function ActiveJobRow({ job, pollEnabled, onTerminal }: ActiveJobRowProps) {
  const isTerminal = job.status === 'completed' || job.status === 'failed'
  const shouldPoll = pollEnabled && !isTerminal

  const detailQuery = useQuery({
    queryKey: ['admin', 'battle-ingest-job', job.id],
    queryFn: () => api.get<JobDetail>(`/admin/battles/ingest-jobs/${job.id}`),
    refetchInterval: shouldPoll ? 5_000 : false,
    enabled: shouldPoll,
  })

  const detail = detailQuery.data
  const effective = useMemo<IngestJobRow & Partial<JobDetail>>(() => {
    return { ...job, ...(detail ?? {}) } as IngestJobRow & Partial<JobDetail>
  }, [job, detail])

  useEffect(() => {
    if (!detail) return
    if (detail.status === 'completed') {
      toast.success(`Draf "${detail.payload?.name ?? ''}" siap untuk ditinjau`)
      onTerminal()
    } else if (detail.status === 'failed') {
      toast.error(detail.errorMessage ?? 'Riset AI gagal')
      onTerminal()
    }
  }, [detail, onTerminal])

  const battleSlug = effective.battleSlug ?? null
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
          {effective.payload?.type ? (
            <Badge variant="outline">{effective.payload.type}</Badge>
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
        {status === 'completed' && battleSlug ? (
          <Button asChild size="sm" variant="outline">
            <a href={`/admin/battles/${battleSlug}/edit`}>Lihat draf</a>
          </Button>
        ) : null}
        {status === 'completed' && !battleSlug && effective.resultBattleId ? (
          <span className="text-xs text-[rgb(var(--text-muted))]">
            id: {effective.resultBattleId}
          </span>
        ) : null}
      </div>
    </li>
  )
}
