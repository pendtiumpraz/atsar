// Tools exposed to the AI chat agent (RAG over the Atsar DB).
//
// The route handler builds a `chatTools(userId)` factory so each tool execute
// can respect the caller's content-access tier (`filterAllowedFigureIds`).
//
// All tools return JSON-serializable objects — the AI SDK stringifies them
// into the assistant transcript when `maxSteps > 1` so the model can read
// the tool output and decide whether to call another tool or compose the
// final answer.
//
// Why a separate file: keeping tool definitions and their SQL in one place
// lets us evolve them (add citations search, hadith search, etc.) without
// touching the route handler.

import { tool } from 'ai'
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import {
  battles,
  citations,
  figureCategories,
  figures,
  locations,
  researchJobs,
  whitelistDomains,
} from '@athar/db/schema'

import { figureService } from '@/lib/server/services/figure.service'
import { filterAllowedFigureIds } from '@/lib/server/services/content-access.service'
import { searchWhitelist } from '@/lib/server/research'
import { getUserRoleSlugs } from '@/lib/server/rbac/permissions'
import {
  discoverBattleCandidates,
  discoverFigureCandidates,
  ingestBattle,
  ingestBattlesBatch,
  ingestFigure,
  ingestFiguresBatch,
  reingestBattle,
  reingestFigure,
  reingestFiguresBatch,
} from '@/lib/server/services/figure-ingest.service'

// ── Constants ───────────────────────────────────────────────────────────────

const FIGURE_CATEGORIES = [
  'nabi',
  'shalih_pre_rasul',
  'sahabat',
  'tabiin',
  'tabiut_tabiin',
  'shalih_pasca_rasul',
] as const

// ── GeoJSON shape returned by ST_AsGeoJSON.  Narrow `Point` form is enough
//    for tool output; the model will read coordinates as text. ────────────
interface GeoJsonPoint {
  type: 'Point'
  coordinates: [number, number]
}

// ── Tool factory ────────────────────────────────────────────────────────────

/**
 * Build the tool map exposed to the chat model. Tools are scoped to the
 * caller's user id so figure search/detail respect the subscription tier.
 *
 * Anonymous callers may pass `null` — `filterAllowedFigureIds(null, ...)`
 * applies the Free-tier view (nabi + shalih_pre_rasul only).
 */
