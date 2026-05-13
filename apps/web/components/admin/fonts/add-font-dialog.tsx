// Add-Font dialog — three input methods (Google Fonts / Custom URL /
// Upload), all of which POST to /admin/fonts.  See docs/IDEAS.md §3b.5.
//
// Validation summary (mirrors font.service.ts → create):
//   - google_fonts  → googleFamilyName required
//   - custom_url    → customUrl required (URL-validated)
//   - uploaded      → at least one weight file required
//
// Upload tab caveat: this UI only collects the files; the actual binary
// upload is not yet wired (storage layer pending — see IDEAS §3b.5).  We
// surface a clear "belum tersedia" notice so admins are not surprised.

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, ApiClientError } from '@/lib/api/client'

type FontScript = 'latin' | 'arabic' | 'mono' | 'both'
type FontSource = 'google_fonts' | 'custom_url' | 'uploaded'

const COMMON_WEIGHTS = [300, 400, 500, 600, 700, 900] as const

interface CreateFontPayload {
  name: string
  family: string
  script: FontScript
  source: FontSource
  googleFamilyName?: string | null
  customUrl?: string | null
  filePaths?: Record<string, string> | null
  weights?: number[] | null
  license?: string | null
}

export interface AddFontDialogProps {
  /** Optional controlled-open mode.  Omit to use the built-in trigger. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Render-prop trigger; defaults to a "+ Add New Font" button. */
  trigger?: React.ReactNode
}

