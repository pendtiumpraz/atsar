// `/quiz` — list of active quizzes (WIREFRAMES §14).
//
// Server component: reads `?category` and `?difficulty` from the URL and
// hands the active filters to a server-side service call. We render each
// quiz as `<QuizCard />`. Filters are simple anchor "chips" that build new
// hrefs — no client state needed for the listing view.
//
// Auth + subscription are already gated by `(app)/layout.tsx`. The quiz
// service's `list` does not enforce a permission (matching the HTTP route
// behavior: any signed-in subscriber can browse quizzes).

import type { Metadata } from 'next'
import Link from 'next/link'

import { QuizCard, type QuizCardData } from '@/components/quiz/quiz-card'
import { cn } from '@/lib/utils'
import { quizService } from '@/lib/server/services/quiz.service'

export const metadata: Metadata = {
  title: 'Quiz',
  description:
    'Uji pemahaman sirah para Sahabat, Tabi\'in, dan ulama salaf melalui quiz interaktif.',
}

interface QuizListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

// Hand-curated to match seeds (kept in lockstep with figure-filter-bar's
// category list). When a category-discovery endpoint lands, swap this for an
// API call — the chip UI doesn't change.
const CATEGORY_CHIPS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Semua' },
  { value: 'sahabat', label: 'Sahabat' },
  { value: 'tabiin', label: "Tabi'in" },
  { value: 'sirah-nabi', label: 'Sirah Nabi' },
  { value: 'fiqh', label: 'Fiqh' },
  { value: 'hadits', label: 'Hadits' },
]

const DIFFICULTY_CHIPS: ReadonlyArray<{
  value: '' | 'easy' | 'medium' | 'hard'
  label: string
}> = [
  { value: '', label: 'Semua Level' },
  { value: 'easy', label: 'Mudah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'hard', label: 'Sulit' },
]

function buildHref(
  current: { category?: string; difficulty?: string },
  patch: Partial<{ category: string; difficulty: string }>,
): string {
  const next = new URLSearchParams()
  const category = patch.category !== undefined ? patch.category : current.category
  const difficulty = patch.difficulty !== undefined ? patch.difficulty : current.difficulty
  if (category) next.set('category', category)
  if (difficulty) next.set('difficulty', difficulty)
  const qs = next.toString()
  return qs.length > 0 ? `/quiz?${qs}` : '/quiz'
}

export default async function QuizListPage({ searchParams }: QuizListPageProps) {
  const sp = await searchParams
  const categoryRaw = pick(sp.category) ?? ''
  const difficultyRaw = pick(sp.difficulty) ?? ''
  const difficulty =
    difficultyRaw === 'easy' || difficultyRaw === 'medium' || difficultyRaw === 'hard'
      ? difficultyRaw
      : undefined
  const category = categoryRaw || undefined

  // Server-side fetch — same pattern used by figure detail pages. The HTTP
  // route also calls `quizService.list({ ..., isActive: true })`.
  const { rows, total } = await quizService.list({
    category,
    difficulty,
    isActive: true,
    page: 1,
    perPage: 50,
  })
  const quizzes = rows as unknown as QuizCardData[]

  const current = { category: categoryRaw, difficulty: difficultyRaw }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Quiz
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Uji pemahaman sirah dan ilmu Anda.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
        <ChipRow
          label="Kategori"
          options={CATEGORY_CHIPS}
          activeValue={categoryRaw}
          buildHref={(value) => buildHref(current, { category: value })}
        />
        <ChipRow
          label="Tingkat"
          options={DIFFICULTY_CHIPS}
          activeValue={difficultyRaw}
          buildHref={(value) => buildHref(current, { difficulty: value })}
        />
      </div>

      {quizzes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center text-sm text-[rgb(var(--text-muted))]">
          Belum ada quiz yang sesuai dengan filter ini.
        </div>
      ) : (
        <>
          <div className="px-1 text-xs text-[rgb(var(--text-faint))]">
            {total} quiz tersedia
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {quizzes.map((quiz) => (
              <li key={quiz.id ?? quiz.slug}>
                <QuizCard quiz={quiz} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ChipRow({
  label,
  options,
  activeValue,
  buildHref,
}: {
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
  activeValue: string
  buildHref: (value: string) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-[rgb(var(--text-faint))]">
        {label}:
      </span>
      {options.map((opt) => {
        const isActive = activeValue === opt.value
        return (
          <Link
            key={opt.value || 'all'}
            href={buildHref(opt.value)}
            scroll={false}
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
              isActive
                ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]',
            )}
          >
            {opt.label}
          </Link>
        )
      })}
    </div>
  )
}
