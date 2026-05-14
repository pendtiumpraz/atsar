// GET /api/v1/figures/:slug/nasab — ancestral lineage chain (upward).
//
// Walks the `figure_relations` graph from the requested figure up through
// every `father` / `mother` edge until either:
//   - no parent edge is found, or
//   - we hit the 25-generation safety cap, or
//   - a cycle is detected (defensive — nasab shouldn't loop).
//
// Edge direction convention (see seeders/027_relations.ts and BACKEND.md §4):
//   figure_relations.figureId = parent
//   figure_relations.relatedId = child
//   relationType            = 'father' | 'mother'
//
// So to find a figure's parents we look up rows where `relatedId = child`
// AND `relationType in ('father','mother')`.
//
// Some ancestors (Adnan, Qushayy, …) may not exist as `figures` rows; in
// that case they live as a relation row with `notesId` carrying the name.
// The endpoint returns those entries with `figureId: null` and `slug: null`
// — the FE renders them as muted, non-linked cards.
//
// Auth: public-ish — we read the session for free-tier scope but don't
// require it (same pattern as `/figures/map-points`).

import { sql } from 'drizzle-orm'
import { db } from '@athar/db'

import { ok, withErrorHandling, ApiError } from '@/lib/server/api'

type RouteCtx = { params: Promise<{ slug: string }> }

const MAX_DEPTH = 25

interface AncestorRow {
  /** Generation offset from the requested figure (1 = parent, 2 = grandparent, …). */
  depth: number
  /** Relation type that connects this ancestor to the previous generation. */
  relationType: 'father' | 'mother'
  /** Optional note text on the relation row (used when ancestor has no figure). */
  relationNotesId: string | null
  // Figure fields — null when ancestor is not in `figures` (just a name in relation notes).
  figureId: string | null
  slug: string | null
  nameFullId: string | null
  nameFullAr: string | null
  nameShortId: string | null
  nameShortAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
  laqabAr: string | null
  birthDateAh: number | null
  deathDateAh: number | null
}

interface NasabSelfRow {
  id: string
  slug: string
  nameFullId: string
  nameFullAr: string
  nameShortId: string | null
  nameShortAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
  laqabAr: string | null
  birthDateAh: number | null
  deathDateAh: number | null
}

