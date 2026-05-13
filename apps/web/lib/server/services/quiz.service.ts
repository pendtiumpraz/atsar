// Quiz service — business logic for the `quizzes` resource.
// Covers: public listing, user attempt flow (start/answer/complete),
// and admin CRUD (create/update/soft-delete + add question).
//
// Score is ALWAYS computed server-side. Clients never send `isCorrect`.
// Attempts are checked against ownership + completion state before each
// answer is recorded.
//
// See docs/BACKEND.md §1 (No raw CRUD), §4 (Soft Delete), §11 (Audit).

import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import {
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
} from '@athar/db/schema'
import { z } from 'zod'
import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'

// ── Types ─────────────────────────────────────────────────────────────
type QuizRow = typeof quizzes.$inferSelect
type QuizInsert = typeof quizzes.$inferInsert
type QuestionRow = typeof quizQuestions.$inferSelect
type OptionRow = typeof quizOptions.$inferSelect
type AttemptRow = typeof quizAttempts.$inferSelect

export interface OptionPublic {
  id: string
  optionOrder: number
  textAr: string | null
  textId: string
}

export interface OptionAdmin extends OptionPublic {
  isCorrect: boolean
}

export interface QuestionWithOptionsPublic {
  id: string
  questionOrder: number
  questionAr: string | null
  questionId: string
  points: number
  // `is_correct` and `explanation_*` are hidden from regular users during
  // an attempt — they're only revealed in the completion summary.
  options: OptionPublic[]
}

export interface QuestionWithOptionsAdmin extends Omit<QuestionWithOptionsPublic, 'options'> {
  explanationAr: string | null
  explanationId: string | null
  options: OptionAdmin[]
}

export interface QuizPublicDetail extends QuizRow {
  questions: QuestionWithOptionsPublic[]
}

export interface QuizAdminDetail extends QuizRow {
  questions: QuestionWithOptionsAdmin[]
}

export interface PaginatedQuizzes {
  rows: QuizRow[]
  total: number
  page: number
  perPage: number
}

// ── Zod schemas ───────────────────────────────────────────────────────
const difficultyValues = ['easy', 'medium', 'hard'] as const

export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case')

export const listQuizzesQuerySchema = z.object({
  category: z.string().trim().min(1).max(64).optional(),
  difficulty: z.enum(difficultyValues).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListQuizzesQuery = z.infer<typeof listQuizzesQuerySchema>

const optionInputSchema = z.object({
  textAr: z.string().max(1000).optional().nullable(),
  textId: z.string().min(1).max(1000),
  isCorrect: z.boolean().default(false),
})

export const questionInputSchema = z.object({
  questionAr: z.string().max(4000).optional().nullable(),
  questionId: z.string().min(1).max(4000),
  explanationAr: z.string().max(4000).optional().nullable(),
  explanationId: z.string().max(4000).optional().nullable(),
  points: z.number().int().min(1).max(100).default(1),
  questionOrder: z.number().int().min(0).optional(),
  options: z
    .array(optionInputSchema)
    .min(2, 'Minimal 2 opsi')
    .max(10, 'Maksimal 10 opsi')
    .refine((opts) => opts.some((o) => o.isCorrect), {
      message: 'Minimal satu opsi harus benar',
    }),
})
export type QuestionInput = z.infer<typeof questionInputSchema>

export const createQuizSchema = z.object({
  slug: slugSchema,
  titleAr: z.string().max(255).optional().nullable(),
  titleId: z.string().min(1).max(255),
  descriptionAr: z.string().max(4000).optional().nullable(),
  descriptionId: z.string().max(4000).optional().nullable(),
  category: z.string().max(64).optional().nullable(),
  difficulty: z.enum(difficultyValues).optional().nullable(),
  durationSeconds: z.number().int().min(1).max(86400).optional().nullable(),
  isActive: z.boolean().optional(),
})
export type CreateQuizInput = z.infer<typeof createQuizSchema>

export const updateQuizSchema = createQuizSchema.partial()
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid().nullable(),
})
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>

