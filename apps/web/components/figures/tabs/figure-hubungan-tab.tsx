// Tab "Hubungan" — guru-murid, kerabat, dst.
//
// The schema stores both directions of every relation (see
// `seeders/027_relations.ts`), so we just fetch the rows where the
// current figure is the SOURCE and group by `relationType`.
//
// On top of the relations grid, this tab also renders a "Nasab" section
// — the classical Islamic ancestral lineage chain rendered either as a
// single inline Arabic line ("Muhammad bin Abdullah bin …") or as a
// vertical card stack with one card per ancestor. Data comes from the
// dedicated `/api/v1/figures/[slug]/nasab` endpoint which walks
// `figure_relations` up through father/mother edges (max 25 generations).

'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { figuresApi } from '@/lib/api/endpoints'
import type { FigureDetailData, FigureRelationEntry } from '../figure-detail'
import { RelationChecker } from '../relation-checker'

type RelationGroupKey =
  | 'teachers' // people THIS figure learned from → `student_of`
  | 'students' // people THIS figure taught → `teacher_of`
  | 'parents' // father / mother of THIS figure (relation type 'son'|'daughter' is wrong direction; we read forward types 'father'/'mother' means THIS is the parent)
  | 'children' // son / daughter OF this figure
  | 'spouses' // husband / wife
  | 'siblings'
  | 'companions'
  | 'lineage' // ancestor / descendant

const GROUP_LABELS: Record<RelationGroupKey, string> = {
  teachers: 'Guru',
  students: 'Murid',
  parents: 'Orang tua',
  children: 'Anak',
  spouses: 'Pasangan',
  siblings: 'Saudara',
  companions: 'Sahabat seangkatan',
  lineage: 'Garis keturunan',
}

const GROUP_ORDER: RelationGroupKey[] = [
  'teachers',
  'students',
  'parents',
  'children',
  'spouses',
  'siblings',
  'companions',
  'lineage',
]

/**
 * Bucket a relation row into a display group.
 *
 * The `relationType` is from the perspective of the OUTER figure (the
 * source/`figureId`):
 *   - `teacher_of`  → outer is a teacher → related is a student → bucket as STUDENTS.
 *   - `student_of`  → outer is a student → related is a teacher → bucket as TEACHERS.
 *   - `father`      → outer is the father → related is the child → bucket as CHILDREN.
 *   - `son`         → outer is a son → related is the parent → bucket as PARENTS.
 *   - … and so on.
 */
function bucketize(type: FigureRelationEntry['relationType']): RelationGroupKey {
  switch (type) {
    case 'teacher_of':
      return 'students'
    case 'student_of':
      return 'teachers'
    case 'father':
    case 'mother':
      return 'children'
    case 'son':
    case 'daughter':
      return 'parents'
    case 'husband':
    case 'wife':
      return 'spouses'
    case 'sibling':
      return 'siblings'
    case 'companion':
      return 'companions'
    case 'ancestor':
    case 'descendant':
      return 'lineage'
  }
}

// ─── Nasab payload types (mirror the route handler) ────────────────────

interface NasabAncestor {
  depth: number
  relationType: 'father' | 'mother'
  figureId: string | null
  slug: string | null
  nameFullId: string | null
  nameFullAr: string | null
  nameShortId: string | null
  nameShortAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
  laqabAr: string | null
  birthDateAh: number | null
  deathDateAh: number | null
  notesId: string | null
}

interface NasabSelf {
  id: string
  slug: string
  nameFullId: string
  nameFullAr: string
  nameShortId: string | null
  nameShortAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
  laqabAr: string | null
  birthDateAh: number | null
  deathDateAh: number | null
}

interface NasabPayload {
  self: NasabSelf
  ancestors: NasabAncestor[]
}

export interface FigureHubunganTabProps {
  data: FigureDetailData
}

interface GroupedRelations {
  key: RelationGroupKey
  label: string
  entries: FigureRelationEntry[]
}