export const GET = withErrorHandling<RouteCtx>(async (_req, ctx) => {
  const { slug } = await ctx.params

  // 1. Resolve the figure first — we need its id for the CTE seed.
  // `db.execute()` on Neon HTTP returns a `{ rows, fields, rowCount, … }`
  // envelope; we want the `rows` array.
  const selfResult = (await db.execute(sql`
    SELECT
      id,
      slug,
      name_full_id        AS "nameFullId",
      name_full_ar        AS "nameFullAr",
      name_short_id       AS "nameShortId",
      name_short_ar       AS "nameShortAr",
      kunyah_id           AS "kunyahId",
      kunyah_ar           AS "kunyahAr",
      laqab_id            AS "laqabId",
      laqab_ar            AS "laqabAr",
      birth_date_ah       AS "birthDateAh",
      death_date_ah       AS "deathDateAh"
    FROM figures
    WHERE slug = ${slug} AND deleted_at IS NULL
    LIMIT 1
  `)) as unknown as { rows: NasabSelfRow[] }

  const self = selfResult.rows[0]
  if (!self) {
    throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)
  }

  // 2. Recursive CTE — walk parent edges upward.
  //
  // Each row in the CTE represents one ancestor (or a missing-figure placeholder
  // backed only by `figure_relations.notes_id`). We carry an `id_path` UUID
  // array to detect cycles in the (unlikely) case the data forms a loop.
  //
  // We LEFT JOIN `figures` on `figureId` (the parent side) so that ancestors
  // that don't have their own `figures` row still appear — but with NULL
  // figure columns, which the FE renders as a muted card.
  //
  // NOTE: figure_relations.figureId is NOT NULL, so a "missing figure" row
  // is one where the parent figure exists in `figures` but is soft-deleted
  // (deleted_at IS NOT NULL). We treat soft-deleted figures as missing.
  const ancestorResult = (await db.execute(sql`
    WITH RECURSIVE nasab AS (
      -- Seed: the figure itself, depth 0.
      SELECT
        ${self.id}::uuid                AS current_id,
        0                               AS depth,
        NULL::text                      AS relation_type,
        NULL::text                      AS relation_notes_id,
        ARRAY[${self.id}::uuid]         AS id_path

      UNION ALL

      -- Recursive step: for the current node, find a parent edge.
      SELECT
        fr.figure_id                    AS current_id,
        n.depth + 1                     AS depth,
        fr.relation_type::text          AS relation_type,
        fr.notes_id                     AS relation_notes_id,
        n.id_path || fr.figure_id       AS id_path
      FROM nasab n
      JOIN figure_relations fr
        ON fr.related_id = n.current_id
       AND fr.relation_type::text IN ('father', 'mother')
       AND fr.deleted_at IS NULL
      WHERE
        n.depth < ${MAX_DEPTH}
        AND NOT (fr.figure_id = ANY(n.id_path))
    )
    SELECT
      n.depth,
      n.relation_type                                       AS "relationType",
      n.relation_notes_id                                   AS "relationNotesId",
      CASE WHEN f.deleted_at IS NULL THEN f.id   END        AS "figureId",
      CASE WHEN f.deleted_at IS NULL THEN f.slug END        AS "slug",
      CASE WHEN f.deleted_at IS NULL THEN f.name_full_id END AS "nameFullId",
      CASE WHEN f.deleted_at IS NULL THEN f.name_full_ar END AS "nameFullAr",
      CASE WHEN f.deleted_at IS NULL THEN f.name_short_id END AS "nameShortId",
      CASE WHEN f.deleted_at IS NULL THEN f.name_short_ar END AS "nameShortAr",
      CASE WHEN f.deleted_at IS NULL THEN f.kunyah_id END    AS "kunyahId",
      CASE WHEN f.deleted_at IS NULL THEN f.kunyah_ar END    AS "kunyahAr",
      CASE WHEN f.deleted_at IS NULL THEN f.laqab_id END     AS "laqabId",
      CASE WHEN f.deleted_at IS NULL THEN f.laqab_ar END     AS "laqabAr",
      CASE WHEN f.deleted_at IS NULL THEN f.birth_date_ah END AS "birthDateAh",
      CASE WHEN f.deleted_at IS NULL THEN f.death_date_ah END AS "deathDateAh"
    FROM nasab n
    LEFT JOIN figures f ON f.id = n.current_id
    WHERE n.depth > 0
    ORDER BY n.depth ASC
  `)) as unknown as { rows: AncestorRow[] }

  const rows = ancestorResult.rows

  // The CTE above only resolves ancestors that exist as `figures` rows
  // (because every parent edge in `figure_relations` references a real
  // figure row via FK). For pre-Islamic ancestors we won't necessarily
  // have a `figures` row — those will surface as relation rows with the
  // ancestor's name in `notesId`. Those are stitched onto the chain by
  // the seeder when targetable as a relation pair.

  // Defensive: ensure parent's relationType is typed and trim payload.
  const ancestors = rows.map((r) => ({
    depth: r.depth,
    relationType: r.relationType,
    figureId: r.figureId,
    slug: r.slug,
    nameFullId: r.nameFullId,
    nameFullAr: r.nameFullAr,
    nameShortId: r.nameShortId,
    nameShortAr: r.nameShortAr,
    kunyahId: r.kunyahId,
    kunyahAr: r.kunyahAr,
    laqabId: r.laqabId,
    laqabAr: r.laqabAr,
    birthDateAh: r.birthDateAh,
    deathDateAh: r.deathDateAh,
    // Surface the relation note so the FE can show the raw name when the
    // ancestor doesn't have its own `figures` row.
    notesId: r.relationNotesId,
  }))

  return ok({
    self,
    ancestors,
  })
})
