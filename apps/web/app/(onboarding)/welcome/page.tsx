'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Languages,
  Loader2,
  Map as MapIcon,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Onboarding Wizard — 5 steps (per WIREFRAMES §3).
 *
 *   1. Pilih Bahasa     (ID / AR / Both)
 *   2. Pilih Calendar   (H / M / Both)
 *   3. Pilih Theme      (Light / Dark / Auto)
 *   4. Tour singkat     (slide-of-features carousel)
 *   5. Done             (redirect → /dashboard)
 *
 * Preferences are persisted via PATCH /api/v1/users/me/preferences (TODO:
 * confirm endpoint contract with backend before launch).
 */

type Language = 'id' | 'ar' | 'both'
type CalendarPref = 'hijri' | 'gregorian' | 'both'
type ThemePref = 'light' | 'dark' | 'auto'

interface Preferences {
  language: Language
  calendar: CalendarPref
  theme: ThemePref
}

const DEFAULTS: Preferences = {
  language: 'id',
  calendar: 'both',
  theme: 'auto',
}

const STEPS = ['Bahasa', 'Kalender', 'Tema', 'Tur Fitur', 'Selesai'] as const

const FEATURE_SLIDES = [
  {
    icon: BookOpen,
    title: 'Biografi Mendalam',
    body: 'Tokoh sirah lengkap dengan timeline hidup, hubungan guru-murid, dan riwayat hadits — bersumber salaf.',
  },
  {
    icon: MapIcon,
    title: 'Peta Interaktif',
    body: 'Telusuri jejak para sahabat dan ulama lewat peta, perang, hingga rute hijrah.',
  },
  {
    icon: Sparkles,
    title: 'AI Belajar Sirah',
    body: 'Chat dengan AI yang membatasi sumber pada kitab-kitab salaf — bukan opini bebas.',
  },
  {
    icon: BookOpen,
    title: 'PDF Generator',
    body: 'Cetak biografi atau materi belajar Anda jadi PDF rapi siap baca offline.',
  },
]

