// Quiz module schema. See DATABASE.md §11.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import { users } from './auth.js'

// ─── quizzes ───────────────────────────────────────────────────────
export const quizzes = pgTable(
  'quizzes',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    titleAr: text('title_ar'),
    titleId: text('title_id').notNull(),
    descriptionAr: text('description_ar'),
    descriptionId: text('description_id'),
    category: text('category'),
    difficulty: text('difficulty'), // 'easy' | 'medium' | 'hard'
    durationSeconds: integer('duration_seconds'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('quizzes_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── quiz_questions ────────────────────────────────────────────────
export const quizQuestions = pgTable(
  'quiz_questions',
  {
    ...baseColumns,
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    questionOrder: integer('question_order').notNull(),
    questionAr: text('question_ar'),
    questionId: text('question_id').notNull(),
    explanationAr: text('explanation_ar'),
    explanationId: text('explanation_id'),
    points: integer('points').notNull().default(1),
  },
  (t) => [index('quiz_questions_quiz_idx').on(t.quizId)],
)

// ─── quiz_options ──────────────────────────────────────────────────
export const quizOptions = pgTable(
  'quiz_options',
  {
    ...baseColumns,
    questionId: uuid('question_id')
      .notNull()
      .references(() => quizQuestions.id, { onDelete: 'cascade' }),
    optionOrder: integer('option_order').notNull(),
    textAr: text('text_ar'),
    textId: text('text_id').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (t) => [index('quiz_options_question_idx').on(t.questionId)],
)

// ─── quiz_attempts ─────────────────────────────────────────────────
export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    score: integer('score'),
    totalQuestions: integer('total_questions'),
  },
  (t) => [
    index('quiz_attempts_user_idx').on(t.userId),
    index('quiz_attempts_quiz_idx').on(t.quizId),
  ],
)

// ─── quiz_answers ──────────────────────────────────────────────────
export const quizAnswers = pgTable('quiz_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id')
    .notNull()
    .references(() => quizQuestions.id),
  selectedOptionId: uuid('selected_option_id').references(() => quizOptions.id),
  isCorrect: boolean('is_correct'),
  answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
})
