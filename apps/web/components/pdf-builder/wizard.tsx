// Multi-step PDF builder wizard.
//
// Owns the entire form payload as a single `useState` so child components
// stay dumb-controlled. The 4 steps mirror WIREFRAMES §16:
//   1. Pick figures (2–60).
//   2. Title (AR + ID, with optional AI auto-generate stub).
//   3. Template + layout options.
//   4. Cover preview + submit.
//
// On submit we call `pdfApi.enqueue` with an `Idempotency-Key` so a double-
// click can't enqueue twice, then navigate to the per-job status page where
// the user can watch the worker progress.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { CoverPreview } from '@/components/pdf-builder/cover-preview'
import {
  FigurePicker,
  type PickerFigure,
} from '@/components/pdf-builder/figure-picker'
import {
  OptionsForm,
  type OptionsValue,
} from '@/components/pdf-builder/options-form'
import { TemplatePicker } from '@/components/pdf-builder/template-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiClientError } from '@/lib/api/client'
import { pdfApi } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

const MIN_FIGURES = 2
const MAX_FIGURES = 60

type TemplateSlug = 'classic' | 'modern' | 'calligraphy' | 'minimalist'

interface WizardState {
  figures: PickerFigure[]
  titleAr: string
  titleId: string
  template: TemplateSlug
  options: OptionsValue
}

const STEPS = [
  { n: 1, label: 'Tokoh' },
  { n: 2, label: 'Judul' },
  { n: 3, label: 'Template' },
  { n: 4, label: 'Cover' },
] as const

export interface WizardProps {
  author: { name: string; email: string }
  quota: { used: number; limit: number; remaining: number }
}

