-- Phase 7.6 — relation-checker cache table.
--
-- Stores the resolved relationship between any two figures so subsequent
-- lookups skip the BFS / AI calls. Three resolution sources:
--   - 'db_graph'     → pure figure_relations graph walk succeeded.
--   - 'ai_websearch' → AI fell back to the salafi whitelist (see
--                      apps/web/lib/server/research/whitelist-search.ts).
--   - 'none'         → no relationship found; cached so we don't re-ask AI.
--
-- A 30-day TTL is enforced at the API layer. Cache invalidation: when an
-- admin edits figure_relations for either party, the application marks
-- every row in this table touching that figure as soft-deleted so the next
-- lookup re-computes.

CREATE TABLE "figure_relation_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"from_figure_id" uuid NOT NULL,
	"to_figure_id" uuid NOT NULL,
	"resolution_source" text NOT NULL,
	"description_id" text NOT NULL,
	"description_ar" text,
	"path_json" jsonb NOT NULL,
	"citation_url" text,
	"citation_domain" text,
	"confidence" text DEFAULT 'medium' NOT NULL,
	CONSTRAINT "figure_relation_paths_resolution_source_check" CHECK ("resolution_source" IN ('db_graph','ai_websearch','none')),
	CONSTRAINT "figure_relation_paths_confidence_check" CHECK ("confidence" IN ('high','medium','low'))
);
--> statement-breakpoint
ALTER TABLE "figure_relation_paths" ADD CONSTRAINT "figure_relation_paths_from_figure_id_figures_id_fk" FOREIGN KEY ("from_figure_id") REFERENCES "public"."figures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figure_relation_paths" ADD CONSTRAINT "figure_relation_paths_to_figure_id_figures_id_fk" FOREIGN KEY ("to_figure_id") REFERENCES "public"."figures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rel_paths_from_to_idx" ON "figure_relation_paths" USING btree ("from_figure_id","to_figure_id") WHERE "figure_relation_paths"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "rel_paths_from_idx" ON "figure_relation_paths" USING btree ("from_figure_id");--> statement-breakpoint
CREATE INDEX "rel_paths_to_idx" ON "figure_relation_paths" USING btree ("to_figure_id");
