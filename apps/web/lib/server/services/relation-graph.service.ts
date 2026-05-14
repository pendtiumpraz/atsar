// Relation-graph service — BFS over `figure_relations` to resolve the
// shortest path between two figures, then render it as Indonesian prose.
//
// Used by the relation-checker endpoint:
//   GET /api/v1/figures/relation?from=&to=
//
// The DB stores both directions of every relation (see
// `seeders/027_relations.ts`), so we don't need to chase reverse edges
// ourselves — `figure_relations.figureId` is the source perspective.
// We BFS forward only; that's correct because:
//
//   A → B with type `father`  means "A is the father of B" (B is the child).
//   A → B with type `son`     means "A is the son of B"    (B is the parent).
//
// …and the inverse row is already inserted by the seeder.
//
// If a future ingest path forgets to insert both directions we still want
// graceful degradation, so `EDGE_INVERSE` is exported for callers (the
// invalidator) that want to defensively walk in either direction.
//
// Compound-label heuristics (the user-visible win): we recognise common
// nasab compositions like "anak dari paman" (sepupu kandung dari ayah),
// "kakek", "cucu", "buyut" by inspecting consecutive edges and collapsing
// them into one canonical Indonesian phrase. Anything that doesn't match
// falls back to the generic chained breadcrumb.

import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import { figureRelations, figures } from '@athar/db/schema'
import type { RelationPathStep } from '@athar/db/schema'

// Mirror of `figureRelationTypeEnum` in schema/enums.ts.
export type RelationType =
  | 'teacher_of'
  | 'student_of'
  | 'father'
  | 'mother'
  | 'husband'
  | 'wife'
  | 'son'
  | 'daughter'
  | 'sibling'
  | 'companion'
  | 'descendant'
  | 'ancestor'

/**
 * Inverse map — used by callers that want to walk the graph in either
 * direction even when the seeder only inserted one row of a pair.
 */
export const EDGE_INVERSE: Record<RelationType, RelationType> = {
  father: 'son',
  mother: 'daughter',
  son: 'father',
  daughter: 'mother',
  husband: 'wife',
  wife: 'husband',
  sibling: 'sibling',
  teacher_of: 'student_of',
  student_of: 'teacher_of',
  companion: 'companion',
  ancestor: 'descendant',
  descendant: 'ancestor',
}

/**
 * Indonesian label for a single edge in the perspective "FROM is the … of TO".
 * Used when we synthesise the breadcrumb for a multi-hop path.
 */
const EDGE_LABEL_ID: Record<RelationType, string> = {
  father: 'ayah dari',
  mother: 'ibu dari',
  son: 'anak laki-laki dari',
  daughter: 'anak perempuan dari',
  husband: 'suami dari',
  wife: 'istri dari',
  sibling: 'saudara dari',
  teacher_of: 'guru dari',
  student_of: 'murid dari',
  companion: 'sahabat seangkatan dari',
  ancestor: 'leluhur dari',
  descendant: 'keturunan dari',
}

const MAX_DEPTH_DEFAULT = 6

/**
 * Minimal figure projection used by the BFS and the description builder.
 */
interface BfsFigureMeta {
  id: string
  slug: string
  nameFullId: string
  nameShortId: string | null
  gender: 'male' | 'female'
}

/**
 * One step in the BFS frontier. We track the previous node + edge type
 * so we can stitch the final path together by walking the `parent` chain
 * back to the seed.
 */
interface BfsNode {
  figureId: string
  parent: BfsNode | null
  /** Edge type that brought us FROM `parent.figureId` TO `figureId`. */
  edgeType: RelationType | null
}

export interface ShortestPathResult {
  /**
   * Ordered hops, including the seed. `steps[0]` is the FROM figure (no
   * edge), each subsequent step records the edge that lands on it.
   */
  steps: RelationPathStep[]
  /** Number of edges traversed (== `steps.length - 1`). */
  depth: number
  found: boolean
}

/**
 * BFS over `figure_relations` from `fromFigureId` outward, stopping when
 * we hit `toFigureId` or the depth cap. Both endpoints must reference
 * non-deleted figures — caller validates.
 *
 * Returns the shortest path (by hop count) when one exists, otherwise
 * `{ found: false, steps: [], depth: 0 }`.
 *
 * Implementation notes:
 *   - We chunk edge expansion per frontier so we issue at most one round-trip
 *     per BFS level — important on Neon HTTP.
 *   - We dedupe visited figures to keep the queue bounded.
 *   - Soft-deleted relations are filtered (matches the partial unique index).
 */
