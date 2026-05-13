# Athar — Technical Architecture (Vercel + Serverless)

> **Updated 2026-05-13**: Pindah dari Hetzner VPS self-host → **Vercel serverless** (per keputusan deploy user). Worker BullMQ → **QStash (Upstash)**. Lihat REFERENCES.md untuk justifikasi pilihan.

---

## 1. Verdict

**Next.js fullstack di Vercel + QStash sebagai serverless queue.**

Tidak ada worker service yang perlu di-deploy terpisah — semua job jalan di **Vercel Functions** yang di-trigger oleh QStash (HTTP webhook + cron).

Alasan singkat:
- App ini **read-heavy + visual-heavy** → Next.js (RSC, App Router) shine di Vercel.
- Neon (Postgres) + Upstash (Redis + QStash) sudah **serverless-managed** — match dengan Vercel.
- Tidak perlu maintain VPS / Docker / orchestration.
- Cost predictable di awal (Vercel Hobby/Pro + Upstash free/pay-as-you-go + Neon free/Launch).
- 1 bahasa (TypeScript), 1 schema, 1 auth.

---

## 2. High-Level Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                       USER (Browser)                          │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼────────────────────────────────┐
│        Vercel — Next.js 15 (App Router)                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ /app/(marketing) RSC + ISR                               │ │
│  │ /app/(app)       RSC + Server Actions                    │ │
│  │ /app/(admin)     Server Actions                          │ │
│  │ /app/(reviewer)  Server Actions                          │ │
│  │ /api/v1/...      API routes (incl. AI streaming)         │ │
│  │ /api/jobs/...    QStash webhook handlers (HMAC verified) │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬────────────────────────────────┘
                               │
   ┌───────────────────┬───────┴────────┬──────────────────────┐
   │                   │                │                      │
┌──▼──────────────┐ ┌──▼─────────────┐ ┌▼──────────────┐ ┌─────▼────────┐
│ Neon Postgres   │ │ Upstash Redis  │ │ Upstash QStash│ │  External AI │
│ + PostGIS       │ │ (REST API)     │ │ (HTTP queue   │ │  Providers    │
│ + pgvector      │ │  • rate-limit  │ │  + cron)      │ │  (multi)      │
│ + pg_trgm       │ │  • RBAC cache  │ │  delivers ←──┐│  via Vercel   │
│ + unaccent      │ │  • SSE pubsub  │ │  to /api/jobs││  AI SDK       │
│ + pgcrypto      │ │  (low writes!) │ │              ││               │
└─────────────────┘ └────────────────┘ └──────────────┘└──────────────┘

Storage:  Vercel Blob ATAU Cloudflare R2 (S3-compatible)
Email:    Resend
Auth:     better-auth (sessions in Postgres)
```

---

## 3. Stack — Final Picks

| Layer | Pick | Catatan |
|---|---|---|
| Hosting | **Vercel** | Frontend + API + cron (Vercel Cron Jobs untuk QStash schedule trigger) |
| Framework | Next.js 15 (App Router) | RSC, Server Actions, Edge-aware |
| Bahasa | TypeScript strict | |
| UI | Tailwind 4 + shadcn/ui | |
| DB | **Neon Postgres** (serverless) | PostGIS + pgvector + pg_trgm |
| ORM | Drizzle | neon-http driver (Edge-compatible) |
| Auth | better-auth | Session di Postgres |
| Cache / Rate-limit | **Upstash Redis** (REST API) | Stateless calls, Edge-compatible |
| Queue | **Upstash QStash** | HTTP-based serverless queue |
| AI SDK | Vercel AI SDK | Provider abstraction |
| Maps | MapLibre GL JS + react-map-gl | |
| Timeline | vis-timeline + react-chrono + visx | |
| PDF | **`@sparticuz/chromium` + Puppeteer-core** di Vercel Function | Fluid Compute (extended timeout) |
| Storage | **Vercel Blob** (default) atau Cloudflare R2 | |
| Email | Resend | |
| i18n | next-intl | |

---

## 4. Worker Strategy: QStash, Bukan BullMQ

Sebelumnya rencana pakai BullMQ + Redis di VPS — **tidak cocok untuk Vercel** (function timeout 60s default).

### Pola QStash
```
Producer (app/.../route.ts):
  await qstash.publishJSON({
    url: 'https://athar.id/api/jobs/research',
    body: { figureName: 'Abu Bakr' },
    retries: 3,
    delay: 0,
  })

  ↓ (Upstash queues + delivers via HTTP)

