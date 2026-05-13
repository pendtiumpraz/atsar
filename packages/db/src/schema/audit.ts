// Audit log (append-only). See DATABASE.md §13.

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  inet,
  index,
} from 'drizzle-orm/pg-core'
import { auditActionEnum, actorRoleEnum } from './enums.js'

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id'),
    actorRole: actorRoleEnum('actor_role'),
    action: auditActionEnum('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    diff: jsonb('diff'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_actor_created_idx').on(t.actorId, t.createdAt),
    index('audit_logs_resource_idx').on(t.resourceType, t.resourceId),
    index('audit_logs_action_created_idx').on(t.action, t.createdAt),
  ],
)
