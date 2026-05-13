import { getSeedDb, logSeed } from './_helpers.js'
import { fonts } from '../schema/index.js'

// See IDEAS.md §3b.3 + BRANDING.md §5.
const FONTS: Array<{
  name: string
  family: string
  script: 'latin' | 'arabic' | 'mono' | 'both'
  googleFamilyName?: string
  weights?: number[]
  styles?: string[]
  isActive: boolean
  previewTextAr?: string
  previewTextId?: string
  license?: string
}> = [
  // ─── Defaults (active) ────────────────────────────────────────────
  { name: 'Playfair Display', family: 'Playfair Display', script: 'latin', googleFamilyName: 'Playfair Display', weights: [400, 600, 700, 900], styles: ['normal', 'italic'], isActive: true, license: 'OFL', previewTextId: 'Athar — Jejak generasi terbaik.' },
  { name: 'Inter', family: 'Inter', script: 'latin', googleFamilyName: 'Inter', weights: [400, 500, 600, 700], styles: ['normal'], isActive: true, license: 'OFL', previewTextId: 'Athar — Jejak generasi terbaik.' },
  { name: 'Amiri', family: 'Amiri', script: 'arabic', googleFamilyName: 'Amiri', weights: [400, 700], styles: ['normal', 'italic'], isActive: true, license: 'OFL', previewTextAr: 'بسم الله الرحمن الرحيم' },
  { name: 'Reem Kufi', family: 'Reem Kufi', script: 'arabic', googleFamilyName: 'Reem Kufi', weights: [400, 500, 600, 700], styles: ['normal'], isActive: true, license: 'OFL', previewTextAr: 'أثر' },
  { name: 'Cairo', family: 'Cairo', script: 'arabic', googleFamilyName: 'Cairo', weights: [400, 500, 600, 700], styles: ['normal'], isActive: true, license: 'OFL', previewTextAr: 'أثر السلف الصالح' },
  { name: 'JetBrains Mono', family: 'JetBrains Mono', script: 'mono', googleFamilyName: 'JetBrains Mono', weights: [400, 500, 700], styles: ['normal', 'italic'], isActive: true, license: 'OFL' },

  // ─── Latin display alternatives (inactive) ────────────────────────
  { name: 'EB Garamond', family: 'EB Garamond', script: 'latin', googleFamilyName: 'EB Garamond', weights: [400, 500, 600, 700], styles: ['normal', 'italic'], isActive: false, license: 'OFL' },
  { name: 'Cormorant', family: 'Cormorant', script: 'latin', googleFamilyName: 'Cormorant', weights: [400, 500, 600, 700], isActive: false, license: 'OFL' },
  { name: 'Source Serif 4', family: 'Source Serif 4', script: 'latin', googleFamilyName: 'Source Serif 4', weights: [400, 600, 700], isActive: false, license: 'OFL' },
  { name: 'Fraunces', family: 'Fraunces', script: 'latin', googleFamilyName: 'Fraunces', weights: [400, 600, 700, 900], isActive: false, license: 'OFL' },

  // ─── Latin body alternatives ──────────────────────────────────────
  { name: 'IBM Plex Sans', family: 'IBM Plex Sans', script: 'latin', googleFamilyName: 'IBM Plex Sans', weights: [400, 500, 600, 700], isActive: false, license: 'OFL' },
  { name: 'Source Sans 3', family: 'Source Sans 3', script: 'latin', googleFamilyName: 'Source Sans 3', weights: [400, 600, 700], isActive: false, license: 'OFL' },
  { name: 'Geist', family: 'Geist', script: 'latin', googleFamilyName: 'Geist', weights: [400, 500, 600, 700], isActive: false, license: 'OFL' },

  // ─── Arabic display alternatives ──────────────────────────────────
  { name: 'Aref Ruqaa', family: 'Aref Ruqaa', script: 'arabic', googleFamilyName: 'Aref Ruqaa', weights: [400, 700], isActive: false, license: 'OFL' },
  { name: 'Lateef', family: 'Lateef', script: 'arabic', googleFamilyName: 'Lateef', weights: [400, 700], isActive: false, license: 'OFL' },

  // ─── Arabic body alternatives ─────────────────────────────────────
  { name: 'Tajawal', family: 'Tajawal', script: 'arabic', googleFamilyName: 'Tajawal', weights: [400, 500, 700], isActive: false, license: 'OFL' },
  { name: 'Noto Sans Arabic', family: 'Noto Sans Arabic', script: 'arabic', googleFamilyName: 'Noto Sans Arabic', weights: [400, 500, 600, 700], isActive: false, license: 'OFL' },
  { name: 'IBM Plex Sans Arabic', family: 'IBM Plex Sans Arabic', script: 'arabic', googleFamilyName: 'IBM Plex Sans Arabic', weights: [400, 500, 700], isActive: false, license: 'OFL' },
  { name: 'Scheherazade New', family: 'Scheherazade New', script: 'arabic', googleFamilyName: 'Scheherazade New', weights: [400, 700], isActive: false, license: 'OFL' },
  { name: 'Noto Naskh Arabic', family: 'Noto Naskh Arabic', script: 'arabic', googleFamilyName: 'Noto Naskh Arabic', weights: [400, 500, 700], isActive: false, license: 'OFL' },
]

export async function seed011Fonts() {
  const db = getSeedDb()
  const data = FONTS.map((f) => ({
    name: f.name,
    family: f.family,
    script: f.script,
    source: 'google_fonts' as const,
    googleFamilyName: f.googleFamilyName,
    weights: f.weights,
    styles: f.styles,
    previewTextAr: f.previewTextAr,
    previewTextId: f.previewTextId,
    license: f.license,
    isActive: f.isActive,
  }))
  const result = await db.insert(fonts).values(data).onConflictDoNothing().returning()
  logSeed('fonts', result.length)
}