export async function findShortestPath(
  fromFigureId: string,
  toFigureId: string,
  maxDepth = MAX_DEPTH_DEFAULT,
): Promise<ShortestPathResult> {
  if (fromFigureId === toFigureId) {
    return { steps: [], depth: 0, found: false }
  }

  const visited = new Set<string>([fromFigureId])
  let frontier: BfsNode[] = [{ figureId: fromFigureId, parent: null, edgeType: null }]
  let targetNode: BfsNode | null = null

  for (let depth = 0; depth < maxDepth && targetNode === null; depth++) {
    if (frontier.length === 0) break

    const frontierIds = frontier.map((n) => n.figureId)
    // Expand all edges out of the current frontier in one query. We only
    // need to follow the FORWARD direction because the seeder mirrors
    // pairs (see seeders/027_relations.ts).
    const edges = (await db
      .select({
        figureId: figureRelations.figureId,
        relatedId: figureRelations.relatedId,
        relationType: figureRelations.relationType,
      })
      .from(figureRelations)
      .where(
        and(
          inArray(figureRelations.figureId, frontierIds),
          isNull(figureRelations.deletedAt),
        ),
      )) as Array<{
      figureId: string
      relatedId: string
      relationType: RelationType
    }>

    if (edges.length === 0) {
      // Frontier is a dead end.
      break
    }

    // Index frontier nodes by id so we can build child BfsNodes pointing
    // back to the right parent.
    const frontierById = new Map<string, BfsNode>()
    for (const node of frontier) frontierById.set(node.figureId, node)

    const next: BfsNode[] = []
    for (const e of edges) {
      const parent = frontierById.get(e.figureId)
      if (!parent) continue // shouldn't happen
      if (visited.has(e.relatedId)) continue

      visited.add(e.relatedId)
      const child: BfsNode = {
        figureId: e.relatedId,
        parent,
        edgeType: e.relationType,
      }

      if (e.relatedId === toFigureId) {
        targetNode = child
        break
      }
      next.push(child)
    }

    frontier = next
  }

  if (!targetNode) {
    return { steps: [], depth: 0, found: false }
  }

  // Walk parents back to the seed and reverse.
  const chain: BfsNode[] = []
  for (let n: BfsNode | null = targetNode; n !== null; n = n.parent) {
    chain.push(n)
  }
  chain.reverse()

  // Hydrate display metadata for every node in the chain.
  const ids = chain.map((n) => n.figureId)
  const figRows = await db
    .select({
      id: figures.id,
      slug: figures.slug,
      nameFullId: figures.nameFullId,
      nameShortId: figures.nameShortId,
      gender: figures.gender,
    })
    .from(figures)
    .where(and(inArray(figures.id, ids), isNull(figures.deletedAt)))
  const metaById = new Map<string, BfsFigureMeta>(
    (figRows as BfsFigureMeta[]).map((f) => [f.id, f]),
  )

  const steps: RelationPathStep[] = chain.map((n) => {
    const meta = metaById.get(n.figureId)
    const name = meta?.nameShortId || meta?.nameFullId || 'Tokoh tak dikenal'
    const edgeType = n.edgeType ?? ''
    const edgeLabel = edgeType
      ? EDGE_LABEL_ID[edgeType as RelationType] ?? edgeType
      : ''
    return {
      figureId: meta?.id ?? n.figureId,
      slug: meta?.slug ?? null,
      name,
      edgeType,
      edgeLabel,
    }
  })

  return { steps, depth: steps.length - 1, found: true }
}

// ─── Description builder ────────────────────────────────────────────────
// Compose the path into Indonesian prose. We don't try to match every
// possible compound — just the ones our seed data + nasab pipeline are
// likely to surface. The fallback ("X terhubung ke Y melalui …") is
// always readable even when no special case matches.

/**
 * Recognised compound patterns. Each pattern is a sequence of edge types
 * matched against `path[1..].edgeType` and rendered as a single phrase.
 *
 * For depth-2 paths the convention is:
 *   "FROM adalah <compoundLabel> <TO>"
 * e.g. path = [Ibnu Abbas, Abbas, Rasulullah], edges = [son, sibling]
 *   →  "Ibnu Abbas adalah anak dari paman Rasulullah".
 */
interface CompoundPattern {
  /** Sequence of edge types to match starting from step[1]. */
  edges: RelationType[]
  /** Indonesian phrase, no leading "adalah ", no trailing "<name>". */
  build: (path: RelationPathStep[]) => string
}

