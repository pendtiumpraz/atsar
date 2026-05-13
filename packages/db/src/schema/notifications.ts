// Notifications schema. See DATABASE.md §12.

import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import { users } from './auth.js'

export const notifications = pgTable(
  'notifications',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'subscription_expiring' | 'pdf_ready' | ...
    title: text('title'),
    body: text('body'),
    actionUrl: text('action_url'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    index('notifications_user_unread_idx')
      .on(t.userId)
      .where(sql`${t.deletedAt} IS NULL AND ${t.isRead} = false`),
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
  ],
)
