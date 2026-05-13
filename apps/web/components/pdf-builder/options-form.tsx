// Step 3b — layout & inclusion options for the PDF builder.
//
// Pure-controlled component: parent owns the full payload object and we only
// fire `onChange(patch)` callbacks with delta updates. Keeps the wizard's
// reducer-free `useState` flow simple.

'use client'

import { Label } from '@/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import type { PdfJobCreateInput } from '@/lib/api/endpoints'

type PaperSize = NonNullable<PdfJobCreateInput['paperSize']>
type Orientation = NonNullable<PdfJobCreateInput['orientation']>
type LanguageMode = NonNullable<PdfJobCreateInput['languageMode']>

export interface OptionsValue {
  paperSize: PaperSize
  orientation: Orientation
  languageMode: LanguageMode
  includeIllustrations: boolean
  includeMaps: boolean
  includeTimeline: boolean
}

export interface OptionsFormProps {
  value: OptionsValue
  onChange: (patch: Partial<OptionsValue>) => void
}

const PAPER_LABELS: Record<PaperSize, string> = {
  a4: 'A4 (210 × 297 mm)',
  a5: 'A5 (148 × 210 mm)',
  letter: 'Letter (8.5 × 11 in)',
  legal: 'Legal (8.5 × 14 in)',
}

export function OptionsForm({ value, onChange }: OptionsFormProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Paper size */}
      <div className="space-y-2">
        <Label htmlFor="pdf-paper-size">Ukuran kertas</Label>
        <Select
          value={value.paperSize}
          onValueChange={(v) => onChange({ paperSize: v as PaperSize })}
        >
          <SelectTrigger id="pdf-paper-size">
            <SelectValue placeholder="Pilih ukuran" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PAPER_LABELS) as PaperSize[]).map((size) => (
              <SelectItem key={size} value={size}>
                {PAPER_LABELS[size]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orientation */}
      <div className="space-y-2">
        <Label>Orientasi</Label>
        <RadioGroup
          value={value.orientation}
          onValueChange={(v) => onChange({ orientation: v as Orientation })}
          className="flex gap-4"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--text))]">
            <RadioGroupItem value="portrait" id="orient-portrait" />
            <span>Portrait</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--text))]">
            <RadioGroupItem value="landscape" id="orient-landscape" />
            <span>Landscape</span>
          </label>
        </RadioGroup>
      </div>

      {/* Language mode */}
      <div className="space-y-2 md:col-span-2">
        <Label>Mode bahasa</Label>
        <RadioGroup
          value={value.languageMode}
          onValueChange={(v) => onChange({ languageMode: v as LanguageMode })}
          className="flex flex-wrap gap-4"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--text))]">
            <RadioGroupItem value="both" id="lang-both" />
            <span>Dwi-Bahasa (AR + ID)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--text))]">
            <RadioGroupItem value="id" id="lang-id" />
            <span>Indonesia saja</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--text))]">
            <RadioGroupItem value="ar" id="lang-ar" />
            <span>Arab saja</span>
          </label>
        </RadioGroup>
      </div>

      {/* Inclusion toggles */}
      <fieldset className="space-y-3 md:col-span-2">
        <legend className="text-sm font-medium text-[rgb(var(--text))]">
          Sertakan dalam buku
        </legend>
        <ToggleRow
          id="incl-illustrations"
          label="Ilustrasi CSS"
          description="Hiasan, drop cap, dan ornamen dekoratif."
          checked={value.includeIllustrations}
          onCheckedChange={(v) => onChange({ includeIllustrations: v })}
        />
        <ToggleRow
          id="incl-maps"
          label="Peta lokasi"
          description="Peta tempat lahir & wafat tokoh (jika tersedia)."
          checked={value.includeMaps}
          onCheckedChange={(v) => onChange({ includeMaps: v })}
        />
        <ToggleRow
          id="incl-timeline"
          label="Linimasa"
          description="Garis waktu kronologis tokoh terpilih."
          checked={value.includeTimeline}
          onCheckedChange={(v) => onChange({ includeTimeline: v })}
        />
      </fieldset>
    </div>
  )
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-[rgb(var(--text-muted))]">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
