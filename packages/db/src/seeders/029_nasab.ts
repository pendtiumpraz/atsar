// Seeder: nasab (ancestral lineage) — classical Islamic chains.
//
// Runs AFTER 027_relations so it can chain off slugs that 027 produced
// (e.g. nabi-muhammad → abdullah-bin-abdul-muthalib → …). Idempotent via
// ON CONFLICT DO NOTHING — re-running is safe.
//
// Strategy
// --------
// `figure_relations.relatedId` is NOT NULL, so every link in the nasab
// chain needs both ends as real `figures` rows. Pre-Islamic ancestors
// (Adnan, Qushayy, Hashim, …) don't have their own seeder, so we insert
// them here as minimal `shalih_pre_rasul` figures (status='published',
// summaryId carries a "Leluhur Nabi ﷺ" tag for clarity).
//
// Chain convention (matches 027_relations.ts):
//   - INSERT (figureId=parent,  relatedId=child, relation='father')  // forward
//   - INSERT (figureId=child,   relatedId=parent, relation='son')    // reverse
//
// Reading direction: chains below list `child → parent → grandparent → …`
// in the visual nasab order. The seeder walks each chain pairwise.

import { eq, sql } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import { figureCategories, figureRelations, figures } from '../schema/index.js'

interface AncestorFigure {
  slug: string
  nameFullAr: string
  nameFullId: string
  laqabId?: string
  summaryId?: string
}

interface NasabChain {
  /** The starting slug (must already exist as a figure — typically Nabi ﷺ or a sahabat). */
  startSlug: string
  /** Ordered child → parent → grandparent → … (slugs). */
  chain: string[]
}

// ─── 1. Pre-Islamic ancestor figures ─────────────────────────────────
//
// Each entry becomes a `figures` row under category `shalih_pre_rasul`.
// `status='published'` so the nasab chart can link them like any other
// figure — clicking through reveals the minimal stub the reviewer can
// flesh out later.

