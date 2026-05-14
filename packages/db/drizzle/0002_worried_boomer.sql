CREATE TYPE "public"."research_job_status_enum" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."research_job_type_enum" AS ENUM('figure_ingest', 'battle_ingest', 'location_ingest');--> statement-breakpoint
CREATE TABLE "research_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"type" "research_job_type_enum" NOT NULL,
	"status" "research_job_status_enum" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"message_id" text,
	"result_figure_id" uuid,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "research_jobs_status_idx" ON "research_jobs" USING btree ("status") WHERE "research_jobs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "research_jobs_created_by_idx" ON "research_jobs" USING btree ("created_by") WHERE "research_jobs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "research_jobs_type_status_idx" ON "research_jobs" USING btree ("type","status") WHERE "research_jobs"."deleted_at" IS NULL;