// Step 3a — template picker.
//
// The 4 templates (classic / modern / calligraphy / minimalist) are seeded in
// the backend (Phase 5 P5-3). The wizard only needs the slug — preview art is
// rendered inline as a styled SVG placeholder so we don't rely on uploaded
// image assets that may not exist in dev.

'use client'

import { cn } from '@/lib/utils'

export interface TemplateOption {
  slug: 'classic' | 'modern' | 'calligraphy' | 'minimalist'
  label: string
  description: string
  /** Tailwind background/border classes used by the placeholder card. */
  swatch: string
}

const TEMPLATES: TemplateOption[] = [
  {
    slug: 'classic',
    label: 'Klasik',
    description: 'Layout tradisional dengan ornamen Turats hijau zamrud.',
    swatch: 'from-[#0e5c4a] to-[#063b30]',
  },
  {
    slug: 'modern',
    label: 'Modern',
    description: 'Tipografi tegas, banyak ruang putih, cocok dibaca digital.',
    swatch: 'from-slate-100 to-slate-300',
  },
  {
    slug: 'calligraphy',
    label: 'Kaligrafi',
    description: 'Cover berhias kaligrafi Arab, ideal untuk hadiah.',
    swatch: 'from-amber-100 to-amber-300',
  },
  {
    slug: 'minimalist',
    label: 'Minimalis',
    description: 'Tanpa ornamen, fokus pada teks.',
    swatch: 'from-stone-200 to-stone-400',
  },
]

export interface TemplatePickerProps {
  value: TemplateOption['slug']
  onChange: (slug: TemplateOption['slug']) => void
}

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Pilih template"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {TEMPLATES.map((tpl) => {
        const active = value === tpl.slug
        return (
          <button
            key={tpl.slug}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(tpl.slug)}
            className={cn(
              'group flex flex-col gap-2 rounded-lg border bg-[rgb(var(--surface))] p-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
              active
                ? 'border-[rgb(var(--accent))] ring-2 ring-[rgb(var(--accent))]'
                : 'border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]',
            )}
          >
            <div
              aria-hidden
              className={cn(
                'flex aspect-[3/4] items-center justify-center rounded-md bg-gradient-to-br shadow-inner',
                tpl.swatch,
              )}
            >
              <svg
                viewBox="0 0 60 80"
                className="h-3/4 w-3/4 text-white/90"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="4" y="6" width="52" height="68" rx="2" />
                <line x1="12" y1="22" x2="48" y2="22" />
                <line x1="18" y1="32" x2="42" y2="32" />
                <line x1="14" y1="46" x2="46" y2="46" />
                <line x1="20" y1="54" x2="40" y2="54" />
                <line x1="24" y1="64" x2="36" y2="64" />
              </svg>
            </div>
            <div className="px-1">
              <div className="text-sm font-semibold text-[rgb(var(--text))]">
                {tpl.label}
              </div>
              <div className="text-xs text-[rgb(var(--text-muted))]">
                {tpl.description}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export { TEMPLATES }