// ── List (public) ─────────────────────────────────────────────────────
export async function list(input: ListQuizzesQuery): Promise<PaginatedQuizzes> {
  const { category, difficulty, isActive = true, page, perPage } = input
  const offset = (page - 1) * perPage

  const where = [isNull(quizzes.deletedAt)]
  if (category) where.push(eq(quizzes.category, category))
  if (difficulty) where.push(eq(quizzes.difficulty, difficulty))
  // isActive is explicit; default true. Allow `false` to bypass for admin-style
  // calls if ever needed (route layer chooses what to expose).
  if (isActive !== undefined) where.push(eq(quizzes.isActive, isActive))

  const whereExpr = and(...where)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(quizzes)
      .where(whereExpr)
      .orderBy(asc(quizzes.titleId))
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(quizzes).where(whereExpr),
  ])

  return { rows, total: totalRow[0]?.count ?? 0, page, perPage }
}

// ── Admin: list (includes inactive) ───────────────────────────────────
export async function listAdmin(input: ListQuizzesQuery): Promise<PaginatedQuizzes> {
  const { category, difficulty, isActive, page, perPage } = input
  const offset = (page - 1) * perPage

  const where = [isNull(quizzes.deletedAt)]
  if (category) where.push(eq(quizzes.category, category))
  if (difficulty) where.push(eq(quizzes.difficulty, difficulty))
  if (isActive !== undefined) where.push(eq(quizzes.isActive, isActive))

  const whereExpr = and(...where)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(quizzes)
      .where(whereExpr)
      .orderBy(asc(quizzes.titleId))
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(quizzes).where(whereExpr),
  ])

  return { rows, total: totalRow[0]?.count ?? 0, page, perPage }
}

// ── Internal: load questions + options for a quiz ─────────────────────
async function loadQuestionsAndOptions(
  quizId: string,
): Promise<{ questions: QuestionRow[]; options: OptionRow[] }> {
  const questions = await db
    .select()
    .from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), isNull(quizQuestions.deletedAt)))
    .orderBy(asc(quizQuestions.questionOrder))

  if (questions.length === 0) return { questions, options: [] }

  const questionIds = questions.map((q) => q.id)
  const options = await db
    .select()
    .from(quizOptions)
    .where(
      and(inArray(quizOptions.questionId, questionIds), isNull(quizOptions.deletedAt)),
    )
    .orderBy(asc(quizOptions.optionOrder))

  return { questions, options }
}

// ── Get by slug (user-facing — strips is_correct + explanation) ───────
export async function getBySlugForUser(
  slug: string,
  // `userId` reserved for future use (e.g. attempt history); not currently
  // required to render the quiz shape.
  _userId: string,
): Promise<QuizPublicDetail> {
  const row = await db.query.quizzes.findFirst({
    where: and(eq(quizzes.slug, slug), isNull(quizzes.deletedAt), eq(quizzes.isActive, true)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Quiz not found: ${slug}`)

  const { questions, options } = await loadQuestionsAndOptions(row.id)

  const byQuestion = new Map<string, OptionPublic[]>()
  for (const o of options) {
    const list = byQuestion.get(o.questionId) ?? []
    list.push({
      id: o.id,
      optionOrder: o.optionOrder,
      textAr: o.textAr,
      textId: o.textId,
      // isCorrect intentionally omitted.
    })
    byQuestion.set(o.questionId, list)
  }

  const shapedQuestions: QuestionWithOptionsPublic[] = questions.map((q) => ({
    id: q.id,
    questionOrder: q.questionOrder,
    questionAr: q.questionAr,
    questionId: q.questionId,
    points: q.points,
    options: byQuestion.get(q.id) ?? [],
  }))

  return { ...row, questions: shapedQuestions }
}

// ── Get by slug (admin — full detail including is_correct) ────────────
export async function getBySlugForAdmin(slug: string): Promise<QuizAdminDetail> {
  const row = await db.query.quizzes.findFirst({
    where: and(eq(quizzes.slug, slug), isNull(quizzes.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Quiz not found: ${slug}`)

  const { questions, options } = await loadQuestionsAndOptions(row.id)

  const byQuestion = new Map<string, OptionAdmin[]>()
  for (const o of options) {
    const list = byQuestion.get(o.questionId) ?? []
    list.push({
      id: o.id,
      optionOrder: o.optionOrder,
      textAr: o.textAr,
      textId: o.textId,
      isCorrect: o.isCorrect,
    })
    byQuestion.set(o.questionId, list)
  }

  const shapedQuestions: QuestionWithOptionsAdmin[] = questions.map((q) => ({
    id: q.id,
    questionOrder: q.questionOrder,
    questionAr: q.questionAr,
    questionId: q.questionId,
    points: q.points,
    explanationAr: q.explanationAr,
    explanationId: q.explanationId,
    options: byQuestion.get(q.id) ?? [],
  }))

  return { ...row, questions: shapedQuestions }
}

async function getQuizById(id: string): Promise<QuizRow> {
  const row = await db.query.quizzes.findFirst({ where: eq(quizzes.id, id) })
  if (!row) throw new ApiError('NOT_FOUND', `Quiz not found: ${id}`)
  return row
}

// ── Attempt: start ────────────────────────────────────────────────────
export interface StartAttemptResult {
  attemptId: string
  quizId: string
  startedAt: Date
  totalQuestions: number
  durationSeconds: number | null
}

export async function startAttempt(
  quizSlug: string,
  userId: string,
): Promise<StartAttemptResult> {
  const quiz = await db.query.quizzes.findFirst({
    where: and(
      eq(quizzes.slug, quizSlug),
      isNull(quizzes.deletedAt),
      eq(quizzes.isActive, true),
    ),
  })
  if (!quiz) throw new ApiError('NOT_FOUND', `Quiz not found: ${quizSlug}`)

  const totalRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quiz.id), isNull(quizQuestions.deletedAt)))
  const total = totalRow[0]?.count ?? 0
  if (total === 0) {
    throw new ApiError('CONFLICT', 'Quiz tidak memiliki pertanyaan')
  }

  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      userId,
      quizId: quiz.id,
      totalQuestions: total,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()
  if (!attempt) throw new ApiError('INTERNAL_ERROR', 'Failed to create attempt')

  return {
    attemptId: attempt.id,
    quizId: quiz.id,
    startedAt: attempt.startedAt,
    totalQuestions: total,
    durationSeconds: quiz.durationSeconds,
  }
}

