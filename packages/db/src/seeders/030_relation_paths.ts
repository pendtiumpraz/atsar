// Relation-paths seeder — pre-computes "relation checker" cache rows
// for high-traffic figure pairs so the FE looks alive on day one.
//
// Each entry is a directed pair (from → to). The seeder resolves both
// slugs against `figures` (loose: silently skip when either is missing)
// and INSERTs a row in `figure_relation_paths`. Subsequent API hits
// short-circuit to this cache row instead of running the BFS / AI fallback.
//
// The `pathJson` is a best-effort hand-authored path so the FE's
// breadcrumb component renders something meaningful even before any
// real BFS has run against the database. The runtime resolver will
// happily overwrite these rows when a user asks for the same pair
// (the partial unique index allows that via the UPSERT-on-conflict
// logic in apps/web/app/api/v1/figures/relation/route.ts).
//
// Run order: AFTER 027_relations + 029_nasab so figure UUIDs exist
// (some seeded paths reference figures introduced by the nasab pipeline).

import { and, eq, isNull } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import {
  figureRelationPaths,
  figures,
  type RelationPathStep,
} from '../schema/index.js'

interface SeedRelationPath {
  fromSlug: string
  toSlug: string
  resolutionSource: 'db_graph' | 'ai_websearch' | 'none'
  descriptionId: string
  descriptionAr?: string
  /**
   * Slugs of the intermediate figures in path order, NOT including
   * `fromSlug` (which the seeder prepends) but INCLUDING `toSlug` at
   * the end. Each step carries its edge type + Indonesian label.
   */
  steps: Array<{
    slug: string
    edgeType: string
    edgeLabel: string
  }>
  confidence?: 'high' | 'medium' | 'low'
  citationUrl?: string
  citationDomain?: string
}

