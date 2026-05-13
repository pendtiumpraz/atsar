# Atsar — Backend Architecture & Conventions

> Backend = Next.js API routes + Server Actions + Worker service. TypeScript strict.
> Lihat `ARCHITECTURE.md` untuk overview, `DATABASE.md` untuk schema.

---

## 1. Prinsip Inti

1. **No raw CRUD** — semua operasi data lewat **Service layer** (bukan direct ORM call di route handler).
2. **Soft delete WAJIB** — semua tabel data punya `deleted_at`. Hard delete hanya via trash view dengan permission khusus.
3. **Validation by Zod** — input validation di setiap endpoint, schema shared dengan frontend.
4. **Audit log** untuk setiap mutation sensitif (figures, users, roles, AI config, payments).
5. **No dummy data hardcoded** — seeders only.
6. **Idempotent operations** untuk POST/PUT yang kritis (gunakan `Idempotency-Key` header).
7. **Stateless** — semua state di DB / Redis, server bisa scale horizontal.

---

## 2. Folder Structure

```
apps/web/
├── app/
│   ├── api/                       # API Routes
│   │   ├── v1/                    # versioned
│   │   │   ├── auth/
│   │   │   ├── figures/
│   │   │   ├── battles/
│   │   │   ├── locations/
│   │   │   ├── ai/
│   │   │   │   ├── chat/route.ts
│   │   │   │   └── usage/route.ts
│   │   │   ├── pdf/
│   │   │   ├── admin/             # admin-only
│   │   │   │   ├── users/
│   │   │   │   ├── roles/
│   │   │   │   ├── ai-providers/
│   │   │   │   └── fonts/
│   │   │   ├── reviewer/
│   │   │   └── trash/             # trash endpoints
│   │   └── webhooks/
│
├── lib/
│   ├── server/
│   │   ├── services/              # bisnis logic
│   │   │   ├── figure.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── subscription.service.ts
│   │   │   ├── ai.service.ts
│   │   │   ├── trash.service.ts
│   │   │   └── ...
│   │   ├── repositories/          # data access (Drizzle queries)
│   │   ├── validators/            # zod schemas
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rbac.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── idempotency.ts
│   │   ├── utils/
│   │   │   ├── api-response.ts
│   │   │   ├── pagination.ts
│   │   │   ├── soft-delete.ts
│   │   │   └── audit.ts
│   │   └── errors/
│   │       └── api-error.ts
│   └── shared/                    # client+server: types, constants
│
packages/db/                       # Drizzle schema (shared web+worker)
packages/ai/                       # provider abstraction
apps/worker/                       # background jobs
```

---

## 3. API Response Envelope

Semua endpoint return shape **konsisten**:

### Success
```json
{
  "ok": true,
  "data": {...},
  "meta": {
    "page": 1, "perPage": 20, "total": 150,
    "executionTimeMs": 42
  }
}
```

### Error
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Field 'name_id' is required",
    "details": [...],
    "fieldErrors": {
      "name_id": "wajib diisi"
    }
  },
  "meta": { "requestId": "req_xyz", "timestamp": "..." }
}
```

### Error Codes
```
AUTH_REQUIRED         401
AUTH_INVALID          401
PERMISSION_DENIED     403
NOT_FOUND             404
VALIDATION_ERROR      422
RATE_LIMITED          429
QUOTA_EXCEEDED        429
CONFLICT              409
EXTERNAL_AI_ERROR     502
INTERNAL_ERROR        500
SUBSCRIPTION_EXPIRED  402
```

---

## 4. Soft Delete Pattern

### 4.1 Service Layer
```ts
// figure.service.ts
export class FigureService {
  async softDelete(id: string, actor: User) {
    await requireOwnerOrPermission(actor, 'figures.delete')
    await db.update(figures)
      .set({ deleted_at: new Date(), deleted_by: actor.id })
      .where(eq(figures.id, id))
    await auditLog.write({ action: 'soft_delete', resource_type: 'figure', resource_id: id, actor })
  }

  async restore(id: string, actor: User) {
    await requirePermission(actor, 'trash.restore')
    await db.update(figures)
      .set({ deleted_at: null, deleted_by: null, updated_by: actor.id })
      .where(eq(figures.id, id))
    await auditLog.write({ action: 'restore', resource_type: 'figure', resource_id: id, actor })
  }

