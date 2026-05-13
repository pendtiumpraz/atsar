import { and, eq } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import { fonts, fontAssignments } from '../schema/index.js'

// BRANDING.md §5 pairing-3 (Balanced — Recommended).
const ASSIGNMENTS: Array<{
  role:
    | 'display_latin'
    | 'body_latin'
    | 'display_arab'
    | 'section_arab'
    | 'body_arab'
    | 'quran_arab'
    | 'mono'
  family: string
}> = [
  { role: 'display_latin', family: 'Playfair Display' },
  { role: 'body_latin', family: 'Inter' },
  { role: 'display_arab', family: 'Amiri' },
  { role: 'section_arab', family: 'Reem Kufi' },
  { role: 'body_arab', family: 'Cairo' },
  { role: 'quran_arab', family: 'Amiri' },
  { role: 'mono', family: 'JetBrains Mono' },
]

export async function seed012FontAssignments() {
  const db = getSeedDb()
  let total = 0
  for (const a of ASSIGNMENTS) {
    const [font] = await db
      .select()
      .from(fonts)
      .where(and(eq(fonts.family, a.family), eq(fonts.isActive, true)))
      .limit(1)
    if (!font) {
      console.warn(`  ⚠ font not found / not active: ${a.family}`)
      continue
    }
    const inserted = await db
      .insert(fontAssignments)
      .values({ role: a.role, fontId: font.id })
      .onConflictDoNothing()
      .returning()
    if (inserted.length > 0) total++
  }
  logSeed('font_assignments', total)
}
