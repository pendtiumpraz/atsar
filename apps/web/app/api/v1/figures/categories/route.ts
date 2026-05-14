// GET /api/v1/figures/categories
//   → List active figure_categories rows (sorted by sortOrder, then nameId).
//     Used by the admin edit form's category dropdown.
//
// Public-ish — requires `figures.view`. Categories are a small enum-ish
// table; we don't paginate.

import { asc, and, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { figureCategories } from '@athar/db/schema'

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'figures.view')
  const rows = await db
    .select({
      id: figureCategories.id,
      slug: figureCategories.slug,
      nameId: figureCategories.nameId,
      nameAr: figureCategories.nameAr,
      sortOrder: figureCategories.sortOrder,
    })
    .from(figureCategories)
    .where(and(eq(figureCategories.isActive, true), isNull(figureCategories.deletedAt)))
    .orderBy(asc(figureCategories.sortOrder), asc(figureCategories.nameId))
  return ok(rows)
})
