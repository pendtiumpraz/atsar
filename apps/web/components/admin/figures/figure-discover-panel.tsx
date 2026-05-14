// `<FigureDiscoverPanel />` — Phase 1 of figure discovery.
//
// Admin pilih kategori (Sahabat / Tabi'in / Nabi / Shalih / dst.), optional
// gender + hints, lalu submit ke `POST /api/v1/admin/figures/discover`.
// Endpoint mengembalikan daftar kandidat `{ nameId, nameAr, kunyahId?,
// laqabId?, shortHint? }` yang BELUM ada di database.
//
// Admin multi-pilih kandidat via checkbox, lalu klik "Antrekan Crawl Detail"
// → kirim ke `POST /api/v1/admin/figures/ingest/batch` (pipeline existing
// untuk crawl + ekstraksi penuh). Setelah sukses, query
// `['admin', 'figure-ingest-jobs']` di-invalidate supaya panel di bawah
// langsung refresh.

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Sparkles,
  ListPlus,
  CheckSquare,
  Square,
  Compass,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/api/client'

const CATEGORY_OPTIONS = [
  { value: 'nabi', label: 'Nabi & Rasul' },
  { value: 'shalih_pre_rasul', label: 'Shalih sebelum Rasul ﷺ' },
  { value: 'sahabat', label: 'Sahabat / Shahabiyat' },
  { value: 'tabiin', label: "Tabi'in" },
  { value: 'tabiut_tabiin', label: "Tabi'ut Tabi'in" },
  { value: 'shalih_pasca_rasul', label: 'Pasca-Salaf / Ulama' },
] as const

type Category = (typeof CATEGORY_OPTIONS)[number]['value']

interface Candidate {
  nameId: string
  nameAr: string
  kunyahId?: string
  laqabId?: string
  shortHint?: string
}

interface DiscoverResponse {
  candidates: Candidate[]
  existingCount: number
  suggestedNew: number
  sourcesFetched: number
  modelUsed: string
  durationMs: number
}

interface BatchResponse {
  created: number
  queued: number
  failures: Array<{ name: string; reason: string }>
  agentConfigured: boolean
}

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

/** Stable key for a candidate row (used for selection Set). */
function candidateKey(c: Candidate): string {
  return `${c.nameId}::${c.nameAr}`
}

