-- Phase 7.7 — add login_failure + lockout to audit_action_enum.
--
-- Required so the login-lockout middleware (lib/server/security/lockout.ts)
-- can emit audit entries for failed sign-ins and tier-escalations. Without
-- these enum values, the previous behaviour was to skip auditing entirely,
-- leaving incident response blind to brute-force activity.
--
-- Postgres ALTER TYPE ADD VALUE IF NOT EXISTS is idempotent.

ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'login_failure';
ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'lockout';
