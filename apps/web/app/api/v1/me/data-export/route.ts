// GET /api/v1/me/data-export
//
// GDPR-style data portability — returns a JSON dump of everything the
// platform stores about the calling user that was either authored by them
// or scoped to their account. Catalog content (figures, battles, etc.)
// is shared editorial data and not included — only personal artefacts.
//
// Response is a single JSON object served with
// `Content-Disposition: attachment; filename="atsar-export-<userId>-<date>.json"`
// so browsers prompt to save. The user can pipe it through any JSON tool.
//
// Auth: requires login. No special permission — every authenticated user
// has the right to export their own data.

import { eq } from 'drizzle-orm'

import { db } from '@athar/db'
import {
  aiUsageLogs,
  auditLogs,
  payments,
  pdfJobs,
  researchJobs,
  subscriptions,
  userRoles,
  users,
} from '@athar/db/schema'
import { ApiError, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = withErrorHandling(async (req) => {
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id
  if (!userId) {
    throw new ApiError('AUTH_REQUIRED', 'Anda harus login terlebih dahulu.')
  }

  // Personal core — the user row itself sans password hash.
  const [profile] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      fullName: users.fullName,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      locale: users.locale,
      themePreference: users.themePreference,
      calendarPreference: users.calendarPreference,
      registeredAt: users.registeredAt,
      lastLoginAt: users.lastLoginAt,
      lastActiveAt: users.lastActiveAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!profile) {
    throw new ApiError('NOT_FOUND', 'Profil tidak ditemukan.')
  }

  // Side data — kept compact. Each block is a flat list of rows scoped
  // to this user. Tables that don't carry a userId column (figures,
  // citations, locations) are catalog data and intentionally excluded.
  const [
    rolesAssigned,
    subscriptionsRows,
    paymentsRows,
    pdfRows,
    researchJobsRows,
    aiUsage,
    auditByActor,
  ] = await Promise.all([
    db.select().from(userRoles).where(eq(userRoles.userId, userId)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db.select().from(payments).where(eq(payments.userId, userId)),
    db.select().from(pdfJobs).where(eq(pdfJobs.userId, userId)),
    db.select().from(researchJobs).where(eq(researchJobs.createdBy, userId)),
    db.select().from(aiUsageLogs).where(eq(aiUsageLogs.userId, userId)).limit(500),
    db.select().from(auditLogs).where(eq(auditLogs.actorId, userId)).limit(500),
  ])

  const dump = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    user: profile,
    rolesAssigned,
    subscriptions: subscriptionsRows,
    payments: paymentsRows,
    pdfBuilderJobs: pdfRows,
    researchJobs: researchJobsRows,
    aiUsage,
    auditActions: auditByActor,
    // Disclaimer to the recipient — this dump is YOUR data; the catalog
    // (figures, battles, citations) is shared editorial content and not
    // part of the personal export.
    notes: {
      excludedFromExport: [
        'figures',
        'battles',
        'citations',
        'locations',
        'figure_relations',
        'figure_locations',
      ],
      contactForCorrections: 'admin@atsar.id',
    },
  }

  const filename = `atsar-export-${userId}-${new Date().toISOString().slice(0, 10)}.json`
  return new Response(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
})