  async hardDelete(id: string, actor: User) {
    await requirePermission(actor, 'trash.hard_delete')
    const row = await db.query.figures.findFirst({ where: eq(figures.id, id) })
    if (!row.deleted_at) throw new ApiError('CONFLICT', 'Harus di-trash dulu sebelum hard delete')
    await db.delete(figures).where(eq(figures.id, id))
    await auditLog.write({ action: 'hard_delete', resource_type: 'figure', resource_id: id, actor })
  }
}
```

### 4.2 Endpoint Pattern (CRUD + Trash)
```
GET    /api/v1/figures               → list (deleted_at IS NULL)
GET    /api/v1/figures?slug=xxx      → detail by slug
POST   /api/v1/figures               → create
PUT    /api/v1/figures/:id           → update
DELETE /api/v1/figures/:id           → soft delete

# Trash:
GET    /api/v1/trash/figures         → list (deleted_at IS NOT NULL)
POST   /api/v1/trash/figures/:id/restore       → restore
DELETE /api/v1/trash/figures/:id/hard          → hard delete
POST   /api/v1/trash/empty?type=figure         → empty trash (admin only)
```

### 4.3 Repository Default Filter
```ts
// figure.repository.ts
function baseQuery() {
  return db.select().from(figures).where(isNull(figures.deleted_at))
}
function trashQuery() {
  return db.select().from(figures).where(isNotNull(figures.deleted_at))
}
```

**Rule**: jangan pernah expose query yang melewatkan `deleted_at` filter di luar trash endpoints.

### 4.4 Cascade Soft Delete
Saat parent di-soft-delete, dependents di-soft-delete juga via service (manual loop):
```ts
async softDelete(id: string, actor: User) {
  await db.transaction(async tx => {
    await tx.update(figures).set({ deleted_at: now() }).where(eq(figures.id, id))
    await tx.update(figureRelations).set({ deleted_at: now() }).where(eq(figureRelations.figure_id, id))
    await tx.update(figureLocations).set({ deleted_at: now() }).where(eq(figureLocations.figure_id, id))
    // ...
  })
}
```

---

## 5. Authentication & Authorization

### 5.1 Auth Strategy
- **better-auth** sebagai library inti.
- Session cookie HTTP-only, SameSite=Lax.
- Email/password (Argon2id), magic link via email, OAuth (Google) optional.
- Email verification wajib sebelum subscription aktif.
- 2FA opsional (TOTP) untuk admin & reviewer.

### 5.2 RBAC Middleware
```ts
// middleware/rbac.ts
export async function requirePermission(slug: string) {
  return async (req: Request) => {
    const user = await getUser(req)
    if (!user) throw new ApiError('AUTH_REQUIRED')
    const perms = await getEffectivePermissions(user.id) // join user_roles → role_permissions
    if (!perms.has(slug)) throw new ApiError('PERMISSION_DENIED', `Butuh permission: ${slug}`)
    return user
  }
}

// usage in route:
export async function POST(req: Request) {
  const user = await requirePermission('figures.create')(req)
  // ...
}
```

### 5.3 Effective Permission Resolution
- User punya N roles (via `user_roles`).
- Tiap role punya M permissions (via `role_permissions`).
- Effective = union dari semua permission roles.
- Cached per user di Redis (`perms:user:<id>`), TTL 5 menit, invalidate saat role change.

### 5.4 Permission Slugs (Daftar)
```
# Konten
figures.view
figures.create
figures.update
figures.delete
figures.publish
figures.review

battles.view
battles.create
battles.update
battles.delete
battles.publish

# Trash
trash.view
trash.restore
trash.hard_delete

# AI
ai.chat
ai.agent.use
ai.doc_analyzer.use
ai_providers.manage
ai_models.manage

# Users
users.view
users.invite
users.update
users.delete
users.set_role

# Roles & Permissions
roles.manage
permissions.manage
menu.manage

# Subscriptions
subscriptions.view
subscriptions.activate
payments.confirm

# Fonts
fonts.view
fonts.manage
fonts.activate

# Whitelist
whitelist.manage

