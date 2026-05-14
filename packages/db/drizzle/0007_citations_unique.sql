-- Phase 7.7 — prevent duplicate citation spam.
--
-- Re-ingest paths INSERT new citations on every run without DELETEing the
-- old ones (the old sources might still back fields that weren't touched
-- this round). The downside is that re-running re-ingest N times appends
-- N copies of the same (content_type, content_id, source_url, field_path)
-- row, bloating the Sumber tab with effectively-identical entries.
--
-- This partial unique index lets the worker chain `.onConflictDoNothing()`
-- on every citations INSERT, so re-runs become idempotent for the same
-- (target, source URL, field path) tuple. The `WHERE deleted_at IS NULL`
-- clause keeps soft-deleted rows from blocking re-insertion if an admin
-- intentionally trashed a citation and the AI re-cites the same source.
--
-- `COALESCE(field_path, '')` is needed because Postgres treats NULL as
-- distinct in unique indexes; battles use `field_path = NULL` on every
-- row, so without the COALESCE a battle could only have one citation
-- per (battle_id, source_url) regardless of which field cited it.

CREATE UNIQUE INDEX IF NOT EXISTS citations_unique_active_idx
ON citations (content_type, content_id, source_url, COALESCE(field_path, ''))
WHERE deleted_at IS NULL;
