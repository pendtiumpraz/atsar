CREATE TYPE "public"."actor_role_enum" AS ENUM('admin', 'reviewer', 'subscriber', 'system');--> statement-breakpoint
CREATE TYPE "public"."ai_request_type_enum" AS ENUM('completion', 'embedding', 'image');--> statement-breakpoint
CREATE TYPE "public"."ai_role_enum" AS ENUM('chat', 'agent', 'doc_analyzer', 'avatar', 'embedding');--> statement-breakpoint
CREATE TYPE "public"."ai_sdk_adapter_enum" AS ENUM('openai-compatible', 'anthropic', 'google', 'deepseek', 'custom');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_status_enum" AS ENUM('success', 'error', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."audit_action_enum" AS ENUM('create', 'update', 'soft_delete', 'restore', 'hard_delete', 'login', 'logout', 'role_change', 'permission_change', 'config_change', 'crawl_complete');--> statement-breakpoint
CREATE TYPE "public"."battle_outcome_enum" AS ENUM('victory', 'defeat', 'truce', 'partial');--> statement-breakpoint
CREATE TYPE "public"."battle_participant_role_enum" AS ENUM('commander', 'sahabat', 'fallen', 'captured');--> statement-breakpoint
CREATE TYPE "public"."battle_type_enum" AS ENUM('ghazwah', 'sariyyah', 'futuhat');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle_enum" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."calendar_preference_enum" AS ENUM('h', 'm', 'both');--> statement-breakpoint
CREATE TYPE "public"."content_status_enum" AS ENUM('draft', 'under_review', 'needs_edit', 'approved', 'published', 'unpublished', 'archived');--> statement-breakpoint
CREATE TYPE "public"."date_precision_enum" AS ENUM('year', 'month', 'day', 'approximate', 'range');--> statement-breakpoint
CREATE TYPE "public"."death_cause_enum" AS ENUM('natural', 'martyr', 'killed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."death_status_enum" AS ENUM('died');--> statement-breakpoint
CREATE TYPE "public"."figure_category_enum" AS ENUM('nabi', 'sahabat', 'tabiin', 'tabiut_tabiin', 'shalih_pre_rasul', 'shalih_pasca_rasul');--> statement-breakpoint
CREATE TYPE "public"."figure_location_role_enum" AS ENUM('birthplace', 'residence', 'dakwah', 'martyr', 'burial');--> statement-breakpoint
CREATE TYPE "public"."figure_relation_type_enum" AS ENUM('teacher_of', 'student_of', 'father', 'mother', 'husband', 'wife', 'son', 'daughter', 'sibling', 'companion', 'descendant', 'ancestor');--> statement-breakpoint
CREATE TYPE "public"."font_role_enum" AS ENUM('display_latin', 'body_latin', 'display_arab', 'section_arab', 'body_arab', 'quran_arab', 'mono');--> statement-breakpoint
CREATE TYPE "public"."font_script_enum" AS ENUM('latin', 'arabic', 'mono', 'both');--> statement-breakpoint
CREATE TYPE "public"."font_source_enum" AS ENUM('google_fonts', 'custom_url', 'uploaded');--> statement-breakpoint
CREATE TYPE "public"."gender_enum" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."locale_enum" AS ENUM('id', 'ar', 'en');--> statement-breakpoint
CREATE TYPE "public"."madhab_enum" AS ENUM('shafii', 'maliki', 'hanafi', 'hanbali', 'zhahiri', 'no_madhab');--> statement-breakpoint
CREATE TYPE "public"."payment_method_enum" AS ENUM('manual_transfer', 'midtrans', 'xendit');--> statement-breakpoint
CREATE TYPE "public"."payment_status_enum" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."pdf_job_status_enum" AS ENUM('queued', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pdf_job_type_enum" AS ENUM('single', 'multi', 'category');--> statement-breakpoint
CREATE TYPE "public"."pdf_language_mode_enum" AS ENUM('id', 'ar', 'both');--> statement-breakpoint
CREATE TYPE "public"."pdf_orientation_enum" AS ENUM('portrait', 'landscape');--> statement-breakpoint
CREATE TYPE "public"."pdf_paper_size_enum" AS ENUM('a5', 'a4', 'letter', 'legal');--> statement-breakpoint
CREATE TYPE "public"."quota_type_enum" AS ENUM('pdf_download', 'ai_chat', 'ai_tokens');--> statement-breakpoint
CREATE TYPE "public"."review_decision_enum" AS ENUM('approve', 'request_edit', 'reject');--> statement-breakpoint
CREATE TYPE "public"."review_status_enum" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."revision_action_enum" AS ENUM('created', 'edited_ai', 'edited_manual', 'approved', 'rejected', 'published', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."rijal_grade_enum" AS ENUM('sahabi_udul', 'thiqah_thiqah', 'thiqah_hafidz', 'thiqah', 'saduq', 'la_basa_bih', 'shalih_al_hadith', 'layyin', 'daif', 'matruk', 'kadhdhab', 'not_narrator', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."social_category_enum" AS ENUM('anshar', 'muhajirin', 'qurasy', 'arab_non_qurasy', 'mawla', 'non_arab', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_lang_enum" AS ENUM('ar', 'id', 'en');--> statement-breakpoint
CREATE TYPE "public"."subscription_status_enum" AS ENUM('trial', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."theme_preference_enum" AS ENUM('light', 'dark', 'auto');--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"label_id" text NOT NULL,
	"label_ar" text,
	"icon" text,
	"path" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"required_permission" text
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"group" text NOT NULL,
	"name_id" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "permissions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reviewer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"title" text,
	"bio_id" text,
	"bio_ar" text,
	"specialty" text[],
	"institutions" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_menu_access" (
	"role_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	CONSTRAINT "role_menu_access_role_id_menu_item_id_pk" PRIMARY KEY("role_id","menu_item_id")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name_id" text NOT NULL,
	"name_ar" text,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"full_name" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"phone" text,
	"locale" "locale_enum" DEFAULT 'id' NOT NULL,
	"theme_preference" "theme_preference_enum" DEFAULT 'auto' NOT NULL,
	"calendar_preference" "calendar_preference_enum" DEFAULT 'both' NOT NULL,
	"font_preference_id" uuid,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"amount_idr" integer NOT NULL,
	"method" "payment_method_enum" NOT NULL,
	"reference" text,
	"proof_url" text,
	"status" "payment_status_enum" DEFAULT 'pending' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quota_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"quota_type" "quota_type_enum" NOT NULL,
	"limit_value" integer NOT NULL,
	"used_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"user_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "subscription_status_enum" NOT NULL,
	"billing_cycle" "billing_cycle_enum",
	"started_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"trial_until" timestamp with time zone,
	"quota_reset_at" timestamp with time zone,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"activated_by" uuid,
	"activated_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name_id" text NOT NULL,
	"price_monthly_idr" integer DEFAULT 0 NOT NULL,
	"price_yearly_idr" integer DEFAULT 0 NOT NULL,
	"download_quota" integer DEFAULT 0 NOT NULL,
	"ai_chat_quota" integer DEFAULT 0 NOT NULL,
	"content_scope" jsonb,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tiers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "location_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"location_id" uuid NOT NULL,
	"alias_ar" text,
	"alias_id" text,
	"alias_en" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_id" text NOT NULL,
	"modern_name" text,
	"country_code" text,
	"region" text,
	"coordinates" text,
	"elevation_meters" integer,
	"description_ar" text,
	"description_id" text,
	"historical_period" text[],
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "figure_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name_id" text NOT NULL,
	"name_ar" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "figure_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "figure_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"figure_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"role" "figure_location_role_enum" NOT NULL,
	"period_start_ah" integer,
	"period_end_ah" integer,
	"notes_ar" text,
	"notes_id" text
);
--> statement-breakpoint
CREATE TABLE "figure_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"figure_id" uuid NOT NULL,
	"related_id" uuid NOT NULL,
	"relation_type" "figure_relation_type_enum" NOT NULL,
	"notes_ar" text,
	"notes_id" text
);
--> statement-breakpoint
CREATE TABLE "figures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"gender" "gender_enum" NOT NULL,
	"name_full_ar" text NOT NULL,
	"name_full_id" text NOT NULL,
	"name_short_ar" text,
	"name_short_id" text,
	"kunyah_ar" text,
	"kunyah_id" text,
	"laqab_ar" text,
	"laqab_id" text,
	"birth_date_ah" integer,
	"birth_date_ce" integer,
	"birth_date_ah_full" date,
	"birth_date_ce_full" date,
	"birth_date_precision" date_precision_enum,
	"birth_date_notes" text,
	"death_date_ah" integer,
	"death_date_ce" integer,
	"death_date_ah_full" date,
	"death_date_ce_full" date,
	"death_date_precision" date_precision_enum,
	"death_date_notes" text,
	"death_status" "death_status_enum" DEFAULT 'died' NOT NULL,
	"death_cause" "death_cause_enum",
	"social_category" "social_category_enum"[],
	"specialty" text[],
	"madhab" "madhab_enum",
	"rijal_grade" "rijal_grade_enum" DEFAULT 'unverified' NOT NULL,
	"rijal_notes_ar" text,
	"rijal_notes_id" text,
	"hadith_count_min" integer,
	"hadith_count_max" integer,
	"summary_ar" text,
	"summary_id" text,
	"biography_ar" text,
	"biography_id" text,
	"biography_pre_wafat_ar" text,
	"biography_pre_wafat_id" text,
	"biography_post_wafat_ar" text,
	"biography_post_wafat_id" text,
	"primary_location_id" uuid,
	"death_location_id" uuid,
	"burial_location_id" uuid,
	"status" "content_status_enum" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "figures_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "battle_locations" (
	"battle_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"notes_ar" text,
	"notes_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battle_locations_battle_id_location_id_pk" PRIMARY KEY("battle_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "battle_participants" (
	"battle_id" uuid NOT NULL,
	"figure_id" uuid NOT NULL,
	"role" "battle_participant_role_enum" NOT NULL,
	"notes_ar" text,
	"notes_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battle_participants_battle_id_figure_id_pk" PRIMARY KEY("battle_id","figure_id")
);
--> statement-breakpoint
CREATE TABLE "battle_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"battle_id" uuid NOT NULL,
	"phase_order" integer NOT NULL,
	"title_ar" text,
	"title_id" text,
	"description_ar" text,
	"description_id" text,
	"phase_location_id" uuid
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_id" text NOT NULL,
	"type" "battle_type_enum" NOT NULL,
	"event_date_ah" integer,
	"event_date_ce" integer,
	"event_date_ah_full" date,
	"event_date_ce_full" date,
	"event_date_precision" date_precision_enum,
	"event_date_notes" text,
	"location_id" uuid,
	"commander_id" uuid,
	"opponent_force" text,
	"muslim_count" integer,
	"opponent_count" integer,
	"outcome" "battle_outcome_enum",
	"casualties_muslim" integer,
	"casualties_opponent" integer,
	"strategy_ar" text,
	"strategy_id" text,
	"narrative_ar" text,
	"narrative_id" text,
	"significance_ar" text,
	"significance_id" text,
	"status" "content_status_enum" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "battles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"content_type" text NOT NULL,
	"content_id" uuid NOT NULL,
	"field_path" text,
	"source_url" text NOT NULL,
	"source_domain" text,
	"source_excerpt_ar" text,
	"source_excerpt_id" text,
	"source_lang" "source_lang_enum",
	"extracted_at" timestamp with time zone,
	"model_used" text,
	"confidence_score" numeric(3, 2)
);
--> statement-breakpoint
CREATE TABLE "content_citation_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"citation_id" uuid NOT NULL,
	"embedding" vector(1536),
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"content_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"diff" jsonb,
	"action" "revision_action_enum" NOT NULL,
	"actor_id" uuid,
	"actor_role" "actor_role_enum",
	"notes" text,
	"ai_instruction" text,
	"ai_model_used" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"content_type" text NOT NULL,
	"content_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "review_status_enum" DEFAULT 'pending' NOT NULL,
	"decision" "review_decision_enum",
	"decision_at" timestamp with time zone,
	"decision_notes" text
);
--> statement-breakpoint
CREATE TABLE "whitelist_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"domain" text NOT NULL,
	"display_name" text,
	"primary_language" "source_lang_enum",
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"crawl_rate_per_minute" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "whitelist_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "ai_credit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"credits_per_1k_input_tokens" numeric(12, 6),
	"credits_per_1k_output_tokens" numeric(12, 6),
	"credits_per_image_generated" numeric(12, 6),
	CONSTRAINT "ai_credit_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"provider_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text,
	"capabilities" text[],
	"context_window" integer,
	"max_output_tokens" integer,
	"supports_streaming" boolean DEFAULT true NOT NULL,
	"supports_tools" boolean DEFAULT false NOT NULL,
	"supports_vision" boolean DEFAULT false NOT NULL,
	"input_price_per_1m" numeric(10, 4),
	"output_price_per_1m" numeric(10, 4),
	"cached_price_per_1m" numeric(10, 4),
	"release_date" date,
	"deprecated_at" date,
	"is_active" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sdk_adapter" "ai_sdk_adapter_enum" NOT NULL,
	"base_url" text,
	"api_key_encrypted" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "ai_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"role" "ai_role_enum" NOT NULL,
	"model_id" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" uuid,
	"role" "ai_role_enum",
	"provider_id" uuid,
	"model_id" uuid,
	"request_type" "ai_request_type_enum",
	"context_summary" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"credits_used" numeric(12, 6),
	"duration_ms" integer,
	"status" "ai_usage_status_enum",
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "font_assignment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "font_role_enum" NOT NULL,
	"old_font_id" uuid,
	"new_font_id" uuid,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "font_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"role" "font_role_enum" NOT NULL,
	"font_id" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fonts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"script" "font_script_enum" NOT NULL,
	"source" "font_source_enum" NOT NULL,
	"google_family_name" text,
	"custom_url" text,
	"file_paths" jsonb,
	"weights" integer[],
	"styles" text[],
	"unicode_range" text,
	"preview_text_ar" text,
	"preview_text_id" text,
	"license" text,
	"is_active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdf_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"user_id" uuid NOT NULL,
	"job_type" "pdf_job_type_enum" NOT NULL,
	"figure_ids" uuid[],
	"template_slug" text,
	"paper_size" "pdf_paper_size_enum" DEFAULT 'a4' NOT NULL,
	"orientation" "pdf_orientation_enum" DEFAULT 'portrait' NOT NULL,
	"language_mode" "pdf_language_mode_enum" DEFAULT 'both' NOT NULL,
	"title_ar" text,
	"title_id" text,
	"author_name" text,
	"author_email" text,
	"include_illustrations" boolean DEFAULT true NOT NULL,
	"include_maps" boolean DEFAULT true NOT NULL,
	"include_timeline" boolean DEFAULT true NOT NULL,
	"status" "pdf_job_status_enum" DEFAULT 'queued' NOT NULL,
	"file_url" text,
	"file_size_bytes" integer,
	"generated_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "pdf_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"name_id" text NOT NULL,
	"name_ar" text,
	"preview_image_url" text,
	"template_path" text NOT NULL,
	"supports_orientation" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "pdf_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"is_correct" boolean,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"score" integer,
	"total_questions" integer
);
--> statement-breakpoint
CREATE TABLE "quiz_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"question_id" uuid NOT NULL,
	"option_order" integer NOT NULL,
	"text_ar" text,
	"text_id" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"quiz_id" uuid NOT NULL,
	"question_order" integer NOT NULL,
	"question_ar" text,
	"question_id" text NOT NULL,
	"explanation_ar" text,
	"explanation_id" text,
	"points" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"slug" text NOT NULL,
	"title_ar" text,
	"title_id" text NOT NULL,
	"description_ar" text,
	"description_id" text,
	"category" text,
	"difficulty" text,
	"duration_seconds" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "quizzes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"body" text,
	"action_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" "actor_role_enum",
	"action" "audit_action_enum" NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"diff" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_profiles" ADD CONSTRAINT "reviewer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menu_access" ADD CONSTRAINT "role_menu_access_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menu_access" ADD CONSTRAINT "role_menu_access_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_usage" ADD CONSTRAINT "quota_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_aliases" ADD CONSTRAINT "location_aliases_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figure_locations" ADD CONSTRAINT "figure_locations_figure_id_figures_id_fk" FOREIGN KEY ("figure_id") REFERENCES "public"."figures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figure_locations" ADD CONSTRAINT "figure_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figure_relations" ADD CONSTRAINT "figure_relations_figure_id_figures_id_fk" FOREIGN KEY ("figure_id") REFERENCES "public"."figures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figure_relations" ADD CONSTRAINT "figure_relations_related_id_figures_id_fk" FOREIGN KEY ("related_id") REFERENCES "public"."figures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figures" ADD CONSTRAINT "figures_category_id_figure_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."figure_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figures" ADD CONSTRAINT "figures_primary_location_id_locations_id_fk" FOREIGN KEY ("primary_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figures" ADD CONSTRAINT "figures_death_location_id_locations_id_fk" FOREIGN KEY ("death_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figures" ADD CONSTRAINT "figures_burial_location_id_locations_id_fk" FOREIGN KEY ("burial_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_locations" ADD CONSTRAINT "battle_locations_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_locations" ADD CONSTRAINT "battle_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_figure_id_figures_id_fk" FOREIGN KEY ("figure_id") REFERENCES "public"."figures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_phases" ADD CONSTRAINT "battle_phases_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_phases" ADD CONSTRAINT "battle_phases_phase_location_id_locations_id_fk" FOREIGN KEY ("phase_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_commander_id_figures_id_fk" FOREIGN KEY ("commander_id") REFERENCES "public"."figures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_citation_embeddings" ADD CONSTRAINT "content_citation_embeddings_citation_id_citations_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_role_assignments" ADD CONSTRAINT "ai_role_assignments_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_role_assignments" ADD CONSTRAINT "ai_role_assignments_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "font_assignment_history" ADD CONSTRAINT "font_assignment_history_old_font_id_fonts_id_fk" FOREIGN KEY ("old_font_id") REFERENCES "public"."fonts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "font_assignment_history" ADD CONSTRAINT "font_assignment_history_new_font_id_fonts_id_fk" FOREIGN KEY ("new_font_id") REFERENCES "public"."fonts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "font_assignment_history" ADD CONSTRAINT "font_assignment_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "font_assignments" ADD CONSTRAINT "font_assignments_font_id_fonts_id_fk" FOREIGN KEY ("font_id") REFERENCES "public"."fonts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "font_assignments" ADD CONSTRAINT "font_assignments_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_jobs" ADD CONSTRAINT "pdf_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_selected_option_id_quiz_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quiz_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_slug_active_idx" ON "menu_items" USING btree ("slug") WHERE "menu_items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "menu_items_parent_idx" ON "menu_items" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_slug_active_idx" ON "permissions" USING btree ("slug") WHERE "permissions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "permissions_group_idx" ON "permissions" USING btree ("group");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_slug_active_idx" ON "roles" USING btree ("slug") WHERE "roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_idx" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("id") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id") WHERE "payments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status") WHERE "payments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "quota_usage_user_period_type_idx" ON "quota_usage" USING btree ("user_id","period_start","quota_type") WHERE "quota_usage"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "quota_usage_user_idx" ON "quota_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status") WHERE "subscriptions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "subscriptions_expires_idx" ON "subscriptions" USING btree ("expires_at") WHERE "subscriptions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "subscriptions_quota_reset_idx" ON "subscriptions" USING btree ("quota_reset_at") WHERE "subscriptions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tiers_slug_active_idx" ON "tiers" USING btree ("slug") WHERE "tiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "location_aliases_loc_idx" ON "location_aliases" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_slug_active_idx" ON "locations" USING btree ("slug") WHERE "locations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "locations_region_idx" ON "locations" USING btree ("region");--> statement-breakpoint
CREATE UNIQUE INDEX "figure_categories_slug_active_idx" ON "figure_categories" USING btree ("slug") WHERE "figure_categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "figure_locations_figure_idx" ON "figure_locations" USING btree ("figure_id") WHERE "figure_locations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "figure_locations_location_idx" ON "figure_locations" USING btree ("location_id") WHERE "figure_locations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "figure_relations_unique_idx" ON "figure_relations" USING btree ("figure_id","related_id","relation_type") WHERE "figure_relations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "figure_relations_figure_idx" ON "figure_relations" USING btree ("figure_id");--> statement-breakpoint
CREATE INDEX "figure_relations_related_idx" ON "figure_relations" USING btree ("related_id");--> statement-breakpoint
CREATE UNIQUE INDEX "figures_slug_active_idx" ON "figures" USING btree ("slug") WHERE "figures"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "figures_category_gender_idx" ON "figures" USING btree ("category_id","gender") WHERE "figures"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "figures_death_ah_idx" ON "figures" USING btree ("death_date_ah") WHERE "figures"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "figures_birth_ah_idx" ON "figures" USING btree ("birth_date_ah") WHERE "figures"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "figures_status_idx" ON "figures" USING btree ("status") WHERE "figures"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "battle_participants_battle_idx" ON "battle_participants" USING btree ("battle_id");--> statement-breakpoint
CREATE INDEX "battle_participants_figure_idx" ON "battle_participants" USING btree ("figure_id");--> statement-breakpoint
CREATE INDEX "battle_phases_battle_idx" ON "battle_phases" USING btree ("battle_id") WHERE "battle_phases"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "battles_slug_active_idx" ON "battles" USING btree ("slug") WHERE "battles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "battles_event_date_idx" ON "battles" USING btree ("event_date_ah") WHERE "battles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "battles_type_idx" ON "battles" USING btree ("type") WHERE "battles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "battles_status_idx" ON "battles" USING btree ("status") WHERE "battles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "citations_content_idx" ON "citations" USING btree ("content_type","content_id") WHERE "citations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "citations_domain_idx" ON "citations" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "cce_citation_idx" ON "content_citation_embeddings" USING btree ("citation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_unique_idx" ON "content_revisions" USING btree ("content_type","content_id","revision_number");--> statement-breakpoint
CREATE INDEX "content_revisions_content_idx" ON "content_revisions" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "content_revisions_actor_idx" ON "content_revisions" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "review_assignments_reviewer_idx" ON "review_assignments" USING btree ("reviewer_id") WHERE "review_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "review_assignments_content_idx" ON "review_assignments" USING btree ("content_type","content_id") WHERE "review_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "review_assignments_status_idx" ON "review_assignments" USING btree ("status") WHERE "review_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "whitelist_domains_domain_active_idx" ON "whitelist_domains" USING btree ("domain") WHERE "whitelist_domains"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_packages_slug_idx" ON "ai_credit_packages" USING btree ("slug") WHERE "ai_credit_packages"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_models_provider_modelid_idx" ON "ai_models" USING btree ("provider_id","model_id") WHERE "ai_models"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ai_models_active_idx" ON "ai_models" USING btree ("is_active") WHERE "ai_models"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_providers_slug_active_idx" ON "ai_providers" USING btree ("slug") WHERE "ai_providers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_role_assignments_role_active_idx" ON "ai_role_assignments" USING btree ("role") WHERE "ai_role_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ai_usage_logs_user_created_idx" ON "ai_usage_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_model_created_idx" ON "ai_usage_logs" USING btree ("model_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_role_created_idx" ON "ai_usage_logs" USING btree ("role","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "font_assignments_role_active_idx" ON "font_assignments" USING btree ("role") WHERE "font_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fonts_family_active_idx" ON "fonts" USING btree ("family") WHERE "fonts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "fonts_script_idx" ON "fonts" USING btree ("script") WHERE "fonts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "pdf_jobs_user_created_idx" ON "pdf_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "pdf_jobs_status_idx" ON "pdf_jobs" USING btree ("status") WHERE "pdf_jobs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pdf_templates_slug_active_idx" ON "pdf_templates" USING btree ("slug") WHERE "pdf_templates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_idx" ON "quiz_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_quiz_idx" ON "quiz_attempts" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_options_question_idx" ON "quiz_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_quiz_idx" ON "quiz_questions" USING btree ("quiz_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quizzes_slug_active_idx" ON "quizzes" USING btree ("slug") WHERE "quizzes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."deleted_at" IS NULL AND "notifications"."is_read" = false;--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_idx" ON "audit_logs" USING btree ("action","created_at");