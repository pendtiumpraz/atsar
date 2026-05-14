// `<BattleReingestPanel />` — "Perbarui via AI" card on the battle edit page.
//
// Flow:
//   1. Admin picks a mode (`enrich` = isi field kosong saja, or `replace` =
//      timpa narasi & strategi) + a list of focus fields + optional hints,
//      then POSTs to `/api/v1/admin/battles/[slug]/re-ingest`.
//   2. Endpoint returns `202 { jobId, status: 'pending', publishError? }`.
//   3. We poll `/api/v1/admin/battles/[slug]/re-ingest-jobs?jobId=…` every 5s
//      until status is `completed` or `failed`, with a 3-minute timeout.
//   4. On `completed`, we surface a summary toast (the worker has already
//      merged the AI patch into the battle row). The admin refreshes the
//      edit form to see the new values.
//
// Mirrors `<FigureReingestPanel />` with battle-specific focus fields.

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/api/client'

type Mode = 'enrich' | 'replace'
type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

interface JobRow {
  id: string
  status: JobStatus
  payload?: {
    mode?: Mode
    focusFields?: string[]
    hints?: string
    metadata?: {
      fieldsChanged?: string[]
      sourcesUsed?: number
      citationsInserted?: number
      locationFilled?: boolean
      commanderFilled?: boolean
    }
  } | null
  errorCode?: string | null
  errorMessage?: string | null
  publishError?: string | null
  createdAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

interface FocusFieldGroup {
  id: string
  label: string
}

const FOCUS_FIELD_GROUPS: FocusFieldGroup[] = [
  { id: 'narrativeId', label: 'Narasi' },
  { id: 'strategyId', label: 'Strategi' },
  { id: 'significanceId', label: 'Signifikansi' },
  { id: 'eventDateAh', label: 'Tahun (H)' },
  { id: 'eventDateCe', label: 'Tahun (M)' },
  { id: 'opponentForce', label: 'Pasukan musuh' },
  { id: 'muslimCount', label: 'Jumlah muslim' },
  { id: 'opponentCount', label: 'Jumlah musuh' },
  { id: 'outcome', label: 'Hasil' },
  { id: 'casualtiesMuslim', label: 'Korban muslim' },
  { id: 'casualtiesOpponent', label: 'Korban musuh' },
  { id: 'citations', label: 'Sitasi' },
]

const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 3 * 60 * 1_000

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'baru saja'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`
  return `${Math.floor(diff / 86_400_000)} hari lalu`
}

function normaliseJob(raw: unknown): JobRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const status = (r['status'] as JobStatus) ?? 'pending'
  return {
    id: String(r['id'] ?? r['jobId'] ?? ''),
    status,
    payload: (r['payload'] ?? null) as JobRow['payload'],
    errorCode: (r['errorCode'] as string | null) ?? null,
    errorMessage: (r['errorMessage'] as string | null) ?? null,
    publishError: (r['publishError'] as string | null) ?? null,
    createdAt: (r['createdAt'] as string | null) ?? null,
    startedAt: (r['startedAt'] as string | null) ?? null,
    finishedAt: (r['finishedAt'] as string | null) ?? null,
  }
}

export interface BattleReingestPanelProps {
  slug: string
}

export function BattleReingestPanel({ slug }: BattleReingestPanelProps) {
  const router = useRouter()

  // Form state
  const [mode, setMode] = React.useState<Mode>('enrich')
  const [focus, setFocus] = React.useState<Set<string>>(
    () => new Set(['narrativeId', 'strategyId']),
  )
  const [hints, setHints] = React.useState('')

  // Job state
  const [submitting, setSubmitting] = React.useState(false)
  const [job, setJob] = React.useState<JobRow | null>(null)
  const [polling, setPolling] = React.useState(false)
  const [pollTimedOut, setPollTimedOut] = React.useState(false)

  // History
  const [recent, setRecent] = React.useState<JobRow | null>(null)

  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const pollDeadlineRef = React.useRef<number>(0)

  const stopPolling = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPolling(false)
  }, [])

  React.useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function loadRecent() {
      try {
        const raw = await api.get<unknown>(
          `/admin/battles/${encodeURIComponent(slug)}/re-ingest-jobs`,
        )
        if (cancelled) return
        const list = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>)['rows'])
            ? ((raw as Record<string, unknown>)['rows'] as unknown[])
            : null
        if (list && list.length > 0) {
          const parsed = normaliseJob(list[0])
          if (parsed) setRecent(parsed)
        }
      } catch {
        // 404 on first refresh is expected; silent.
      }
    }
    void loadRecent()
    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (focus.size === 0 && mode === 'replace') {
      toast.error('Mode "Replace" memerlukan minimal satu field fokus.')
      return
    }
    setSubmitting(true)
    setPollTimedOut(false)
    try {
      const body = {
        mode,
        focusFields: Array.from(focus),
        ...(hints.trim().length > 0 ? { hints: hints.trim() } : {}),
      }
      const res = await api.post<{
        jobId: string
        status: JobStatus
        publishError?: string
      }>(`/admin/battles/${encodeURIComponent(slug)}/re-ingest`, body)

      setJob({
        id: res.jobId,
        status: res.status ?? 'pending',
        publishError: res.publishError ?? null,
      })

      if (res.publishError) {
        toast.warning(
          'QStash gagal publish — job tercatat sebagai pending.',
        )
      } else {
        toast.success('Crawl ulang dimulai. Hasil ~30–60 detik.')
      }

      startPolling(res.jobId)
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message || 'Gagal memulai crawl ulang.')
      } else {
        toast.error('Gagal memulai crawl ulang. Coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function startPolling(jobId: string) {
    stopPolling()
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS
    setPolling(true)
    setPollTimedOut(false)

    const tick = async () => {
      if (Date.now() > pollDeadlineRef.current) {
        stopPolling()
        setPollTimedOut(true)
        toast.info('Crawl masih berjalan, refresh nanti.')
        return
      }
      try {
        const raw = await api.get<unknown>(
          `/admin/battles/${encodeURIComponent(slug)}/re-ingest-jobs?jobId=${encodeURIComponent(jobId)}`,
        )
        let parsed: JobRow | null = null
        if (Array.isArray(raw)) {
          parsed = normaliseJob(raw.find((r) => (r as Record<string, unknown>)?.['id'] === jobId))
        } else if (
          raw &&
          typeof raw === 'object' &&
          Array.isArray((raw as Record<string, unknown>)['rows'])
        ) {
          const rows = (raw as Record<string, unknown>)['rows'] as unknown[]
          parsed = normaliseJob(rows.find((r) => (r as Record<string, unknown>)?.['id'] === jobId))
        } else {
          parsed = normaliseJob(raw)
        }
        if (!parsed) return

        setJob(parsed)
        if (parsed.status === 'completed') {
          stopPolling()
          setRecent(parsed)
          const changed = parsed.payload?.metadata?.fieldsChanged ?? []
          if (changed.length > 0) {
            toast.success(`AI selesai. ${changed.length} field diperbarui.`)
          } else {
            toast.info('AI selesai tapi tidak ada perubahan field.')
          }
          // Hard-refresh so the edit form picks up the new values.
          router.refresh()
        } else if (parsed.status === 'failed') {
          stopPolling()
          toast.error(parsed.errorMessage ?? 'Crawl ulang gagal.')
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          stopPolling()
          toast.error('Job tidak ditemukan saat polling.')
        }
      }
    }

    void tick()
    pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS)
  }

  const status = job?.status
  const isRunning = polling || status === 'pending' || status === 'running'
  const meta = job?.payload?.metadata ?? recent?.payload?.metadata

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[rgb(var(--accent))]/10 p-2 text-[rgb(var(--accent))]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Perbarui via AI</CardTitle>
              <CardDescription className="mt-1">
                AI akan crawl ulang 30 domain whitelist dan memperbarui field
                yang dipilih (narasi, strategi, signifikansi, dll.).
              </CardDescription>
            </div>
          </div>
          {recent ? (
            <div className="hidden text-right text-xs text-[rgb(var(--text-muted))] sm:block">
              Terakhir diperbarui oleh AI:{' '}
              <span className="font-medium text-[rgb(var(--text))]">
                {formatRelative(recent.finishedAt ?? recent.createdAt)}
              </span>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-[rgb(var(--text))]">Mode</legend>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className="grid gap-2 sm:grid-cols-2"
            >
              <label
                htmlFor="battle-reingest-mode-enrich"
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--border))] p-3 hover:bg-[rgb(var(--bg-elevated))]"
              >
                <RadioGroupItem value="enrich" id="battle-reingest-mode-enrich" className="mt-1" />
                <div>
                  <div className="text-sm font-medium">Enrich</div>
                  <p className="text-xs text-[rgb(var(--text-muted))]">
                    Isi field yang masih kosong saja. Aman.
                  </p>
                </div>
              </label>
              <label
                htmlFor="battle-reingest-mode-replace"
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--border))] p-3 hover:bg-[rgb(var(--bg-elevated))]"
              >
                <RadioGroupItem value="replace" id="battle-reingest-mode-replace" className="mt-1" />
                <div>
                  <div className="text-sm font-medium">Replace</div>
                  <p className="text-xs text-[rgb(var(--text-muted))]">
                    Timpa field terpilih dengan hasil AI yang baru.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-[rgb(var(--text))]">Fokus field</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FOCUS_FIELD_GROUPS.map((g) => {
                const id = `battle-reingest-focus-${g.id}`
                const checked = focus.has(g.id)
                return (
                  <label
                    key={g.id}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-[rgb(var(--border))] p-2 text-sm hover:bg-[rgb(var(--bg-elevated))]"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(v) => {
                        setFocus((prev) => {
                          const next = new Set(prev)
                          if (v) next.add(g.id)
                          else next.delete(g.id)
                          return next
                        })
                      }}
                    />
                    <span>{g.label}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Mode Replace hanya akan menimpa field yang dicentang. Mode Enrich
              mengabaikan field yang sudah ada isinya.
            </p>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="battle-reingest-hints">Petunjuk tambahan (opsional)</Label>
            <Textarea
              id="battle-reingest-hints"
              rows={3}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="Misal: fokus pada strategi pasukan menurut Sirah Ibnu Hisyam"
            />
          </div>

          {job ? (
            <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--text-muted))]" />
                  ) : status === 'completed' ? (
                    <Check className="h-4 w-4 text-[rgb(var(--success,16_185_129))]" />
                  ) : status === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-[rgb(var(--danger))]" />
                  ) : null}
                  <span className="font-medium">
                    {status === 'pending' && 'Antri…'}
                    {status === 'running' && 'AI sedang crawl…'}
                    {status === 'completed' && 'Selesai.'}
                    {status === 'failed' && (job.errorMessage ?? 'Gagal')}
                  </span>
                </div>
                {job.publishError ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSubmit as unknown as (e: React.MouseEvent) => void}
                    disabled={submitting}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Coba lagi
                  </Button>
                ) : null}
              </div>
              {pollTimedOut ? (
                <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
                  Crawl masih berjalan, refresh nanti.
                </p>
              ) : null}
              {meta?.fieldsChanged && meta.fieldsChanged.length > 0 ? (
                <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
                  Field diperbarui:{' '}
                  <span className="font-medium text-[rgb(var(--text))]">
                    {meta.fieldsChanged.join(', ')}
                  </span>
                </p>
              ) : null}
              {meta?.citationsInserted ? (
                <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                  {meta.citationsInserted} sitasi baru disisipkan.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[rgb(var(--text-muted))] sm:hidden">
              {recent
                ? `Terakhir oleh AI: ${formatRelative(recent.finishedAt ?? recent.createdAt)}`
                : null}
            </p>
            <Button type="submit" disabled={submitting || isRunning}>
              {submitting || isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Mulai Crawl Ulang
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
