// All enums in one place.
// Refer DATABASE.md §4.3, §4.4, §7.1.

import { pgEnum } from 'drizzle-orm/pg-core'

export const datePrecisionEnum = pgEnum('date_precision_enum', [
  'year',
  'month',
  'day',
  'approximate',
  'range',
])

export const genderEnum = pgEnum('gender_enum', ['male', 'female'])

export const figureCategoryEnum = pgEnum('figure_category_enum', [
  'nabi',
  'sahabat',
  'tabiin',
  'tabiut_tabiin',
  'shalih_pre_rasul',
  'shalih_pasca_rasul',
])

export const socialCategoryEnum = pgEnum('social_category_enum', [
  'anshar',
  'muhajirin',
  'qurasy',
  'arab_non_qurasy',
  'mawla',
  'non_arab',
  'other',
])

export const madhabEnum = pgEnum('madhab_enum', [
  'shafii',
  'maliki',
  'hanafi',
  'hanbali',
  'zhahiri',
  'no_madhab',
])

export const rijalGradeEnum = pgEnum('rijal_grade_enum', [
  // Ta'dil (positif)
  'sahabi_udul',
  'thiqah_thiqah',
  'thiqah_hafidz',
  'thiqah',
  'saduq',
  'la_basa_bih',
  'shalih_al_hadith',
  // Jarh (negatif)
  'layyin',
  'daif',
  'matruk',
  'kadhdhab',
  // Special
  'not_narrator',
  'unverified',
])

export const deathStatusEnum = pgEnum('death_status_enum', [
  'died',
  // 'alive' deliberately excluded — see IDEAS §2.0c
])

export const deathCauseEnum = pgEnum('death_cause_enum', ['natural', 'martyr', 'killed', 'unknown'])

export const contentStatusEnum = pgEnum('content_status_enum', [
  'draft',
  'under_review',
  'needs_edit',
  'approved',
  'published',
  'unpublished',
  'archived',
])

export const reviewDecisionEnum = pgEnum('review_decision_enum', [
  'approve',
  'request_edit',
  'reject',
])

export const reviewStatusEnum = pgEnum('review_status_enum', [
  'pending',
  'in_progress',
  'completed',
])

export const revisionActionEnum = pgEnum('revision_action_enum', [
  'created',
  'edited_ai',
  'edited_manual',
  'approved',
  'rejected',
  'published',
  'unpublished',
])

export const actorRoleEnum = pgEnum('actor_role_enum', [
  'admin',
  'reviewer',
  'subscriber',
  'system',
])

export const billingCycleEnum = pgEnum('billing_cycle_enum', ['monthly', 'yearly'])

export const subscriptionStatusEnum = pgEnum('subscription_status_enum', [
  'trial',
  'active',
  'expired',
  'cancelled',
])

export const paymentStatusEnum = pgEnum('payment_status_enum', ['pending', 'confirmed', 'rejected'])

export const paymentMethodEnum = pgEnum('payment_method_enum', [
  'manual_transfer',
  'midtrans',
  'xendit',
])

export const quotaTypeEnum = pgEnum('quota_type_enum', ['pdf_download', 'ai_chat', 'ai_tokens'])

export const aiRoleEnum = pgEnum('ai_role_enum', [
  'chat',
  'agent',
  'doc_analyzer',
  'avatar',
  'embedding',
])

export const aiSdkAdapterEnum = pgEnum('ai_sdk_adapter_enum', [
  'openai-compatible',
  'anthropic',
  'google',
  'deepseek',
  'custom',
])

export const aiRequestTypeEnum = pgEnum('ai_request_type_enum', [
  'completion',
  'embedding',
  'image',
])

export const aiUsageStatusEnum = pgEnum('ai_usage_status_enum', ['success', 'error', 'timeout'])

export const fontScriptEnum = pgEnum('font_script_enum', ['latin', 'arabic', 'mono', 'both'])

export const fontSourceEnum = pgEnum('font_source_enum', ['google_fonts', 'custom_url', 'uploaded'])

export const fontRoleEnum = pgEnum('font_role_enum', [
  'display_latin',
  'body_latin',
  'display_arab',
  'section_arab',
  'body_arab',
  'quran_arab',
  'mono',
])

export const figureRelationTypeEnum = pgEnum('figure_relation_type_enum', [
  'teacher_of',
  'student_of',
  'father',
  'mother',
  'husband',
  'wife',
  'son',
  'daughter',
  'sibling',
  'companion',
  'descendant',
  'ancestor',
])

export const figureLocationRoleEnum = pgEnum('figure_location_role_enum', [
  'birthplace',
  'residence',
  'dakwah',
  'martyr',
  'burial',
])

export const battleTypeEnum = pgEnum('battle_type_enum', ['ghazwah', 'sariyyah', 'futuhat'])

export const battleOutcomeEnum = pgEnum('battle_outcome_enum', [
  'victory',
  'defeat',
  'truce',
  'partial',
])

export const battleParticipantRoleEnum = pgEnum('battle_participant_role_enum', [
  // Legacy roles (kept verbatim — seed data + curated rows still use these).
  'commander',
  'sahabat',
  'fallen',
  'captured',
  // Extended roles emitted by the AI battle re-ingest pipeline. The worker
  // maps every extracted participant onto one of these. See
  // `apps/web/lib/server/ai/battle-schema.ts` for the contract.
  'sub_commander',
  'wounded',
  'witness',
  'flag_bearer',
  'envoy',
])

/**
 * Which side of a battle a participant fought on. Used by the public Tokoh
 * tab to group rows under "Muslim" / "Pihak lawan" / "Kedua belah pihak".
 * `'both'` is reserved for envoys, witnesses, or figures who switched sides
 * mid-engagement.
 */
export const battleSideEnum = pgEnum('battle_side_enum', ['muslim', 'opponent', 'both'])

export const pdfJobTypeEnum = pgEnum('pdf_job_type_enum', ['single', 'multi', 'category'])

export const pdfJobStatusEnum = pgEnum('pdf_job_status_enum', [
  'queued',
  'processing',
  'done',
  'failed',
])

export const pdfLanguageModeEnum = pgEnum('pdf_language_mode_enum', ['id', 'ar', 'both'])

export const pdfPaperSizeEnum = pgEnum('pdf_paper_size_enum', ['a5', 'a4', 'letter', 'legal'])

export const pdfOrientationEnum = pgEnum('pdf_orientation_enum', ['portrait', 'landscape'])

export const localeEnum = pgEnum('locale_enum', ['id', 'ar', 'en'])

export const themePreferenceEnum = pgEnum('theme_preference_enum', ['light', 'dark', 'auto'])

export const calendarPreferenceEnum = pgEnum('calendar_preference_enum', ['h', 'm', 'both'])

export const sourceLangEnum = pgEnum('source_lang_enum', ['ar', 'id', 'en'])

export const researchJobTypeEnum = pgEnum('research_job_type_enum', [
  'figure_ingest',
  'battle_ingest',
  'location_ingest',
  'figure_reingest',
  'battle_reingest',
])

export const researchJobStatusEnum = pgEnum('research_job_status_enum', [
  'pending',
  'running',
  'completed',
  'failed',
])

export const auditActionEnum = pgEnum('audit_action_enum', [
  'create',
  'update',
  'soft_delete',
  'restore',
  'hard_delete',
  'login',
  'logout',
  'login_failure',
  'lockout',
  'role_change',
  'permission_change',
  'config_change',
  'crawl_complete',
])