# PDF
pdf.export
pdf.export_custom        # admin: set custom name & email

# Quiz
quiz.attempt
quiz.manage

# Audit
audit_log.view
```

### 5.5 Default Role-Permission Matrix (Seeder)
| Permission Group | admin | reviewer | subscriber |
|---|---|---|---|
| `figures.*` | full | view + review | view only |
| `trash.*` | full | view | — |
| `ai.chat` | ✅ unlimited | ✅ unlimited | ✅ quota |
| `ai.agent.use` | ✅ | — | — |
| `ai.doc_analyzer.use` | ✅ | — | — |
| `ai_providers.manage` | ✅ | — | — |
| `users.invite` | ✅ | — | — |
| `roles.manage` | ✅ | — | — |
| `subscriptions.activate` | ✅ | — | — |
| `fonts.*` | full | — | — |
| `whitelist.manage` | ✅ | — | — |
| `pdf.export` | ✅ unlimited | ✅ unlimited | ✅ quota |
| `pdf.export_custom` | ✅ | — | — |
| `audit_log.view` | ✅ | view (own) | — |

Admin bisa **edit matrix ini** di UI; tidak hardcoded (kecuali role `admin` selalu punya `roles.manage`).

---

## 6. AI Service Layer

### 6.1 Provider Abstraction
```ts
// packages/ai/index.ts
import { createDeepSeek, createAnthropic, createOpenAI, createGoogleGenerativeAI } from 'ai/providers'

export async function getActiveModel(role: AIRole) {
  const assignment = await db.query.aiRoleAssignments.findFirst({
    where: and(eq(table.role, role), isNull(table.deleted_at))
  })
  const model = assignment.model
  const provider = model.provider

  switch (provider.sdk_adapter) {
    case 'deepseek':
      return createDeepSeek({ apiKey: decrypt(provider.api_key_encrypted) }).chat(model.model_id)
    case 'anthropic':
      return createAnthropic({ apiKey: decrypt(provider.api_key_encrypted) }).chat(model.model_id)
    case 'openai-compatible':
      return createOpenAI({ baseURL: provider.base_url, apiKey: decrypt(...) }).chat(model.model_id)
    // ...
  }
}
```

### 6.2 Streaming Chat
```ts
// app/api/v1/ai/chat/route.ts
export async function POST(req: Request) {
  const user = await requirePermission('ai.chat')(req)
  await checkQuota(user.id, 'ai_chat')

  const { messages } = await req.json()
  const model = await getActiveModel('chat')

  const result = streamText({
    model,
    messages,
    onFinish: async ({ usage }) => {
      await logAIUsage({ user, role: 'chat', usage, contextSummary: summarize(messages[0]) })
      await incrementQuotaUsage(user.id, 'ai_chat', 1)
    }
  })

  return result.toDataStreamResponse()
}
```

### 6.3 Credit Calculation
```ts
// ai-credit.ts
export function calculateCredits(usage: AIUsage, model: AIModel): number {
  // Default formula: 1 credit = $0.001 worth
  const inputCost  = (usage.inputTokens  / 1_000_000) * model.input_price_per_1m
  const outputCost = (usage.outputTokens / 1_000_000) * model.output_price_per_1m
  const totalUSD   = inputCost + outputCost
  return totalUSD * 1000   // 1 USD = 1000 credits
}
```

Disimpan di `ai_usage_logs.credits_used`. Quota di-cek di `quota_usage`.

### 6.4 Quota Reset (Cron Job)
```ts
// worker/jobs/reset-quotas.ts (daily 00:01)
async function resetQuotas() {
  const subs = await db.query.subscriptions.findMany({
    where: and(
      eq(table.status, 'active'),
      lte(table.quota_reset_at, new Date())
    )
  })

  for (const sub of subs) {
    const nextReset = addMonths(sub.quota_reset_at, 1)
    await db.transaction(async tx => {
      // Buat row baru untuk periode bulan ini (use-it-or-lose-it: yg lama tidak di-rollover)
      await tx.insert(quotaUsage).values({
        user_id: sub.user_id,
        period_start: sub.quota_reset_at,
        period_end: nextReset,
        quota_type: 'pdf_download',
        limit_value: sub.tier.download_quota,
        used_value: 0
      })
      await tx.insert(quotaUsage).values({
        user_id: sub.user_id,
        period_start: sub.quota_reset_at,
        period_end: nextReset,
        quota_type: 'ai_chat',
        limit_value: sub.tier.ai_chat_quota,
        used_value: 0
      })
      await tx.update(subscriptions).set({ quota_reset_at: nextReset }).where(eq(...))
    })
  }
}
```

---

## 7. Validation (Zod)

```ts
// validators/figure.ts
export const createFigureSchema = z.object({
  category_id: z.uuid(),
  gender: z.enum(['male', 'female']),
  name_full_ar: z.string().min(1).max(255),
  name_full_id: z.string().min(1).max(255),
  birth_date_ah: z.number().int().min(-100).max(1500).nullable(),
  death_date_ah: z.number().int().min(-100).max(1500).nullable(),
  social_category: z.array(z.enum(['anshar', 'muhajirin', 'other'])).optional(),
  // ...
})

