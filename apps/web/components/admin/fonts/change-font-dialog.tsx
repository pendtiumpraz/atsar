// Change-font dialog — admin picks a font for a given role slot, previews
// it, then confirms. POSTs to /admin/fonts/[id]/activate which atomically
// swaps the slot (db.batch — see font.service.ts).
//
// The font list is filtered to only those whose `script` is compatible with
// the target role (e.g. only Arab/`both` fonts show up for `display_arab`).
// This mirrors the server-side `isValidScriptForRole` check so the user
// never sees a guaranteed-fail option.
//
// On success: invalidates the `['admin', 'fonts', 'assignments']` query so
// the Active Slots panel re-renders instantly.
// See docs/IDEAS.md §3b.4.

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { api, ApiClientError } from '@/lib/api/client'

import { FontPreview, type FontPreviewScript, type FontPreviewSource } from './font-preview'

export type FontRole =
  | 'display_latin'
  | 'body_latin'
  | 'display_arab'
  | 'section_arab'
  | 'body_arab'
  | 'quran_arab'
  | 'mono'

export interface FontListRow {
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
}

interface FontsListResponse {
  rows?: FontListRow[]
  // Some envelopes return the array directly; we handle both shapes.
}

export interface ChangeFontDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: FontRole
  /** Currently assigned font id for this slot (pre-selected). */
  currentFontId: string | null
  /** Friendly slot label, e.g. "display_latin". */
  roleLabel?: string
}

/**
 * Map a role to the set of font scripts the server will accept.  Kept in
 * sync with `font.service.ts → isValidScriptForRole`.
 */
function compatibleScriptsForRole(role: FontRole): FontPreviewScript[] {
  if (role === 'mono') return ['mono', 'both']
  if (['display_arab', 'section_arab', 'body_arab', 'quran_arab'].includes(role))
    return ['arabic', 'both']
  return ['latin', 'both']
}

export function ChangeFontDialog({
  open,
  onOpenChange,
  role,
  currentFontId,
  roleLabel,
}: ChangeFontDialogProps) {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(currentFontId)

  // Re-sync selection whenever the dialog re-opens against a new role.
  useEffect(() => {
    if (open) setSelectedId(currentFontId)
  }, [open, currentFontId, role])

  const compatibleScripts = useMemo(() => compatibleScriptsForRole(role), [role])

  // Fetch a generous page of fonts; we filter client-side by script so we
  // get both `latin`/`arabic` and `both` in one round-trip.
  const fontsQuery = useQuery({
    queryKey: ['admin', 'fonts', 'list', { perPage: 200 }],
    queryFn: async () => {
      const data = await api.get<FontsListResponse | FontListRow[]>(
        '/admin/fonts?perPage=200',
      )
      const rows = Array.isArray(data) ? data : (data?.rows ?? [])
      return rows
    },
    enabled: open,
  })

  const compatibleFonts = useMemo(() => {
    const rows = fontsQuery.data ?? []
    return rows.filter((f) => compatibleScripts.includes(f.script))
  }, [fontsQuery.data, compatibleScripts])

  const selectedFont = useMemo(
    () => compatibleFonts.find((f) => f.id === selectedId) ?? null,
    [compatibleFonts, selectedId],
  )

  const activateMutation = useMutation({
    mutationFn: async (fontId: string) => {
      return api.post(`/admin/fonts/${fontId}/activate`, { role })
    },
    onSuccess: async () => {
      toast.success('Font berhasil diaktifkan')
      await qc.invalidateQueries({ queryKey: ['admin', 'fonts'] })
      onOpenChange(false)
    },
    onError: (err) => {
      const msg = ApiClientError.is(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Gagal mengaktifkan font'
      toast.error(msg)
    },
  })

  function handleConfirm() {
    if (!selectedId) return
    activateMutation.mutate(selectedId)
  }

  const isUnchanged = selectedId === currentFontId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ganti Font</DialogTitle>
          <DialogDescription>
            Pilih font untuk slot{' '}
            <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 text-xs">
              {roleLabel ?? role}
            </code>
            . Hanya font yang cocok dengan script slot ini yang ditampilkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="font-select">Font</Label>
            {fontsQuery.isPending ? (
              <div className="flex h-10 items-center gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm text-[rgb(var(--text-muted))]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat daftar font…
              </div>
            ) : fontsQuery.isError ? (
              <div className="rounded-md border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-3 text-sm text-[rgb(var(--danger))]">
                Gagal memuat daftar font.
              </div>
            ) : compatibleFonts.length === 0 ? (
              <div className="rounded-md border border-dashed border-[rgb(var(--border))] p-3 text-sm text-[rgb(var(--text-muted))]">
                Belum ada font yang kompatibel dengan slot ini.
              </div>
            ) : (
              <Select
                value={selectedId ?? undefined}
                onValueChange={(v) => setSelectedId(v)}
              >
                <SelectTrigger id="font-select">
                  <SelectValue placeholder="Pilih font…" />
                </SelectTrigger>
                <SelectContent>
                  {compatibleFonts.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.family}
                      <span className="ml-2 text-xs text-[rgb(var(--text-faint))]">
                        {f.script}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedFont ? (
            <FontPreview
              fontId={selectedFont.id}
              family={selectedFont.family}
              script={selectedFont.script}
              source={selectedFont.source}
              googleFamilyName={selectedFont.googleFamilyName}
              customUrl={selectedFont.customUrl}
              filePaths={selectedFont.filePaths}
              weights={selectedFont.weights}
              sampleAr={selectedFont.previewTextAr}
              sampleId={selectedFont.previewTextId}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={activateMutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId || isUnchanged || activateMutation.isPending}
          >
            {activateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengaktifkan…
              </>
            ) : (
              'Aktifkan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