export function AddFontDialog({ open, onOpenChange, trigger }: AddFontDialogProps) {
  const qc = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }

  const [tab, setTab] = useState<FontSource>('google_fonts')

  // Shared fields
  const [family, setFamily] = useState('')
  const [script, setScript] = useState<FontScript>('latin')
  const [license, setLicense] = useState('')
  const [weights, setWeights] = useState<number[]>([400, 700])

  // Google fonts
  const [googleFamilyName, setGoogleFamilyName] = useState('')

  // Custom URL
  const [customUrl, setCustomUrl] = useState('')

  // Upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([])

  function resetForm() {
    setTab('google_fonts')
    setFamily('')
    setScript('latin')
    setLicense('')
    setWeights([400, 700])
    setGoogleFamilyName('')
    setCustomUrl('')
    setUploadFiles([])
  }

  const createMutation = useMutation({
    mutationFn: async (payload: CreateFontPayload) => {
      return api.post('/admin/fonts', payload)
    },
    onSuccess: async () => {
      toast.success('Font berhasil ditambahkan')
      await qc.invalidateQueries({ queryKey: ['admin', 'fonts'] })
      resetForm()
      setOpen(false)
    },
    onError: (err) => {
      const msg = ApiClientError.is(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Gagal menambah font'
      toast.error(msg)
    },
  })

  function toggleWeight(w: number) {
    setWeights((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort((a, b) => a - b),
    )
  }

  function buildPayload(): CreateFontPayload | null {
    const baseFamily = (tab === 'google_fonts' ? googleFamilyName : family).trim()
    if (!baseFamily) {
      toast.error('Family wajib diisi')
      return null
    }
    const common: CreateFontPayload = {
      name: baseFamily,
      family: baseFamily,
      script,
      source: tab,
      weights: weights.length > 0 ? weights : null,
      license: license.trim() || null,
    }

    if (tab === 'google_fonts') {
      common.googleFamilyName = googleFamilyName.trim()
      return common
    }
    if (tab === 'custom_url') {
      const url = customUrl.trim()
      if (!url) {
        toast.error('URL font wajib diisi')
        return null
      }
      try {
        // Soft URL validation — server re-validates with zod.
        new URL(url)
      } catch {
        toast.error('URL tidak valid')
        return null
      }
      common.customUrl = url
      return common
    }
    // uploaded
    if (uploadFiles.length === 0) {
      toast.error('Pilih minimal satu file font')
      return null
    }
    // File upload to storage is not yet wired (see IDEAS §3b.5). Build a
    // placeholder `filePaths` from filenames so the row creates; the binary
    // path will be backfilled when storage lands.
    const filePaths: Record<string, string> = {}
    for (const f of uploadFiles) {
      filePaths[`pending_${f.name}`] = `pending://${f.name}`
    }
    common.filePaths = filePaths
    return common
  }

  function handleSubmit() {
    const payload = buildPayload()
    if (!payload) return
    createMutation.mutate(payload)
  }

  const defaultTrigger = (
    <Button type="button">+ Add New Font</Button>
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v && createMutation.isPending) return
        setOpen(v)
        if (!v) resetForm()
      }}
    >
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah Font Baru</DialogTitle>
          <DialogDescription>
            Tiga cara: Google Fonts, custom CDN URL, atau upload file font.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as FontSource)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="google_fonts">Google Fonts</TabsTrigger>
            <TabsTrigger value="custom_url">Custom URL</TabsTrigger>
            <TabsTrigger value="uploaded">Upload</TabsTrigger>
          </TabsList>

          {/* ── Shared meta ────────────────────────────────────────── */}
          <div className="mt-4 space-y-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3">
            <div className="space-y-1.5">
              <Label htmlFor="font-script">Script</Label>
              <Select value={script} onValueChange={(v) => setScript(v as FontScript)}>
                <SelectTrigger id="font-script">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latin">Latin</SelectItem>
                  <SelectItem value="arabic">Arab</SelectItem>
                  <SelectItem value="mono">Mono</SelectItem>
                  <SelectItem value="both">Latin + Arab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="font-license">Lisensi (opsional)</Label>
              <Input
                id="font-license"
                placeholder="OFL, Apache 2.0, Proprietary, …"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
              />
            </div>
          </div>

          {/* ── Google Fonts tab ────────────────────────────────────── */}
          <TabsContent value="google_fonts" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gfont-name">Nama family di Google Fonts</Label>
              <Input
                id="gfont-name"
                placeholder="Cairo, Inter, Playfair Display, …"
                value={googleFamilyName}
                onChange={(e) => setGoogleFamilyName(e.target.value)}
              />
              <p className="text-xs text-[rgb(var(--text-faint))]">
                Tulis persis seperti di fonts.google.com — huruf besar &
                spasi diperhatikan.
              </p>
            </div>
            <WeightSelector weights={weights} onToggle={toggleWeight} />
          </TabsContent>

          {/* ── Custom URL tab ──────────────────────────────────────── */}
          <TabsContent value="custom_url" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-family">Family CSS</Label>
              <Input
                id="custom-family"
                placeholder="Mis. MyBrandSerif"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-url">URL CSS / font file</Label>
              <Input
                id="custom-url"
                type="url"
                placeholder="https://fonts.bunny.net/css?family=…"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
            </div>
            <WeightSelector weights={weights} onToggle={toggleWeight} />
          </TabsContent>

          {/* ── Upload tab ──────────────────────────────────────────── */}
          <TabsContent value="uploaded" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="upload-family">Family CSS</Label>
              <Input
                id="upload-family"
                placeholder="Mis. MyBrandSerif"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upload-files">File font (.woff2 / .ttf)</Label>
              <Input
                id="upload-files"
                type="file"
                accept=".woff2,.ttf,.otf,.woff"
                multiple
                onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
              />
              {uploadFiles.length > 0 ? (
                <ul className="text-xs text-[rgb(var(--text-muted))]">
                  {uploadFiles.map((f) => (
                    <li key={f.name}>{f.name} ({Math.round(f.size / 1024)} KB)</li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs text-[rgb(var(--warning))]">
                Catatan: upload binary belum tersedia. Entry akan dibuat dengan
                placeholder; admin perlu menyalin file ke /storage/fonts secara
                manual sampai feature upload selesai.
              </p>
            </div>
            <WeightSelector weights={weights} onToggle={toggleWeight} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={createMutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              'Simpan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Weight checkboxes (shared across tabs) ────────────────────────────
function WeightSelector({
  weights,
  onToggle,
}: {
  weights: number[]
  onToggle: (w: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Weights</Label>
      <div className="flex flex-wrap gap-3">
        {COMMON_WEIGHTS.map((w) => {
          const id = `weight-${w}`
          return (
            <label
              key={w}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--text))]"
            >
              <Checkbox
                id={id}
                checked={weights.includes(w)}
                onCheckedChange={() => onToggle(w)}
              />
              {w}
            </label>
          )
        })}
      </div>
    </div>
  )
}
