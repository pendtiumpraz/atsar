// `<BattleEditForm />` — minimal edit form for a battle row.
//
// Scope (intentionally narrow — sibling of `<FigureEditForm />`):
//   - Name (Indonesian + Arabic)
//   - Type (ghazwah / sariyyah / futuhat)
//   - Event date (AH + CE integer year)
//   - Narrative (Indonesian)
//   - Outcome (victory / defeat / truce / partial)
//   - Status (draft / under_review / approved / published)
//
// Save flow: PATCH `/battles/:slug` then router.refresh().

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

type BattleType = 'ghazwah' | 'sariyyah' | 'futuhat'
type Outcome = 'victory' | 'defeat' | 'truce' | 'partial'

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

const TYPE_LABEL: Record<BattleType, string> = {
  ghazwah: 'Ghazwah',
  sariyyah: 'Sariyyah',
  futuhat: 'Futuhat',
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  victory: 'Menang',
  defeat: 'Kalah',
  truce: 'Gencatan',
  partial: 'Sebagian',
}

export interface BattleEditFormInitial {
  slug: string
  nameId: string
  nameAr: string
  type: BattleType
  eventDateAh: number | null
  eventDateCe: number | null
  narrativeId: string
  outcome: Outcome | null
  status: Status
}

export interface BattleEditFormProps {
  initial: BattleEditFormInitial
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

export function BattleEditForm({ initial }: BattleEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  const [nameId, setNameId] = React.useState(initial.nameId)
  const [nameAr, setNameAr] = React.useState(initial.nameAr)
  const [type, setType] = React.useState<BattleType>(initial.type)
  const [eventDateAh, setEventDateAh] = React.useState<string>(
    initial.eventDateAh != null ? String(initial.eventDateAh) : '',
  )
  const [eventDateCe, setEventDateCe] = React.useState<string>(
    initial.eventDateCe != null ? String(initial.eventDateCe) : '',
  )
  const [narrativeId, setNarrativeId] = React.useState(initial.narrativeId)
  const [outcome, setOutcome] = React.useState<Outcome | ''>(initial.outcome ?? '')
  const [status, setStatus] = React.useState<Status>(initial.status)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setFieldErrors({})

    if (status !== initial.status) {
      const toPublished = status === 'published'
      const fromPublished = initial.status === 'published'
      if (toPublished || fromPublished) {
        const ok = await confirm({
          title: toPublished ? 'Publikasikan sirah perang?' : 'Ubah status?',
          text: toPublished
            ? `"${initial.nameId}" akan tampil di publik.`
            : `Status berubah dari ${STATUS_LABEL[initial.status]} → ${STATUS_LABEL[status]}.`,
          confirmText: toPublished ? 'Publikasikan' : 'Ubah',
          dangerous: fromPublished && !toPublished,
        })
        if (!ok) return
      }
    }

    const body: Record<string, unknown> = {
      nameId: nameId.trim(),
      nameAr: nameAr.trim(),
      type,
      eventDateAh: numOrNull(eventDateAh),
      eventDateCe: numOrNull(eventDateCe),
      narrativeId: emptyToNull(narrativeId),
      outcome: outcome === '' ? null : outcome,
      status,
    }

    setSaving(true)
    try {
      await api.patch(`/battles/${encodeURIComponent(initial.slug)}`, body)
      toast.success('Sirah perang tersimpan')
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
            <Link href="/admin/battles">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1
              className="text-2xl font-semibold text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              Edit Sirah Perang
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
        <Card>
          <CardHeader>
            <CardTitle>Nama</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nameId">Nama (Indonesia)</Label>
              <Input
                id="nameId"
                value={nameId}
                onChange={(e) => setNameId(e.target.value)}
                aria-invalid={fieldErrors['nameId'] ? 'true' : 'false'}
                required
              />
              {fieldErrors['nameId'] && (
                <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                  {fieldErrors['nameId']}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameAr">Nama (Arab)</Label>
              <Input
                id="nameAr"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
                aria-invalid={fieldErrors['nameAr'] ? 'true' : 'false'}
                required
              />
              {fieldErrors['nameAr'] && (
                <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                  {fieldErrors['nameAr']}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Klasifikasi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="type">Jenis</Label>
              <Select value={type} onValueChange={(v) => setType(v as BattleType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as BattleType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventDateAh">Tahun (H)</Label>
              <Input
                id="eventDateAh"
                type="number"
                inputMode="numeric"
                value={eventDateAh}
                onChange={(e) => setEventDateAh(e.target.value)}
                placeholder="mis. 2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventDateCe">Tahun (M)</Label>
              <Input
                id="eventDateCe"
                type="number"
                inputMode="numeric"
                value={eventDateCe}
                onChange={(e) => setEventDateCe(e.target.value)}
                placeholder="mis. 624"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Narasi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="narrativeId">Narasi (Indonesia)</Label>
              <Textarea
                id="narrativeId"
                value={narrativeId}
                onChange={(e) => setNarrativeId(e.target.value)}
                rows={10}
                placeholder="Tulis narasi pertempuran dalam Bahasa Indonesia…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="outcome">Hasil</Label>
                <Select
                  value={outcome}
                  onValueChange={(v) => setOutcome(v === '' ? '' : (v as Outcome))}
                >
                  <SelectTrigger id="outcome">
                    <SelectValue placeholder="— belum diketahui —" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                      <SelectItem key={o} value={o}>
                        {OUTCOME_LABEL[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href="/admin/battles">Batal</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </div>
      </form>
    </div>
  )
}
