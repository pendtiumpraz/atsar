// Interactive question card used inside the active attempt page
// (WIREFRAMES §14).
//
// Owns the per-question rendering + navigation buttons. Selection state is
// fully controlled by the parent (`/quiz/attempts/[id]/page.tsx`) so it can
// persist answers across question changes and submit them. Framer Motion
// provides a soft fade transition between questions.

'use client'

import { AnimatePresence, motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface QuizSessionOption {
  id: string
  optionOrder: number
  textAr?: string | null
  textId: string
}

export interface QuizSessionQuestion {
  id: string
  questionOrder: number
  questionAr?: string | null
  questionId: string
  points: number
  options: QuizSessionOption[]
}

export interface QuizSessionProps {
  question: QuizSessionQuestion
  /** 0-based index of the current question. */
  currentIndex: number
  /** Total questions in the quiz. */
  total: number
  /** Currently selected option id (if any). */
  selectedOptionId: string | null
  /** Fired when the user picks an option. */
  onSelect: (optionId: string) => void
  /** Fired on the back button. Disabled when first question. */
  onPrev: () => void
  /** Fired on the next button. Disabled when last question. */
  onNext: () => void
  /** Fired on the submit button (last question only). */
  onSubmit: () => void
  /** True while a submit-answer or complete request is in flight. */
  isBusy?: boolean
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

export function QuizSession({
  question,
  currentIndex,
  total,
  selectedOptionId,
  onSelect,
  onPrev,
  onNext,
  onSubmit,
  isBusy = false,
}: QuizSessionProps) {
  const isFirst = currentIndex === 0
  const isLast = currentIndex === total - 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-[rgb(var(--text-muted))]">
        <span>
          Soal{' '}
          <span className="font-semibold text-[rgb(var(--text))]">
            {currentIndex + 1}
          </span>{' '}
          / {total}
        </span>
        <span className="text-xs text-[rgb(var(--text-faint))]">
          {question.points} poin
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-elevated))]"
        aria-hidden
      >
        <div
          className="h-full bg-[rgb(var(--primary))] transition-all"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex flex-col gap-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-6"
        >
          {question.questionAr ? (
            <p
              lang="ar"
              dir="rtl"
              className="text-xl leading-relaxed text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {question.questionAr}
            </p>
          ) : null}
          <p className="text-base leading-relaxed text-[rgb(var(--text))]">
            {question.questionId}
          </p>

          {/* Custom radio buttons — large touch targets per task spec. */}
          <ul
            role="radiogroup"
            aria-label="Pilihan jawaban"
            className="flex flex-col gap-2"
          >
            {question.options.map((opt, idx) => {
              const isSelected = selectedOptionId === opt.id
              const letter = OPTION_LETTERS[idx] ?? String(idx + 1)
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onSelect(opt.id)}
                    disabled={isBusy}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                      'min-h-[3rem] sm:min-h-[3.5rem]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      isSelected
                        ? 'border-[rgb(var(--primary))] bg-[rgb(var(--bg-elevated))]'
                        : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                        isSelected
                          ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                          : 'border-[rgb(var(--border))] text-[rgb(var(--text-muted))]',
                      )}
                    >
                      {letter}
                    </span>
                    <span className="min-w-0 flex-1">
                      {opt.textAr ? (
                        <span
                          lang="ar"
                          dir="rtl"
                          className="block text-base text-[rgb(var(--text))]"
                          style={{ fontFamily: 'var(--font-body-arab)' }}
                        >
                          {opt.textAr}
                        </span>
                      ) : null}
                      <span className="block text-sm text-[rgb(var(--text))]">
                        {opt.textId}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          disabled={isFirst || isBusy}
        >
          ← Sebelumnya
        </Button>
        {isLast ? (
          <Button
            type="button"
            variant="primary"
            onClick={onSubmit}
            disabled={isBusy}
          >
            {isBusy ? 'Mengirim…' : 'Submit'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={onNext}
            disabled={isBusy}
          >
            Lanjut →
          </Button>
        )}
      </div>
    </div>
  )
}
