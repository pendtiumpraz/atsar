// `<BattleBatchIngestPanel />` — Batch Tambah Perang (AI).
//
// Admin paste daftar nama perang (satu per baris), pilih jenis bersama
// (opsional) untuk SEMUA nama, opsional hints, lalu POST ke
// `/api/v1/admin/battles/ingest/batch`. Endpoint INSERT semua row di
// satu db.batch dan publish QStash message per row dengan
// Promise.allSettled — partial failures dilaporkan kembali ke UI.
//
// Mirrors `<FigureBatchIngestPanel />`.

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ListPlus, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/api/client'

const TYPE_OPTIONS = [
  { value: '', label: '— biarkan AI tentukan —' },
  { value: 'ghazwah', label: 'Ghazwah (Nabi ﷺ memimpin)' },
  { value: 'sariyyah', label: 'Sariyyah (delegasi sahabat)' },
  { value: 'futuhat', label: 'Futuhat (penaklukan pasca-Nabi)' },
] as const

type BattleType = '' | 'ghazwah' | 'sariyyah' | 'futuhat'

interface BatchResponse {
  created: number
  queued: number
  failures: Array<{ name: string; reason: string }>
  agentConfigured: boolean
}

const MAX_NAMES = 100

function parseNames(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of raw.split(/[\n,]+/)) {
    const name = line.trim()
    if (name.length === 0) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= MAX_NAMES) break
  }
  return out
}

export function BattleBatchIngestPanel() {
  const queryClient = useQueryClient()
  const [namesText, setNamesText] = React.useState('')
  const [type, setType] = React.useState<BattleType>('')
  const [hints, setHints] = React.useState('')

  const parsedNames = React.useMemo(() => parseNames(namesText), [namesText])
  const totalSeconds = parsedNames.length * 45
  const etaMin = Math.ceil(totalSeconds / 60)

  const mutation = useMutation({
    mutationFn: async () => {
      const items = parsedNames.map((name) => ({
        name,
        ...(type ? { type } : {}),
        ...(hints.trim() ? { hints: hints.trim() } : {}),
      }))
      return api.post<BatchResponse>('/admin/battles/ingest/batch', { items })
    },
    onSuccess: (data) => {
      if (data.created === 0) {
        toast.error('Tidak ada job baru dibuat — semua nama sudah pernah diantrekan.')
      } else {
        toast.success(
          `${data.created} job dibuat, ${data.queued} berhasil diantre.${data.failures.length > 0 ? ` ${data.failures.length} gagal (lihat detail).` : ''}`,
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
        setNamesText('')
        setHints('')
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'battle-ingest-jobs'] })
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal kirim batch.'
      toast.error(msg)
    },
  })

  const submitDisabled =
    mutation.isPending || parsedNames.length === 0 || parsedNames.length > MAX_NAMES

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-[rgb(var(--accent))]" />
            Batch Tambah Perang (AI)
          </CardTitle>
          <span className="text-xs text-[rgb(var(--text-muted))]">Max {MAX_NAMES} nama/batch</span>
        </div>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Tempel daftar nama perang — satu per baris. Semua akan dicrawl pakai
          AI ke 30 website salafi whitelist dan dibuat draf otomatis.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="batch-battle-names">
              Nama perang ({parsedNames.length}/{MAX_NAMES})
            </Label>
            <Textarea
              id="batch-battle-names"
              rows={8}
              placeholder={'Perang Badar\nPerang Uhud\nPerang Khandaq\nFath Makkah\nPerang Yarmuk\n…'}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              disabled={mutation.isPending}
              className="font-mono text-sm"
            />
            {parsedNames.length > 0 && (
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Estimasi: ~{totalSeconds} detik (≈{etaMin} menit) untuk seluruh batch
                berjalan paralel di QStash. Job tetap diproses di latar
                belakang — kamu boleh tutup halaman.
              </p>
            )}
            {parsedNames.length > MAX_NAMES && (
              <p className="flex items-center gap-1 text-xs text-[rgb(var(--danger))]">
                <AlertTriangle className="h-3 w-3" /> Batas {MAX_NAMES} nama
                terlampaui — sisanya akan diabaikan.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch-battle-type">Jenis (untuk semua)</Label>
            <select
              id="batch-battle-type"
              value={type}
              onChange={(e) => setType(e.target.value as BattleType)}
              disabled={mutation.isPending}
              className="h-10 w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch-battle-hints">Arahan bersama (opsional)</Label>
            <Input
              id="batch-battle-hints"
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder='Mis. "fokus pada perang masa Khulafa Rasyidin"'
              disabled={mutation.isPending}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={submitDisabled}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim batch…
                </>
              ) : (
                <>
                  <ListPlus className="h-4 w-4" />
                  Antrekan {parsedNames.length || ''} nama
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
