// `<BattleBulkList />` — Daftar Sirah Perang + Bulk Update via AI.
//
// Renders the existing battle list (paginated, FTS via `q=`) with a checkbox
// per row so an admin can select many slugs at once and trigger bulk AI
// re-ingest against `POST /api/v1/admin/battles/re-ingest/batch`. Bulk
// soft-delete is also exposed via the action bar.
//
// Mirrors `<FigureBulkList />`.

'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError, apiPaginated } from '@/lib/api/client'
import { deleteConfirm } from '@/lib/swal'

// ── Types ────────────────────────────────────────────────────────────
interface BattleListRow {
  id: string
  slug: string
  nameId: string
  nameAr: string
  type: 'ghazwah' | 'sariyyah' | 'futuhat'
  status:
    | 'draft'
    | 'under_review'
    | 'needs_edit'
    | 'approved'
    | 'published'
    | 'unpublished'
    | 'archived'
  eventDateAh: number | null
  updatedAt: string
}

const STATUS_LABEL: Record<BattleListRow['status'], string> = {
  draft: 'Draf',
  under_review: 'Ditinjau',
  needs_edit: 'Perlu Revisi',
  approved: 'Disetujui',
  published: 'Publis',
  unpublished: 'Belum Publis',
  archived: 'Diarsipkan',
}

const STATUS_VARIANT: Record<
  BattleListRow['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  under_review: 'secondary',
  needs_edit: 'secondary',
  approved: 'secondary',
  published: 'default',
  unpublished: 'outline',
  archived: 'destructive',
}

const TYPE_LABEL: Record<BattleListRow['type'], string> = {
  ghazwah: 'Ghazwah',
  sariyyah: 'Sariyyah',
  futuhat: 'Futuhat',
}

// Focus fields offered in the modal — echoed verbatim to the batch endpoint
// so the worker can decide what to re-fetch.
const FOCUS_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'narrativeId', label: 'Narasi' },
  { value: 'strategyId', label: 'Strategi' },
  { value: 'significanceId', label: 'Signifikansi' },
  { value: 'eventDateAh', label: 'Tahun (H)' },
  { value: 'opponentForce', label: 'Pasukan musuh' },
  { value: 'muslimCount', label: 'Jumlah pasukan muslim' },
  { value: 'casualtiesMuslim', label: 'Korban muslim' },
  { value: 'outcome', label: 'Hasil pertempuran' },
  { value: 'citations', label: 'Sitasi' },
]

const RECENT_JOBS_KEY = ['admin', 'battle-ingest-jobs'] as const
const PER_PAGE = 50

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

