// `<WhitelistTable />` — admin CRUD UI for citation-source whitelist domains.
//
// Responsibilities:
//   - Fetch the full list via TanStack Query (admin endpoint returns inactive
//     + soft-deleted rows too so admins can audit history).
//   - Render a flat table: domain, displayName, primaryLanguage badge,
//     priority, crawlRatePerMinute (inline-editable), isActive toggle, and
//     Edit / Delete actions.
//   - Inline edits: clicking the rate cell turns it into a number input,
//     blur or Enter writes back with PUT.  Toggling the active switch fires
//     PUT immediately (no separate save button).
//   - Add: opens `<AddDomainDialog />` (mounted here so it can invalidate
//     the same query key on success).
//
// API verbs intentionally hit `api.put`/`api.delete` directly rather than
// going through `endpoints.ts → adminApi.whitelist.update` because the
// backend route exports `PUT` (not PATCH).  See `app/api/v1/admin/whitelist/[id]/route.ts`.

'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { AddDomainDialog } from '@/components/admin/whitelist/add-domain-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api, ApiClientError } from '@/lib/api/client'
import { deleteConfirm } from '@/lib/swal'

type PrimaryLanguage = 'ar' | 'id' | 'en'

interface WhitelistRow {
  id: string
  domain: string
  displayName: string | null
  primaryLanguage: PrimaryLanguage | null
  description: string | null
  priority: number
  crawlRatePerMinute: number
  isActive: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

const QUERY_KEY = ['admin', 'whitelist', 'all'] as const

const LANG_LABEL: Record<PrimaryLanguage, string> = {
  ar: 'AR',
  id: 'ID',
  en: 'EN',
}

const LANG_VARIANT: Record<PrimaryLanguage, 'default' | 'accent' | 'secondary'> = {
  ar: 'default',
  id: 'accent',
  en: 'secondary',
}

async function listWhitelist(): Promise<WhitelistRow[]> {
  // The list endpoint returns the raw array (no pagination envelope) —
  // see `whitelistService.list`.
  const res = await api.get<WhitelistRow[] | { rows?: WhitelistRow[] }>(
    '/admin/whitelist',
  )
  if (Array.isArray(res)) return res
  return res?.rows ?? []
}

export function WhitelistTable() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listWhitelist })

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put<WhitelistRow>(`/admin/whitelist/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menyimpan'
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/admin/whitelist/${id}`),
    onSuccess: () => {
      toast.success('Domain dipindahkan ke Sampah')
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menghapus domain'
      toast.error(msg)
    },
  })

  async function handleDelete(row: WhitelistRow) {
    const ok = await deleteConfirm(`domain ${row.domain}`)
    if (!ok) return
    deleteMutation.mutate(row.id)
  }

  function handleToggleActive(row: WhitelistRow, next: boolean) {
    patchMutation.mutate({ id: row.id, body: { isActive: next } })
  }

  function handleRateCommit(row: WhitelistRow, next: number) {
    if (!Number.isFinite(next) || next < 1 || next > 600) {
      toast.error('Laju crawl harus 1–600 / menit')
      return
    }
    if (next === row.crawlRatePerMinute) return
    patchMutation.mutate({ id: row.id, body: { crawlRatePerMinute: next } })
  }

  const rows = query.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[rgb(var(--text-muted))]">
          {query.isPending
            ? 'Memuat…'
            : query.isError
              ? 'Gagal memuat domain.'
              : `${rows.length} domain`}
        </p>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          Tambah Domain
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase text-[rgb(var(--text-muted))]">
            <tr>
              <th className="px-3 py-2 font-medium">Domain</th>
              <th className="px-3 py-2 font-medium">Nama Tampilan</th>
              <th className="px-3 py-2 font-medium">Bahasa</th>
              <th className="px-3 py-2 font-medium">Prioritas</th>
              <th className="px-3 py-2 font-medium">Laju / menit</th>
              <th className="px-3 py-2 font-medium">Aktif</th>
              <th className="px-3 py-2 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[rgb(var(--text-muted))]">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[rgb(var(--text-muted))]">
                  Belum ada domain dalam whitelist.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <WhitelistRowView
                  key={row.id}
                  row={row}
                  onToggleActive={(next) => handleToggleActive(row, next)}
                  onCommitRate={(next) => handleRateCommit(row, next)}
                  onDelete={() => handleDelete(row)}
                  busy={
                    (patchMutation.isPending && patchMutation.variables?.id === row.id) ||
                    (deleteMutation.isPending && deleteMutation.variables === row.id)
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: QUERY_KEY })
        }}
      />
    </div>
  )
}

interface WhitelistRowViewProps {
  row: WhitelistRow
  onToggleActive: (next: boolean) => void
  onCommitRate: (next: number) => void
  onDelete: () => void
  busy: boolean
}

function WhitelistRowView({
  row,
  onToggleActive,
  onCommitRate,
  onDelete,
  busy,
}: WhitelistRowViewProps) {
  const [editingRate, setEditingRate] = useState(false)
  const [rateDraft, setRateDraft] = useState(String(row.crawlRatePerMinute))

  const lang = row.primaryLanguage
  const deleted = row.deletedAt != null

  return (
    <tr
      className={
        'border-t border-[rgb(var(--border))] ' +
        (deleted ? 'opacity-50' : 'hover:bg-[rgb(var(--bg-elevated))]/40')
      }
    >
      <td className="px-3 py-2 font-mono text-xs">
        <a
          href={`https://${row.domain}`}
          target="_blank"
          rel="noreferrer noopener"
          className="hover:underline"
        >
          {row.domain}
        </a>
      </td>
      <td className="px-3 py-2 text-[rgb(var(--text))]">
        {row.displayName ?? <span className="text-[rgb(var(--text-muted))]">—</span>}
      </td>
      <td className="px-3 py-2">
        {lang ? (
          <Badge variant={LANG_VARIANT[lang]}>{LANG_LABEL[lang]}</Badge>
        ) : (
          <span className="text-[rgb(var(--text-muted))]">—</span>
        )}
      </td>
      <td className="px-3 py-2 tabular-nums">{row.priority}</td>
      <td className="px-3 py-2">
        {editingRate ? (
          <Input
            type="number"
            min={1}
            max={600}
            value={rateDraft}
            autoFocus
            onChange={(e) => setRateDraft(e.target.value)}
            onBlur={() => {
              setEditingRate(false)
              onCommitRate(Number.parseInt(rateDraft, 10))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              } else if (e.key === 'Escape') {
                setRateDraft(String(row.crawlRatePerMinute))
                setEditingRate(false)
              }
            }}
            className="h-7 w-20"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setRateDraft(String(row.crawlRatePerMinute))
              setEditingRate(true)
            }}
            disabled={deleted}
            className="rounded px-2 py-0.5 tabular-nums hover:bg-[rgb(var(--bg-elevated))] disabled:cursor-not-allowed"
            aria-label="Edit laju crawl"
          >
            {row.crawlRatePerMinute}
          </button>
        )}
      </td>
      <td className="px-3 py-2">
        <Switch
          checked={row.isActive}
          onCheckedChange={onToggleActive}
          disabled={busy || deleted}
          aria-label={row.isActive ? 'Nonaktifkan domain' : 'Aktifkan domain'}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setRateDraft(String(row.crawlRatePerMinute))
              setEditingRate(true)
            }}
            disabled={deleted}
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onDelete}
            disabled={busy || deleted}
            aria-label="Hapus"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
