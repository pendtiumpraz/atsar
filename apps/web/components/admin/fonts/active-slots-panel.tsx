// Active Slots panel — 7 role rows, each showing the currently-assigned
// font plus a [Change ▾] and [Preview] action.  Matches the wireframe in
// docs/IDEAS.md §3b.4.
//
// Data flow:
//   - GET /admin/fonts/assignments  → role-keyed map of active font entries
//                                     (or `null` when unassigned).
//   - "Change"   → opens <ChangeFontDialog />.
//   - "Preview"  → opens a lightweight preview dialog using <FontPreview />.
//
// We keep two pieces of local UI state (which dialog is open + which role
// it targets) here rather than per-row so only one dialog ever mounts at
// a time.

'use client'

import { useQuery } from '@tanstack/react-query'
import { Eye, Loader2, Pencil } from 'lucide-react'
import { useState } from 'react'

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
import { api } from '@/lib/api/client'

import { ChangeFontDialog, type FontRole } from './change-font-dialog'
import { FontPreview, type FontPreviewScript, type FontPreviewSource } from './font-preview'

// ── Role meta ─────────────────────────────────────────────────────────
const ROLES: ReadonlyArray<{
  role: FontRole
  label: string
  description: string
  script: FontPreviewScript
}> = [
  {
    role: 'display_latin',
    label: 'display_latin',
    description: 'Heading & display untuk teks Latin',
    script: 'latin',
  },
  {
    role: 'body_latin',
    label: 'body_latin',
    description: 'Body text untuk teks Latin',
    script: 'latin',
  },
  {
    role: 'display_arab',
    label: 'display_arab',
    description: 'Heading & display untuk teks Arab',
    script: 'arabic',
  },
  {
    role: 'section_arab',
    label: 'section_arab',
    description: 'Section header Arab (mis. judul bab)',
    script: 'arabic',
  },
  {
    role: 'body_arab',
    label: 'body_arab',
    description: 'Body text untuk teks Arab',
    script: 'arabic',
  },
  {
    role: 'quran_arab',
    label: 'quran_arab',
    description: 'Khusus untuk ayat Al-Qur’an',
    script: 'arabic',
  },
  {
    role: 'mono',
    label: 'mono',
    description: 'Monospace untuk kode / data',
    script: 'mono',
  },
]

// ── Wire types (match font.service.ts → ActiveAssignmentsMap) ────────
interface AssignmentEntry {
  fontId: string
  family: string
  source: FontPreviewSource
  googleFamilyName: string | null
  customUrl: string | null
  weights: number[] | null
  styles: string[] | null
}

type AssignmentsMap = Partial<Record<FontRole, AssignmentEntry | null>>

export function ActiveSlotsPanel() {
  const [changeOpen, setChangeOpen] = useState(false)
  const [changeRole, setChangeRole] = useState<FontRole | null>(null)
  const [previewRole, setPreviewRole] = useState<FontRole | null>(null)

  const { data, isPending, isError } = useQuery<AssignmentsMap>({
    queryKey: ['admin', 'fonts', 'assignments'],
    queryFn: () => api.get<AssignmentsMap>('/admin/fonts/assignments'),
  })

  function openChange(role: FontRole) {
    setChangeRole(role)
    setChangeOpen(true)
  }

  const previewEntry = previewRole && data ? data[previewRole] : null
  const previewMeta = previewRole ? ROLES.find((r) => r.role === previewRole) : null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Active Slots</CardTitle>
          <CardDescription>
            Tiap slot mewakili peran tipografi di seluruh aplikasi Atsar. Pilih
            font yang aktif untuk masing-masing slot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat slot…
            </div>
          ) : isError ? (
            <div className="rounded-md border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-3 text-sm text-[rgb(var(--danger))]">
              Gagal memuat slot font.
            </div>
          ) : (
            <ul className="divide-y divide-[rgb(var(--border))]">
              {ROLES.map((slot) => {
                const entry = data?.[slot.role] ?? null
                return (
                  <li
                    key={slot.role}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-xs text-[rgb(var(--text))]">
                          {slot.label}
                        </code>
                        <span className="truncate text-sm font-medium text-[rgb(var(--text))]">
                          {entry ? entry.family : (
                            <span className="text-[rgb(var(--text-muted))] italic">
                              Belum diatur
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[rgb(var(--text-muted))]">
                        {slot.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openChange(slot.role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Change
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewRole(slot.role)}
                        disabled={!entry}
                        title={entry ? 'Pratinjau' : 'Slot belum diisi'}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Change dialog — keyed by role so re-opens against a different slot
          remount the internal state cleanly. */}
      {changeRole ? (
        <ChangeFontDialog
          key={changeRole}
          open={changeOpen}
          onOpenChange={setChangeOpen}
          role={changeRole}
          roleLabel={changeRole}
          currentFontId={data?.[changeRole]?.fontId ?? null}
        />
      ) : null}

      {/* Lightweight preview-only dialog. */}
      <Dialog
        open={!!previewRole}
        onOpenChange={(o) => !o && setPreviewRole(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pratinjau Font</DialogTitle>
            <DialogDescription>
              Slot{' '}
              <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 text-xs">
                {previewMeta?.label ?? previewRole}
              </code>
            </DialogDescription>
          </DialogHeader>
          {previewEntry && previewMeta ? (
            <FontPreview
              fontId={previewEntry.fontId}
              family={previewEntry.family}
              script={previewMeta.script}
              source={previewEntry.source}
              googleFamilyName={previewEntry.googleFamilyName}
              customUrl={previewEntry.customUrl}
              weights={previewEntry.weights}
            />
          ) : (
            <p className="text-sm text-[rgb(var(--text-muted))]">
              Slot belum memiliki font aktif.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
