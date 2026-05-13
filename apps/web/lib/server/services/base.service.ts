// Base service template — documents the soft-delete + lifecycle pattern
// that every domain service should follow. See docs/BACKEND.md §4.
//
// This is intentionally a thin abstract — services are not forced to extend
// it (TypeScript structural typing means they're compatible without).  Treat
// it as a checklist + JSDoc contract.

/**
 * Standard lifecycle contract for any soft-deletable resource.
 *
 * Every domain service (figures, battles, locations, ...) should expose at
 * minimum these three mutation methods.  Implementations MUST:
 *
 *  - Write to `audit_log` on each call (action: soft_delete / restore /
 *    hard_delete) via `auditLog.write({...})`.
 *  - Cascade soft-delete to dependent tables inside a single transaction.
 *  - For `hardDelete`: assert the row is already in trash (`deleted_at IS
 *    NOT NULL`).  Throw `ApiError('CONFLICT', ...)` otherwise.
 *  - Require permission `trash.hard_delete` for hard-delete operations
 *    (checked at the route layer via `requirePermission`).
 *
 * @typeParam TTable  - The Drizzle table reference (e.g. `figures`).
 * @typeParam TSelect - Row shape returned by `select`.
 * @typeParam TInsert - Insert shape accepted by `insert`.
 */
export abstract class BaseService<TTable, TSelect, TInsert> {
  /** Drizzle table reference this service owns. */
  protected abstract table: TTable

  /**
   * Soft-delete the row + cascade to dependents.  Sets `deleted_at = now()`
   * and `deleted_by = actorId`.  Wrap dependents in the same transaction.
   */
  abstract softDelete(id: string, actorId: string): Promise<void>

  /**
   * Reverse a soft-delete.  Clears `deleted_at` / `deleted_by` and sets
   * `updated_by = actorId`.  Requires `trash.restore` permission upstream.
   */
  abstract restore(id: string, actorId: string): Promise<void>

  /**
   * Permanent delete.  Row MUST already be in trash; if not, throw
   * `ApiError('CONFLICT')`.  Requires `trash.hard_delete` permission
   * upstream.
   */
  abstract hardDelete(id: string, actorId: string): Promise<void>

  // The intentionally-unused generics participate in JSDoc + future inference.
  declare protected _select?: TSelect
  declare protected _insert?: TInsert
}