export function chatTools(userId: string | null) {
  return {
    // ── 1. Search figures ────────────────────────────────────────────────
    // ILIKE across Indonesian + Arabic name, kunyah, laqab, summary. Filters
    // out figures the caller cannot view via `filterAllowedFigureIds`. The
    // category filter resolves slug → id with a sub-query so callers can use
    // the human-friendly slugs in the param schema.
    search_figures: tool({
      description:
        "Cari tokoh (Nabi/Sahabat/Tabi'in/Ulama Salaf) di database Atsar berdasarkan nama, kunyah, atau laqab. " +
        'Gunakan dulu sebelum menjawab pertanyaan tentang tokoh.',
      parameters: z.object({
        query: z.string().min(1).max(120),
        category: z.enum(FIGURE_CATEGORIES).optional(),
        limit: z.number().int().min(1).max(15).default(5),
      }),
      execute: async ({ query, category, limit }) => {
        const like = `%${query}%`

        const where = [
          isNull(figures.deletedAt),
          or(
            ilike(figures.nameFullId, like),
            ilike(figures.nameFullAr, like),
            ilike(figures.nameShortId, like),
            ilike(figures.nameShortAr, like),
            ilike(figures.kunyahId, like),
            ilike(figures.kunyahAr, like),
            ilike(figures.laqabId, like),
            ilike(figures.laqabAr, like),
            ilike(figures.summaryId, like),
          )!,
        ]
        if (category) {
          where.push(
            sql`${figures.categoryId} IN (SELECT ${figureCategories.id} FROM ${figureCategories} WHERE ${figureCategories.slug} = ${category} AND ${figureCategories.deletedAt} IS NULL)`,
          )
        }

        const rows = await db
          .select({
            id: figures.id,
            slug: figures.slug,
            nameFullId: figures.nameFullId,
            nameFullAr: figures.nameFullAr,
            kunyahId: figures.kunyahId,
            laqabId: figures.laqabId,
            categorySlug: figureCategories.slug,
            categoryNameId: figureCategories.nameId,
            birthDateAh: figures.birthDateAh,
            birthDateCe: figures.birthDateCe,
            deathDateAh: figures.deathDateAh,
            deathDateCe: figures.deathDateCe,
            summaryId: figures.summaryId,
          })
          .from(figures)
          .innerJoin(figureCategories, eq(figureCategories.id, figures.categoryId))
          .where(and(...where))
          .orderBy(asc(figures.nameFullId))
          .limit(Math.max(1, limit) * 2) // headroom for content-access filter

        // Drop rows the caller isn't entitled to see.
        const allowedIds = new Set(
          await filterAllowedFigureIds(userId, rows.map((r) => r.id)),
        )
        const visible = rows.filter((r) => allowedIds.has(r.id)).slice(0, limit)

        return {
          count: visible.length,
          results: visible.map((r) => ({
            slug: r.slug,
            name: r.nameFullId,
            nameAr: r.nameFullAr,
            kunyah: r.kunyahId,
            laqab: r.laqabId,
            category: r.categorySlug,
            categoryLabel: r.categoryNameId,
            birthAh: r.birthDateAh,
            birthCe: r.birthDateCe,
            deathAh: r.deathDateAh,
            deathCe: r.deathDateCe,
            summary: r.summaryId?.slice(0, 280) ?? null,
          })),
        }
      },
    }),

    // ── 2. Get figure detail ────────────────────────────────────────────
    // Reuse `figureService.getBySlug` (returns biography + locations +
    // relations + battles + citations in one pre-fetched payload). Trim the
    // shape so the model gets a focused JSON instead of the raw DB row, and
    // gate visibility through `filterAllowedFigureIds`.
    get_figure_detail: tool({
      description:
        'Ambil detail lengkap satu tokoh: biografi, tanggal, lokasi, relasi guru/murid, dan citation sumber. ' +
        'Pakai slug yang dikembalikan oleh search_figures.',
      parameters: z.object({
        slug: z.string().min(1).max(100),
      }),
      execute: async ({ slug }) => {
        try {
          const fig = await figureService.getBySlug(slug)
          const allowed = await filterAllowedFigureIds(userId, [fig.id])
          if (allowed.length === 0) {
            return {
              found: false,
              reason: 'Tier akun Anda tidak mencakup tokoh ini.',
            }
          }
          return {
            found: true,
            slug: fig.slug,
            name: fig.nameFullId,
            nameAr: fig.nameFullAr,
            kunyah: fig.kunyahId,
            laqab: fig.laqabId,
            category: fig.category?.slug ?? null,
            gender: fig.gender,
            birthAh: fig.birthDateAh,
            birthCe: fig.birthDateCe,
            deathAh: fig.deathDateAh,
            deathCe: fig.deathDateCe,
            socialCategory: fig.socialCategory ?? null,
            madhab: fig.madhab ?? null,
            rijalGrade: fig.rijalGrade ?? null,
            summary: fig.summaryId,
            biography: fig.biographyId?.slice(0, 2000) ?? null,
            locations: fig.locations.slice(0, 10).map((l) => ({
              role: l.role,
              name: l.location.nameId,
              modernName: l.location.modernName,
              region: l.location.region,
              periodStartAh: l.periodStartAh,
              periodEndAh: l.periodEndAh,
            })),
            relations: fig.relations.slice(0, 20).map((r) => ({
              type: r.relationType,
              name: r.related.nameFullId,
              slug: r.related.slug,
            })),
            battles: fig.timelineEvents.battles.slice(0, 10).map((b) => ({
              name: b.nameId,
              ah: b.eventDateAh,
              ce: b.eventDateCe,
              role: b.role,
            })),
            citations: fig.citations.slice(0, 8).map((c) => ({
              url: c.sourceUrl,
              domain: c.sourceDomain,
              field: c.fieldPath,
            })),
          }
        } catch (err) {
          // figureService.getBySlug throws ApiError('NOT_FOUND') when missing.
          // Coerce to a soft "not found" so the model can keep going instead
          // of bubbling up as a tool error.
          const code = (err as { code?: string })?.code
          if (code === 'NOT_FOUND') {
            return { found: false, reason: 'Tokoh tidak ditemukan di database Atsar.' }
          }
          throw err
        }
      },
    }),

    // ── 3. Search locations ─────────────────────────────────────────────
    // ILIKE across Indonesian + Arabic + modern name, with optional region
    // filter. Projects PostGIS coordinates as GeoJSON so the model can read
    // lng/lat in plain text.
    search_locations: tool({
      description:
        'Cari lokasi historis Islam (Mekkah, Madinah, Damaskus, Kufah, dll) dengan koordinat dan region.',
      parameters: z.object({
        query: z.string().min(1).max(120),
        region: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, region, limit }) => {
        const like = `%${query}%`
        const where = [
          isNull(locations.deletedAt),
          or(
            ilike(locations.nameId, like),
            ilike(locations.nameAr, like),
            ilike(locations.modernName, like),
            ilike(locations.slug, like),
          )!,
        ]
        if (region) where.push(eq(locations.region, region))

        const rows = await db
          .select({
            slug: locations.slug,
            nameId: locations.nameId,
            nameAr: locations.nameAr,
            modernName: locations.modernName,
            region: locations.region,
            countryCode: locations.countryCode,
            elevationMeters: locations.elevationMeters,
            descriptionId: locations.descriptionId,
            coordinates: sql<GeoJsonPoint | null>`
              CASE
                WHEN ${locations.coordinates} IS NULL THEN NULL
                ELSE ST_AsGeoJSON(${locations.coordinates}::geography)::jsonb
              END
            `,
          })
          .from(locations)
          .where(and(...where))
          .orderBy(asc(locations.nameId))
          .limit(limit)

        return {
          count: rows.length,
          results: rows.map((r) => ({
            slug: r.slug,
            name: r.nameId,
            nameAr: r.nameAr,
            modernName: r.modernName,
            region: r.region,
            countryCode: r.countryCode,
            elevationMeters: r.elevationMeters,
            description: r.descriptionId?.slice(0, 240) ?? null,
            coordinates: r.coordinates
              ? { lng: r.coordinates.coordinates[0], lat: r.coordinates.coordinates[1] }
              : null,
          })),
        }
      },
    }),

    // ── 4. Search battles ───────────────────────────────────────────────
    // ILIKE on name/narrative, LEFT JOIN locations + commander figure so the
    // model gets enough context in a single hop. Sorted by event date for a
    // stable, chronological result.
    search_battles: tool({
      description:
        'Cari ghazwah / sariyyah / pertempuran dengan nama, tahun, atau lokasi.',
      parameters: z.object({
        query: z.string().min(1).max(120),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }) => {
        const like = `%${query}%`
        const rows = await db
          .select({
            slug: battles.slug,
            nameId: battles.nameId,
            nameAr: battles.nameAr,
            type: battles.type,
            outcome: battles.outcome,
            eventDateAh: battles.eventDateAh,
            eventDateCe: battles.eventDateCe,
            opponentForce: battles.opponentForce,
            muslimCount: battles.muslimCount,
            opponentCount: battles.opponentCount,
            casualtiesMuslim: battles.casualtiesMuslim,
            casualtiesOpponent: battles.casualtiesOpponent,
            narrativeId: battles.narrativeId,
            locationName: locations.nameId,
            locationModern: locations.modernName,
            commanderName: figures.nameFullId,
            commanderSlug: figures.slug,
          })
          .from(battles)
          .leftJoin(locations, eq(locations.id, battles.locationId))
          .leftJoin(figures, eq(figures.id, battles.commanderId))
          .where(
            and(
              isNull(battles.deletedAt),
              or(
                ilike(battles.nameId, like),
                ilike(battles.nameAr, like),
                ilike(battles.narrativeId, like),
              )!,
            ),
          )
          .orderBy(asc(battles.eventDateAh))
          .limit(limit)

        return {
          count: rows.length,
          results: rows.map((r) => ({
            slug: r.slug,
            name: r.nameId,
            nameAr: r.nameAr,
            type: r.type,
            outcome: r.outcome,
            ah: r.eventDateAh,
            ce: r.eventDateCe,
            location: r.locationName,
            locationModern: r.locationModern,
            commander: r.commanderName,
            commanderSlug: r.commanderSlug,
            opponent: r.opponentForce,
            muslimCount: r.muslimCount,
            opponentCount: r.opponentCount,
            casualtiesMuslim: r.casualtiesMuslim,
            casualtiesOpponent: r.casualtiesOpponent,
            summary: r.narrativeId?.slice(0, 280) ?? null,
          })),
        }
      },
    }),

    // ── 5. Search web (whitelist-only) ───────────────────────────────────
    // Build candidate URLs across the active whitelist domains. We do NOT
    // fetch the pages here — the model can decide to cite the URLs and the
    // user can click through. Fetching during a tool call would blow the
    // 60-second stream budget for marginal gain.
    search_web: tool({
      description:
        'Cari sumber tambahan di website salafi whitelist (almanhaj, muslim.or.id, rumaysho, binbaz, dorar, dll). ' +
        'Pakai HANYA kalau database Atsar tidak punya jawaban. Mengembalikan kandidat URL untuk dikutip.',
      parameters: z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ query, limit }) => {
        // Search citations table first — these are already-vetted source
        // pages the editorial team has used to back content in the catalogue.
        const citationRows = await db
          .select({
            url: citations.sourceUrl,
            excerpt: citations.sourceExcerptId,
            domain: citations.sourceDomain,
            displayName: whitelistDomains.displayName,
          })
          .from(citations)
          .leftJoin(whitelistDomains, eq(whitelistDomains.domain, citations.sourceDomain))
          .where(
            and(
              isNull(citations.deletedAt),
              or(
                ilike(citations.sourceExcerptId, `%${query}%`),
                ilike(citations.sourceExcerptAr, `%${query}%`),
              )!,
            ),
          )
          .orderBy(desc(whitelistDomains.priority))
          .limit(limit)

        if (citationRows.length > 0) {
          return {
            source: 'citations',
            count: citationRows.length,
            results: citationRows.map((c) => ({
              url: c.url,
              domain: c.domain,
              displayName: c.displayName,
              snippet: c.excerpt?.slice(0, 200) ?? null,
            })),
          }
        }

        // Fall back to building candidate URLs across the active whitelist.
        const domains = await db
          .select({
            domain: whitelistDomains.domain,
            priority: whitelistDomains.priority,
            displayName: whitelistDomains.displayName,
          })
          .from(whitelistDomains)
          .where(
            and(
              eq(whitelistDomains.isActive, true),
              isNull(whitelistDomains.deletedAt),
            ),
          )
          .orderBy(desc(whitelistDomains.priority))

        const urls = await searchWhitelist(query, domains)
        const candidates = urls.slice(0, limit).map((url) => {
          let domain = ''
          try {
            domain = new URL(url).hostname
          } catch {
            domain = ''
          }
          const meta = domains.find((d) => d.domain === domain)
          return {
            url,
            domain,
            displayName: meta?.displayName ?? null,
            snippet: null as string | null,
          }
        })

        return {
          source: 'whitelist-candidates',
          count: candidates.length,
          results: candidates,
        }
      },
    }),
  }
}

