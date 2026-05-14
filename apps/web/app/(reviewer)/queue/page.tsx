// `/reviewer/queue` — reviewer's inbox (WIREFRAMES §26).
//
// Server component. The `(reviewer)` layout already enforces session + role,
// so we can fetch directly from the schema (skipping a same-process HTTP
// hop). Four buckets ride along on the same page so reviewers can scan their
// pipeline + recent history at a glance:
//
//   - Pending          → `status=pending` (inbox, FIFO)
//   - Perlu Perbaikan  → `status=completed AND decision='request_edit'`
//                          (this calendar month)
//   - Disetujui        → `status=completed AND decision='approve'` (this month)
//   - Ditolak          → `status=completed AND decision='reject'` (this month)
//
// Each bucket pre-joins the content title + citation count + AI confidence
// (averaged across citations) so `<QueueItem />` stays a pure presentational
// component.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QueueItem, type QueueItemData } from '@/components/reviewer/queue-item'
import { auth } from '@/lib/server/auth'
import { db } from '@athar/db'
import {
  battles,
  citations,
  figures,
  reviewAssignments,
} from '@athar/db/schema'

export const metadata: Metadata = {
  title: 'Antrian Review · Atsar',
  description: 'Antrian assignment review konten Atsar.',
}

export const dynamic = 'force-dynamic'

type Bucket = 'pending' | 'in_progress' | 'completed'
type DecisionFilter = 'approve' | 'request_edit' | 'reject' | null

interface JoinedAssignment {
  id: string
  contentType: string
  contentId: string
  assignedAt: Date | null
  status: string
  decision: string | null
  decisionAt: Date | null
}

interface ContentTitle {
  id: string
  titleAr: string | null
  titleId: string | null
}

interface CitationAgg {
  contentType: string
  contentId: string
  count: number
  avgConfidence: number | null
}

async function loadAssignments(
  reviewerId: string,
  bucket: Bucket,
  decision?: DecisionFilter,
): Promise<JoinedAssignment[]> {
  const whereClauses = [
    eq(reviewAssignments.reviewerId, reviewerId),
    eq(reviewAssignments.status, bucket),
    isNull(reviewAssignments.deletedAt),
  ]
  if (decision) whereClauses.push(eq(reviewAssignments.decision, decision))

  const rows = await db
    .select({
      id: reviewAssignments.id,
      contentType: reviewAssignments.contentType,
      contentId: reviewAssignments.contentId,
      assignedAt: reviewAssignments.assignedAt,
      status: reviewAssignments.status,
      decision: reviewAssignments.decision,
      decisionAt: reviewAssignments.decisionAt,
    })
    .from(reviewAssignments)
    .where(and(...whereClauses))
    // Pending: oldest first (FIFO inbox). Completed: newest first.
    .orderBy(
      bucket === 'pending'
        ? asc(reviewAssignments.assignedAt)
        : desc(reviewAssignments.decisionAt),
    )
    .limit(50)
  return rows
}

/** Filter completed assignments to those decided this calendar month. */
function thisMonthOnly(rows: JoinedAssignment[]): JoinedAssignment[] {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return rows.filter((r) => {
    if (!r.decisionAt) return false
    const d = new Date(r.decisionAt)
    return d.getFullYear() === y && d.getMonth() === m
  })
}