export function BattleBulkList() {
  const queryClient = useQueryClient()
  const [qInput, setQInput] = React.useState('')
  const q = useDebounced(qInput, 300)
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = React.useState(false)

  React.useEffect(() => {
    setPage(1)
  }, [q])

  const params = React.useMemo(
    () => ({
      q: q || undefined,
      page,
      perPage: PER_PAGE,
    }),
    [q, page],
  )

  const battlesQuery = useQuery({
    queryKey: ['admin', 'battles', params] as const,
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params.q) searchParams.set('q', params.q)
      searchParams.set('page', String(params.page))
      searchParams.set('perPage', String(params.perPage))
      return apiPaginated<BattleListRow>(`/battles?${searchParams.toString()}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const rows = battlesQuery.data?.rows ?? []
  const total = battlesQuery.data?.total ?? 0
  const totalPages = battlesQuery.data?.totalPages ?? 1

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.slug))
  const someOnPageSelected = rows.some((r) => selected.has(r.slug))

  function toggleOne(slug: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(slug)
      else next.delete(slug)
      return next
    })
  }
  function toggleAllOnPage(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of rows) {
        if (on) next.add(r.slug)
        else next.delete(r.slug)
      }
      return next
    })
  }
  function clearSelection() {
    setSelected(new Set())
  }

  const bulkDelete = useMutation({
    mutationFn: async (slugs: string[]) => {
      const settled = await Promise.allSettled(
        slugs.map((slug) => api.delete(`/battles/${slug}`)),
      )
      const okCount = settled.filter((r) => r.status === 'fulfilled').length
      const failCount = settled.length - okCount
      return { okCount, failCount }
    },
    onSuccess: ({ okCount, failCount }) => {
      if (okCount > 0) {
        toast.success(`${okCount} sirah perang dipindah ke Sampah.`)
      }
      if (failCount > 0) {
        toast.error(`${failCount} sirah perang gagal dihapus.`)
      }
      clearSelection()
      void queryClient.invalidateQueries({ queryKey: ['admin', 'battles'] })
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menghapus sirah perang.'
      toast.error(msg)
    },
  })

  async function handleBulkDelete() {
    const slugs = Array.from(selected)
    if (slugs.length === 0) return
    const ok = await deleteConfirm(`${slugs.length} sirah perang terpilih`)
    if (!ok) return
    bulkDelete.mutate(slugs)
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-[rgb(var(--text))]">
          Daftar Sirah Perang (Update via AI)
        </h2>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Pilih satu atau beberapa perang untuk di-update ulang lewat AI, atau
          hapus dari daftar. AI akan mengambil ulang fakta dari domain
          whitelist hanya untuk field yang dipilih.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'rgb(var(--text-muted))' }}
          />
          <Input
            type="search"
            placeholder="Cari nama perang…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="pl-8"
            aria-label="Cari perang"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void battlesQuery.refetch()}
          disabled={battlesQuery.isFetching}
        >
          {battlesQuery.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Muat ulang
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-[rgb(var(--text))]">
            <span className="font-medium">{selected.size} dipilih</span>
            <span className="text-[rgb(var(--text-muted))]">·</span>
            <Button
              size="sm"
              onClick={() => setModalOpen(true)}
              disabled={bulkDelete.isPending}
            >
              <Sparkles className="h-4 w-4" />
              Update via AI
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleBulkDelete()}
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Hapus…
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            disabled={bulkDelete.isPending}
          >
            Batalkan pilihan
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    aria-label="Pilih semua di halaman ini"
                    checked={
                      allOnPageSelected
                        ? true
                        : someOnPageSelected
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={(v) => toggleAllOnPage(v === true)}
                    disabled={rows.length === 0}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Tahun (H)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Diperbarui</th>
                <th className="px-4 py-3 text-right font-medium">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {battlesQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[rgb(var(--text-muted))]">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : battlesQuery.isError ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center"
                    style={{ color: 'rgb(var(--danger))' }}
                  >
                    Gagal memuat daftar perang.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[rgb(var(--text-muted))]">
                    {q
                      ? `Tidak ada perang yang cocok dengan "${q}".`
                      : 'Belum ada sirah perang. Tambah lewat panel di atas.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const checked = selected.has(row.slug)
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]"
                    >
                      <td className="px-4 py-3 align-top">
                        <Checkbox
                          aria-label={`Pilih ${row.nameId}`}
                          checked={checked}
                          onCheckedChange={(v) => toggleOne(row.slug, v === true)}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-0.5">
                          <Link
                            href={`/admin/battles/${row.slug}/edit`}
                            className="font-medium text-[rgb(var(--text))] hover:underline"
                          >
                            {row.nameId}
                          </Link>
                          <span
                            className="text-xs text-[rgb(var(--text-muted))]"
                            dir="rtl"
                            lang="ar"
                            style={{ fontFamily: 'var(--font-arabic)' }}
                          >
                            {row.nameAr}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="outline">{TYPE_LABEL[row.type] ?? row.type}</Badge>
                      </td>
                      <td className="px-4 py-3 align-top text-[rgb(var(--text-muted))]">
                        {row.eventDateAh ?? '—'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-[rgb(var(--text-muted))]">
                        {formatDate(row.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <RowActions
                          slug={row.slug}
                          onSelect={() => toggleOne(row.slug, true)}
                          onSelectAndOpenAi={() => {
                            toggleOne(row.slug, true)
                            setModalOpen(true)
                          }}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-[rgb(var(--text-muted))]">
          {total > 0 ? (
            <>
              Halaman {page} dari {totalPages} · {total} perang
            </>
          ) : (
            '0 perang'
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || battlesQuery.isFetching}
          >
            Sebelumnya
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || battlesQuery.isFetching}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <BulkAiUpdateDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        slugs={Array.from(selected)}
        onSuccess={() => {
          clearSelection()
          setModalOpen(false)
          void queryClient.invalidateQueries({ queryKey: RECENT_JOBS_KEY })
        }}
      />
    </section>
  )
}

function RowActions({
  slug,
  onSelect,
  onSelectAndOpenAi,
}: {
  slug: string
  onSelect: () => void
  onSelectAndOpenAi: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Tindakan baris">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Tindakan</DropdownMenuLabel>
        <DropdownMenuItem onClick={onSelectAndOpenAi}>
          <Sparkles className="h-4 w-4" />
          Update via AI
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/battles/${slug}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit manual
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSelect}>Tambah ke seleksi</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface BulkAiUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slugs: string[]
  onSuccess: () => void
}

interface BatchResponse {
  jobs?: number
  created?: number
  queued?: number
  failures?: Array<{ slug: string; reason: string }>
}

function BulkAiUpdateDialog({
  open,
  onOpenChange,
  slugs,
  onSuccess,
}: BulkAiUpdateDialogProps) {
  const [mode, setMode] = React.useState<'enrich' | 'replace'>('enrich')
  const [focusFields, setFocusFields] = React.useState<Set<string>>(new Set())
  const [hints, setHints] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setMode('enrich')
      setFocusFields(new Set())
      setHints('')
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: async () => {
      const body: {
        slugs: string[]
        mode: 'enrich' | 'replace'
        focusFields?: string[]
        hints?: string
      } = {
        slugs,
        mode,
      }
      if (focusFields.size > 0) body.focusFields = Array.from(focusFields)
      if (hints.trim()) body.hints = hints.trim()
      return api.post<BatchResponse>('/admin/battles/re-ingest/batch', body)
    },
    onSuccess: (data) => {
      const n = data?.jobs ?? data?.created ?? slugs.length
      toast.success(`Antrekan diberangkatkan: ${n} jobs`)
      if (data?.failures && data.failures.length > 0) {
        const head = data.failures
          .slice(0, 3)
          .map((f) => `${f.slug}: ${f.reason}`)
          .join('\n')
        toast.warning(
          `Beberapa slug gagal:\n${head}${data.failures.length > 3 ? `\n…+${data.failures.length - 3} lainnya` : ''}`,
        )
      }
      onSuccess()
    },
    onError: (err) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal mengantre batch update.'
      toast.error(msg)
    },
  })

  function toggleField(value: string, on: boolean) {
    setFocusFields((prev) => {
      const next = new Set(prev)
      if (on) next.add(value)
      else next.delete(value)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[rgb(var(--accent))]" />
            Update via AI ({slugs.length} dipilih)
          </DialogTitle>
          <DialogDescription>
            AI akan mengambil ulang fakta dari domain whitelist untuk perang
            terpilih. Pilih mode dan field yang ingin di-refresh.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (slugs.length === 0) return
            mutation.mutate()
          }}
        >
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'enrich' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMode('enrich')}
                disabled={mutation.isPending}
              >
                Enrich (tambah)
              </Button>
              <Button
                type="button"
                variant={mode === 'replace' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMode('replace')}
                disabled={mutation.isPending}
              >
                Replace (timpa)
              </Button>
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              {mode === 'enrich'
                ? 'Hanya isi field yang masih kosong / tipis.'
                : 'Timpa field terpilih dengan hasil AI yang baru.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Field fokus (opsional)</Label>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS_FIELD_OPTIONS.map((opt) => {
                const id = `focus-battle-${opt.value}`
                const checked = focusFields.has(opt.value)
                return (
                  <label
                    key={opt.value}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-[rgb(var(--border))] px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(v) => toggleField(opt.value, v === true)}
                      disabled={mutation.isPending}
                    />
                    <span>{opt.label}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Tidak dicentang berarti AI bebas memilih (mode replace tetap
              hanya menimpa field yang dicentang).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-battle-hints">Petunjuk tambahan (opsional)</Label>
            <Textarea
              id="bulk-battle-hints"
              rows={3}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="Mis. fokus pada perang yang terjadi pada tahun 2 H"
              disabled={mutation.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending || slugs.length === 0}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Antrekan {slugs.length} job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