export default function WelcomePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS)
  const [tourSlide, setTourSlide] = useState(0)
  const [saving, setSaving] = useState(false)

  // Apply theme immediately so user sees the choice take effect.
  function setTheme(theme: ThemePref) {
    setPrefs((p) => ({ ...p, theme }))
    try {
      localStorage.setItem('theme', theme)
      const isDark =
        theme === 'dark' ||
        (theme === 'auto' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset['theme'] = isDark ? 'dark' : 'light'
    } catch {
      /* ignore — non-fatal */
    }
  }

  async function persistPreferences() {
    // TODO(F2/F3): confirm `PATCH /api/v1/users/me/preferences` contract.
    try {
      const res = await fetch('/api/v1/users/me/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: prefs.language,
          calendar: prefs.calendar,
          theme: prefs.theme,
        }),
      })
      if (!res.ok && res.status !== 404) {
        // 404 → endpoint not yet implemented; don't block onboarding.
        throw new Error(`Gagal menyimpan preferensi (status ${res.status}).`)
      }
    } catch (e) {
      // Non-fatal — user can change preferences later from Settings.
      const msg = e instanceof Error ? e.message : 'Tidak bisa menyimpan preferensi.'
      // eslint-disable-next-line no-console
      console.warn('[onboarding] preferences not saved:', msg)
    }
  }

  async function handleFinish() {
    setSaving(true)
    try {
      await persistPreferences()
      toast.success('Selamat datang di Athar! Trial 3 hari Anda dimulai.')
      router.push('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  function prev() {
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'rgb(var(--bg))' }}
    >
      <div className="w-full max-w-2xl">
        {/* Stepper */}
        <ol
          className="mb-8 flex items-center justify-between gap-2"
          aria-label="Progress onboarding"
        >
          {STEPS.map((label, i) => {
            const done = i < step
            const active = i === step
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  )}
                  style={{
                    backgroundColor: done || active ? 'rgb(var(--primary))' : 'rgb(var(--surface))',
                    color: done || active ? 'rgb(var(--primary-foreground))' : 'rgb(var(--text-muted))',
                    borderColor: 'rgb(var(--border))',
                  }}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className="h-px flex-1"
                    style={{
                      backgroundColor:
                        i < step ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                    }}
                  />
                )}
              </li>
            )
          })}
        </ol>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === 0 && 'Pilih Bahasa Anda'}
              {step === 1 && 'Mode Kalender'}
              {step === 2 && 'Pilih Tema'}
              {step === 3 && 'Sekilas Tur Fitur'}
              {step === 4 && 'Siap Mulai!'}
            </CardTitle>
            <CardDescription>
              Langkah {step + 1} dari {STEPS.length} — {STEPS[step]}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === 0 && (
              <LanguageStep
                value={prefs.language}
                onChange={(v) => setPrefs((p) => ({ ...p, language: v }))}
              />
            )}
            {step === 1 && (
              <CalendarStep
                value={prefs.calendar}
                onChange={(v) => setPrefs((p) => ({ ...p, calendar: v }))}
              />
            )}
            {step === 2 && (
              <ThemeStep value={prefs.theme} onChange={setTheme} />
            )}
            {step === 3 && (
              <TourStep slide={tourSlide} onSlideChange={setTourSlide} />
            )}
            {step === 4 && <DoneStep prefs={prefs} />}

            <div className="mt-6 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={prev}
                disabled={step === 0 || saving}
              >
                <ChevronLeft size={16} />
                Kembali
              </Button>

              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={next}>
                  Lanjut
                  <ChevronRight size={16} />
                </Button>
              ) : (
                <Button type="button" onClick={handleFinish} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      Mulai Belajar
                      <ChevronRight size={16} />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

// ─── Step components ──────────────────────────────────────────────────

interface OptionCardProps {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
}

function OptionCard({ selected, onClick, icon, title, description }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors',
      )}
      style={{
        borderColor: selected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
        backgroundColor: selected ? 'rgb(var(--bg-elevated))' : 'rgb(var(--surface))',
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: selected ? 'rgb(var(--primary))' : 'rgb(var(--bg-elevated))',
          color: selected ? 'rgb(var(--primary-foreground))' : 'rgb(var(--text-muted))',
        }}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-medium" style={{ color: 'rgb(var(--text))' }}>
          {title}
        </span>
        <span className="mt-0.5 block text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
          {description}
        </span>
      </span>
      {selected && (
        <Check size={18} style={{ color: 'rgb(var(--primary))' }} aria-hidden="true" />
      )}
    </button>
  )
}

function LanguageStep({
  value,
  onChange,
}: {
  value: Language
  onChange: (v: Language) => void
}) {
  return (
    <div className="space-y-3">
      <OptionCard
        selected={value === 'id'}
        onClick={() => onChange('id')}
        icon={<Languages size={20} />}
        title="Bahasa Indonesia"
        description="Tampilkan antarmuka dan konten dalam Bahasa Indonesia."
      />
      <OptionCard
        selected={value === 'ar'}
        onClick={() => onChange('ar')}
        icon={<Globe size={20} />}
        title="العربية (Arab)"
        description="Tampilkan dalam Bahasa Arab dengan layout RTL."
      />
      <OptionCard
        selected={value === 'both'}
        onClick={() => onChange('both')}
        icon={<Globe size={20} />}
        title="Dwi-bahasa (ID + AR)"
        description="Tampilkan keduanya berdampingan untuk teks utama."
      />
    </div>
  )
}

function CalendarStep({
  value,
  onChange,
}: {
  value: CalendarPref
  onChange: (v: CalendarPref) => void
}) {
  return (
    <div className="space-y-3">
      <OptionCard
        selected={value === 'hijri'}
        onClick={() => onChange('hijri')}
        icon={<CalendarIcon size={20} />}
        title="Hijriyah"
        description="Tampilkan tanggal dalam kalender Hijriyah (H)."
      />
      <OptionCard
        selected={value === 'gregorian'}
        onClick={() => onChange('gregorian')}
        icon={<CalendarIcon size={20} />}
        title="Masehi"
        description="Tampilkan tanggal dalam kalender Masehi (M)."
      />
      <OptionCard
        selected={value === 'both'}
        onClick={() => onChange('both')}
        icon={<CalendarIcon size={20} />}
        title="Keduanya"
        description="Tampilkan H dan M berdampingan."
      />
    </div>
  )
}

