// Notification service — own-user inbox + fire-and-forget pubsub publish.
// See docs/BACKEND.md §12 (Notifications) and DATABASE.md §12.
//
// SSE delivery: `create()` publishes to Upstash Redis pubsub on channel
// `notif:user:<userId>`.  The stream route ideally subscribes, but Upstash
// REST does not natively support `SUBSCRIBE`, so the stream route falls
// back to polling — see notifications/stream/route.ts.
//
// The publish is fire-and-forget: a Redis outage must never block the
// underlying insert.

import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { notifications } from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'
import { redis } from '@/lib/server/upstash/redis'

export type NotificationRow = typeof notifications.$inferSelect

export interface CreateNotificationInput {
  userId: string
  type: string
  title?: string | null
  body?: string | null
  actionUrl?: string | null
}

export interface ListNotificationsQuery {
  page: number
  perPage: number
  unreadOnly?: boolean
}

export interface PaginatedNotifications {
  rows: NotificationRow[]
  total: number
  page: number
  perPage: number
}

/**
 * Channel name for a per-user notification stream.
 * Exported so the SSE route can construct the same key.
 */
export function pubsubChannel(userId: string): string {
  return `notif:user:${userId}`
}

/**
 * Insert a notification row and fire-and-forget publish a tiny payload to
 * the user's Redis pubsub channel.  Publish failures are logged but never
 * thrown so a Redis outage cannot break the originating mutation.
 */
export async function create(
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const [inserted] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title ?? null,
      body: input.body ?? null,
      actionUrl: input.actionUrl ?? null,
    })
    .returning()

  if (!inserted) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to insert notification')
  }

  // Fire-and-forget publish — the SSE route may also poll as a fallback.
  void redis
    .publish(pubsubChannel(input.userId), JSON.stringify({ id: inserted.id, type: inserted.type }))
    .catch((err) => {
      console.error('[notification.service] redis publish failed', {
        userId: input.userId,
        notifId: inserted.id,
        err,
      })
    })

  return inserted
}

/**
 * List the current user's notifications, newest first.  `unreadOnly` filters
 * to `is_read = false`.
 */
export async function listForUser(
  userId: string,
  query: ListNotificationsQuery,
): Promise<PaginatedNotifications> {
  const { page, perPage, unreadOnly } = query
  const offset = (page - 1) * perPage

  const where = [eq(notifications.userId, userId), isNull(notifications.deletedAt)]
  if (unreadOnly) where.push(eq(notifications.isRead, false))
  const whereExpr = and(...where)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(whereExpr)
      .orderBy(desc(notifications.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(whereExpr),
  ])

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

/**
 * Mark a single notification as read.  Refuses (NOT_FOUND) if the row does
 * not belong to `userId` — we use NOT_FOUND rather than PERMISSION_DENIED
 * to avoid leaking the existence of other users' rows.
 */
export async function markRead(id: string, userId: string): Promise<NotificationRow> {
  const row = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.id, id),
      eq(notifications.userId, userId),
      isNull(notifications.deletedAt),
    ),
  })
  if (!row) throw new ApiError('NOT_FOUND', 'Notifikasi tidak ditemukan')

  if (row.isRead) return row // idempotent — no UPDATE needed

  const now = new Date()
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: now, updatedAt: now })
    .where(eq(notifications.id, id))
    .returning()
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Gagal menandai notifikasi')
  return updated
}

/**
 * Mark every unread notification for `userId` as read.  Returns the number
 * of rows affected so the client can refresh the unread badge optimistically.
 */
export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const now = new Date()
  const updated = await db
    .update(notifications)
    .set({ isRead: true, readAt: now, updatedAt: now })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        isNull(notifications.deletedAt),
      ),
    )
    .returning({ id: notifications.id })
  return { updated: updated.length }
}

/**
 * Internal helper used by the SSE polling fallback: return any notification
 * rows for `userId` with `created_at > cursor`, oldest-first, capped at 50.
 */
export async function listSince(
  userId: string,
  cursor: Date,
): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.deletedAt),
        sql`${notifications.createdAt} > ${cursor.toISOString()}`,
      ),
    )
    .orderBy(notifications.createdAt)
    .limit(50)
}

export const notificationService = {
  create,
  listForUser,
  markRead,
  markAllRead,
  listSince,
  pubsubChannel,
}