const ANCESTOR_FIGURES: AncestorFigure[] = [
  // Nabi ﷺ paternal line (above Abdul Muthalib, up to Adnan).
  {
    slug: 'abdullah-bin-abdul-muthalib',
    nameFullAr: 'عَبْد الله بْن عَبْد الْمُطَّلِب',
    nameFullId: 'Abdullah bin Abdul Muthalib',
    laqabId: 'Ayah Nabi ﷺ',
    summaryId: 'Ayahanda Nabi Muhammad ﷺ; wafat sebelum kelahiran beliau.',
  },
  {
    slug: 'abdul-muthalib-bin-hasyim',
    nameFullAr: 'عَبْد الْمُطَّلِب بْن هَاشِم',
    nameFullId: 'Abdul Muthalib bin Hasyim',
    laqabId: 'Kakek Nabi ﷺ; Sayyid Quraisy',
    summaryId:
      'Kakek Nabi Muhammad ﷺ; pemimpin Quraisy yang mengasuh Nabi setelah wafat Abdullah dan Aminah.',
  },
  {
    slug: 'hasyim-bin-abd-manaf',
    nameFullAr: 'هَاشِم بْن عَبْد مَنَاف',
    nameFullId: 'Hasyim bin Abd Manaf',
    laqabId: 'Pendiri Bani Hasyim',
    summaryId:
      'Buyut Nabi ﷺ; pelopor rihlah dagang dua musim Quraisy (asy-Syita’ dan ash-Shaif).',
  },
  {
    slug: 'abd-manaf-bin-qushayy',
    nameFullAr: 'عَبْد مَنَاف بْن قُصَيّ',
    nameFullId: 'Abd Manaf bin Qushayy',
    laqabId: 'Leluhur Bani Hasyim & Bani Umayyah',
    summaryId: 'Leluhur Bani Hasyim dan Bani Umayyah; bapak dari Hasyim, al-Muthalib, dan Abd Syams.',
  },
  {
    slug: 'qushayy-bin-kilab',
    nameFullAr: 'قُصَيّ بْن كِلَاب',
    nameFullId: 'Qushayy bin Kilab',
    laqabId: 'Penyatu Quraisy',
    summaryId:
      'Pemimpin Quraisy yang menyatukan kabilahnya di Makkah dan memegang siqayah serta hijabah Ka’bah.',
  },
  {
    slug: 'kilab-bin-murrah',
    nameFullAr: 'كِلَاب بْن مُرَّة',
    nameFullId: 'Kilab bin Murrah',
    summaryId: 'Leluhur Nabi ﷺ; ayah Qushayy bin Kilab.',
  },
  {
    slug: 'murrah-bin-kab',
    nameFullAr: 'مُرَّة بْن كَعْب',
    nameFullId: 'Murrah bin Ka’b',
    summaryId: 'Leluhur Nabi ﷺ; ayah Kilab dan moyang bersama Abu Bakr ash-Shiddiq.',
  },
  {
    slug: 'kab-bin-luay',
    nameFullAr: 'كَعْب بْن لُؤَيّ',
    nameFullId: 'Ka’b bin Lu’ay',
    summaryId: 'Leluhur Nabi ﷺ; ayah Murrah.',
  },
  {
    slug: 'luay-bin-ghalib',
    nameFullAr: 'لُؤَيّ بْن غَالِب',
    nameFullId: 'Lu’ay bin Ghalib',
    summaryId: 'Leluhur Nabi ﷺ; ayah Ka’b.',
  },
  {
    slug: 'ghalib-bin-fihr',
    nameFullAr: 'غَالِب بْن فِهْر',
    nameFullId: 'Ghalib bin Fihr',
    summaryId: 'Leluhur Nabi ﷺ; ayah Lu’ay.',
  },
  {
    slug: 'fihr-bin-malik',
    nameFullAr: 'فِهْر بْن مَالِك',
    nameFullId: 'Fihr bin Malik',
    laqabId: 'Quraisy',
    summaryId:
      'Leluhur Nabi ﷺ; dialah Quraisy yang darinya kabilah Quraisy mengambil nama.',
  },
  {
    slug: 'malik-bin-an-nadhr',
    nameFullAr: 'مَالِك بْن النَّضْر',
    nameFullId: 'Malik bin an-Nadhr',
    summaryId: 'Leluhur Nabi ﷺ; ayah Fihr.',
  },
  {
    slug: 'an-nadhr-bin-kinanah',
    nameFullAr: 'النَّضْر بْن كِنَانَة',
    nameFullId: 'An-Nadhr bin Kinanah',
    summaryId: 'Leluhur Nabi ﷺ; ayah Malik.',
  },
  {
    slug: 'kinanah-bin-khuzaymah',
    nameFullAr: 'كِنَانَة بْن خُزَيْمَة',
    nameFullId: 'Kinanah bin Khuzaymah',
    summaryId: 'Leluhur Nabi ﷺ; ayah an-Nadhr.',
  },
  {
    slug: 'khuzaymah-bin-mudrikah',
    nameFullAr: 'خُزَيْمَة بْن مُدْرِكَة',
    nameFullId: 'Khuzaymah bin Mudrikah',
    summaryId: 'Leluhur Nabi ﷺ; ayah Kinanah.',
  },
  {
    slug: 'mudrikah-bin-ilyas',
    nameFullAr: 'مُدْرِكَة بْن إِلْيَاس',
    nameFullId: 'Mudrikah bin Ilyas',
    summaryId: 'Leluhur Nabi ﷺ; ayah Khuzaymah.',
  },
  {
    slug: 'ilyas-bin-mudhar',
    nameFullAr: 'إِلْيَاس بْن مُضَر',
    nameFullId: 'Ilyas bin Mudhar',
    summaryId: 'Leluhur Nabi ﷺ; ayah Mudrikah.',
  },
  {
    slug: 'mudhar-bin-nizar',
    nameFullAr: 'مُضَر بْن نِزَار',
    nameFullId: 'Mudhar bin Nizar',
    summaryId: 'Leluhur Nabi ﷺ; ayah Ilyas dan moyang Mudhar.',
  },
  {
    slug: 'nizar-bin-maad',
    nameFullAr: 'نِزَار بْن مَعَدّ',
    nameFullId: 'Nizar bin Ma’add',
    summaryId: 'Leluhur Nabi ﷺ; ayah Mudhar.',
  },
  {
    slug: 'maad-bin-adnan',
    nameFullAr: 'مَعَدّ بْن عَدْنَان',
    nameFullId: 'Ma’add bin Adnan',
    summaryId: 'Leluhur Nabi ﷺ; ayah Nizar dan putra Adnan.',
  },
  {
    slug: 'adnan',
    nameFullAr: 'عَدْنَان',
    nameFullId: 'Adnan',
    laqabId: 'Leluhur bangsa Arab Adnaniyah',
    summaryId:
      'Leluhur Nabi ﷺ dan moyang bangsa Arab Adnaniyah; mayoritas ulama berhenti pada Adnan tanpa melanjutkan ke atas tanpa nash shahih.',
  },

  // Abu Bakr paternal line — branches from Murrah (common ancestor with Nabi).
  {
    slug: 'abu-quhafah-utsman',
    nameFullAr: 'أَبُو قُحَافَة عُثْمَان بْن عَامِر',
    nameFullId: 'Abu Quhafah Utsman bin Amir',
    laqabId: 'Ayah Abu Bakr',
    summaryId:
      'Ayahanda Abu Bakr ash-Shiddiq RA; masuk Islam pada Fath Makkah di usia lanjut.',
  },
  {
    slug: 'amir-bin-amr',
    nameFullAr: 'عَامِر بْن عَمْرو',
    nameFullId: 'Amir bin Amr',
    summaryId: 'Kakek Abu Bakr ash-Shiddiq RA dari pihak ayah.',
  },
  {
    slug: 'amr-bin-kab',
    nameFullAr: 'عَمْرو بْن كَعْب',
    nameFullId: 'Amr bin Ka’b',
    summaryId: 'Buyut Abu Bakr ash-Shiddiq RA; menjumpai jalur ke Murrah bin Ka’b.',
  },

  // Umar paternal line — moyang sampai 'Adi (asal kabilah Bani 'Adi).
  {
    slug: 'khattab-bin-nufail',
    nameFullAr: 'الْخَطَّاب بْن نُفَيْل',
    nameFullId: 'Khattab bin Nufail',
    laqabId: 'Ayah Umar bin Khattab',
    summaryId: 'Ayahanda Umar bin Khattab RA; pembesar Bani ‘Adi sebelum Islam.',
  },
  {
    slug: 'nufail-bin-abdul-uzza',
    nameFullAr: 'نُفَيْل بْن عَبْد الْعُزَّى',
    nameFullId: 'Nufail bin Abdul ‘Uzza',
    summaryId: 'Kakek Umar bin Khattab RA dari pihak ayah.',
  },
  {
    slug: 'abdul-uzza-bin-riyah',
    nameFullAr: 'عَبْد الْعُزَّى بْن رِيَاح',
    nameFullId: 'Abdul ‘Uzza bin Riyah',
    summaryId: 'Buyut Umar bin Khattab RA.',
  },
  {
    slug: 'riyah-bin-abdullah',
    nameFullAr: 'رِيَاح بْن عَبْد الله',
    nameFullId: 'Riyah bin Abdullah',
    summaryId: 'Leluhur Umar bin Khattab RA; jalur Bani ‘Adi.',
  },
  {
    slug: 'abdullah-bin-qurth',
    nameFullAr: 'عَبْد الله بْن قُرْط',
    nameFullId: 'Abdullah bin Qurth',
    summaryId: 'Leluhur Umar bin Khattab RA.',
  },
  {
    slug: 'qurth-bin-razah',
    nameFullAr: 'قُرْط بْن رَزَاح',
    nameFullId: 'Qurth bin Razah',
    summaryId: 'Leluhur Umar bin Khattab RA.',
  },
  {
    slug: 'razah-bin-adi',
    nameFullAr: 'رَزَاح بْن عَدِيّ',
    nameFullId: 'Razah bin ‘Adi',
    summaryId: 'Leluhur Umar bin Khattab RA dari kabilah Bani ‘Adi.',
  },
  {
    slug: 'adi-bin-kab',
    nameFullAr: 'عَدِيّ بْن كَعْب',
    nameFullId: '‘Adi bin Ka’b',
    laqabId: 'Moyang Bani ‘Adi',
    summaryId:
      'Moyang kabilah Bani ‘Adi (kabilah Umar bin Khattab RA); putra Ka’b bin Lu’ay, sekaligus saudara Murrah (moyang Nabi ﷺ).',
  },

  // Ali paternal line — only Abu Thalib needs adding (his father Abdul
  // Muthalib is already in the Nabi chain above).
  {
    slug: 'abu-thalib-bin-abdul-muthalib',
    nameFullAr: 'أَبُو طَالِب بْن عَبْد الْمُطَّلِب',
    nameFullId: 'Abu Thalib bin Abdul Muthalib',
    laqabId: 'Paman Nabi ﷺ; Ayah Ali RA',
    summaryId:
      'Paman Nabi ﷺ dari pihak ayah; pengasuh dan pelindung dakwah Rasulullah di Makkah; ayahanda Ali bin Abi Thalib RA.',
  },
]