export type CreateFigureInput = z.infer<typeof createFigureSchema>
```

Schema **shared** dengan client (di `lib/shared/validators`) → react-hook-form pakai schema yang sama untuk form validation.

---

## 8. Worker Jobs

### 8.1 BullMQ Setup
```ts
// apps/worker/index.ts
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'

new Worker('research', researchProcessor, { connection: redis, concurrency: 2 })
new Worker('pdf', pdfProcessor, { connection: redis, concurrency: 1 })
new Worker('extract', extractProcessor, { connection: redis, concurrency: 5 })
new Worker('mail', mailProcessor, { connection: redis, concurrency: 10 })
```

### 8.2 Job: Deep Research per Figure
```ts
async function researchProcessor(job: Job<{ figureName: string }>) {
  const name = job.data.figureName

  // Step 1: search via whitelist domains
  const urls = await searchWhitelist(name, { domains: await activeWhitelist() })

  // Step 2: fetch per URL
  const sources = []
  for (const url of urls) {
    const html = await fetchWithRateLimit(url)
    const arabicText = extractArabic(html)
    sources.push({ url, content: arabicText })
  }

  // Step 3: LLM extract structured + bilingual
  const model = await getActiveModel('agent')
  const figureData = await generateObject({
    model,
    schema: figureExtractionSchema,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(name, sources) }
    ]
  })

  // Step 4: save as DRAFT with citations
  await figureService.createDraft({
    ...figureData,
    citations: sources.map(s => ({ source_url: s.url, source_excerpt_ar: s.content.slice(0, 1000) }))
  })

  // Step 5: enqueue review assignment to ustadz
  await reviewQueue.add('assign', { content_type: 'figure', content_id: figureData.id })
}
```

### 8.3 Job: PDF Generation
```ts
async function pdfProcessor(job: Job<{ pdfJobId: string }>) {
  const pdfJob = await db.query.pdfJobs.findFirst({ where: eq(table.id, job.data.pdfJobId) })

  // Render HTML using template
  const html = await renderPDFTemplate(pdfJob)

  // Puppeteer
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({
    format: pdfJob.paper_size,
    landscape: pdfJob.orientation === 'landscape',
    printBackground: true
  })
  await browser.close()

  // Upload to S3
  const key = `pdf/${pdfJob.user_id}/${pdfJob.id}.pdf`
  await s3.putObject({ Bucket, Key: key, Body: pdfBuffer })

  await db.update(pdfJobs).set({
    status: 'done',
    file_url: `${S3_PUBLIC_URL}/${key}`,
    file_size_bytes: pdfBuffer.byteLength,
    generated_at: new Date()
  }).where(eq(table.id, pdfJob.id))

  // Notification
  await notifyUser(pdfJob.user_id, { type: 'pdf_ready', action_url: pdfUrl })
}
```

---

## 9. File Upload

### 9.1 Endpoint
```
POST /api/v1/uploads
  multipart/form-data
  field "file"
  field "purpose" = 'avatar' | 'font' | 'doc_analyzer' | 'payment_proof'