export function Wizard({ author, quota }: WizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [submitting, setSubmitting] = useState(false)
  const [state, setState] = useState<WizardState>({
    figures: [],
    titleAr: '',
    titleId: '',
    template: 'classic',
    options: {
      paperSize: 'a4',
      orientation: 'portrait',
      languageMode: 'both',
      includeIllustrations: true,
      includeMaps: true,
      includeTimeline: true,
    },
  })

  const quotaBlocked = quota.limit > 0 && quota.remaining <= 0

  const canGoNext = useMemo(() => {
    switch (step) {
      case 1:
        return (
          state.figures.length >= MIN_FIGURES &&
          state.figures.length <= MAX_FIGURES
        )
      case 2:
        return state.titleId.trim().length > 0 || state.titleAr.trim().length > 0
      case 3:
        return Boolean(state.template)
      case 4:
        return true
      default:
        return false
    }
  }, [step, state])

  function patchOptions(patch: Partial<OptionsValue>) {
    setState((s) => ({ ...s, options: { ...s.options, ...patch } }))
  }

  const [generatingTitle, setGeneratingTitle] = useState(false)

  async function generateTitle() {
    if (state.figures.length === 0) {
      toast.error('Pilih minimal satu tokoh dulu.')
      return
    }
    setGeneratingTitle(true)
    try {
      const res = await fetch('/api/v1/ai/generate-title', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          figureSlugs: state.figures.map((f) => f.slug),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message ?? `Gagal generate judul (${res.status})`)
      }
      const body = (await res.json()) as {
        ok: true
        data: { titleId: string; titleAr: string; subtitleId?: string }
      }
      setState((s) => ({
        ...s,
        titleId: body.data.titleId,
        titleAr: body.data.titleAr,
      }))
      toast.success('Judul dihasilkan oleh AI.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal generate judul.')
    } finally {
      setGeneratingTitle(false)
    }
  }

  async function handleSubmit() {
    if (quotaBlocked) {
      toast.error('Kuota PDF Anda habis untuk periode ini.')
      return
    }
    if (state.figures.length < MIN_FIGURES) {
      toast.error(`Pilih minimal ${MIN_FIGURES} tokoh.`)
      setStep(1)
      return
    }

    setSubmitting(true)
    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`

    try {
      const job = await pdfApi.enqueue(
        {
          figureIds: state.figures.map((f) => f.id),
          templateSlug: state.template,
          paperSize: state.options.paperSize,
          orientation: state.options.orientation,
          languageMode: state.options.languageMode,
          titleAr: state.titleAr.trim() || undefined,
          titleId: state.titleId.trim() || undefined,
          authorName: author.name,
          authorEmail: author.email,
          includeIllustrations: state.options.includeIllustrations,
          includeMaps: state.options.includeMaps,
          includeTimeline: state.options.includeTimeline,
        },
        idempotencyKey,
      )
      toast.success('Job PDF dikirim. Mengarahkan ke status…')
      router.push(`/pdf-builder/jobs/${job.id}`)
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal membuat job PDF.'
      toast.error(msg)
      setSubmitting(false)
    }
  }

  // Quota-exhausted gate — render the wizard read-only with an upgrade CTA.
  if (quotaBlocked) {
    return (
      <div className="rounded-lg border border-[rgb(var(--warning))] bg-[rgb(var(--surface))] p-6">
        <h2 className="text-lg font-semibold text-[rgb(var(--text))]">
          Kuota PDF Anda sudah habis
        </h2>
        <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">
          Anda telah memakai {quota.used} / {quota.limit} kuota unduhan PDF untuk
          periode ini. Tingkatkan paket langganan untuk membuat buku tambahan.
        </p>
        <div className="mt-4 flex gap-2">
          <Button asChild>
            <Link href="/subscription-expired">Tingkatkan Paket</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pdf-builder/jobs">Lihat Riwayat</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper header */}
      <ol className="grid grid-cols-4 gap-2" aria-label="Langkah pembuatan PDF">
        {STEPS.map((s) => {
          const active = s.n === step
          const done = s.n < step
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => {
                  // Allow going back freely; jumping forward only if allowed.
                  if (s.n < step || canGoNext || s.n === step) setStep(s.n as 1 | 2 | 3 | 4)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text))]'
                    : done
                      ? 'border-[rgb(var(--success))] bg-[rgb(var(--surface))] text-[rgb(var(--text))]'
                      : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))]',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    active
                      ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]'
                      : done
                        ? 'bg-[rgb(var(--success))] text-white'
                        : 'bg-[rgb(var(--bg-elevated))]',
                  )}
                >
                  {s.n}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Step body */}
      <section
        aria-labelledby="step-heading"
        className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5"
      >
        {step === 1 && (
          <div>
            <h2 id="step-heading" className="mb-3 text-lg font-semibold">
              Pilih Tokoh ({MIN_FIGURES}–{MAX_FIGURES})
            </h2>
            <FigurePicker
              selected={state.figures}
              onChange={(figures) => setState((s) => ({ ...s, figures }))}
              min={MIN_FIGURES}
              max={MAX_FIGURES}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 id="step-heading" className="text-lg font-semibold">
              Judul Buku
            </h2>
            <div className="space-y-2">
              <Label htmlFor="title-ar">Judul (Arab)</Label>
              <Input
                id="title-ar"
                lang="ar"
                dir="rtl"
                value={state.titleAr}
                onChange={(e) =>
                  setState((s) => ({ ...s, titleAr: e.target.value }))
                }
                placeholder="مثال: سير الخلفاء الراشدين"
                style={{ fontFamily: 'var(--font-body-arab)' }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title-id">Judul (Indonesia)</Label>
              <Input
                id="title-id"
                value={state.titleId}
                onChange={(e) =>
                  setState((s) => ({ ...s, titleId: e.target.value }))
                }
                placeholder="Contoh: Sirah Khulafa ar-Rasyidin"
              />
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={generateTitle}
                size="sm"
                disabled={generatingTitle || state.figures.length === 0}
              >
                <Sparkles className="h-4 w-4" />
                {generatingTitle ? 'Membuat judul…' : 'Generate dari AI'}
              </Button>
              <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                Isi otomatis dari tokoh yang telah dipilih. Anda tetap bisa
                mengedit kedua kolom.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 id="step-heading" className="mb-3 text-lg font-semibold">
                Template
              </h2>
              <TemplatePicker
                value={state.template}
                onChange={(template) => setState((s) => ({ ...s, template }))}
              />
            </div>
            <div>
              <h3 className="mb-3 text-base font-semibold">Layout</h3>
              <OptionsForm value={state.options} onChange={patchOptions} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 id="step-heading" className="text-lg font-semibold">
              Pratinjau Cover &amp; Konfirmasi
            </h2>
            <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
              <CoverPreview
                titleAr={state.titleAr}
                titleId={state.titleId}
                authorName={author.name}
                authorEmail={author.email}
                template={state.template}
              />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-[rgb(var(--text-muted))]">Template</dt>
                <dd className="font-medium capitalize">{state.template}</dd>
                <dt className="text-[rgb(var(--text-muted))]">Tokoh</dt>
                <dd className="font-medium">{state.figures.length}</dd>
                <dt className="text-[rgb(var(--text-muted))]">Kertas</dt>
                <dd className="font-medium uppercase">
                  {state.options.paperSize}
                </dd>
                <dt className="text-[rgb(var(--text-muted))]">Orientasi</dt>
                <dd className="font-medium capitalize">
                  {state.options.orientation}
                </dd>
                <dt className="text-[rgb(var(--text-muted))]">Bahasa</dt>
                <dd className="font-medium">
                  {state.options.languageMode === 'both'
                    ? 'AR + ID'
                    : state.options.languageMode.toUpperCase()}
                </dd>
                <dt className="text-[rgb(var(--text-muted))]">Sertakan</dt>
                <dd className="font-medium text-[rgb(var(--text-muted))]">
                  {[
                    state.options.includeIllustrations ? 'Ilustrasi' : null,
                    state.options.includeMaps ? 'Peta' : null,
                    state.options.includeTimeline ? 'Linimasa' : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
              </dl>
            </div>
          </div>
        )}
      </section>

      {/* Step controls */}
      <footer className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1 || submitting}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
        >
          Sebelumnya
        </Button>

        {step < 4 ? (
          <Button
            type="button"
            disabled={!canGoNext || submitting}
            onClick={() => setStep((s) => ((s + 1) as 2 | 3 | 4))}
          >
            Lanjutkan
          </Button>
        ) : (
          <Button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Mengirim…' : 'Generate PDF'}
          </Button>
        )}
      </footer>
    </div>
  )
}