/** Batch-load content titles + citation aggregates for a set of assignments. */
async function hydrateContent(
  rows: JoinedAssignment[],
): Promise<Map<string, QueueItemData>> {
  const figureIds = rows.filter((r) => r.contentType === 'figure').map((r) => r.contentId)
  const battleIds = rows.filter((r) => r.contentType === 'battle').map((r) => r.contentId)

  const [figureTitles, battleTitles] = await Promise.all([
    figureIds.length > 0
      ? db
          .select({
            id: figures.id,
            titleAr: figures.nameShortAr,
            titleId: figures.nameShortId,
          })
          .from(figures)
          .where(inArray(figures.id, figureIds))
      : Promise.resolve([] as ContentTitle[]),
    battleIds.length > 0
      ? db
          .select({
            id: battles.id,
            titleAr: battles.nameAr,
            titleId: battles.nameId,
          })
          .from(battles)
          .where(inArray(battles.id, battleIds))
      : Promise.resolve([] as ContentTitle[]),
  ])

  // Aggregate citation count + avg confidence per (contentType, contentId).
  // Confidence is stored as numeric(3,2); Postgres returns it as string —
  // we coerce in the query so the JS side gets numbers.
  const allIds = [...figureIds, ...battleIds]
  const citationRows: CitationAgg[] =
    allIds.length === 0
      ? []
      : await db
          .select({
            contentType: citations.contentType,
            contentId: citations.contentId,
            count: sql<number>`count(*)::int`,
            avgConfidence: sql<number | null>`avg(${citations.confidenceScore})::float`,
          })
          .from(citations)
          .where(
            and(inArray(citations.contentId, allIds), isNull(citations.deletedAt)),
          )
          .groupBy(citations.contentType, citations.contentId)

  const titleMap = new Map<string, ContentTitle>()
  for (const t of figureTitles) titleMap.set(`figure:${t.id}`, t)
  for (const t of battleTitles) titleMap.set(`battle:${t.id}`, t)

  const citeMap = new Map<string, CitationAgg>()
  for (const c of citationRows) citeMap.set(`${c.contentType}:${c.contentId}`, c)

  const out = new Map<string, QueueItemData>()
  for (const r of rows) {
    const key = `${r.contentType}:${r.contentId}`
    const title = titleMap.get(key)
    const agg = citeMap.get(key)
    out.set(r.id, {
      id: r.id,
      contentType: r.contentType,
      contentId: r.contentId,
      assignedAt: r.assignedAt,
      status: r.status,
      titleAr: title?.titleAr ?? null,
      titleId: title?.titleId ?? null,
      citationCount: agg?.count ?? 0,
      aiConfidence: agg?.avgConfidence ?? null,
    })
  }
  return out
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center text-sm text-[rgb(var(--text-muted))]">
      {label}
    </div>
  )
}

interface BucketSectionProps {
  rows: JoinedAssignment[]
  hydrated: Map<string, QueueItemData>
  emptyLabel: string
}

function BucketSection({ rows, hydrated, emptyLabel }: BucketSectionProps) {
  if (rows.length === 0) return <EmptyState label={emptyLabel} />
  return (
    <ul className="flex flex-col gap-3" role="list">
      {rows.map((r) => {
        const data = hydrated.get(r.id)
        if (!data) return null
        return (
          <li key={r.id}>
            <QueueItem item={data} />
          </li>
        )
      })}
    </ul>
  )
}

export default async function ReviewerQueuePage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id
  // Layout already redirects unauthenticated users — defensive check.
  if (!userId) redirect('/login')

  // Four buckets:
  //   - pending        — inbox (FIFO).
  //   - needs_changes  — assignments this reviewer marked `request_edit`
  //                      (historical, scoped to this month).
  //   - approved       — assignments this reviewer approved (historical, this month).
  //   - rejected       — assignments this reviewer rejected (historical, this month).
  const [pending, requestedEditAll, approvedAll, rejectedAll] = await Promise.all([
    loadAssignments(userId, 'pending'),
    loadAssignments(userId, 'completed', 'request_edit'),
    loadAssignments(userId, 'completed', 'approve'),
    loadAssignments(userId, 'completed', 'reject'),
  ])
  const needsChanges = thisMonthOnly(requestedEditAll)
  const approved = thisMonthOnly(approvedAll)
  const rejected = thisMonthOnly(rejectedAll)

  const hydrated = await hydrateContent([
    ...pending,
    ...needsChanges,
    ...approved,
    ...rejected,
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Antrian Tinjauan ({pending.length} pending)
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Draf konten dari AI yang menunggu keputusan Anda. Pintasan keyboard
            tersedia di halaman review (A / R / X).
          </p>
        </div>
        <div className="text-sm text-[rgb(var(--text-muted))]">
          {pending.length} menunggu · {approved.length} disetujui bulan ini
        </div>
      </header>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="needs_changes">
            Perlu Perbaikan ({needsChanges.length})
          </TabsTrigger>
          <TabsTrigger value="approved">Disetujui ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Ditolak ({rejected.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <BucketSection
            rows={pending}
            hydrated={hydrated}
            emptyLabel="Tidak ada draf yang menunggu tinjauan. ✨"
          />
        </TabsContent>
        <TabsContent value="needs_changes" className="mt-4">
          <BucketSection
            rows={needsChanges}
            hydrated={hydrated}
            emptyLabel="Belum ada permintaan perbaikan bulan ini."
          />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <BucketSection
            rows={approved}
            hydrated={hydrated}
            emptyLabel="Belum ada draf yang Anda setujui bulan ini."
          />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <BucketSection
            rows={rejected}
            hydrated={hydrated}
            emptyLabel="Tidak ada draf yang ditolak bulan ini."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
