// `<FigureEditForm />` — minimal edit form for a figure row.
//
// Scope (intentionally narrow — see page.tsx for rationale):
//   - Name (Indonesian + Arabic)
//   - Summary (Indonesian + Arabic)
//   - Birth + death year (AH + CE, integer years)
//   - Status (draft / under_review / approved / published)
//
// Save flow:
//   1. POST PATCH-equivalent to `/figures/:slug` (route is PUT today).
//   2. Toast + redirect back to `/admin/figures` on success.
//   3. Inline field errors surfaced from `ApiClientError.fieldErrors`.
//
// Slug is read-only here — renaming a slug breaks inbound links. Use the
// API directly if you need to rename.
//
// Note on HTTP verb: `figuresApi.update()` in lib/api/endpoints.ts uses
// `PATCH` but the route at `/api/v1/figures/[slug]` only exports `PUT`.
// This file calls `api.put` directly so it works regardless of the
// endpoint helper's current verb. Audit follow-up: align the two.

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/api/client'
import { confirm } from '@/lib/swal'

type Status =
  | 'draft'
  | 'under_review'
  | 'needs_edit'
  | 'approved'
  | 'published'
  | 'unpublished'
  | 'archived'

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draf',
  under_review: 'Sedang Review',
  needs_edit: 'Perlu Edit',
  approved: 'Disetujui',
  published: 'Terbit',
  unpublished: 'Tidak Terbit',
  archived: 'Diarsipkan',
}

const STATUS_VARIANT: Record<
  Status,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  under_review: 'secondary',
  needs_edit: 'destructive',
  approved: 'secondary',
  published: 'default',
  unpublished: 'outline',
  archived: 'outline',
}

export interface FigureEditFormInitial {
  slug: string
  nameFullId: string
  nameFullAr: string
  summaryId: string
  summaryAr: string
  birthDateAh: number | null
  birthDateCe: number | null
  deathDateAh: number | null
  deathDateCe: number | null
  status: Status
  publishedAt: string | null
}

export interface FigureEditFormProps {
  initial: FigureEditFormInitial
}

