// Audit log writer + simple diff utility.
// See docs/BACKEND.md §11 (Audit Logging).
//
// `auditLog.write` is fire-and-forget: failures are logged but never thrown,
// so audit logging can never break the calling mutation.

import { db } from '@athar/db'
import { auditLogs } from '@athar/db/schema'

/**
 * Valid `action` values, mirroring the `audit_action_enum` Postgres enum.
 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'soft_delete'
  | 'restore'
  | 'hard_delete'
  | 'login'
  | 'logout'
  | 'role_change'
  | 'permission_change'
  | 'config_change'
  | 'crawl_complete'

/**
 * Valid `actor_role` values, mirroring `actor_role_enum`.
 */
export type AuditActorRole = 'admin' | 'reviewer' | 'subscriber' | 'system'

/**
 * One audit entry. Most fields optional — for `login` / `logout` only an
 * `actorId` + `action` is meaningful, while resource mutations populate
 * `resourceType` / `resourceId` / `diff`.
 */
export interface AuditEntry {
  actorId?: string | null
  actorRole?: AuditActorRole
  action: AuditAction
  resourceType?: string
  resourceId?: string
  diff?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Naive shallow diff. For every key present in `before` or `after`, if the
 * JSON-stringified values differ, the result has `[oldValue, newValue]`.
 *
 * Does **not** deep-diff arrays or nested objects — they're compared as a
 * whole. That's intentional: audit diff is for human review, not patch
 * application. If you need granular nested diffs, do it at the service layer.
 */
export function jsonDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, [unknown, unknown]> {
  const a = (before ?? {}) as Record<string, unknown>
  const b = (after ?? {}) as Record<string, unknown>
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  const out: Record<string, [unknown, unknown]> = {}
  for (const key of keys) {
    const oldVal = a[key]
    const newVal = b[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      out[key] = [oldVal, newVal]
    }
  }
  return out
}

/**
 * Audit-log facade. The single public API is `auditLog.write`.
 */
export const auditLog = {
  /**
   * Insert one audit row. Errors are caught and logged — never re-thrown,
   * so audit logging can never abort the calling operation.
   *
   * The call is awaited (so we don't lose the entry if the request ends),
   * but the failure path is silent. Use `console.error` so it surfaces in
   * Vercel / Coolify logs.
   */
  async write(entry: AuditEntry): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        diff: entry.diff ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      })
    } catch (err) {
      // Audit must never break the caller — swallow and log.
      console.error('[audit] write failed', {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        err,
      })
    }
  },
}