function ThemeStep({
  value,
  onChange,
}: {
  value: ThemePref
  onChange: (v: ThemePref) => void
}) {
  return (
    <div className="space-y-3">
      <OptionCard
        selected={value === 'light'}
        onClick={() => onChange('light')}
        icon={<Sun size={20} />}
        title="Mode Terang"
        description="Palet Emerald Turats dengan latar krem."
      />
      <OptionCard
        selected={value === 'dark'}
        onClick={() => onChange('dark')}
        icon={<Moon size={20} />}
        title="Mode Gelap"
        description="Emerald Turats Night — nyaman di malam hari."
      />
      <OptionCard
        selected={value === 'auto'}
        onClick={() => onChange('auto')}
        icon={<Sparkles size={20} />}
        title="Otomatis"
        description="Ikuti preferensi sistem operasi Anda."
      />
    </div>
  )
}

function TourStep({
  slide,
  onSlideChange,
}: {
  slide: number
  onSlideChange: (n: number) => void
}) {
  const current = FEATURE_SLIDES[slide] ?? FEATURE_SLIDES[0]
  if (!current) return null
  const Icon = current.icon

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
        style={{
          borderColor: 'rgb(var(--border))',
          backgroundColor: 'rgb(var(--bg-elevated))',
        }}
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: 'rgb(var(--primary))',
            color: 'rgb(var(--primary-foreground))',
          }}
        >
          <Icon size={28} />
        </span>
        <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--text))' }}>
          {current.title}
        </h3>
        <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
          {current.body}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Slide tur fitur">
        {FEATURE_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === slide}
            aria-label={`Slide ${i + 1}`}
            onClick={() => onSlideChange(i)}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === slide ? 24 : 8,
              backgroundColor:
                i === slide ? 'rgb(var(--primary))' : 'rgb(var(--border))',
            }}
          />
        ))}
      </div>

      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => onSlideChange(Math.max(0, slide - 1))}
          disabled={slide === 0}
          className="disabled:opacity-40"
          style={{ color: 'rgb(var(--text-muted))' }}
        >
          ← Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => onSlideChange(Math.min(FEATURE_SLIDES.length - 1, slide + 1))}
          disabled={slide === FEATURE_SLIDES.length - 1}
          className="disabled:opacity-40"
          style={{ color: 'rgb(var(--text-muted))' }}
        >
          Berikutnya →
        </button>
      </div>
    </div>
  )
}

function DoneStep({ prefs }: { prefs: Preferences }) {
  const langLabel = { id: 'Bahasa Indonesia', ar: 'العربية', both: 'Dwi-bahasa' }[prefs.language]
  const calLabel = { hijri: 'Hijriyah', gregorian: 'Masehi', both: 'Keduanya' }[prefs.calendar]
  const themeLabel = { light: 'Terang', dark: 'Gelap', auto: 'Otomatis' }[prefs.theme]

  return (
    <div className="space-y-4 text-center">
      <p style={{ color: 'rgb(var(--text))' }}>
        Pengaturan Anda siap. Trial 3 hari akan dimulai begitu Anda klik tombol di bawah.
      </p>
      <dl
        className="mx-auto grid max-w-sm grid-cols-2 gap-2 rounded-lg border p-4 text-left text-sm"
        style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--bg-elevated))' }}
      >
        <dt style={{ color: 'rgb(var(--text-muted))' }}>Bahasa</dt>
        <dd style={{ color: 'rgb(var(--text))' }}>{langLabel}</dd>
        <dt style={{ color: 'rgb(var(--text-muted))' }}>Kalender</dt>
        <dd style={{ color: 'rgb(var(--text))' }}>{calLabel}</dd>
        <dt style={{ color: 'rgb(var(--text-muted))' }}>Tema</dt>
        <dd style={{ color: 'rgb(var(--text))' }}>{themeLabel}</dd>
      </dl>
    </div>
  )
}