function emptyToNull(v: string): string | null {
  const trimmed = v.trim()
  return trimmed.length === 0 ? null : trimmed
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function FigureEditForm({ initial }: FigureEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  const [nameFullId, setNameFullId] = React.useState(initial.nameFullId)
  const [nameFullAr, setNameFullAr] = React.useState(initial.nameFullAr)
  const [summaryId, setSummaryId] = React.useState(initial.summaryId)
  const [summaryAr, setSummaryAr] = React.useState(initial.summaryAr)
  const [birthAh, setBirthAh] = React.useState<string>(
    initial.birthDateAh != null ? String(initial.birthDateAh) : '',
  )
  const [birthCe, setBirthCe] = React.useState<string>(
    initial.birthDateCe != null ? String(initial.birthDateCe) : '',
  )
  const [deathAh, setDeathAh] = React.useState<string>(
    initial.deathDateAh != null ? String(initial.deathDateAh) : '',
  )
  const [deathCe, setDeathCe] = React.useState<string>(
    initial.deathDateCe != null ? String(initial.deathDateCe) : '',
  )
  const [status, setStatus] = React.useState<Status>(initial.status)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setFieldErrors({})

    // If the admin is flipping draft → published, confirm. Going backwards
    // (e.g. published → draft = "unpublish") gets a different confirm.
    if (status !== initial.status) {
      const toPublished = status === 'published'
      const fromPublished = initial.status === 'published'
      if (toPublished || fromPublished) {
        const ok = await confirm({
          title: toPublished ? 'Publikasikan tokoh?' : 'Ubah status?',
          text: toPublished
            ? `"${initial.nameFullId}" akan tampil di publik.`
            : `Status berubah dari ${STATUS_LABEL[initial.status]} → ${STATUS_LABEL[status]}.`,
          confirmText: toPublished ? 'Publikasikan' : 'Ubah',
          dangerous: fromPublished && !toPublished,
        })
        if (!ok) return
      }
    }

    const body: Record<string, unknown> = {
      nameFullId: nameFullId.trim(),
      nameFullAr: nameFullAr.trim(),
      summaryId: emptyToNull(summaryId),
      summaryAr: emptyToNull(summaryAr),
      birthDateAh: numOrNull(birthAh),
      birthDateCe: numOrNull(birthCe),
      deathDateAh: numOrNull(deathAh),
      deathDateCe: numOrNull(deathCe),
      status,
    }

    setSaving(true)
    try {
      // Route is PUT today (see header comment). When we align endpoints we'll
      // switch to figuresApi.update.
      await api.put(`/figures/${encodeURIComponent(initial.slug)}`, body)
      toast.success('Tokoh tersimpan')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
        toast.error(err.message)
      } else {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan'
        toast.error(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/figures">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1
              className="text-2xl font-semibold text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              Edit Tokoh
            </h1>
            <p className="text-sm text-[rgb(var(--text-muted))]">
              <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-xs">
                {initial.slug}
              </code>{' '}
              <Badge variant={STATUS_VARIANT[initial.status]} className="ml-1">
                {STATUS_LABEL[initial.status]}
              </Badge>
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSave} className="flex flex-col gap-6" noValidate>
        {/* ── Nama ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Nama</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nameFullId">Nama (Indonesia)</Label>
              <Input
                id="nameFullId"
                value={nameFullId}
                onChange={(e) => setNameFullId(e.target.value)}
                aria-invalid={fieldErrors['nameFullId'] ? 'true' : 'false'}
                required
              />
              {fieldErrors['nameFullId'] && (
                <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                  {fieldErrors['nameFullId']}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameFullAr">Nama (Arab)</Label>
              <Input
                id="nameFullAr"
                value={nameFullAr}
                onChange={(e) => setNameFullAr(e.target.value)}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
                aria-invalid={fieldErrors['nameFullAr'] ? 'true' : 'false'}
                required
              />
              {fieldErrors['nameFullAr'] && (
                <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                  {fieldErrors['nameFullAr']}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Ringkasan ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="summaryId">Ringkasan (Indonesia)</Label>
              <Textarea
                id="summaryId"
                value={summaryId}
                onChange={(e) => setSummaryId(e.target.value)}
                rows={6}
                placeholder="1–3 paragraf ringkas."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summaryAr">Ringkasan (Arab)</Label>
              <Textarea
                id="summaryAr"
                value={summaryAr}
                onChange={(e) => setSummaryAr(e.target.value)}
                rows={6}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Tanggal ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Tanggal</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="birthAh">Lahir (H)</Label>
              <Input
                id="birthAh"
                type="number"
                inputMode="numeric"
                value={birthAh}
                onChange={(e) => setBirthAh(e.target.value)}
                placeholder="mis. 194"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthCe">Lahir (M)</Label>
              <Input
                id="birthCe"
                type="number"
                inputMode="numeric"
                value={birthCe}
                onChange={(e) => setBirthCe(e.target.value)}
                placeholder="mis. 810"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deathAh">Wafat (H)</Label>
              <Input
                id="deathAh"
                type="number"
                inputMode="numeric"
                value={deathAh}
                onChange={(e) => setDeathAh(e.target.value)}
                placeholder="mis. 256"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deathCe">Wafat (M)</Label>
              <Input
                id="deathCe"
                type="number"
                inputMode="numeric"
                value={deathCe}
                onChange={(e) => setDeathCe(e.target.value)}
                placeholder="mis. 870"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Status ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Status Publikasi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              {initial.publishedAt ? (
                <>
                  Pertama terbit:{' '}
                  <span className="font-mono">
                    {new Date(initial.publishedAt).toLocaleString('id-ID')}
                  </span>
                </>
              ) : (
                'Belum pernah dipublikasikan.'
              )}
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/admin/figures')}
            disabled={saving}
          >
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Simpan
          </Button>
        </div>

        <p className="text-xs text-[rgb(var(--text-muted))]">
          Catatan: form ini fokus pada bidang utama. Bidang lengkap (kunyah,
          laqab, lokasi, rijal, sitasi, biografi pra/pasca wafat) dapat
          disunting via API atau form lengkap (TODO).
        </p>
      </form>
    </div>
  )
}