Consumer (app/api/jobs/research/route.ts):
  export const POST = verifySignatureAppRouter(async (req) => {
    const { figureName } = await req.json()
    await processResearch(figureName)
    return new Response('ok')
  })
```

### Timeout per Job
- Vercel **Hobby**: 60s
- Vercel **Pro**: 300s (default), **800s** dengan Fluid Compute
- Vercel **Enterprise**: 900s

**Pengaruh ke desain**:
- Job > 60s harus **chunk** (split jadi multiple QStash publishes).
- Crawl per sahabat → max 5 sumber per job, sisanya schedule lanjutan.
- PDF generate 60 sahabat → split per 5–10 sahabat per chunk, lalu merge.
- Doc analyzer file besar → split per halaman.

### Pola Chunking
```ts
// Job kicker
async function startCrawlBatch(figureNames: string[]) {
  for (const chunk of chunks(figureNames, 5)) {
    await qstash.publishJSON({
      url: '/api/jobs/research/chunk',
      body: { names: chunk },
      delay: 10, // 10s between chunks for rate limit
    })
  }
}
```

### Cron (Scheduled Jobs)
QStash punya **Schedules** (cron syntax) yang publish ke URL secara periodic:
- Daily 00:01 UTC → `/api/jobs/cron/reset-quotas`
- Weekly Sun 02:00 UTC → `/api/jobs/cron/revalidate-sources`
- Daily 03:00 UTC → `/api/jobs/cron/purge-trash`

Alternative: Vercel Cron Jobs (built-in `vercel.json`) — boleh dipakai bila tidak perlu retry/backoff QStash.

### HMAC Verification
QStash sign payload dengan `QSTASH_CURRENT_SIGNING_KEY` & `QSTASH_NEXT_SIGNING_KEY`. SDK punya helper `verifySignatureAppRouter()` — wajib di setiap `/api/jobs/*` route.

---

## 5. Repo Structure (Updated)

```
athar/
├── apps/
│   └── web/                    # Next.js — frontend + API + jobs
│       ├── app/
│       │   ├── (marketing)/
│       │   ├── (auth)/
│       │   ├── (app)/
│       │   ├── (reviewer)/
│       │   ├── (admin)/
│       │   └── api/
│       │       ├── v1/         # public + auth API
│       │       └── jobs/       # QStash webhook handlers (HMAC verified)
│       │           ├── research/route.ts
│       │           ├── pdf/route.ts
│       │           ├── extract/route.ts
│       │           ├── doc-analyze/route.ts
│       │           ├── mail/route.ts
│       │           └── cron/
│       │               ├── reset-quotas/route.ts
│       │               ├── revalidate-sources/route.ts
│       │               └── purge-trash/route.ts
│       └── lib/
│           └── server/
│               ├── qstash.ts   # client wrapper + publish helpers
│               └── jobs/       # job processor functions (called by /api/jobs routes)
│
├── packages/                   # shared
│   ├── db/                     # Drizzle schema + migrations + seeders
│   ├── ai/                     # AI provider abstraction
│   ├── ui/                     # Shared UI primitives
│   ├── shared/                 # Types, constants, validators, env loader
│   └── hijri/                  # Hijri ↔ Gregorian utils
│
├── docs/                       # All spec docs
├── apps/worker/                # ⚠ DEPRECATED — kept as stub for legacy reference
│                               #   Migrating its logic to apps/web/app/api/jobs/*
├── vercel.json
├── turbo.json
└── pnpm-workspace.yaml
```

> **Note**: `apps/worker` di-flag sebagai **deprecated**. Jobs pindah ke `apps/web/app/api/jobs/*`. Stub package dipertahankan sampai semua job pindah, lalu dihapus.

---

## 6. Deployment Topology

### Production
```
Vercel project: athar
├── Region: sin1 (Singapore) — terdekat Indonesia
├── Functions: Edge + Node (default Node)
├── Cron Jobs: defined in vercel.json
└── Env vars: dari Vercel dashboard (read by Next.js)

External services:
├── Neon Postgres        (region: us-east-1 — latency ~150ms from sin1)
├── Upstash Redis        (region: us-east-1)
├── Upstash QStash       (region: us-east-1)
├── Cloudflare R2 / Blob (storage)
└── Resend              (email)
```

> **Region note**: Neon DB di us-east-1 sementara Vercel di sin1 → latency ~150ms per query. Bila masalah, opsi:
> 1. Move Neon ke ap-southeast-1 (Singapore) — sama region dengan Vercel sin1.
> 2. Pakai Neon connection caching agresif.
> 3. Cache hot data di Upstash Redis.

### Deployment Flow
```
git push main
   ↓
GitHub Actions: lint, typecheck, build (preview deploy gates)
   ↓
Vercel Build & Deploy
   ↓
Post-deploy: Drizzle migrate (via Vercel Build Step or manual)
```

---

## 7. Env Vars Flow

| Layer | Source | Contoh |
|---|---|---|
| Local dev | `.env.local` (gitignored) | All keys |
| Vercel preview | Vercel dashboard "Preview" env | All keys (test/staging) |
| Vercel prod | Vercel dashboard "Production" env | All keys (real) |
| GitHub Actions | GitHub Secrets | Build placeholder values |

Wajib di Vercel dashboard:
```
DATABASE_URL, DATABASE_URL_UNPOOLED
REDIS_URL, KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN
QSTASH_URL, QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY
BETTER_AUTH_SECRET, BETTER_AUTH_URL
AI_MASTER_KEY, SEED_DEEPSEEK_API_KEY
S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_URL
RESEND_API_KEY, MAIL_FROM
ADMIN_NAME, ADMIN_WA_NUMBER
```

---

## 8. Cost Estimate (Awal)

```
Vercel Hobby (gratis)                          : start, batasi function 60s
Neon Launch ($19/bln)                          : pgvector + PostGIS support, branching
Upstash Pay-as-you-go (Redis + QStash)         : ~$5-10/bulan early
Cloudflare R2 ($0.015/GB-month, 10GB free)     : ~$0-5/bulan early
Resend Free tier (3000 email/bulan)            : $0
Domain (.id atau .app)                         : ~$15/tahun
────────────────────────────────────────────────────────
Total early                                    : ~$25-35/bulan
```

Scale: pindah ke Vercel Pro ($20/bln) saat butuh function timeout > 60s atau team.

---

## 9. Observability

- **Logs**: Vercel logs (built-in) + Sentry untuk error.
- **Metrics**: Vercel Analytics (free tier) + Upstash dashboard (Redis/QStash usage).
- **Alerts**: Sentry alerts ke email/Slack.

---

## 10. Migration Notes (Dari Plan Sebelumnya)

| Sebelumnya | Sekarang |
|---|---|
| Hetzner VPS + Coolify | Vercel serverless |
| BullMQ + Redis (long-running) | QStash (HTTP queue) |
| Puppeteer full | `@sparticuz/chromium` + puppeteer-core |
| Self-host Postgres + PostGIS | Neon Postgres (managed) |
| Self-host Redis | Upstash Redis (REST) |
| MinIO self-host | Vercel Blob atau R2 |
| Caddy reverse proxy | Vercel edge (auto-TLS) |

Dokumen lain (BACKEND.md, IMPLEMENTATION_PLAN.md, REFERENCES.md) di-update setelah Phase 0 selesai.

---

## 11. Limitasi & Trade-off Sadar

1. **Function timeout** (60s/300s) — paksa chunking untuk job berat. OK untuk skala awal.
2. **Cold start** — Vercel Edge cepat, Node functions 100-500ms cold. Acceptable.
3. **No persistent connections** — semua DB/Redis call via HTTP (Neon serverless driver, Upstash REST). Latency lebih tinggi dari TCP pool, tapi infra simpler.
4. **Neon free 0.5 GB storage** — cukup awal, upgrade Launch saat tumbuh.
5. **Upstash free 500K commands/day** — sudah hit limit pas test (Redis pakai konservatif), upgrade pay-as-you-go saat real traffic.
6. **QStash 500 messages/day free** — perlu upgrade saat banyak job (Pro $10/bln = 100K msg/day).

---

## 12. Yang TIDAK Berubah dari Dokumen Asli

- DATABASE.md schema → ✓ jalan di Neon.
- BRANDING.md → ✓ tidak terpengaruh hosting.
- IDEAS.md fitur → ✓ semua bisa di-implement (perlu sedikit chunking).
- FRONTEND.md → ✓ Next.js conventions sama.
- WIREFRAMES.md → ✓ semua wireframe valid.
- UI_UX.md → ✓ design system sama.