export function FigureHubunganTab({ data }: FigureHubunganTabProps) {
  const grouped = useMemo<GroupedRelations[]>(() => {
    const buckets = new Map<RelationGroupKey, FigureRelationEntry[]>()
    for (const r of data.relations ?? []) {
      const key = bucketize(r.relationType)
      const arr = buckets.get(key) ?? []
      arr.push(r)
      buckets.set(key, arr)
    }
    return GROUP_ORDER.filter((k) => buckets.has(k)).map((k) => ({
      key: k,
      label: GROUP_LABELS[k],
      entries: (buckets.get(k) ?? []).sort((a, b) =>
        a.related.nameFullId.localeCompare(b.related.nameFullId, 'id'),
      ),
    }))
  }, [data.relations])

  const displayName = data.nameShortId || data.nameFullId || data.slug

  return (
    <div className="flex flex-col gap-6">
      {/* Nasab — silsilah ke atas */}
      <NasabSection slug={data.slug} />

      {/* Relation checker — cek hubungan dengan tokoh lain */}
      <RelationChecker fromSlug={data.slug} fromName={displayName} />

      {/* Existing relations grouped grid */}
      {grouped.length === 0 ? (
        <EmptyState
          title="Belum ada relasi tercatat"
          body="Hubungan guru-murid, keluarga, dan sahabat tokoh ini akan tampil di sini setelah data ditambahkan oleh tim editorial."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map((g) => (
            <section key={g.key} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
                {g.label}
                <span className="ml-1 text-xs font-normal normal-case text-[rgb(var(--text-faint))]">
                  · {g.entries.length}
                </span>
              </h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.entries.map((r) => (
                  <RelationCard key={r.id} relation={r} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Nasab section ─────────────────────────────────────────────────────

type NasabMode = 'compact' | 'detailed'

function NasabSection({ slug }: { slug: string }) {
  const [mode, setMode] = useState<NasabMode>('detailed')
  const { data, isPending, isError } = useQuery<NasabPayload>({
    queryKey: ['figure', slug, 'nasab'],
    queryFn: () => figuresApi.nasab(slug) as Promise<NasabPayload>,
    staleTime: 5 * 60_000,
  })

  return (
    <section className="flex flex-col gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
            Nasab
          </h3>
          <p className="text-xs text-[rgb(var(--text-faint))]">
            Silsilah keturunan ke atas
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Tampilan nasab"
          className="inline-flex rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-0.5 text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'compact'}
            onClick={() => setMode('compact')}
            className={
              mode === 'compact'
                ? 'rounded-sm bg-[rgb(var(--primary))]/15 px-2 py-1 font-medium text-[rgb(var(--primary))]'
                : 'rounded-sm px-2 py-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'
            }
          >
            Ringkas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'detailed'}
            onClick={() => setMode('detailed')}
            className={
              mode === 'detailed'
                ? 'rounded-sm bg-[rgb(var(--primary))]/15 px-2 py-1 font-medium text-[rgb(var(--primary))]'
                : 'rounded-sm px-2 py-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]'
            }
          >
            Detail
          </button>
        </div>
      </header>

      {isPending ? (
        <div className="h-16 animate-pulse rounded bg-[rgb(var(--surface))]" />
      ) : isError || !data ? (
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Gagal memuat nasab. Coba muat ulang halaman.
        </p>
      ) : data.ancestors.length === 0 ? (
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Nasab belum tercatat untuk tokoh ini.
        </p>
      ) : mode === 'compact' ? (
        <NasabCompact self={data.self} ancestors={data.ancestors} />
      ) : (
        <NasabDetailed self={data.self} ancestors={data.ancestors} />
      )}
    </section>
  )
}

/** Short token used to build the Arabic chain — prefer the short form. */
function shortToken(
  src: { nameShortAr?: string | null; nameFullAr?: string | null } | null | undefined,
  fallbackText: string,
): string {
  if (!src) return fallbackText
  if (src.nameShortAr && src.nameShortAr.trim()) return src.nameShortAr.trim()
  const full = (src.nameFullAr ?? '').trim()
  if (!full) return fallbackText
  // First word of the Arabic full name (skip leading "ال" articles).
  const first = full.split(/\s+/)[0] ?? full
  return first
}

function NasabCompact({
  self,
  ancestors,
}: {
  self: NasabSelf
  ancestors: NasabAncestor[]
}) {
  // Build "name bin father bin grandfather …" using either Arabic short forms
  // (for the visual chain in RTL Arabic style) and a Latin transliteration
  // mirror beneath.
  const arabicTokens: string[] = []
  arabicTokens.push(
    shortToken(
      { nameShortAr: self.nameShortAr, nameFullAr: self.nameFullAr },
      self.nameFullAr,
    ),
  )
  for (const a of ancestors) {
    const token = shortToken(
      { nameShortAr: a.nameShortAr, nameFullAr: a.nameFullAr },
      // Fallback for unlinked ancestors: surface the notesId text untransformed.
      a.notesId ?? a.nameFullId ?? '—',
    )
    arabicTokens.push(token)
  }
  // Glue with the Arabic conjunction بن / بنت — for nasab we conventionally
  // use بن throughout the chain (every ancestor link is via the father side).
  const arabicChain = arabicTokens.join(' بن ')

  // Latin transliteration (Indonesian convention).
  const latinTokens: string[] = []
  latinTokens.push(self.nameShortId || self.nameFullId.split(/\s+/)[0] || self.nameFullId)
  for (const a of ancestors) {
    const t =
      a.nameShortId ||
      a.nameFullId?.split(/\s+/)[0] ||
      a.notesId ||
      a.nameFullAr ||
      '—'
    latinTokens.push(t)
  }
  const latinChain = latinTokens.join(' bin ')

  return (
    <div className="flex flex-col gap-2">
      <p
        dir="rtl"
        lang="ar"
        className="text-xl leading-relaxed text-[rgb(var(--text))]"
        style={{ fontFamily: 'var(--font-display-arab)' }}
      >
        {arabicChain}
      </p>
      <p className="text-sm leading-relaxed text-[rgb(var(--text-muted))]">
        {latinChain}
      </p>
    </div>
  )
}

function NasabDetailed({
  self,
  ancestors,
}: {
  self: NasabSelf
  ancestors: NasabAncestor[]
}) {
  // Render the figure itself at the top, then each ancestor as a vertical
  // card connected by a left rail with accent dots — same visual rhythm
  // as the Timeline tab.
  return (
    <ol className="relative ml-3 flex flex-col gap-2 border-l-2 border-[rgb(var(--border))] pl-5">
      <NasabCard
        depth={0}
        title={self.nameFullId}
        titleAr={self.nameFullAr}
        kunyahId={self.kunyahId}
        kunyahAr={self.kunyahAr}
        laqabId={self.laqabId}
        laqabAr={self.laqabAr}
        birthDateAh={self.birthDateAh}
        deathDateAh={self.deathDateAh}
        slug={self.slug}
        isSelf
      />
      {ancestors.map((a, idx) => {
        const titleId = a.nameFullId ?? a.notesId ?? '—'
        const titleAr = a.nameFullAr ?? null
        return (
          <NasabCard
            // No stable id when there's no figure — fall back to depth + index.
            key={a.figureId ?? `anon-${idx}-${a.depth}`}
            depth={a.depth}
            title={titleId}
            titleAr={titleAr}
            kunyahId={a.kunyahId}
            kunyahAr={a.kunyahAr}
            laqabId={a.laqabId}
            laqabAr={a.laqabAr}
            birthDateAh={a.birthDateAh}
            deathDateAh={a.deathDateAh}
            slug={a.slug}
            isSelf={false}
          />
        )
      })}
    </ol>
  )
}

function NasabCard({
  depth,
  title,
  titleAr,
  kunyahId,
  kunyahAr,
  laqabId,
  laqabAr,
  birthDateAh,
  deathDateAh,
  slug,
  isSelf,
}: {
  depth: number
  title: string
  titleAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
  laqabAr: string | null
  birthDateAh: number | null
  deathDateAh: number | null
  slug: string | null
  isSelf: boolean
}) {
  const generationLabel =
    depth === 0
      ? 'Tokoh'
      : depth === 1
        ? 'Ayah'
        : depth === 2
          ? 'Kakek'
          : `Leluhur ke-${depth}`
  const dateLine = formatLifeSpan(birthDateAh, deathDateAh)
  const inner = (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-faint))]">
          {generationLabel}
        </span>
      </div>
      <div className="flex flex-col">
        {titleAr ? (
          <span
            dir="rtl"
            lang="ar"
            className="text-base font-semibold leading-snug text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-body-arab)' }}
          >
            {titleAr}
          </span>
        ) : null}
        <span className="text-sm text-[rgb(var(--text-muted))]">{title}</span>
      </div>
      {kunyahId || kunyahAr ? (
        <div className="text-xs text-[rgb(var(--text-faint))]">
          Kunyah:{' '}
          <span className="text-[rgb(var(--text-muted))]">
            {kunyahId || kunyahAr}
          </span>
        </div>
      ) : null}
      {laqabId || laqabAr ? (
        <div className="text-xs text-[rgb(var(--text-faint))]">
          Laqab:{' '}
          <span className="text-[rgb(var(--text-muted))]">
            {laqabId || laqabAr}
          </span>
        </div>
      ) : null}
      {dateLine ? (
        <div className="text-xs text-[rgb(var(--text-faint))]">{dateLine}</div>
      ) : null}
    </div>
  )

  // Accent dot positioned on the left rail.
  const dot = (
    <span
      aria-hidden
      className={
        'absolute -left-[7px] mt-2 inline-block h-3 w-3 rounded-full border-2 ' +
        (isSelf
          ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]'
          : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]')
      }
    />
  )

  return (
    <li className="relative">
      {dot}
      {slug ? (
        <Link
          href={`/figures/${slug}`}
          className="block rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 transition-colors hover:border-[rgb(var(--primary))]/60 hover:bg-[rgb(var(--bg-elevated))]"
        >
          {inner}
        </Link>
      ) : (
        <div
          className="block rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))]/60 px-3 py-2"
          title="Leluhur belum dicatat sebagai tokoh terpisah."
        >
          {inner}
        </div>
      )}
    </li>
  )
}

function formatLifeSpan(
  birthAh: number | null | undefined,
  deathAh: number | null | undefined,
): string | null {
  if (typeof birthAh !== 'number' && typeof deathAh !== 'number') return null
  const b = typeof birthAh === 'number' ? `${birthAh} H` : '—'
  const d = typeof deathAh === 'number' ? `${deathAh} H` : '—'
  return `${b} — ${d}`
}

function RelationCard({ relation }: { relation: FigureRelationEntry }) {
  const f = relation.related
  const initial = (f.nameShortId ?? f.nameFullId).slice(0, 1).toUpperCase()
  return (
    <li className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-sm">
      <Link href={`/figures/${f.slug}`} className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--primary))]/15 text-sm font-semibold text-[rgb(var(--primary))]"
        >
          {initial}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-[rgb(var(--text))] hover:text-[rgb(var(--primary))]">
            {f.nameShortId || f.nameFullId}
            {f.gender === 'female' ? ' (RA)' : ' (RA)'}
          </span>
          <span
            dir="rtl"
            lang="ar"
            className="truncate text-xs text-[rgb(var(--text-muted))]"
            style={{ fontFamily: 'var(--font-body-arab)' }}
          >
            {f.nameShortAr || f.nameFullAr}
          </span>
          {relation.notesId ? (
            <span className="mt-0.5 text-xs text-[rgb(var(--text-faint))]">{relation.notesId}</span>
          ) : null}
        </span>
      </Link>
    </li>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
    </div>
  )
}
