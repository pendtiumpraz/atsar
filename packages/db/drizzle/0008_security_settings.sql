-- Phase 7.6 — tiered login lockout configuration.
--
-- Singleton settings row consumed by the lockout middleware at
-- apps/web/lib/server/security/lockout.ts. Counter / lockout state lives
-- in Upstash Redis (fast + auto-evicts); only the *thresholds and durations*
-- live in Postgres so admins can tune them via /admin/security without a
-- redeploy.
--
-- Tier semantics (rolling window = `attempt_window_sec`):
--   tier1  → first soft brake after N failures (default 3 → 1 min)
--   tier2  → second escalation                  (default 5 → 5 min)
--   tier3  → hard lockout                       (default 10 → 1 hour)
--
-- Singleton invariant is enforced at the application layer: seeder 031
-- inserts the row, the PATCH /api/v1/admin/security endpoint updates
-- by id. We deliberately avoid a partial-unique index here — there is no
-- natural key, and a wiped table degrades to safe defaults via the
-- middleware fallback, never an outage.

CREATE TABLE IF NOT EXISTS "security_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login_lockout_tier1_threshold" integer DEFAULT 3 NOT NULL,
	"login_lockout_tier1_duration_sec" integer DEFAULT 60 NOT NULL,
	"login_lockout_tier2_threshold" integer DEFAULT 5 NOT NULL,
	"login_lockout_tier2_duration_sec" integer DEFAULT 300 NOT NULL,
	"login_lockout_tier3_threshold" integer DEFAULT 10 NOT NULL,
	"login_lockout_tier3_duration_sec" integer DEFAULT 3600 NOT NULL,
	"attempt_window_sec" integer DEFAULT 3600 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