export type ChatTools = ReturnType<typeof chatTools>

// ── Admin tool factory ──────────────────────────────────────────────────
//
// Returns the WRITE tools that mutate the database via the existing
// research-job pipeline. Each tool re-checks the caller's role inside
// `execute()` as defence-in-depth — the chat route also gates by role
// before mounting these tools, but a future regression there shouldn't
// leak DB writes to non-admins.
//
// Returns research_jobs rows + QStash messages. The drafts land in
// `/queue` for ustadz review; nothing here bypasses the editorial flow.

const BATTLE_TYPE_VALUES = ['ghazwah', 'sariyyah', 'futuhat'] as const

const FIGURE_REINGEST_FIELDS = [
  'nameFullAr',
  'nameFullId',
  'kunyahAr',
  'kunyahId',
  'birthDateAh',
  'deathDateAh',
  'socialCategory',
  'specialty',
  'summaryAr',
  'summaryId',
  'biographyAr',
  'biographyId',
  'citations',
] as const

const BATTLE_REINGEST_FIELDS = [
  'nameAr',
  'nameId',
  'eventDateAh',
  'eventDateCe',
  'eventDatePrecision',
  'eventDateNotes',
  'opponentForce',
  'muslimCount',
  'opponentCount',
  'outcome',
  'casualtiesMuslim',
  'casualtiesOpponent',
  'strategyId',
  'narrativeId',
  'significanceId',
  'citations',
] as const

