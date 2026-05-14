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
  whitelistDomains,
} from '@athar/db/schema'

import { figureService } from '@/lib/server/services/figure.service'
import { filterAllowedFigureIds } from '@/lib/server/services/content-access.service'
import { searchWhitelist } from '@/lib/server/research'

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
