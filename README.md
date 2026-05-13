# Atsar (أثر)

> Jejak generasi terbaik, dalam genggamanmu.

Aplikasi untuk membandingkan timeline & biografi para Nabi, Sahabat, Shahabiyat, Tabi'in, Tabi'iyyat, Tabi'ut Tabi'in, dan ulama salaf — dengan peta interaktif, AI deep research bersumber salaf, dan PDF book generator.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict |
| UI | Tailwind 4 + shadcn/ui + Lucide |
| DB | Postgres (Neon) + Drizzle ORM + pgvector |
| Queue | BullMQ + Redis (Upstash) |
| AI | Vercel AI SDK (DeepSeek V4 Flash default, multi-provider) |
| Maps | MapLibre GL JS |
| Timeline | vis-timeline + react-chrono + visx |
| PDF | Puppeteer (worker) |
| Auth | better-auth |
| Modal/Toast | SweetAlert2 + Sonner |

Monorepo via **pnpm workspaces + Turborepo**.

---

## Struktur

```
athar/
├── apps/
│   ├── web/          # Next.js app (frontend + API)
│   └── worker/       # Background jobs (BullMQ)
├── packages/
│   ├── db/           # Drizzle schema + migrations + seeders
│   ├── ai/           # AI provider abstraction
│   ├── ui/           # Shared UI primitives
│   ├── shared/       # Types, constants, validators
│   └── hijri/        # Hijri ↔ Gregorian utils
└── docs/             # Spec dokumen (BRANDING, DATABASE, BACKEND, ...)
```

---

## Quickstart (Dev)

```bash
# 1. Copy env template & isi
cp .env.example .env.local
# Edit .env.local — isi DATABASE_URL, REDIS_URL, AI keys, dll

# 2. Install dependencies
pnpm install

# 3. Generate & apply migrations
pnpm db:generate
pnpm db:migrate

# 4. Seed data (no dummy hardcoded — semua via seeders)
pnpm db:seed             # production seeders
pnpm db:seed:dev         # + demo data

# 5. Start dev
pnpm dev
```

---

## Dokumentasi

Spec lengkap di `docs/`:

- **IDEAS.md** — visi produk, fitur, model bisnis
- **BRANDING.md** — palet Emerald Turats, typography, tone of voice
- **ARCHITECTURE.md** — overview teknis high-level
- **DATABASE.md** — schema lengkap + seeders + indexes
- **BACKEND.md** — service layer, RBAC, AI, soft delete, audit log
- **FRONTEND.md** — Next.js conventions, atomic design, theme, font
- **WIREFRAMES.md** — wireframe per fitur + library yang dipakai
- **UI_UX.md** — design tokens, atomic component specs
- **IMPLEMENTATION_PLAN.md** — fase 0–10 dengan checklist progress
- **REFERENCES.md** — sumber & dokumentasi yang dirujuk

---

## Kontak

Admin: **Galih** • WA **0813-1950-4441**

---

## Lisensi

Proprietary — © 2026 Atsar. Hak cipta dilindungi.