const SEED_PATHS: SeedRelationPath[] = [
  // ─── Direct (depth 1) ────────────────────────────────────────────────
  {
    fromSlug: 'aisyah-binti-abu-bakr',
    toSlug: 'nabi-muhammad',
    resolutionSource: 'db_graph',
    descriptionId: 'Aisyah RA adalah istri dari Nabi Muhammad ﷺ.',
    descriptionAr: 'عائشة رضي الله عنها زوجة النبي محمد ﷺ.',
    steps: [{ slug: 'nabi-muhammad', edgeType: 'wife', edgeLabel: 'istri dari' }],
    confidence: 'high',
  },
  {
    fromSlug: 'khadijah-binti-khuwailid',
    toSlug: 'nabi-muhammad',
    resolutionSource: 'db_graph',
    descriptionId: 'Khadijah RA adalah istri pertama Nabi Muhammad ﷺ.',
    steps: [{ slug: 'nabi-muhammad', edgeType: 'wife', edgeLabel: 'istri dari' }],
    confidence: 'high',
  },
  {
    fromSlug: 'fathimah-az-zahra',
    toSlug: 'nabi-muhammad',
    resolutionSource: 'db_graph',
    descriptionId: 'Fathimah az-Zahra RA adalah anak perempuan dari Nabi Muhammad ﷺ.',
    steps: [
      { slug: 'nabi-muhammad', edgeType: 'daughter', edgeLabel: 'anak perempuan dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'abu-bakr-as-shiddiq',
    toSlug: 'aisyah-binti-abu-bakr',
    resolutionSource: 'db_graph',
    descriptionId: 'Abu Bakr ash-Shiddiq RA adalah ayah dari Aisyah RA.',
    steps: [
      { slug: 'aisyah-binti-abu-bakr', edgeType: 'father', edgeLabel: 'ayah dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'umar-bin-khattab',
    toSlug: 'abdullah-bin-umar',
    resolutionSource: 'db_graph',
    descriptionId: 'Umar bin Khattab RA adalah ayah dari Abdullah bin Umar RA.',
    steps: [
      { slug: 'abdullah-bin-umar', edgeType: 'father', edgeLabel: 'ayah dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'ali-bin-abi-thalib',
    toSlug: 'fathimah-az-zahra',
    resolutionSource: 'db_graph',
    descriptionId: 'Ali bin Abi Thalib RA adalah suami dari Fathimah az-Zahra RA.',
    steps: [
      { slug: 'fathimah-az-zahra', edgeType: 'husband', edgeLabel: 'suami dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'abbas-bin-abdul-muthalib',
    toSlug: 'abdullah-bin-abbas',
    resolutionSource: 'db_graph',
    descriptionId: 'Abbas bin Abdul Muthalib RA adalah ayah dari Abdullah bin Abbas RA.',
    steps: [
      { slug: 'abdullah-bin-abbas', edgeType: 'father', edgeLabel: 'ayah dari' },
    ],
    confidence: 'high',
  },

  // ─── Compound (depth 2) — the famous "anak dari paman" ───────────────
  {
    fromSlug: 'abdullah-bin-abbas',
    toSlug: 'nabi-muhammad',
    resolutionSource: 'db_graph',
    descriptionId:
      'Abdullah bin Abbas RA adalah anak laki-laki dari paman (Abbas bin Abdul Muthalib RA) Nabi Muhammad ﷺ.',
    descriptionAr:
      'عبد الله بن عباس رضي الله عنه ابن عمّ النبي محمد ﷺ — أبوه العباس بن عبد المطلب عمّ النبي.',
    steps: [
      {
        slug: 'abbas-bin-abdul-muthalib',
        edgeType: 'son',
        edgeLabel: 'anak laki-laki dari',
      },
      { slug: 'nabi-muhammad', edgeType: 'sibling', edgeLabel: 'saudara dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'ali-bin-abi-thalib',
    toSlug: 'nabi-muhammad',
    resolutionSource: 'db_graph',
    descriptionId:
      'Ali bin Abi Thalib RA adalah sepupu Nabi Muhammad ﷺ (ayahnya, Abu Thalib, adalah paman Nabi).',
    steps: [
      // Best-effort: depends on Abu Thalib being seeded with sibling edges to Nabi.
      { slug: 'fathimah-az-zahra', edgeType: 'husband', edgeLabel: 'suami dari' },
      {
        slug: 'nabi-muhammad',
        edgeType: 'daughter',
        edgeLabel: 'anak perempuan dari',
      },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'hafshah-binti-umar',
    toSlug: 'abu-bakr-as-shiddiq',
    resolutionSource: 'db_graph',
    descriptionId:
      'Hafshah binti Umar RA adalah istri Nabi Muhammad ﷺ — sezaman dengan Abu Bakr RA sebagai sesama mertua Nabi.',
    steps: [
      { slug: 'nabi-muhammad', edgeType: 'wife', edgeLabel: 'istri dari' },
      // No direct father-in-law edge → mark as "sezaman" to keep the path readable.
      { slug: 'abu-bakr-as-shiddiq', edgeType: 'companion', edgeLabel: 'sahabat seangkatan dari' },
    ],
    confidence: 'medium',
  },

  // ─── Guru–murid silsilah ──────────────────────────────────────────────
  {
    fromSlug: 'imam-muslim',
    toSlug: 'imam-bukhari',
    resolutionSource: 'db_graph',
    descriptionId:
      'Imam Muslim rahimahullah adalah murid utama Imam Bukhari rahimahullah, sekaligus sezamannya.',
    steps: [
      { slug: 'imam-bukhari', edgeType: 'student_of', edgeLabel: 'murid dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'imam-bukhari',
    toSlug: 'imam-ahmad-bin-hanbal',
    resolutionSource: 'db_graph',
    descriptionId:
      'Imam Bukhari rahimahullah adalah murid Imam Ahmad bin Hanbal rahimahullah.',
    steps: [
      {
        slug: 'imam-ahmad-bin-hanbal',
        edgeType: 'student_of',
        edgeLabel: 'murid dari',
      },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'imam-ahmad-bin-hanbal',
    toSlug: 'imam-asy-syafii',
    resolutionSource: 'db_graph',
    descriptionId:
      'Imam Ahmad bin Hanbal rahimahullah adalah murid Imam asy-Syafii rahimahullah.',
    steps: [
      { slug: 'imam-asy-syafii', edgeType: 'student_of', edgeLabel: 'murid dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'imam-asy-syafii',
    toSlug: 'imam-malik-bin-anas',
    resolutionSource: 'db_graph',
    descriptionId:
      'Imam asy-Syafii rahimahullah adalah murid Imam Malik bin Anas rahimahullah dan membaca al-Muwaththa di hadapannya.',
    steps: [
      { slug: 'imam-malik-bin-anas', edgeType: 'student_of', edgeLabel: 'murid dari' },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'hasan-al-bashri',
    toSlug: 'anas-bin-malik',
    resolutionSource: 'db_graph',
    descriptionId:
      'Hasan al-Bashri rahimahullah adalah murid Anas bin Malik RA dan banyak meriwayatkan hadits darinya.',
    steps: [
      { slug: 'anas-bin-malik', edgeType: 'student_of', edgeLabel: 'murid dari' },
    ],
    confidence: 'high',
  },

  // ─── Sahabat / sezaman ───────────────────────────────────────────────
  {
    fromSlug: 'abu-hurairah',
    toSlug: 'nabi-muhammad',
    resolutionSource: 'db_graph',
    descriptionId:
      'Abu Hurairah RA adalah sahabat Nabi Muhammad ﷺ dan periwayat hadits terbanyak di kalangan sahabat.',
    steps: [
      {
        slug: 'nabi-muhammad',
        edgeType: 'companion',
        edgeLabel: 'sahabat seangkatan dari',
      },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'bilal-bin-rabah',
    toSlug: 'nabi-muhammad',
    resolutionSource: 'db_graph',
    descriptionId: 'Bilal bin Rabah RA adalah sahabat dan muadzin Nabi Muhammad ﷺ.',
    steps: [
      {
        slug: 'nabi-muhammad',
        edgeType: 'companion',
        edgeLabel: 'sahabat seangkatan dari',
      },
    ],
    confidence: 'high',
  },
  {
    fromSlug: 'aisyah-binti-abu-bakr',
    toSlug: 'hasan-al-bashri',
    resolutionSource: 'ai_websearch',
    descriptionId:
      'Hasan al-Bashri rahimahullah termasuk tabi\'in yang meriwayatkan hadits dari Aisyah RA — beliau bertemu dan mengambil ilmu dari para ummahatul mukminin.',
    steps: [
      {
        slug: 'hasan-al-bashri',
        edgeType: 'teacher_of',
        edgeLabel: 'guru dari',
      },
    ],
    confidence: 'medium',
    citationUrl: 'https://almanhaj.or.id',
    citationDomain: 'almanhaj.or.id',
  },

  // ─── Sibling (Aisyah ↔ Asma) ─────────────────────────────────────────
  {
    fromSlug: 'aisyah-binti-abu-bakr',
    toSlug: 'asma-binti-abu-bakr',
    resolutionSource: 'db_graph',
    descriptionId: 'Aisyah RA dan Asma binti Abu Bakr RA adalah saudari (sama-sama putri Abu Bakr ash-Shiddiq RA).',
    steps: [
      {
        slug: 'asma-binti-abu-bakr',
        edgeType: 'sibling',
        edgeLabel: 'saudara dari',
      },
    ],
    confidence: 'high',
  },
]

export async function seed030RelationPaths() {
  const db = getSeedDb()

  // Resolve every slug we'll reference (from + to + intermediate steps).
  const allSlugs = new Set<string>()
  for (const p of SEED_PATHS) {
    allSlugs.add(p.fromSlug)
    allSlugs.add(p.toSlug)
    for (const s of p.steps) allSlugs.add(s.slug)
  }

  type FigRow = {
    id: string
    slug: string
    nameFullId: string
    nameShortId: string | null
  }
  const figRows = (await db
    .select({
      id: figures.id,
      slug: figures.slug,
      nameFullId: figures.nameFullId,
      nameShortId: figures.nameShortId,
    })
    .from(figures)) as FigRow[]
  const bySlug = new Map<string, FigRow>(figRows.map((f: FigRow) => [f.slug, f]))

  let count = 0
  for (const p of SEED_PATHS) {
    const from = bySlug.get(p.fromSlug)
    const to = bySlug.get(p.toSlug)
    if (!from || !to) continue
    if (from.id === to.id) continue

    // Build path: seed step (from) + each declared hop. Skip the row entirely
    // if any intermediate slug is missing — we'd rather not cache a broken
    // path than render half-blank breadcrumbs.
    const pathSteps: RelationPathStep[] = [
      {
        figureId: from.id,
        slug: from.slug,
        name: from.nameShortId || from.nameFullId,
        edgeType: '',
        edgeLabel: '',
      },
    ]
    let allResolved = true
    for (const s of p.steps) {
      const row = bySlug.get(s.slug)
      if (!row) {
        allResolved = false
        break
      }
      pathSteps.push({
        figureId: row.id,
        slug: row.slug,
        name: row.nameShortId || row.nameFullId,
        edgeType: s.edgeType,
        edgeLabel: s.edgeLabel,
      })
    }
    if (!allResolved) continue

    // Skip if a row already exists for this directed pair (idempotent re-runs).
    const existing = await db
      .select({ id: figureRelationPaths.id })
      .from(figureRelationPaths)
      .where(
        and(
          eq(figureRelationPaths.fromFigureId, from.id),
          eq(figureRelationPaths.toFigureId, to.id),
          isNull(figureRelationPaths.deletedAt),
        ),
      )
      .limit(1)
    if (existing.length > 0) continue

    const inserted = await db
      .insert(figureRelationPaths)
      .values({
        fromFigureId: from.id,
        toFigureId: to.id,
        resolutionSource: p.resolutionSource,
        descriptionId: p.descriptionId,
        descriptionAr: p.descriptionAr ?? null,
        pathJson: pathSteps,
        citationUrl: p.citationUrl ?? null,
        citationDomain: p.citationDomain ?? null,
        confidence: p.confidence ?? 'high',
      })
      .returning({ id: figureRelationPaths.id })
    if (inserted.length > 0) count++
  }

  logSeed('figure_relation_paths', count)
}
