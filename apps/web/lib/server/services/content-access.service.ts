// Content-access service — answers "may this user view this figure?".
//
// Layered on top of `subscription-gate`: subscription gate decides
// whether the user has any usable plan at all; this service decides
// whether that plan's `contentScope` covers a specific figure.
//
// Rules (per docs/IDEAS.md §6.3 and §6.7):
//
//   - `nabi` and `shalih_pre_rasul` are ALWAYS allowed regardless of
//     tier — these are the fundamental Quranic figures and must be
//     accessible to anonymous/Free users.
//   - For every other category the tier's `contentScope.categories`
//     array must list the figure's category slug, OR the figure must
//     appear in the tier's `curatedFigureIds` allow-list (used by
//     Free/Sampler curation).
//
// Anonymous users (no userId) get the Free-tier view: nabi +
// shalih_pre_rasul only.

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@athar/db'
import { figureCategories, figures } from '@athar/db/schema'

import { getActiveSubscription } from '@/lib/server/auth/subscription-gate'

// ── Constants ─────────────────────────────────────────────────────────

/**
 * Categories that every user can see — including Free tier and
 * anonymous visitors. See IDEAS.md §6.3 note 1.
 */
const ALWAYS_ALLOWED_CATEGORIES = new Set<string>(['nabi', 'shalih_pre_rasul'])

// ── Types ─────────────────────────────────────────────────────────────

export interface ContentCheck {
  allowed: boolean
  reason?: string
}

// ── Internal helpers ──────────────────────────────────────────────────

interface ResolvedScope {
  categories: Set<string>
  curatedFigureIds: Set<string>
}

/**
 * Build a scope describing what this user can see. Anonymous users
 * (no usable subscription) get the always-allowed categories only.
 */
async function resolveScope(userId: string | null): Promise<ResolvedScope> {
  if (!userId) {
    return {
      categories: new Set(ALWAYS_ALLOWED_CATEGORIES),
      curatedFigureIds: new Set(),
    }
  }

  const sub = await getActiveSubscription(userId)
  if (!sub) {
    return {
      categories: new Set(ALWAYS_ALLOWED_CATEGORIES),
      curatedFigureIds: new Set(),
    }
  }

  // Always merge in the fundamental free categories — defensive in case
  // a tier row was seeded without them.
  const cats = new Set<string>(ALWAYS_ALLOWED_CATEGORIES)
  for (const c of sub.contentScope.categories) cats.add(c)

  return {
    categories: cats,
    curatedFigureIds: new Set(sub.contentScope.curatedFigureIds ?? []),
  }
}

function checkAgainstScope(
  scope: ResolvedScope,
  categorySlug: string,
  figureId: string | undefined,
): ContentCheck {
  if (scope.categories.has(categorySlug)) {
    return { allowed: true }
  }
  if (figureId && scope.curatedFigureIds.has(figureId)) {
    return { allowed: true }
  }
  return {
    allowed: false,
    reason: `Tier Anda tidak mencakup kategori: ${categorySlug}`,
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Decide whether `userId` (or anonymous, when null) may view a figure
 * in the given category. Pass `figureId` so curated allow-lists
 * (Free/Sampler) are consulted as a fallback.
 *
 * Returns `{ allowed: true }` on success, `{ allowed: false, reason }`
 * on denial. Never throws — let route handlers decide whether to 402
 * or to silently hide.
 */
export async function canViewFigure(
  userId: string | null,
  figureCategorySlug: string,
  figureId?: string,
): Promise<ContentCheck> {
  const scope = await resolveScope(userId)
  return checkAgainstScope(scope, figureCategorySlug, figureId)
}

/**
 * Bulk variant: given a list of figure ids, return only those the user
 * is allowed to see. Used by list/search endpoints to filter result
 * sets before paginating.
 *
 * Performs a single join from `figures` → `figure_categories` so we
 * fetch each figure's category slug in one query.
 */
export async function filterAllowedFigureIds(
  userId: string | null,
  figureIds: string[],
): Promise<string[]> {
  if (figureIds.length === 0) return []

  const scope = await resolveScope(userId)

  // Fast-path: if every figure category the system uses is included in
  // the scope AND we have no curation to check against, skip the DB
  // round-trip. We can't know this without loading categories though,
  // so the more useful fast-path is the "premium" case where curated is
  // empty and we just check categories from the DB rows.

  const rows = await db
    .select({
      id: figures.id,
      categorySlug: figureCategories.slug,
    })
    .from(figures)
    .innerJoin(figureCategories, eq(figureCategories.id, figures.categoryId))
    .where(
      and(
        inArray(figures.id, figureIds),
        isNull(figures.deletedAt),
        isNull(figureCategories.deletedAt),
      ),
    )

  const allowed: string[] = []
  for (const r of rows) {
    if (scope.categories.has(r.categorySlug)) {
      allowed.push(r.id)
      continue
    }
    if (scope.curatedFigureIds.has(r.id)) {
      allowed.push(r.id)
    }
  }
  return allowed
}

export const contentAccessService = {
  canViewFigure,
  filterAllowedFigureIds,
}