// ── Internal: load an attempt and assert ownership + open state ───────
async function loadOpenAttemptOwnedBy(
  attemptId: string,
  userId: string,
): Promise<AttemptRow> {
  const attempt = await db.query.quizAttempts.findFirst({
    where: eq(quizAttempts.id, attemptId),
  })
  if (!attempt) throw new ApiError('NOT_FOUND', `Attempt not found: ${attemptId}`)
  // Ownership: refuse cross-user access — exposing a different code than
  // NOT_FOUND would leak attempt existence, so prefer the same code.
  if (attempt.userId !== userId) {
    throw new ApiError('NOT_FOUND', `Attempt not found: ${attemptId}`)
  }
  if (attempt.completedAt) {
    throw new ApiError('CONFLICT', 'Attempt sudah selesai, tidak bisa diubah')
  }
  return attempt
}

// ── Attempt: submit single answer ─────────────────────────────────────
export interface SubmitAnswerResult {
  answerId: string
  isCorrect: boolean
}

export async function submitAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionId: string | null,
  userId: string,
): Promise<SubmitAnswerResult> {
  const attempt = await loadOpenAttemptOwnedBy(attemptId, userId)

  // Verify the question belongs to this quiz.
  const question = await db.query.quizQuestions.findFirst({
    where: and(
      eq(quizQuestions.id, questionId),
      eq(quizQuestions.quizId, attempt.quizId),
      isNull(quizQuestions.deletedAt),
    ),
  })
  if (!question) {
    throw new ApiError('NOT_FOUND', `Question not found in quiz: ${questionId}`)
  }

  // Resolve correctness server-side. A null selection (skipped) is incorrect.
  let isCorrect = false
  if (selectedOptionId) {
    const option = await db.query.quizOptions.findFirst({
      where: and(
        eq(quizOptions.id, selectedOptionId),
        eq(quizOptions.questionId, questionId),
        isNull(quizOptions.deletedAt),
      ),
    })
    if (!option) {
      throw new ApiError('VALIDATION_ERROR', 'Option not found for this question', {
        fieldErrors: { selectedOptionId: 'Opsi tidak valid' },
      })
    }
    isCorrect = option.isCorrect
  }

  // Upsert-like: if an answer already exists for this (attempt, question),
  // overwrite it. Drizzle doesn't have a high-level upsert for composite
  // keys here, so do a check-then-write.
  const existing = await db.query.quizAnswers.findFirst({
    where: and(eq(quizAnswers.attemptId, attemptId), eq(quizAnswers.questionId, questionId)),
  })

  let answerId: string
  if (existing) {
    const [updated] = await db
      .update(quizAnswers)
      .set({
        selectedOptionId,
        isCorrect,
        answeredAt: new Date(),
      })
      .where(eq(quizAnswers.id, existing.id))
      .returning()
    if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to update answer')
    answerId = updated.id
  } else {
    const [inserted] = await db
      .insert(quizAnswers)
      .values({
        attemptId,
        questionId,
        selectedOptionId,
        isCorrect,
      })
      .returning()
    if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert answer')
    answerId = inserted.id
  }

  return { answerId, isCorrect }
}