const RESEARCH_JOB_TYPES = [
  'figure_ingest',
  'figure_reingest',
  'battle_ingest',
  'battle_reingest',
] as const

/**
 * Guard helper — throws inside a tool `execute()` if the caller is not an
 * admin. We use a regular Error (not ApiError) because the AI SDK wraps
 * tool errors and the message bubbles up to the model, which will report
 * it to the user.
 */
async function assertAdmin(userId: string | null): Promise<void> {
  if (!userId) {
    throw new Error('Permission denied: chat tidak terotentikasi.')
  }
  const roles = await getUserRoleSlugs(userId)
  if (!roles.has('admin')) {
    throw new Error(
      'Permission denied: tool ini hanya untuk admin Atsar.',
    )
  }
}

/**
 * Build the admin-only WRITE tool map. The chat route merges these with
 * `chatTools(userId)` for admin callers only — subscribers/anonymous never
 * see these tool definitions.
 */
export function adminChatTools(userId: string | null) {
  return {
    // ── 1. Discover figures ──────────────────────────────────────────
    // Phase 1 enumeration — does NOT write to DB. Safe to call without
    // confirmation. Returns candidates filtered against EXCLUDE_LIST.
    discover_figures: tool({
      description:
        'Enumerasi nama-nama tokoh untuk kategori tertentu dari whitelist salafi. ' +
        'TIDAK menulis ke DB — hanya membaca + memanggil AI agent. ' +
        'Gunakan SEBELUM ingest_figure_batch untuk dapatkan daftar kandidat. ' +
        'Hasilnya sudah di-dedupe dari tokoh yang sudah ada di database.',
      parameters: z.object({
        category: z.enum(FIGURE_CATEGORIES),
        gender: z.enum(['male', 'female']).optional(),
        hints: z.string().max(500).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async ({ category, gender, hints, limit }) => {
        await assertAdmin(userId)
        const result = await discoverFigureCandidates(userId!, {
          category,
          gender,
          hints,
          limit,
        })
        return {
          candidates: result.candidates,
          existingCount: result.existingCount,
          suggestedNew: result.suggestedNew,
          sourcesFetched: result.sourcesFetched,
        }
      },
    }),

    // ── 2. Ingest single figure ──────────────────────────────────────
    // Queue one crawl job. Confirm name + category with admin first.
    ingest_figure: tool({
      description:
        'Antrekan crawl detail untuk SATU tokoh — membuat 1 row research_jobs (figure_ingest) + publish QStash. ' +
        'Hasil akan muncul sebagai draft di /queue untuk ditinjau ustadz. ' +
        'WAJIB minta konfirmasi admin sebelum dipanggil.',
      parameters: z.object({
        name: z.string().trim().min(2).max(160),
        category: z.enum(FIGURE_CATEGORIES),
        gender: z.enum(['male', 'female']).optional(),
        hints: z.string().max(2000).optional(),
      }),
      execute: async ({ name, category, gender, hints }) => {
        await assertAdmin(userId)
        const result = await ingestFigure(userId!, {
          name,
          category,
          gender,
          hints,
        })
        return {
          jobId: result.jobId,
          status: 'pending' as const,
          publishError: result.publishError,
        }
      },
    }),

    // ── 3. Ingest figures batch ──────────────────────────────────────
    // Bulk variant. WAJIB tampilkan total + daftar singkat ke admin
    // sebelum dipanggil (hemat AI credits).
    ingest_figure_batch: tool({
      description:
        'Antrekan crawl detail untuk BANYAK tokoh sekaligus (max 50). ' +
        'WAJIB konfirmasi total + tampilkan daftar singkat ke admin sebelum dipanggil. ' +
        'Hemat AI credits.',
      parameters: z.object({
        items: z
          .array(
            z.object({
              name: z.string().trim().min(2).max(160),
              category: z.enum(FIGURE_CATEGORIES),
              gender: z.enum(['male', 'female']).optional(),
              hints: z.string().max(2000).optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
      execute: async ({ items }) => {
        await assertAdmin(userId)
        const result = await ingestFiguresBatch(userId!, items)
        return {
          created: result.created,
          queued: result.queued,
          failures: result.failures,
        }
      },
    }),

    // ── 4. Re-ingest single figure ───────────────────────────────────
    // Re-crawl existing figure. Confirm mode (enrich/replace) with admin.
    reingest_figure: tool({
      description:
        'Re-crawl tokoh yang SUDAH ADA. Mode: "enrich" (isi kolom kosong saja) ' +
        'atau "replace" (timpa). WAJIB tanya admin mode mana sebelum dipanggil.',
      parameters: z.object({
        slug: z
          .string()
          .min(1)
          .max(160)
          .regex(/^[a-z0-9-]+$/),
        mode: z.enum(['enrich', 'replace']).default('enrich'),
        focusFields: z.array(z.enum(FIGURE_REINGEST_FIELDS)).optional(),
        hints: z.string().max(2000).optional(),
      }),
      execute: async ({ slug, mode, focusFields, hints }) => {
        await assertAdmin(userId)
        const result = await reingestFigure(userId!, {
          slug,
          mode,
          focusFields,
          hints,
        })
        return {
          jobId: result.jobId,
          status: 'pending' as const,
          figureId: result.figureId,
          mode: result.mode,
          publishError: result.publishError,
        }
      },
    }),

    // ── 5. Re-ingest figures batch ───────────────────────────────────
    reingest_figure_batch: tool({
      description:
        'Re-crawl BANYAK tokoh yang sudah ada (max 50). ' +
        'WAJIB konfirmasi dengan admin: enrich atau replace?',
      parameters: z.object({
        slugs: z
          .array(
            z
              .string()
              .min(1)
              .max(160)
              .regex(/^[a-z0-9-]+$/),
          )
          .min(1)
          .max(50),
        mode: z.enum(['enrich', 'replace']).default('enrich'),
        focusFields: z.array(z.enum(FIGURE_REINGEST_FIELDS)).optional(),
        hints: z.string().max(2000).optional(),
      }),
      execute: async ({ slugs, mode, focusFields, hints }) => {
        await assertAdmin(userId)
        const result = await reingestFiguresBatch(userId!, {
          slugs,
          mode,
          focusFields,
          hints,
        })
        return {
          created: result.created,
          queued: result.queued,
          failures: result.failures,
        }
      },
    }),

    // ── 6. Discover battles ──────────────────────────────────────────
    discover_battles: tool({
      description:
        'Enumerasi nama-nama peperangan (ghazwah/sariyyah/futuhat) dari whitelist. ' +
        'TIDAK menulis ke DB. Hasil sudah di-dedupe terhadap battles existing.',
      parameters: z.object({
        type: z.enum(BATTLE_TYPE_VALUES).optional(),
        era: z.string().max(60).optional(),
        hints: z.string().max(500).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async ({ type, era, hints, limit }) => {
        await assertAdmin(userId)
        const result = await discoverBattleCandidates(userId!, {
          type,
          era,
          hints,
          limit,
        })
        return {
          candidates: result.candidates,
          existingCount: result.existingCount,
          suggestedNew: result.suggestedNew,
          sourcesFetched: result.sourcesFetched,
        }
      },
    }),

    // ── 7. Ingest single battle ──────────────────────────────────────
    ingest_battle: tool({
      description:
        'Antrekan crawl detail untuk SATU sirah perang. ' +
        'WAJIB konfirmasi nama + type sebelum dipanggil.',
      parameters: z.object({
        name: z.string().trim().min(2).max(160),
        type: z.enum(BATTLE_TYPE_VALUES).optional(),
        hints: z.string().max(2000).optional(),
      }),
      execute: async ({ name, type, hints }) => {
        await assertAdmin(userId)
        const result = await ingestBattle(userId!, { name, type, hints })
        return {
          jobId: result.jobId,
          status: 'pending' as const,
          publishError: result.publishError,
        }
      },
    }),

    // ── 8. Ingest battles batch ──────────────────────────────────────
    ingest_battle_batch: tool({
      description:
        'Antrekan crawl detail untuk BANYAK sirah perang sekaligus (max 50). ' +
        'WAJIB konfirmasi total + daftar singkat sebelum dipanggil.',
      parameters: z.object({
        items: z
          .array(
            z.object({
              name: z.string().trim().min(2).max(160),
              type: z.enum(BATTLE_TYPE_VALUES).optional(),
              hints: z.string().max(2000).optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
      execute: async ({ items }) => {
        await assertAdmin(userId)
        const result = await ingestBattlesBatch(userId!, items)
        return {
          created: result.created,
          queued: result.queued,
          failures: result.failures,
        }
      },
    }),

    // ── 9. Re-ingest single battle ───────────────────────────────────
    reingest_battle: tool({
      description:
        'Re-crawl sirah perang yang sudah ada. Mode: enrich atau replace. ' +
        'WAJIB tanya admin mode mana.',
      parameters: z.object({
        slug: z
          .string()
          .min(1)
          .max(160)
          .regex(/^[a-z0-9-]+$/),
        mode: z.enum(['enrich', 'replace']).default('enrich'),
        focusFields: z.array(z.enum(BATTLE_REINGEST_FIELDS)).optional(),
        hints: z.string().max(2000).optional(),
      }),
      execute: async ({ slug, mode, focusFields, hints }) => {
        await assertAdmin(userId)
        const result = await reingestBattle(userId!, {
          slug,
          mode,
          focusFields,
          hints,
        })
        return {
          jobId: result.jobId,
          status: 'pending' as const,
          battleId: result.battleId,
          mode: result.mode,
          publishError: result.publishError,
        }
      },
    }),

    // ── 10. List pending jobs (read-only helper) ─────────────────────
    // Admin can ask the model "berapa banyak job yang masih berjalan?";
    // the model calls this and reports back. Filters to the calling user
    // so admins only see their own pipeline.
    list_pending_jobs: tool({
      description:
        'Lihat status job research yang sedang berjalan/baru selesai. ' +
        'Read-only — gunakan untuk lapor progress ke admin. ' +
        'Hanya menampilkan job yang admin ini buat sendiri.',
      parameters: z.object({
        type: z.enum(RESEARCH_JOB_TYPES).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      execute: async ({ type, limit }) => {
        await assertAdmin(userId)
        const conds = [
          eq(researchJobs.createdBy, userId!),
          isNull(researchJobs.deletedAt),
        ]
        if (type) conds.push(eq(researchJobs.type, type))

        const rows = await db
          .select({
            id: researchJobs.id,
            type: researchJobs.type,
            status: researchJobs.status,
            payload: researchJobs.payload,
            errorMessage: researchJobs.errorMessage,
            startedAt: researchJobs.startedAt,
            finishedAt: researchJobs.finishedAt,
            createdAt: researchJobs.createdAt,
            resultFigureId: researchJobs.resultFigureId,
          })
          .from(researchJobs)
          .where(and(...conds))
          .orderBy(desc(researchJobs.createdAt))
          .limit(limit)

        return {
          count: rows.length,
          jobs: rows.map((r) => {
            const p = (r.payload ?? {}) as {
              name?: string
              slug?: string
              category?: string
              type?: string
              mode?: string
            }
            return {
              jobId: r.id,
              type: r.type,
              status: r.status,
              name: p.name ?? null,
              slug: p.slug ?? null,
              category: p.category ?? null,
              battleType: p.type ?? null,
              mode: p.mode ?? null,
              startedAt: r.startedAt?.toISOString() ?? null,
              finishedAt: r.finishedAt?.toISOString() ?? null,
              createdAt: r.createdAt?.toISOString() ?? null,
              errorMessage: r.errorMessage ?? null,
              resultId: r.resultFigureId ?? null,
            }
          }),
        }
      },
    }),

    // ── 11. Recent drafts (read-only helper) ─────────────────────────
    // After a batch ingest, admin can ask "tokoh apa saja yang baru jadi
    // draft?" — the model fans this out across figures + battles and
    // reports the latest.
    get_recent_drafts: tool({
      description:
        'Lihat draft tokoh & perang terbaru hasil crawl. ' +
        'Read-only — untuk konfirmasi hasil setelah ingest.',
      parameters: z.object({
        limit: z.number().int().min(1).max(50).default(10),
      }),
      execute: async ({ limit }) => {
        await assertAdmin(userId)

        // Use a raw SQL `IN` so the enum type widens correctly — Drizzle's
        // typed `inArray` requires the const-tuple literal type at the call
        // site, but we want a reusable status list.
        const figureRows = await db
          .select({
            slug: figures.slug,
            nameFullId: figures.nameFullId,
            nameFullAr: figures.nameFullAr,
            categorySlug: figureCategories.slug,
            status: figures.status,
            createdAt: figures.createdAt,
          })
          .from(figures)
          .innerJoin(
            figureCategories,
            eq(figureCategories.id, figures.categoryId),
          )
          .where(
            and(
              isNull(figures.deletedAt),
              sql`${figures.status} IN ('draft','under_review','needs_edit')`,
            ),
          )
          .orderBy(desc(figures.createdAt))
          .limit(limit)

        const battleRows = await db
          .select({
            slug: battles.slug,
            nameId: battles.nameId,
            nameAr: battles.nameAr,
            type: battles.type,
            status: battles.status,
            createdAt: battles.createdAt,
          })
          .from(battles)
          .where(
            and(
              isNull(battles.deletedAt),
              sql`${battles.status} IN ('draft','under_review','needs_edit')`,
            ),
          )
          .orderBy(desc(battles.createdAt))
          .limit(limit)

        return {
          figures: figureRows.map((r) => ({
            kind: 'figure' as const,
            slug: r.slug,
            nameId: r.nameFullId,
            nameAr: r.nameFullAr,
            category: r.categorySlug,
            status: r.status,
            createdAt: r.createdAt?.toISOString() ?? null,
          })),
          battles: battleRows.map((r) => ({
            kind: 'battle' as const,
            slug: r.slug,
            nameId: r.nameId,
            nameAr: r.nameAr,
            type: r.type,
            status: r.status,
            createdAt: r.createdAt?.toISOString() ?? null,
          })),
        }
      },
    }),
  }
}

export type AdminChatTools = ReturnType<typeof adminChatTools>
