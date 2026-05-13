// All-fonts table — every installed font with filter controls + per-row
// preview / active toggle.  Matches docs/IDEAS.md §3b.4.
//
// Columns:
//   Family | Script | Source | Weights | Active (Switch) | Preview
//
// Filters:
//   - script  (latin / arabic / mono / both / all)
//   - active  (all / active / inactive)
//
// The active Switch flips `is_active` on the font row (PUT
// /admin/fonts/[id]).  Note: this is the *catalogue* flag (font visible to
// slot pickers), separate from the per-role `font_assignments` slot
// activation that lives in <ChangeFontDialog />.

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api, ApiClientError } from '@/lib/api/client'

import { FontPreview, type FontPreviewScript, type FontPreviewSource } from './font-preview'

interface FontRow {
  id: string
  name: string
  family: string
  script: FontPreviewScript
  source: FontPreviewSource
  googleFamilyName: string | null
  customUrl: string | null
  filePaths: Record<string, string> | null
  weights: number[] | null
  styles: string[] | null
  previewTextAr: string | null
  previewTextId: string | null
  isActive: boolean
}

interface FontListEnvelope {
  rows?: FontRow[]
}

type ScriptFilter = 'all' | FontPreviewScript
type ActiveFilter = 'all' | 'active' | 'inactive'

export function FontsTable() {
  const qc = useQueryClient()
  const [scriptFilter, setScriptFilter] = useState<ScriptFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Server-side filter for `script` + `isActive` so the page count stays
  // tight; client-side fallback filter handles edge transitions.
  const queryParams = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set('perPage', '200')
    if (scriptFilter !== 'all') sp.set('script', scriptFilter)
    if (activeFilter === 'active') sp.set('isActive', 'true')
    if (activeFilter === 'inactive') sp.set('isActive', 'false')
    return sp.toString()
  }, [scriptFilter, activeFilter])

  const fontsQuery = useQuery({
    queryKey: ['admin', 'fonts', 'list', { script: scriptFilter, active: activeFilter }],
    queryFn: async () => {
      const data = await api.get<FontListEnvelope | FontRow[]>(
        `/admin/fonts?${queryParams}`,
      )
      const rows = Array.isArray(data) ? data : (data?.rows ?? [])
      return rows
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async (vars: { id: string; isActive: boolean }) => {
      return api.put(`/admin/fonts/${vars.id}`, { isActive: vars.isActive })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'fonts'] })
    },
    onError: (err) => {
      const msg = ApiClientError.is(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Gagal mengubah status font'
      toast.error(msg)
    },
  })

  const rows = fontsQuery.data ?? []
  const previewFont = useMemo(
    () => rows.find((r) => r.id === previewId) ?? null,
    [rows, previewId],
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All Fonts</CardTitle>
          <CardDescription>
            Daftar lengkap font yang ter-install di Atsar. Toggle aktif untuk
            menampilkan font di pemilih slot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-script" className="text-xs">
                Script
              </Label>
              <Select
                value={scriptFilter}
                onValueChange={(v) => setScriptFilter(v as ScriptFilter)}
              >
                <SelectTrigger id="filter-script" className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua script</SelectItem>
                  <SelectItem value="latin">Latin</SelectItem>
                  <SelectItem value="arabic">Arab</SelectItem>
                  <SelectItem value="mono">Mono</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-active" className="text-xs">
                Status
              </Label>
              <Select
                value={activeFilter}
                onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
              >
                <SelectTrigger id="filter-active" className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {fontsQuery.isPending ? (
            <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat font…
            </div>
          ) : fontsQuery.isError ? (
            <div className="rounded-md border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-3 text-sm text-[rgb(var(--danger))]">
              Gagal memuat daftar font.
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-[rgb(var(--border))] p-4 text-center text-sm text-[rgb(var(--text-muted))]">
              Tidak ada font yang cocok dengan filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[rgb(var(--border))]">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Family</th>
                    <th className="px-3 py-2 font-medium">Script</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Weights</th>
                    <th className="px-3 py-2 font-medium">Aktif</th>
                    <th className="px-3 py-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border))]">
                  {rows.map((f) => (
                    <tr
                      key={f.id}
                      className="text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{f.family}</div>
                        {f.name !== f.family ? (
                          <div className="text-xs text-[rgb(var(--text-faint))]">
                            {f.name}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 capitalize">{f.script}</td>
                      <td className="px-3 py-2">
                        <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 text-xs">
                          {f.source}
                        </code>
                      </td>
                      <td className="px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
                        {f.weights && f.weights.length > 0 ? f.weights.join(', ') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Switch
                          checked={f.isActive}
                          disabled={toggleActiveMutation.isPending}
                          onCheckedChange={(v) =>
                            toggleActiveMutation.mutate({ id: f.id, isActive: v })
                          }
                          aria-label={`Toggle ${f.family} active`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewId(f.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pratinjau Font</DialogTitle>
            <DialogDescription>
              Sample teks Arab & Latin yang dirender menggunakan font ini.
            </DialogDescription>
          </DialogHeader>
          {previewFont ? (
            <FontPreview
              fontId={previewFont.id}
              family={previewFont.family}
              script={previewFont.script}
              source={previewFont.source}
              googleFamilyName={previewFont.googleFamilyName}
              customUrl={previewFont.customUrl}
              filePaths={previewFont.filePaths}
              weights={previewFont.weights}
              sampleAr={previewFont.previewTextAr}
              sampleId={previewFont.previewTextId}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