// ── Attempt: complete and finalize score ──────────────────────────────
export interface CompleteAttemptResult {
  attemptId: string
  score: number
  totalQuestions: number
  correctCount: number
  completedAt: Date
}

export async function completeAttempt(
  attemptId: string,
  userId: string,
): Promise<CompleteAttemptResult> {
  const attempt = await loadOpenAttemptOwnedBy(attemptId, userId)

  // Recompute score server-side from quiz_answers — we never trust a
  // client-supplied count. Sum the points of each question whose answer
  // row has is_correct = true.
  const scoreRow = await db
    .select({
      correctCount: sql<number>`COUNT(*) FILTER (WHERE ${quizAnswers.isCorrect} = true)::int`,
      score: sql<number>`COALESCE(SUM(CASE WHEN ${quizAnswers.isCorrect} = true THEN ${quizQuestions.points} ELSE 0 END), 0)::int`,
    })
    .from(quizAnswers)
    .innerJoin(quizQuestions, eq(quizAnswers.questionId, quizQuestions.id))
    .where(eq(quizAnswers.attemptId, attemptId))

  const correctCount = scoreRow[0]?.correctCount ?? 0
  const score = scoreRow[0]?.score ?? 0
  const now = new Date()

  const [updated] = await db
    .update(quizAttempts)
    .set({
      score,
      completedAt: now,
      updatedBy: userId,
      updatedAt: now,
    })
    .where(eq(quizAttempts.id, attemptId))
    .returning()
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to finalize attempt')

  return {
    attemptId,
    score,
    totalQuestions: attempt.totalQuestions ?? 0,
    correctCount,
    completedAt: now,
  }
}

// ── Admin: create quiz ────────────────────────────────────────────────
export async function create(
  data: CreateQuizInput,
  actorId: string,
): Promise<QuizRow> {
  const clash = await db.query.quizzes.findFirst({
    where: and(eq(quizzes.slug, data.slug), isNull(quizzes.deletedAt)),
  })
  if (clash) {
    throw new ApiError('CONFLICT', `Slug already in use: ${data.slug}`, {
      fieldErrors: { slug: 'Slug sudah dipakai' },
    })
  }

  const insertValues: QuizInsert = {
    ...data,
    isActive: data.isActive ?? true,
    createdBy: actorId,
    updatedBy: actorId,
  }

  const [inserted] = await db.insert(quizzes).values(insertValues).returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert quiz')

  await auditLog.write({
    action: 'create',
    resourceType: 'quiz',
    resourceId: inserted.id,
    actorId,
    diff: { after: inserted },
  })

  return inserted
}

