import { sql } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import { pdfTemplates } from '../schema/index.js'

// Atsar PDF templates — four distinct visual identities.
// Public slugs stay stable for backwards compatibility; the internal
// identity / description copy was redesigned in Phase 7.5.6 to match the
// new production-grade book layouts (see
// `apps/web/lib/server/pdf/templates/*.ts`).
const TEMPLATES = [
  {
    // Internal identity: "Klasik Naskh" — warm cream paper, Naskh
    // Arabic + EB Garamond Latin, classical book layout with chapter
    // ornaments and page-bottom footnotes.
    slug: 'classic',
    nameId: 'Klasik Naskh',
    nameAr: 'كلاسيكي نسخي',
    templatePath: 'templates/classic/index.html',
    supportsOrientation: ['portrait'],
    isActive: true,
  },
  {
    // Internal identity: "Kontemporer" — bright white, Markazi Text
    // Arabic + Inter Latin, editorial grid layout with sidebar dates.
    slug: 'modern',
    nameId: 'Kontemporer',
    nameAr: 'معاصر',
    templatePath: 'templates/modern/index.html',
    supportsOrientation: ['portrait'],
    isActive: true,
  },
  {
    // Internal identity: "Lentera" — deep navy + gold premium edition,
    // Aref Ruqaa display + serif body, oversized drop caps, full-bleed
    // arabesque cover.
    slug: 'calligraphy',
    nameId: 'Lentera Premium',
    nameAr: 'فانوس',
    templatePath: 'templates/calligraphy/index.html',
    supportsOrientation: ['portrait'],
    isActive: true,
  },
  {
    // Internal identity: "Edisi Mahasiswa" — notebook-style off-white
    // study edition with generous outer margin for annotation and
    // callout boxes for key facts.
    slug: 'minimalist',
    nameId: 'Edisi Mahasiswa',
    nameAr: 'طبعة الطالب',
    templatePath: 'templates/minimalist/index.html',
    supportsOrientation: ['portrait'],
    isActive: true,
  },
]

export async function seed014PdfTemplates() {
  const db = getSeedDb()
  // Upsert so the description / name updates after Phase 7.5.6 take
  // effect on re-seed (slug stays unique, other columns refresh from
  // the `excluded` pseudo-table that ON CONFLICT exposes).
  const result = await db
    .insert(pdfTemplates)
    .values(TEMPLATES)
    .onConflictDoUpdate({
      target: pdfTemplates.slug,
      set: {
        nameId: sql`excluded.name_id`,
        nameAr: sql`excluded.name_ar`,
        templatePath: sql`excluded.template_path`,
        supportsOrientation: sql`excluded.supports_orientation`,
        isActive: sql`excluded.is_active`,
        updatedAt: new Date(),
      },
    })
    .returning()
  logSeed('pdf_templates', result.length)
}