export function FigureDiscoverPanel() {
  const queryClient = useQueryClient()
  const [category, setCategory] = React.useState<Category>('sahabat')
  const [gender, setGender] = React.useState<'' | 'male' | 'female'>('')
  const [hints, setHints] = React.useState('')
  const [limit, setLimit] = React.useState<number>(DEFAULT_LIMIT)

  const [candidates, setCandidates] = React.useState<Candidate[]>([])
  const [meta, setMeta] = React.useState<Pick<
    DiscoverResponse,
    'existingCount' | 'suggestedNew' | 'sourcesFetched' | 'modelUsed' | 'durationMs'
  > | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const discover = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { category, limit }
      if (gender) body.gender = gender
      if (hints.trim()) body.hints = hints.trim()
      return api.post<DiscoverResponse>('/admin/figures/discover', body)
    },
    onSuccess: (data) => {
      setCandidates(data.candidates ?? [])
      setMeta({
        existingCount: data.existingCount,
        suggestedNew: data.suggestedNew,
        sourcesFetched: data.sourcesFetched,
        modelUsed: data.modelUsed,
        durationMs: data.durationMs,
      })
      setSelected(new Set())
      if ((data.candidates ?? []).length === 0) {
        toast.info(
          'AI tidak menemukan nama baru untuk kategori + filter ini. Coba longgarkan hints.',
        )
      } else {
        toast.success(`${data.candidates.length} kandidat baru ditemukan.`)
      }
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal menjalankan discovery.'
      toast.error(msg)
    },
  })

  const enqueue = useMutation({
    mutationFn: async () => {
      const picked = candidates.filter((c) => selected.has(candidateKey(c)))
      if (picked.length === 0) {
        throw new ApiClientError('VALIDATION_ERROR', 'Tidak ada kandidat dipilih.')
      }
      const items = picked.map((c) => {
        const name =
          c.nameId && c.nameId.length >= 2 ? c.nameId : c.nameAr // safety net
        const itemHints = [
          hints.trim(),
          c.shortHint?.trim(),
          c.nameAr ? `Nama Arab: ${c.nameAr}` : '',
          c.kunyahId ? `Kunyah: ${c.kunyahId}` : '',
          c.laqabId ? `Laqab: ${c.laqabId}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
        const item: Record<string, unknown> = { name, category }
        if (gender) item.gender = gender
        if (itemHints) item.hints = itemHints
        return item
      })
      return api.post<BatchResponse>('/admin/figures/ingest/batch', { items })
    },
    onSuccess: (data) => {
      if (data.created === 0) {
        toast.warning(
          'Tidak ada job baru dibuat — semua nama sudah pernah diantrekan dalam 1 jam terakhir.',
        )
      } else {
        toast.success(
          `Antrekan diberangkatkan: ${data.created} nama (${data.queued} antre QStash).`,
        )
        if (data.failures.length > 0) {
          const head = data.failures
            .slice(0, 3)
            .map((f) => `${f.name}: ${f.reason}`)
            .join('\n')
          toast.warning(
            `Beberapa nama gagal:\n${head}${data.failures.length > 3 ? `\n…+${data.failures.length - 3} lainnya` : ''}`,
          )
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'figure-ingest-jobs'] })
      // Clear selection but keep the candidate list visible so admin sees
      // which names were enqueued.
      setSelected(new Set())
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal mengantrekan batch.'
      toast.error(msg)
    },
  })

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const selectAll = () =>
    setSelected(new Set(candidates.map(candidateKey)))
  const selectNone = () => setSelected(new Set())

  const allSelected =
    candidates.length > 0 && selected.size === candidates.length

  const discoverDisabled = discover.isPending
  const enqueueDisabled =
    enqueue.isPending || selected.size === 0 || candidates.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[rgb(var(--accent))]" />
            Discover via AI
          </CardTitle>
          <span className="text-xs text-[rgb(var(--text-muted))]">
            Tahap 1 — enumerasi nama per kategori
          </span>
        </div>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Pilih kategori, lalu AI akan mencari ke 30 domain salafi whitelist
          plus pengetahuan modelnya, dan mengembalikan nama-nama tokoh yang
          BELUM ada di database. Pilih nama mana yang ingin di-crawl detail
          (Biografi, Timeline, Hadits, dst.) — pipeline crawl detail tetap
          pakai batch ingest existing.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            discover.mutate()
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="discover-category">Kategori</Label>
              <select
                id="discover-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                disabled={discoverDisabled}
                className="h-10 w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="discover-gender">Kunci Gender (opsional)</Label>
              <select
                id="discover-gender"
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as '' | 'male' | 'female')
                }
                disabled={discoverDisabled}
                className="h-10 w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm"
              >
                <option value="">— bebas —</option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="discover-limit">Target jumlah (max {MAX_LIMIT})</Label>
              <Input
                id="discover-limit"
                type="number"
                min={1}
                max={MAX_LIMIT}
                value={limit}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isFinite(v)) {
                    setLimit(Math.min(Math.max(v, 1), MAX_LIMIT))
                  }
                }}
                disabled={discoverDisabled}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discover-hints">
              Hints / pembatas (opsional, max 500 char)
            </Label>
            <Textarea
              id="discover-hints"
              rows={3}
              value={hints}
              onChange={(e) => setHints(e.target.value.slice(0, 500))}
              placeholder={
                'Mis. "hanya yang wafat sebelum 50H", "fokus sahabat Anshar", "shahabiyat periwayat hadits", "ulama Khurasan abad 3 H"'
              }
              disabled={discoverDisabled}
            />
            <p className="text-xs text-[rgb(var(--text-muted))]">
              {hints.length}/500 karakter
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={discoverDisabled}>
              {discover.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mencari kandidat…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Discover
                </>
              )}
            </Button>
          </div>
        </form>

        {meta && (
          <div className="mt-6 flex flex-col gap-3 border-t border-[rgb(var(--border))] pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
              <span>
                Sudah ada di DB: <strong>{meta.existingCount}</strong>
              </span>
              <span>
                Kandidat baru: <strong>{meta.suggestedNew}</strong>
              </span>
              <span>
                Sumber dipetik: <strong>{meta.sourcesFetched}</strong>
              </span>
              <span>
                Model: <code className="font-mono text-[10px]">{meta.modelUsed}</code>
              </span>
              <span>
                Durasi: <strong>{(meta.durationMs / 1000).toFixed(1)}s</strong>
              </span>
            </div>

            {candidates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 text-sm text-[rgb(var(--text-muted))]">
                AI tidak menemukan nama baru — semua nama sudah ada di database,
                atau hints terlalu sempit. Coba longgarkan hints, ganti kategori,
                atau hapus kunci gender.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      disabled={allSelected || enqueue.isPending}
                    >
                      <CheckSquare className="h-4 w-4" />
                      Pilih Semua
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectNone}
                      disabled={selected.size === 0 || enqueue.isPending}
                    >
                      <Square className="h-4 w-4" />
                      Pilih Tidak Ada
                    </Button>
                    <span className="text-xs text-[rgb(var(--text-muted))]">
                      {selected.size}/{candidates.length} dipilih
                    </span>
                  </div>
                </div>

                <ul className="flex max-h-[480px] flex-col gap-1 overflow-y-auto rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2">
                  {candidates.map((c) => {
                    const key = candidateKey(c)
                    const checked = selected.has(key)
                    return (
                      <li
                        key={key}
                        className={`flex items-start gap-3 rounded-md px-3 py-2 transition-colors ${
                          checked
                            ? 'bg-[rgb(var(--primary))]/5'
                            : 'hover:bg-[rgb(var(--bg))]'
                        }`}
                      >
                        <div className="pt-1">
                          <Checkbox
                            id={`cand-${key}`}
                            checked={checked}
                            onCheckedChange={() => toggle(key)}
                            disabled={enqueue.isPending}
                          />
                        </div>
                        <label
                          htmlFor={`cand-${key}`}
                          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <span className="text-sm font-medium text-[rgb(var(--text))]">
                              {c.nameId}
                            </span>
                            <span
                              dir="rtl"
                              className="text-xs text-[rgb(var(--text-muted))]"
                              style={{ fontFamily: 'var(--font-display-arabic, serif)' }}
                            >
                              {c.nameAr}
                            </span>
                          </div>
                          {(c.kunyahId || c.laqabId) && (
                            <div className="text-xs text-[rgb(var(--text-muted))]">
                              {c.kunyahId && <span>Kunyah: {c.kunyahId}</span>}
                              {c.kunyahId && c.laqabId && <span> · </span>}
                              {c.laqabId && <span>Laqab: {c.laqabId}</span>}
                            </div>
                          )}
                          {c.shortHint && (
                            <p className="text-xs italic text-[rgb(var(--text-muted))]">
                              {c.shortHint}
                            </p>
                          )}
                        </label>
                      </li>
                    )
                  })}
                </ul>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => enqueue.mutate()}
                    disabled={enqueueDisabled}
                  >
                    {enqueue.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mengantrekan…
                      </>
                    ) : (
                      <>
                        <ListPlus className="h-4 w-4" />
                        Antrekan Crawl Detail ({selected.size} dipilih)
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