// ─── 2. Nasab chains (ordered child → parent → …) ─────────────────────
//
// Each chain seeds the chain ABOVE the start figure. The first slug in the
// `chain` array is the parent of `startSlug`; the second is the
// grandparent, and so on.

const NASAB_CHAINS: NasabChain[] = [
  // Nabi ﷺ — full chain to Adnan.
  {
    startSlug: 'nabi-muhammad',
    chain: [
      'abdullah-bin-abdul-muthalib',
      'abdul-muthalib-bin-hasyim',
      'hasyim-bin-abd-manaf',
      'abd-manaf-bin-qushayy',
      'qushayy-bin-kilab',
      'kilab-bin-murrah',
      'murrah-bin-kab',
      'kab-bin-luay',
      'luay-bin-ghalib',
      'ghalib-bin-fihr',
      'fihr-bin-malik',
      'malik-bin-an-nadhr',
      'an-nadhr-bin-kinanah',
      'kinanah-bin-khuzaymah',
      'khuzaymah-bin-mudrikah',
      'mudrikah-bin-ilyas',
      'ilyas-bin-mudhar',
      'mudhar-bin-nizar',
      'nizar-bin-maad',
      'maad-bin-adnan',
      'adnan',
    ],
  },

  // Abu Bakr — partial paternal chain (3 generations seeded). Full chain
  // joins the Nabi line at Murrah bin Ka'b, but the intermediary Sa'd /
  // Taym names aren't seeded yet — the visual nasab card just stops here.
  {
    startSlug: 'abu-bakr-as-shiddiq',
    chain: ['abu-quhafah-utsman', 'amir-bin-amr', 'amr-bin-kab'],
  },

  // Umar — full chain to 'Adi (and 'Adi up into Ka'b bin Lu'ay shared with Nabi).
  {
    startSlug: 'umar-bin-khattab',
    chain: [
      'khattab-bin-nufail',
      'nufail-bin-abdul-uzza',
      'abdul-uzza-bin-riyah',
      'riyah-bin-abdullah',
      'abdullah-bin-qurth',
      'qurth-bin-razah',
      'razah-bin-adi',
      'adi-bin-kab',
      // Once at 'Adi bin Ka'b we share Ka'b bin Lu'ay with the Nabi chain.
      'kab-bin-luay',
      'luay-bin-ghalib',
      'ghalib-bin-fihr',
      'fihr-bin-malik',
    ],
  },

  // Ali bin Abi Thalib — joins the Nabi chain at Abdul Muthalib.
  {
    startSlug: 'ali-bin-abi-thalib',
    chain: [
      'abu-thalib-bin-abdul-muthalib',
      'abdul-muthalib-bin-hasyim',
      'hasyim-bin-abd-manaf',
      'abd-manaf-bin-qushayy',
      'qushayy-bin-kilab',
    ],
  },

  // Hamzah & Abbas — same paternal line as Nabi (Abdul Muthalib is their father).
  {
    startSlug: 'hamzah-bin-abdul-muthalib',
    chain: ['abdul-muthalib-bin-hasyim', 'hasyim-bin-abd-manaf', 'abd-manaf-bin-qushayy'],
  },
  {
    startSlug: 'abbas-bin-abdul-muthalib',
    chain: ['abdul-muthalib-bin-hasyim', 'hasyim-bin-abd-manaf', 'abd-manaf-bin-qushayy'],
  },

  // Aisyah RA — Abu Bakr is her father, so her chain inherits Abu Bakr's.
  {
    startSlug: 'aisyah-binti-abu-bakr',
    chain: ['abu-bakr-as-shiddiq', 'abu-quhafah-utsman', 'amir-bin-amr', 'amr-bin-kab'],
  },
  {
    startSlug: 'asma-binti-abu-bakr',
    chain: ['abu-bakr-as-shiddiq', 'abu-quhafah-utsman', 'amir-bin-amr', 'amr-bin-kab'],
  },

  // Hafshah binti Umar — chain inherits Umar's.
  {
    startSlug: 'hafshah-binti-umar',
    chain: [
      'umar-bin-khattab',
      'khattab-bin-nufail',
      'nufail-bin-abdul-uzza',
      'abdul-uzza-bin-riyah',
    ],
  },

  // Fathimah az-Zahra — chain inherits Nabi ﷺ.
  {
    startSlug: 'fathimah-az-zahra',
    chain: ['nabi-muhammad', 'abdullah-bin-abdul-muthalib', 'abdul-muthalib-bin-hasyim'],
  },

  // Abdullah bin Umar — chain inherits Umar's.
  {
    startSlug: 'abdullah-bin-umar',
    chain: ['umar-bin-khattab', 'khattab-bin-nufail'],
  },

  // Abdullah bin Abbas — chain inherits Abbas's.
  {
    startSlug: 'abdullah-bin-abbas',
    chain: ['abbas-bin-abdul-muthalib', 'abdul-muthalib-bin-hasyim'],
  },
]

