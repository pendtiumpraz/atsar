-- Phase 7.5.6 — battles re-ingest expansion (Tokoh peserta + Fase).
--
-- The AI websearch re-ingest pipeline now writes to `battle_participants`
-- and `battle_phases` in addition to `battles`. This migration:
--
--   1. Extends `battle_participant_role_enum` with the new fine-grained
--      roles the AI is allowed to emit (`sub_commander`, `wounded`,
--      `witness`, `flag_bearer`, `envoy`). The legacy roles `commander`,
--      `sahabat`, `fallen`, `captured` are retained verbatim — older data
--      is unaffected.
--   2. Adds a `side` column to `battle_participants` so the public Tokoh
--      tab can group rows by Muslim / Opponent / Both. Defaulted to
--      `'muslim'` because every existing seeder row is on the Muslim side.
--   3. Adds three new columns to `battle_phases` for movement vectors and
--      duration: `arrow_from_id`, `arrow_to_id`, `duration_hours`. These
--      let the `<BattleMap />` arrow overlay + phase cards consume the
--      data the AI now extracts (FROM → TO locations and elapsed time per
--      phase).
--
-- All ADDs are idempotent (`IF NOT EXISTS`) so the migration can be re-run
-- against a partially-applied database in development.

-- 1. Enum extensions ---------------------------------------------------
ALTER TYPE "public"."battle_participant_role_enum" ADD VALUE IF NOT EXISTS 'sub_commander';--> statement-breakpoint
ALTER TYPE "public"."battle_participant_role_enum" ADD VALUE IF NOT EXISTS 'wounded';--> statement-breakpoint
ALTER TYPE "public"."battle_participant_role_enum" ADD VALUE IF NOT EXISTS 'witness';--> statement-breakpoint
ALTER TYPE "public"."battle_participant_role_enum" ADD VALUE IF NOT EXISTS 'flag_bearer';--> statement-breakpoint
ALTER TYPE "public"."battle_participant_role_enum" ADD VALUE IF NOT EXISTS 'envoy';--> statement-breakpoint

-- 2. New `side` enum + column on battle_participants -------------------
DO $$ BEGIN
  CREATE TYPE "public"."battle_side_enum" AS ENUM('muslim', 'opponent', 'both');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "battle_participants"
  ADD COLUMN IF NOT EXISTS "side" "battle_side_enum" NOT NULL DEFAULT 'muslim';--> statement-breakpoint

-- 3. battle_phases — arrows + duration ---------------------------------
ALTER TABLE "battle_phases"
  ADD COLUMN IF NOT EXISTS "arrow_from_id" uuid;--> statement-breakpoint
ALTER TABLE "battle_phases"
  ADD COLUMN IF NOT EXISTS "arrow_to_id" uuid;--> statement-breakpoint
ALTER TABLE "battle_phases"
  ADD COLUMN IF NOT EXISTS "duration_hours" integer;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "battle_phases"
    ADD CONSTRAINT "battle_phases_arrow_from_id_locations_id_fk"
    FOREIGN KEY ("arrow_from_id") REFERENCES "public"."locations"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "battle_phases"
    ADD CONSTRAINT "battle_phases_arrow_to_id_locations_id_fk"
    FOREIGN KEY ("arrow_to_id") REFERENCES "public"."locations"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