// ── Admin: update by id ───────────────────────────────────────────────
export async function update(
  id: string,
  data: UpdateQuizInput,
  actorId: string,
): Promise<QuizRow> {
  const before = await db.query.quizzes.findFirst({
    where: and(eq(quizzes.id, id), isNull(quizzes.deletedAt)),
  })
  if (!before) throw new ApiError('NOT_FOUND', `Quiz not found: ${id}`)

  if (data.slug && data.slug !== before.slug) {
    const clash = await db.query.quizzes.findFirst({
      where: and(
        eq(quizzes.slug, data.slug),
        isNull(quizzes.deletedAt),
        ne(quizzes.id, before.id),
      ),
    })
    if (clash) {
      throw new ApiError('CONFLICT', `Slug already in use: ${data.slug}`, {
        fieldErrors: { slug: 'Slug sudah dipakai' },
      })
    }
  }

  const [updated] = await db
    .update(quizzes)
    .set({
      ...data,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .where(eq(quizzes.id, id))
    .returning()
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to update quiz')

  await auditLog.write({
    action: 'update',
    resourceType: 'quiz',
    resourceId: updated.id,
    actorId,
    diff: { before, after: updated },
  })

  return updated
}

// ── Admin: soft delete by id (cascade questions + options) ────────────
export async function softDelete(id: string, actorId: string): Promise<void> {
  const row = await db.query.quizzes.findFirst({
    where: and(eq(quizzes.id, id), isNull(quizzes.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Quiz not found: ${id}`)

  const now = new Date()

  // Cascade atomically via Neon's HTTP batch (single round-trip).
  // We soft-delete questions; options have no soft-delete cascade through
  // questions because each row owns its own `deleted_at`. Mark them too
  // for consistency with figure.service's pattern.
  await db.batch([
    db
      .update(quizzes)
      .set({ deletedAt: now, deletedBy: actorId, updatedBy: actorId })
      .where(eq(quizzes.id, row.id)),
    db
      .update(quizQuestions)
      .set({ deletedAt: now, deletedBy: actorId })
      .where(and(eq(quizQuestions.quizId, row.id), isNull(quizQuestions.deletedAt))),
    db
      .update(quizOptions)
      .set({ deletedAt: now, deletedBy: actorId })
      .where(
        and(
          sql`${quizOptions.questionId} IN (SELECT ${quizQuestions.id} FROM ${quizQuestions} WHERE ${quizQuestions.quizId} = ${row.id})`,
          isNull(quizOptions.deletedAt),
        ),
      ),
  ])

  await auditLog.write({
    action: 'soft_delete',
    resourceType: 'quiz',
    resourceId: row.id,
    actorId,
    diff: { slug: row.slug },
  })
}

// ── Admin: get by id (for admin detail route) ─────────────────────────
export async function getByIdForAdmin(id: string): Promise<QuizAdminDetail> {
  const row = await db.query.quizzes.findFirst({
    where: and(eq(quizzes.id, id), isNull(quizzes.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Quiz not found: ${id}`)
  // Reuse the by-slug admin loader via slug to share code paths.
  return getBySlugForAdmin(row.slug)
}

// ── Admin: add a question (+ options) to a quiz ───────────────────────
export interface AddQuestionResult {
  question: QuestionRow
  options: OptionRow[]
}

export async function addQuestion(
  quizId: string,
  input: QuestionInput,
  actorId: string,
): Promise<AddQuestionResult> {
  const quiz = await getQuizById(quizId)
  if (quiz.deletedAt) {
    throw new ApiError('CONFLICT', 'Cannot add question to a deleted quiz')
  }

  // Determine order: explicit override, else next slot.
  let order = input.questionOrder
  if (order === undefined) {
    const maxRow = await db
      .select({ max: sql<number | null>`MAX(${quizQuestions.questionOrder})::int` })
      .from(quizQuestions)
      .where(and(eq(quizQuestions.quizId, quizId), isNull(quizQuestions.deletedAt)))
    order = (maxRow[0]?.max ?? -1) + 1
  }

  const [question] = await db
    .insert(quizQuestions)
    .values({
      quizId,
      questionOrder: order,
      questionAr: input.questionAr ?? null,
      questionId: input.questionId,
      explanationAr: input.explanationAr ?? null,
      explanationId: input.explanationId ?? null,
      points: input.points,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning()
  if (!question) throw new ApiError('INTERNAL_ERROR', 'Failed to insert question')

  const optionRows = await db
    .insert(quizOptions)
    .values(
      input.options.map((opt, idx) => ({
        questionId: question.id,
        optionOrder: idx,
        textAr: opt.textAr ?? null,
        textId: opt.textId,
        isCorrect: opt.isCorrect,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    )
    .returning()

  await auditLog.write({
    action: 'create',
    resourceType: 'quiz_question',
    resourceId: question.id,
    actorId,
    diff: { quizId, after: { question, options: optionRows } },
  })

  return { question, options: optionRows }
}

// ── Default export (namespaced) ───────────────────────────────────────
export const quizService = {
  list,
  listAdmin,
  getBySlugForUser,
  getBySlugForAdmin,
  getByIdForAdmin,
  startAttempt,
  submitAnswer,
  completeAttempt,
  create,
  update,
  softDelete,
  addQuestion,
}
