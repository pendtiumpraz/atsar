// Tab "Hubungan" — guru-murid, kerabat, dst.
//
// The schema stores both directions of every relation (see
// `seeders/027_relations.ts`), so we just fetch the rows where the
// current figure is the SOURCE and group by `relationType`.

'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import type { FigureDetailData, FigureRelationEntry } from '../figure-detail'

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

  if (grouped.length === 0) {
    return (
      <EmptyState
        title="Belum ada relasi tercatat"
        body="Hubungan guru-murid, keluarga, dan sahabat tokoh ini akan tampil di sini setelah data ditambahkan oleh tim editorial."
      />
    )
  }

  return (
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
  )
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