const COMPOUND_PATTERNS: CompoundPattern[] = [
  // child-of-uncle → "anak dari paman X" (sepupu via ayah's brother)
  {
    edges: ['son', 'sibling'],
    build: (p) => `anak laki-laki dari paman (${p[1]!.name})`,
  },
  {
    edges: ['daughter', 'sibling'],
    build: (p) => `anak perempuan dari paman (${p[1]!.name})`,
  },
  // grandparent: X is father/mother of Y who is father/mother of Z → "kakek/nenek dari Z"
  { edges: ['father', 'father'], build: () => 'kakek (dari pihak ayah) dari' },
  { edges: ['father', 'mother'], build: () => 'kakek dari' },
  { edges: ['mother', 'father'], build: () => 'nenek dari' },
  { edges: ['mother', 'mother'], build: () => 'nenek (dari pihak ibu) dari' },
  // grandchild
  { edges: ['son', 'son'], build: () => 'cucu (laki-laki) dari' },
  { edges: ['son', 'daughter'], build: () => 'cucu dari' },
  { edges: ['daughter', 'son'], build: () => 'cucu dari' },
  { edges: ['daughter', 'daughter'], build: () => 'cucu (perempuan) dari' },
  // uncle/aunt via parent's sibling
  { edges: ['sibling', 'father'], build: () => 'paman/bibi dari' },
  { edges: ['sibling', 'mother'], build: () => 'paman/bibi dari' },
  // teacher of teacher → guru besar (silsilah ilmu)
  { edges: ['teacher_of', 'teacher_of'], build: () => 'guru dari guru' },
  { edges: ['student_of', 'student_of'], build: () => 'murid dari murid' },
]

/**
 * For depth-1 paths, render "X adalah <edgeLabel> Y".
 */
function describeDirect(path: RelationPathStep[]): string {
  const from = path[0]!
  const to = path[1]!
  return `${from.name} adalah ${to.edgeLabel} ${to.name}.`
}

/**
 * For depth-2 paths, try to match a compound; otherwise chain.
 */
function describeTwoHop(path: RelationPathStep[]): string {
  const from = path[0]!
  const mid = path[1]!
  const to = path[2]!
  const edgeA = mid.edgeType as RelationType
  const edgeB = to.edgeType as RelationType
  const match = COMPOUND_PATTERNS.find(
    (p) => p.edges.length === 2 && p.edges[0] === edgeA && p.edges[1] === edgeB,
  )
  if (match) {
    return `${from.name} adalah ${match.build(path)} ${to.name}.`
  }
  // Generic: "X adalah <labelA> Y, dan Y adalah <labelB> Z."
  return `${from.name} adalah ${mid.edgeLabel} ${mid.name}, dan ${mid.name} adalah ${to.edgeLabel} ${to.name}.`
}

/**
 * For depth >= 3 paths, render a breadcrumb. Always readable, never
 * pretends to know a fancy compound label that doesn't exist.
 */
function describeChain(path: RelationPathStep[]): string {
  const from = path[0]!
  const to = path[path.length - 1]!
  const middle = path
    .slice(1)
    .map((s) => `${s.edgeLabel} ${s.name}`)
    .join(' → ')
  return `${from.name} terhubung ke ${to.name} melalui rantai: ${middle}.`
}

/**
 * Compose the human-readable Indonesian explanation for a resolved path.
 *
 * Caller MUST pass a path with `.found = true`. For depth 0 (same figure)
 * we return a neutral string — the route handler should never reach this
 * because it rejects equal slugs upstream.
 */
export function buildDescription(path: RelationPathStep[]): string {
  if (path.length < 2) {
    return 'Kedua tokoh ini adalah orang yang sama.'
  }
  if (path.length === 2) return describeDirect(path)
  if (path.length === 3) return describeTwoHop(path)
  return describeChain(path)
}

/**
 * Convenience: find + describe in one call. Returns null when no path
 * exists within `maxDepth`.
 */
export async function findAndDescribe(
  fromFigureId: string,
  toFigureId: string,
  maxDepth = MAX_DEPTH_DEFAULT,
): Promise<{ steps: RelationPathStep[]; depth: number; description: string } | null> {
  const result = await findShortestPath(fromFigureId, toFigureId, maxDepth)
  if (!result.found) return null
  return {
    steps: result.steps,
    depth: result.depth,
    description: buildDescription(result.steps),
  }
}

// ─── Cache invalidation helpers ─────────────────────────────────────────
// Called by figure-relations admin mutations (out of scope here — the
// caller wires it via `figure.service.ts` whenever it edits relations).

/**
 * Soft-delete every cached path row that references either of the two
 * figures. Use after `figure_relations` for either party changes.
 *
 * `or(eq(from, X), eq(to, X), eq(from, Y), eq(to, Y))` is a single update
 * round-trip; safe to call even when nothing matches.
 */
export async function invalidateCacheForFigures(figureIds: string[]): Promise<void> {
  if (figureIds.length === 0) return
  await db.execute(sql`
    UPDATE figure_relation_paths
       SET deleted_at = now()
     WHERE deleted_at IS NULL
       AND (from_figure_id = ANY(${figureIds}::uuid[])
            OR to_figure_id = ANY(${figureIds}::uuid[]))
  `)
}

// Re-export so callers don't have to drill into Drizzle helpers.
export { and, eq, or, isNull }