export async function seed029Nasab() {
  const db = getSeedDb()

  // ── A. Ensure shalih_pre_rasul category exists ──────────────────────
  const cat = await db
    .select({ id: figureCategories.id })
    .from(figureCategories)
    .where(eq(figureCategories.slug, 'shalih_pre_rasul'))
    .limit(1)
  const ancestorCategoryId = cat[0]?.id
  if (!ancestorCategoryId) {
    logSeed('nasab', 0, 'skipped (shalih_pre_rasul category missing)')
    return
  }

  // ── B. Insert ancestor figures (idempotent) ─────────────────────────
  let figsInserted = 0
  for (const a of ANCESTOR_FIGURES) {
    const result = await db
      .insert(figures)
      .values({
        slug: a.slug,
        categoryId: ancestorCategoryId,
        gender: 'male',
        nameFullAr: a.nameFullAr,
        nameFullId: a.nameFullId,
        laqabId: a.laqabId,
        rijalGrade: 'not_narrator',
        summaryId: a.summaryId ?? 'Leluhur dari rantai nasab.',
        status: 'published',
        publishedAt: new Date(),
        birthDatePrecision: 'approximate',
        deathDatePrecision: 'approximate',
        birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
        deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
      })
      .onConflictDoNothing()
      .returning({ id: figures.id })
    if (result.length > 0) figsInserted++
  }
  logSeed('nasab figures', figsInserted)

  // ── C. Build slug→id map for chain lookups ──────────────────────────
  const allFigs = await db
    .select({ id: figures.id, slug: figures.slug })
    .from(figures)
    .where(sql`${figures.deletedAt} IS NULL`)
  const idBySlug = new Map(allFigs.map((f) => [f.slug, f.id]))

  // ── D. Insert chain pairs ───────────────────────────────────────────
  // For each chain, walk pairwise (child, parent) and INSERT the two
  // directions ('father' + 'son') with ON CONFLICT DO NOTHING.
  let relsInserted = 0
  for (const c of NASAB_CHAINS) {
    const startId = idBySlug.get(c.startSlug)
    if (!startId) continue // start figure not present — skip silently

    let childId = startId
    for (const parentSlug of c.chain) {
      const parentId = idBySlug.get(parentSlug)
      if (!parentId) break // can't continue the chain
      if (parentId === childId) break // defensive

      // forward: parent → child (father)
      const fwd = await db
        .insert(figureRelations)
        .values({
          figureId: parentId,
          relatedId: childId,
          relationType: 'father',
        })
        .onConflictDoNothing()
        .returning({ id: figureRelations.id })
      if (fwd.length > 0) relsInserted++

      // reverse: child → parent (son) so the existing detail panel surfaces
      // the parent under the "Orang tua" bucket via the standard relations
      // query (which only looks at `figureId = this.id`).
      const rev = await db
        .insert(figureRelations)
        .values({
          figureId: childId,
          relatedId: parentId,
          relationType: 'son',
        })
        .onConflictDoNothing()
        .returning({ id: figureRelations.id })
      if (rev.length > 0) relsInserted++

      childId = parentId
    }
  }
  logSeed('nasab relations', relsInserted)
}