```

### 9.2 Validation
- Max size per purpose: avatar 2MB, font 5MB, doc_analyzer 50MB, payment_proof 5MB.
- MIME whitelist per purpose.
- Virus scan (ClamAV) untuk doc_analyzer.

### 9.3 Storage
- MinIO bucket per environment.
- Path: `<purpose>/<user_id>/<uuid>.<ext>`.
- Pre-signed URLs untuk akses publik (TTL 24 jam untuk download).

---

## 10. Rate Limiting

Per endpoint group, pakai Redis sliding window:
```
/api/v1/auth/login         5 req/min per IP
/api/v1/ai/chat            10 req/min per user (di luar quota)
/api/v1/pdf/export         3 req/min per user
default                    60 req/min per user
```

429 response include `Retry-After` header.

---

## 11. Audit Logging

Tiap mutation di service layer call `auditLog.write({...})`. Async, non-blocking.

```ts
await auditLog.write({
  actor_id: user.id,
  actor_role: user.activeRole,
  action: 'update',
  resource_type: 'figure',
  resource_id: figure.id,
  diff: jsonDiff(before, after),
  ip_address: req.ip,
  user_agent: req.headers['user-agent']
})
```

Audit log **append-only**, tidak ada update/delete (kecuali GDPR-like data erasure dengan permission khusus).

---

## 12. Error Handling

### 12.1 ApiError Class
```ts
export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public details?: any) {
    super(message)
  }
  toJSON() { return { code: this.code, message: this.message, details: this.details } }
}
```

### 12.2 Global Handler
```ts
// app/api/_lib/handle.ts
export function withErrorHandling(handler: Handler) {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ ok: false, error: e.toJSON() }, { status: codeToStatus(e.code) })
      }
      logger.error({ err: e, requestId })
      Sentry.captureException(e)
      return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: '...' }}, { status: 500 })
    }
  }
}
```

---

## 13. Logging

- Library: **pino** (structured JSON).
- Level: `trace | debug | info | warn | error | fatal`.
- Fields wajib: `requestId`, `userId`, `route`, `durationMs`.
- Output: stdout → Coolify → Loki (production) atau file (dev).

---

## 14. Testing

- Unit: **vitest** untuk service & utils.
- Integration: **vitest** + test database (testcontainers Postgres).
- E2E: **Playwright** untuk flow auth, CRUD, review.
- Tiap PR wajib green test sebelum merge.

---

## 15. Environment Variables

```bash
# Database
DATABASE_URL=postgres://...
REDIS_URL=redis://...

# Auth
BETTER_AUTH_SECRET=<random 64 chars>
AUTH_GOOGLE_CLIENT_ID=
AUTH_GOOGLE_CLIENT_SECRET=

# AI
AI_MASTER_KEY=<for encrypting provider API keys>
# Initial seed key (one-time, then disable):
SEED_DEEPSEEK_API_KEY=sk-...

# Storage
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Mail
RESEND_API_KEY=
MAIL_FROM=noreply@athar.id

# App
NEXT_PUBLIC_APP_URL=https://athar.id
NEXT_PUBLIC_BRAND_NAME=Atsar
NODE_ENV=production
LOG_LEVEL=info

# Worker
WORKER_CONCURRENCY_PDF=1
WORKER_CONCURRENCY_RESEARCH=2

# Admin contact
ADMIN_WA_NUMBER=6281319504441
ADMIN_NAME=Galih
```

`.env.example` di-commit, `.env.local` di gitignore.

---

## 16. Worker–Web Coupling

- Worker dan Web **share package**: `packages/db`, `packages/ai`, `packages/shared`.
- **Tidak ada** HTTP call dari worker ke web (langsung query DB).
- Worker push notification ke web client via Redis pub/sub → SSE endpoint.

---

## 17. Migration Workflow

```bash
# Buat migration baru dari perubahan schema Drizzle
pnpm db:generate

# Review file SQL yang di-generate

# Apply di local
pnpm db:migrate

# Production: di-run otomatis post-deploy via Coolify hook
```

---

## 18. Health Check

```
GET /api/health         → { ok, db: 'up', redis: 'up', uptime: 12345 }
GET /api/ready          → readiness probe (cek migrasi up-to-date)
```

---

## 19. Versioning

- API path `/api/v1/...` — bila breaking change → `/api/v2/...` paralel.
- Schema migration: never delete column di v1, deprecate dulu (mark `_deprecated`), drop di major release.
