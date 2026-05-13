# Atsar — Database Architecture & Relations

> Schema PostgreSQL 16+ dengan PostGIS (geospatial) + pgvector (RAG).
> ORM: Drizzle ORM. Migrations versioned.
> **Naming**: snake_case tabel & kolom, plural untuk tabel.
> **Soft delete wajib** di SEMUA tabel data (`deleted_at TIMESTAMPTZ NULL`).
> **Audit columns wajib**: `created_at`, `updated_at`, `created_by`, `updated_by`.

---

## 1. Konvensi Umum

### 1.1 Base Columns (Semua Tabel)
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
created_by      UUID REFERENCES users(id) ON DELETE SET NULL
updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
deleted_at      TIMESTAMPTZ NULL                    -- soft delete
deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL
```

### 1.2 Multi-Bahasa
Field konten yang punya 2 bahasa pakai pola `*_ar` + `*_id`:
```
name_ar    TEXT NOT NULL
name_id    TEXT NOT NULL
summary_ar TEXT
summary_id TEXT
```

### 1.3 Dual Calendar (Hijri & Gregorian)
```
date_ah        INTEGER             -- bisa negatif untuk pre-Hijra
date_ce        INTEGER
date_ah_full   DATE                -- bila bulan & tanggal H diketahui
date_ce_full   DATE                -- bila bulan & tanggal M diketahui
date_precision date_precision_enum -- year | month | day | approximate
date_notes     TEXT
```

### 1.4 Soft Delete Pattern
- **Query default** WAJIB filter `WHERE deleted_at IS NULL`.
- **Trash view** = `WHERE deleted_at IS NOT NULL`.
- **Restore** = `UPDATE ... SET deleted_at = NULL`.
- **Hard delete** = `DELETE FROM ...` (hanya admin, dari trash view).
- Index partial: `CREATE INDEX ... WHERE deleted_at IS NULL` untuk performa.

### 1.5 Audit Trail
Semua perubahan data sensitif (konten, role, permission, AI config) ditulis ke `audit_logs`.

---

## 2. Auth & Users

### 2.1 `users`
```sql
id                  UUID PK
email               TEXT UNIQUE NOT NULL
email_verified_at   TIMESTAMPTZ
password_hash       TEXT                   -- argon2id
full_name           TEXT NOT NULL
display_name        TEXT
avatar_url          TEXT
phone               TEXT
locale              TEXT DEFAULT 'id'      -- 'id' | 'ar' | 'en'
theme_preference    TEXT DEFAULT 'auto'    -- 'light' | 'dark' | 'auto'
calendar_preference TEXT DEFAULT 'both'    -- 'h' | 'm' | 'both'
font_preference_id  UUID                   -- opsional override (TBD if user-level)
registered_at       TIMESTAMPTZ NOT NULL DEFAULT now()
last_login_at       TIMESTAMPTZ
last_active_at      TIMESTAMPTZ
[+ base columns]
```

### 2.2 `roles`
3 role utama + guest virtual:
```sql
id          UUID PK
slug        TEXT UNIQUE NOT NULL  -- 'admin' | 'reviewer' | 'subscriber'
name_id     TEXT NOT NULL
name_ar     TEXT
description TEXT
is_system   BOOLEAN DEFAULT false -- system role tidak bisa dihapus
[+ base columns]
```

Seeded roles:
- `admin` — akses penuh, manage everything
- `reviewer` — ustadz, review konten
- `subscriber` — end user yang berlangganan

### 2.3 `user_roles` (Many-to-Many)
```sql
user_id  UUID REFERENCES users(id) ON DELETE CASCADE
role_id  UUID REFERENCES roles(id) ON DELETE CASCADE
assigned_at TIMESTAMPTZ DEFAULT now()
assigned_by UUID REFERENCES users(id)
PRIMARY KEY (user_id, role_id)
```

User bisa punya **multiple role**. Mis. admin yang juga reviewer.

### 2.4 `permissions`
Atomic permission yang bisa dirakit jadi role:
```sql
id          UUID PK
slug        TEXT UNIQUE NOT NULL   -- 'figures.create' | 'figures.publish' | dst
group       TEXT NOT NULL          -- 'figures' | 'users' | 'ai' | dst
name_id     TEXT NOT NULL
description TEXT
is_system   BOOLEAN DEFAULT false
[+ base columns]
```

Format slug: `<resource>.<action>` — `figures.create`, `figures.review`, `users.invite`, `ai_providers.manage`, `fonts.activate`, `trash.hard_delete`, dst.

### 2.5 `role_permissions`
```sql
role_id       UUID
permission_id UUID
granted_at    TIMESTAMPTZ
granted_by    UUID
PRIMARY KEY (role_id, permission_id)
```

### 2.6 `menu_items`
Definisi menu navigasi (untuk role-based menu matrix):
```sql
id              UUID PK
parent_id       UUID NULL          -- nested menu
slug            TEXT UNIQUE
label_id        TEXT NOT NULL
label_ar        TEXT
icon            TEXT               -- nama lucide icon
path            TEXT               -- route Next.js
display_order   INTEGER
is_active       BOOLEAN DEFAULT true
required_permission TEXT           -- slug permission yg dibutuhkan
[+ base columns]
```

### 2.7 `role_menu_access`
Matrix akses menu per role (admin bisa toggle):
```sql
role_id       UUID
menu_item_id  UUID
can_view      BOOLEAN DEFAULT true
PRIMARY KEY (role_id, menu_item_id)
```

### 2.8 `sessions`
```sql
id           UUID PK
user_id      UUID REFERENCES users(id) ON DELETE CASCADE
token_hash   TEXT UNIQUE NOT NULL  -- hashed session token
ip_address   INET
user_agent   TEXT
expires_at   TIMESTAMPTZ NOT NULL
created_at   TIMESTAMPTZ DEFAULT now()
```

### 2.9 `password_reset_tokens`, `email_verification_tokens`
Standar pattern, token hashed, expires.

### 2.10 `reviewer_profiles`
Profile khusus reviewer (ustadz):
```sql
user_id        UUID PK REFERENCES users(id)
title          TEXT          -- 'Ustadz' | 'Syaikh' | 'Dr.'
bio_id         TEXT
bio_ar         TEXT
specialty      TEXT[]        -- ['rijal', 'sirah_perang', 'tafsir']
institutions   TEXT[]
is_active      BOOLEAN DEFAULT true
invited_by     UUID
invited_at     TIMESTAMPTZ
```

---

## 3. Subscriptions & Billing

### 3.1 `tiers`
```sql
id                UUID PK
slug              TEXT UNIQUE       -- 'free' | 'sampler' | 'basic' | 'pro' | 'premium'
name_id           TEXT
price_monthly_idr INTEGER           -- dalam Rupiah
price_yearly_idr  INTEGER
download_quota    INTEGER           -- per bulan; -1 = unlimited
ai_chat_quota     INTEGER           -- per bulan (messages atau tokens)
content_scope     JSONB             -- akses kategori konten (lihat §6.7 IDEAS)
display_order     INTEGER
is_active         BOOLEAN DEFAULT true
[+ base columns]
```

### 3.2 `subscriptions`
```sql
id              UUID PK
user_id         UUID NOT NULL
tier_id         UUID NOT NULL
status          TEXT NOT NULL       -- 'trial' | 'active' | 'expired' | 'cancelled'
billing_cycle   TEXT                -- 'monthly' | 'yearly'
started_at      TIMESTAMPTZ
expires_at      TIMESTAMPTZ
trial_until     TIMESTAMPTZ
quota_reset_at  TIMESTAMPTZ         -- anniversary date, auto-update tiap reset
auto_renew      BOOLEAN DEFAULT false  -- always false di v1 (manual admin)
activated_by    UUID REFERENCES users(id)  -- admin yang aktifkan
activated_at    TIMESTAMPTZ
notes           TEXT
[+ base columns]
```

### 3.3 `payments`
```sql
id              UUID PK
user_id         UUID
subscription_id UUID
amount_idr      INTEGER
method          TEXT          -- 'manual_transfer' | 'midtrans' | 'xendit'
reference       TEXT          -- nomor transaksi
proof_url       TEXT          -- bukti transfer upload (manual)
status          TEXT          -- 'pending' | 'confirmed' | 'rejected'
confirmed_by    UUID
confirmed_at    TIMESTAMPTZ
[+ base columns]
```

### 3.4 `quota_usage` (Monthly Counter)
```sql
id              UUID PK
user_id         UUID NOT NULL
period_start    DATE NOT NULL       -- anniversary-anchored
period_end      DATE NOT NULL
quota_type      TEXT                -- 'pdf_download' | 'ai_chat' | 'ai_tokens'
limit_value     INTEGER
used_value      INTEGER DEFAULT 0
[+ base columns]
UNIQUE (user_id, period_start, quota_type)
```

Reset job (cron daily): cek subscriptions yang `quota_reset_at <= now()` → buat row baru, reset counter.

---

## 4. Tokoh / Figures (Core Content)

### 4.1 `figure_categories`
```sql
id           UUID PK
slug         TEXT UNIQUE          -- 'nabi' | 'sahabat' | 'tabiin' | 'tabiut_tabiin' | 'shalih_pre_rasul' | 'shalih_pasca_rasul'
name_id      TEXT
name_ar      TEXT
description  TEXT
sort_order   INTEGER
is_active    BOOLEAN
[+ base columns]
```

### 4.2 `figures` (Tabel Utama Tokoh)
```sql
id                  UUID PK
slug                TEXT UNIQUE NOT NULL    -- URL-friendly, mis. 'abu-bakr-as-shiddiq'
category_id         UUID NOT NULL REFERENCES figure_categories(id)
gender              TEXT NOT NULL           -- 'male' | 'female'
name_full_ar        TEXT NOT NULL
name_full_id        TEXT NOT NULL
name_short_ar       TEXT
name_short_id       TEXT
kunyah_ar           TEXT                    -- mis. 'أبو بكر'
kunyah_id           TEXT
laqab_ar            TEXT
laqab_id            TEXT

birth_date_ah       INTEGER
birth_date_ce       INTEGER
birth_date_ah_full  DATE
birth_date_ce_full  DATE
birth_date_precision date_precision_enum
birth_date_notes    TEXT

death_date_ah       INTEGER
death_date_ce       INTEGER
death_date_ah_full  DATE
death_date_ce_full  DATE
death_date_precision date_precision_enum
death_date_notes    TEXT
death_status        TEXT                    -- 'died' (default & only — alive not allowed per §2.0c)
death_cause         TEXT                    -- 'natural' | 'martyr' | 'killed' | 'unknown'

social_category     TEXT[]                  -- ['anshar'] | ['muhajirin'] | ['both']
specialty           TEXT[]                  -- ['hadith', 'fiqh', 'tafsir']
madhab              TEXT                    -- 'shafii' | 'maliki' | 'hanafi' | 'hanbali' | 'no_madhab' | null

rijal_grade         TEXT                    -- enum, lihat §4.4
rijal_notes_ar      TEXT
rijal_notes_id      TEXT

hadith_count_min    INTEGER                 -- range jumlah hadits
hadith_count_max    INTEGER

summary_ar          TEXT                    -- ringkasan singkat
summary_id          TEXT
biography_ar        TEXT                    -- biografi lengkap (markdown)
biography_id        TEXT
biography_pre_wafat_ar TEXT                 -- dakwah sebelum Rasul ﷺ wafat
biography_pre_wafat_id TEXT
biography_post_wafat_ar TEXT                -- dakwah setelah Rasul ﷺ wafat (untuk sahabat)
biography_post_wafat_id TEXT

primary_location_id UUID                    -- tempat tinggal utama / asal
death_location_id   UUID                    -- lokasi wafat
burial_location_id  UUID

status              TEXT NOT NULL DEFAULT 'draft'   -- lihat §7
published_at        TIMESTAMPTZ
[+ base columns]
```

Index:
- `slug` (unique)
- `category_id, gender`
- `death_date_ah` (range filter timeline)
- GIN on `social_category`, `specialty` (array filter)
- FTS index on `name_full_id`, `name_full_ar`, `summary_id`

### 4.3 `date_precision_enum`
```sql
CREATE TYPE date_precision_enum AS ENUM ('year', 'month', 'day', 'approximate', 'range');
```

### 4.4 `rijal_grade_enum`
```sql
CREATE TYPE rijal_grade_enum AS ENUM (
  -- Ta'dil (positif):
  'sahabi_udul',          -- sahabat = otomatis 'udul
  'thiqah_thiqah',
  'thiqah_hafidz',
  'thiqah',
  'saduq',
  'la_basa_bih',
  'shalih_al_hadith',
  -- Jarh (negatif):
  'layyin',
  'daif',
  'matruk',
  'kadhdhab',
  -- Special:
  'not_narrator',         -- bukan perowi (nabi, shalihah, dll)
  'unverified'            -- belum diverifikasi
);
```

### 4.5 `figure_relations` (Guru/Murid/Kerabat)
```sql
id            UUID PK
figure_id     UUID NOT NULL
related_id    UUID NOT NULL
relation_type TEXT NOT NULL  -- 'teacher_of' | 'student_of' | 'father' | 'mother' | 'husband' | 'wife' | 'son' | 'daughter' | 'sibling' | 'companion'
notes_ar      TEXT
notes_id      TEXT
[+ base columns]
UNIQUE (figure_id, related_id, relation_type)
```

### 4.6 `figure_locations` (Histori Tempat Tinggal)
```sql
id              UUID PK
figure_id       UUID
location_id     UUID
role            TEXT          -- 'birthplace' | 'residence' | 'dakwah' | 'martyr' | 'burial'
period_start_ah INTEGER
period_end_ah   INTEGER
notes_ar        TEXT
notes_id        TEXT
[+ base columns]
```

### 4.7 `figure_madhab_links` (Hubungan dengan Mazhab)
Untuk ulama lintas-mazhab atau pendiri.

---

## 5. Locations & Geospatial

### 5.1 `locations`
```sql
id                  UUID PK
slug                TEXT UNIQUE
name_ar             TEXT NOT NULL
name_id             TEXT NOT NULL
modern_name         TEXT          -- nama kota modern
country_code        TEXT          -- ISO 3166
region              TEXT          -- 'hijaz' | 'iraq' | 'sham' | 'misr' | dll
coordinates         GEOGRAPHY(POINT, 4326)  -- PostGIS
elevation_meters    INTEGER
description_ar      TEXT
description_id      TEXT
historical_period   TEXT[]        -- ['jahiliyyah', 'khulafa_rasyidin', 'umayyad']
[+ base columns]
```

Index: `GIST (coordinates)` untuk query peta cepat.

### 5.2 `location_aliases`
Nama alternatif (Mekkah / Makkah / Bakkah / Ummu al-Qura).

---

## 6. Battles & Events (Sirah Perang)

### 6.1 `battles`
```sql
id              UUID PK
slug            TEXT UNIQUE
name_ar         TEXT NOT NULL
name_id         TEXT NOT NULL
type            TEXT          -- 'ghazwah' (dihadiri Nabi) | 'sariyyah' | 'futuhat'
date_ah         INTEGER
date_ce         INTEGER
date_full_ah    DATE
location_id     UUID
commander_id    UUID          -- panglima Muslim
opponent_force  TEXT          -- 'Quraisy' | 'Romawi' | 'Persia' | dll
muslim_count    INTEGER
opponent_count  INTEGER
outcome         TEXT          -- 'victory' | 'defeat' | 'truce' | 'partial'
casualties_muslim INTEGER
casualties_opponent INTEGER
strategy_ar     TEXT
strategy_id     TEXT
narrative_ar    TEXT
narrative_id    TEXT
significance_ar TEXT
significance_id TEXT
status          TEXT DEFAULT 'draft'
[+ base columns]
```

### 6.2 `battle_phases`
Fase pertempuran (untuk timeline & peta perang detail):
```sql
id          UUID PK
battle_id   UUID
phase_order INTEGER
title_ar    TEXT
title_id    TEXT
description_ar TEXT
description_id TEXT
phase_location_id UUID    -- lokasi spesifik fase ini
[+ base columns]
```

### 6.3 `battle_participants`
```sql
battle_id   UUID
figure_id   UUID
role        TEXT       -- 'commander' | 'sahabat' | 'fallen' | 'captured'
notes_ar    TEXT
notes_id    TEXT
PRIMARY KEY (battle_id, figure_id)
```

### 6.4 `battle_locations` (Multi-lokasi per battle)
Beberapa perang punya multi lokasi (mis. Khaibar terdiri dari beberapa benteng).

---

## 7. Content Workflow & Citations

### 7.1 `content_status_enum`
```sql
CREATE TYPE content_status_enum AS ENUM (
  'draft',
  'under_review',
  'needs_edit',
  'approved',
  'published',
  'unpublished',
  'archived'
);
```

Status ini berlaku untuk: `figures.status`, `battles.status`, dan tabel konten lain.

### 7.2 `citations`
Setiap fact di konten **wajib** punya citation:
```sql
id              UUID PK
content_type    TEXT NOT NULL     -- 'figure' | 'battle' | 'location'
content_id      UUID NOT NULL
field_path      TEXT              -- 'biography_ar' | 'death_date_ah' | dst
source_url      TEXT NOT NULL
source_domain   TEXT              -- 'islamqa.info' | 'dorar.net'
source_excerpt_ar TEXT
source_excerpt_id TEXT
source_lang     TEXT              -- 'ar' | 'id' | 'en'
extracted_at    TIMESTAMPTZ
model_used      TEXT              -- mis. 'deepseek-v4-flash'
confidence_score NUMERIC(3,2)
[+ base columns]
```

Index: `(content_type, content_id)` untuk query semua citation per konten.

### 7.3 `whitelist_domains`
Daftar website salaf yang boleh di-crawl:
```sql
id              UUID PK
domain          TEXT UNIQUE NOT NULL
display_name    TEXT
primary_language TEXT           -- 'ar' | 'id' | 'en'
description     TEXT
is_active       BOOLEAN DEFAULT true
priority        INTEGER          -- urutan prefer saat search
crawl_rate_per_minute INTEGER DEFAULT 30
[+ base columns]
```

Seed: islamqa.info, dorar.net, islamweb.net, shamela.ws, sunnah.com, alukah.net.

### 7.4 `content_revisions` (Immutable Log)
```sql
id              UUID PK
content_type    TEXT NOT NULL
content_id      UUID NOT NULL
revision_number INTEGER NOT NULL
diff            JSONB             -- struktur diff per field
action          TEXT NOT NULL     -- 'created' | 'edited_ai' | 'edited_manual' | 'approved' | 'rejected' | 'published' | 'unpublished'
actor_id        UUID
actor_role      TEXT
notes           TEXT
ai_instruction  TEXT              -- catatan ustadz ke AI
ai_model_used   TEXT
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE (content_type, content_id, revision_number)
```

### 7.5 `review_assignments`
```sql
id              UUID PK
content_type    TEXT
content_id      UUID
reviewer_id     UUID NOT NULL
assigned_by     UUID
assigned_at     TIMESTAMPTZ
status          TEXT          -- 'pending' | 'in_progress' | 'completed'
decision        TEXT          -- 'approve' | 'request_edit' | 'reject'
decision_at     TIMESTAMPTZ
decision_notes  TEXT
[+ base columns]
```

### 7.6 `content_citation_embeddings` (RAG)
```sql
id              UUID PK
citation_id     UUID
embedding       VECTOR(1536)      -- pgvector
model           TEXT              -- 'openai-text-embedding-3-large' | dst
created_at      TIMESTAMPTZ
```

Index: `ivfflat` / `hnsw` untuk pencarian similar.

---

## 8. AI Providers & Models

### 8.1 `ai_providers`
```sql
id              UUID PK
slug            TEXT UNIQUE
name            TEXT NOT NULL
sdk_adapter     TEXT          -- 'openai-compatible' | 'anthropic' | 'google' | 'deepseek' | 'custom'
base_url        TEXT
api_key_encrypted TEXT        -- encrypted with AI_MASTER_KEY
is_active       BOOLEAN DEFAULT true
notes           TEXT
[+ base columns]
```

### 8.2 `ai_models`
```sql
id                  UUID PK
provider_id         UUID
model_id            TEXT NOT NULL   -- string yang dipakai ke API
display_name        TEXT
capabilities        TEXT[]          -- ['chat', 'agent', 'doc_analyzer', 'embedding', 'vision', 'avatar']
context_window      INTEGER
max_output_tokens   INTEGER
supports_streaming  BOOLEAN
supports_tools      BOOLEAN
supports_vision     BOOLEAN
input_price_per_1m  NUMERIC(10,4)   -- harga per 1M input tokens (USD)
output_price_per_1m NUMERIC(10,4)
cached_price_per_1m NUMERIC(10,4)
release_date        DATE
deprecated_at       DATE
is_active           BOOLEAN DEFAULT true
notes               TEXT
[+ base columns]
UNIQUE (provider_id, model_id)
```

### 8.3 `ai_role_assignments`
Hanya 1 model aktif per role:
```sql
id              UUID PK
role            TEXT NOT NULL    -- 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'
model_id        UUID NOT NULL
activated_at    TIMESTAMPTZ
activated_by    UUID
[+ base columns]
UNIQUE (role) WHERE deleted_at IS NULL
```

### 8.4 `ai_credit_packages`
Definisi paket credit (untuk admin set conversion rate):
```sql
id              UUID PK
slug            TEXT UNIQUE
name            TEXT
credits_per_1k_input_tokens   NUMERIC
credits_per_1k_output_tokens  NUMERIC
credits_per_image_generated   NUMERIC
[+ base columns]
```

### 8.5 `ai_usage_logs`
Setiap call AI tercatat:
```sql
id              UUID PK
user_id         UUID
session_id      UUID
role            TEXT          -- 'chat' | 'agent' | dst
provider_id     UUID
model_id        UUID
request_type    TEXT          -- 'completion' | 'embedding' | 'image'
context_summary TEXT          -- "AI Chat: Tanya tentang Abu Bakr"
input_tokens    INTEGER
output_tokens   INTEGER
cached_tokens   INTEGER
credits_used    NUMERIC
duration_ms     INTEGER
status          TEXT          -- 'success' | 'error' | 'timeout'
error_message   TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

Index: `(user_id, created_at DESC)`, `(model_id, created_at DESC)`.

### 8.6 `ai_usage_monthly_summary` (View / Materialized)
Agregat untuk performa dashboard:
```sql
CREATE MATERIALIZED VIEW ai_usage_monthly_summary AS
SELECT
  user_id,
  date_trunc('month', created_at) AS period,
  role,
  SUM(credits_used) AS total_credits,
  SUM(input_tokens) AS total_input,
  SUM(output_tokens) AS total_output,
  COUNT(*) AS total_calls
FROM ai_usage_logs
GROUP BY user_id, period, role;
```

Refresh: cron tiap 1 jam.

### 8.7 Seed Data — AI Providers & Models per Mei 2026 (VERIFIED via web)

> ✅ **Diverifikasi via web search 13 Mei 2026** dari rilis resmi/dokumentasi provider.
> Sumber lengkap di `docs/REFERENCES.md` §AI Providers.

#### Anthropic (Claude 4.x family)
| Model ID | Display | Rilis | Konteks | Vision | Catatan |
|---|---|---|---|---|---|
| `claude-opus-4-7` | Claude Opus 4.7 | 16 Apr 2026 | 200K (+1M variant) | ✅ (3.75 MP) | Most capable; jump besar di agentic coding |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | Feb 2026 | 200K | ✅ | Pertama kali Sonnet > Opus generasi sebelumnya di coding |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 | Okt 2025 | 200K | ✅ | Lightweight |

> ❌ *Claude Mythos Preview* — restricted via "Project Glasswing", **tidak** tersedia untuk produk umum. Tidak di-seed.

#### OpenAI
| Model ID | Display | Rilis | Catatan |
|---|---|---|---|
| `gpt-5.5-instant` / `chat-latest` | GPT-5.5 Instant | 5 Mei 2026 | **NEW default ChatGPT**, -52.5% halusinasi di domain sensitif (hukum, medis, finansial) |
| `gpt-5` | GPT-5 | Aug 2025 | flagship sebelumnya |
| `gpt-5.3-instant` | GPT-5.3 Instant | 2025-Q4 | predecessor GPT-5.5, deprecated tapi masih tersedia |
| `text-embedding-3-large` | Embedding | 2024 | untuk RAG |

#### Google (Gemini)
| Model ID | Display | Rilis | Catatan |
|---|---|---|---|
| `gemini-3.1-pro` | Gemini 3.1 Pro | 19 Feb 2026 | flagship, agentic coding kuat |
| `gemini-3.1-flash` | Gemini 3.1 Flash | Q1 2026 | mid-tier |
| `gemini-3.1-flash-lite` | Gemini 3.1 Flash Lite | 3 Mar 2026 | cost-efficient |
| `gemini-3.1-flash-tts-preview` | Gemini 3.1 Flash TTS | Apr 2026 | text-to-speech |

> ❌ `gemini-3-pro-preview` deprecated 9 Mar 2026 — jangan seed.

#### DeepSeek (DEFAULT untuk Chat & Agent)
| Model ID | Display | Rilis | Konteks | Catatan |
|---|---|---|---|---|
| `deepseek-v4-pro` | DeepSeek V4 Pro | 24 Apr 2026 | 1M tokens | 1.6T total, 49B activated MoE |
| `deepseek-v4-flash` | DeepSeek V4 Flash | 24 Apr 2026 | 1M tokens | **DEFAULT** — 284B total, 13B activated MoE |
| `deepseek-v4-pro-max` | DeepSeek V4 Pro Max | 24 Apr 2026 | 1M tokens | reasoning effort mode |

> ❌ DeepSeek R2 → **belum** dirilis resmi per 7 Mei 2026. Jangan seed sebagai aktif.

#### xAI (Grok)
| Model ID | Display | Rilis | Catatan |
|---|---|---|---|
| `grok-4.3-beta` | Grok 4.3 Beta | 17 Apr 2026 | full rollout mid-late Mei 2026; SuperGrok Heavy first |
| `grok-4.20` | Grok 4.20 | 2026 | 2M context, 16-agent Heavy system |
| `grok-3` | Grok 3 | Feb 2025 | GA via API |
| `grok-imagine-quality` | Grok Imagine Quality | 2026 | image gen/edit |

#### Meta (Llama 4 series)
| Model ID | Display | Rilis | Catatan |
|---|---|---|---|
| `llama-4-scout` | Llama 4 Scout | 5 Apr 2025 | 17B active / 16 experts, **10M context** |
| `llama-4-maverick` | Llama 4 Maverick | 5 Apr 2025 | 17B active / 128 experts, multimodal |
| `muse-spark` | Muse Spark | 8 Apr 2026 | **CLOSED-weight** Meta SuperLabs, hanya via meta.ai (tidak ada API publik) |

> Catatan: Muse Spark **tidak** bisa di-self-host/API → jangan seed sebagai provider integration kecuali ada API resmi.

#### Mistral
| Model ID | Display | Rilis | Catatan |
|---|---|---|---|
| `mistral-large-3` | Mistral Large 3 | Dec 2025 | 675B total / 41B active, Apache 2.0 |
| `mistral-small-4` | Mistral Small 4 | 16 Mar 2026 | unifies Magistral (reasoning) + Pixtral (vision) + Devstral (coding) |
| `ministral-3-14b` | Ministral 3 14B | 2025 | dense, Apache 2.0 |
| `ministral-3-8b` | Ministral 3 8B | 2025 | dense |
| `ministral-3-3b` | Ministral 3 3B | 2025 | edge |
| `voxtral-tts` | Voxtral TTS | 23 Mar 2026 | audio, 9 bahasa termasuk Arab |

#### Alibaba (Qwen)
| Model ID | Display | Rilis | Catatan |
|---|---|---|---|
| `qwen3.5-397b-a17b` | Qwen3.5 397B MoE | 16 Feb 2026 | flagship MoE |
| `qwen3.5-122b-a10b` | Qwen3.5 122B | 24 Feb 2026 | MoE |
| `qwen3.5-35b-a3b` | Qwen3.5 35B | 24 Feb 2026 | MoE |
| `qwen3.5-27b` | Qwen3.5 27B | 24 Feb 2026 | dense |
| `qwen3.5-omni` | Qwen3.5 Omni | Apr 2026 | multimodal native |
| `qwen3.6-max-preview` | Qwen3.6 Max Preview | 2026 | most powerful |
| `qwen3.6-plus` | Qwen3.6 Plus | Apr 2026 | proprietary |
| `qwen3.6-27b` | Qwen3.6 27B | 22 Apr 2026 | dense open-weight, top di agentic coding 27B class |

> Mendukung 201 bahasa termasuk Arab native.

#### Embeddings
| Model ID | Display | Provider |
|---|---|---|
| `text-embedding-3-large` | Embedding 3 Large | OpenAI |
| `voyage-3-large` | Voyage 3 Large | Voyage AI (perlu cek availability) |
| `bge-multilingual-gemma2` | BGE Multilingual | open-source |

#### Default Seed `ai_role_assignments`
| Role | Model | Alasan |
|---|---|---|
| `chat` | `deepseek-v4-flash` | Per user instruction — 1M context, MoE efisien, harga rendah |
| `agent` | `deepseek-v4-flash` | Same — deep research butuh context panjang |
| `doc_analyzer` | `claude-sonnet-4-6` | Arab klasik & long-form parsing kuat |
| `embedding` | `text-embedding-3-large` | Standar industri, kualitas multibahasa baik |
| `avatar` | null | TBD — kemungkinan tidak dipakai (no figure generation per adab) |

**Catatan kebijakan model:**
- Provider yang **tidak punya API publik** (Muse Spark, Claude Mythos) → tidak di-seed.
- Provider yang **preview/beta** (Grok 4.3 Beta, Qwen3.6 Max Preview) → di-seed tapi `is_active = false` sampai admin enable.
- Saat ada release model baru, admin **add via UI** (§3b style) — tidak perlu deploy.

---

## 9. Fonts (Admin Configurable)

### 9.1 `fonts`
```sql
id              UUID PK
name            TEXT NOT NULL
family          TEXT NOT NULL
script          TEXT NOT NULL       -- 'latin' | 'arabic' | 'mono' | 'both'
source          TEXT NOT NULL       -- 'google_fonts' | 'custom_url' | 'uploaded'
google_family_name TEXT
custom_url      TEXT
file_paths      JSONB               -- per weight/style
weights         INTEGER[]
styles          TEXT[]
unicode_range   TEXT
preview_text_ar TEXT
preview_text_id TEXT
license         TEXT
is_active       BOOLEAN DEFAULT false
[+ base columns]
```

### 9.2 `font_role_enum`
```sql
CREATE TYPE font_role_enum AS ENUM (
  'display_latin', 'body_latin',
  'display_arab', 'section_arab', 'body_arab', 'quran_arab',
  'mono'
);
```

### 9.3 `font_assignments`
```sql
id              UUID PK
role            font_role_enum NOT NULL
font_id         UUID NOT NULL
activated_at    TIMESTAMPTZ
activated_by    UUID
[+ base columns]
UNIQUE (role) WHERE deleted_at IS NULL
```

### 9.4 `font_assignment_history`
Otomatis di-insert tiap perubahan font_assignments.

### 9.5 Seed Default
Lihat IDEAS §3b.3 — pre-seeded: Playfair Display, Inter, Amiri, Reem Kufi, Cairo, JetBrains Mono + 9 font alternatif inactive.

---

## 10. PDF Export Jobs

### 10.1 `pdf_jobs`
```sql
id              UUID PK
user_id         UUID
job_type        TEXT          -- 'single' | 'multi' | 'category'
figure_ids      UUID[]        -- list tokoh yang dipilih
template_slug   TEXT          -- 'classic' | 'modern' | 'calligraphy' | 'minimal'
paper_size      TEXT          -- 'a5' | 'a4' | 'letter' | 'legal'
orientation     TEXT          -- 'portrait' | 'landscape'
language_mode   TEXT          -- 'id' | 'ar' | 'both'
title_ar        TEXT
title_id        TEXT
author_name     TEXT
author_email    TEXT
include_illustrations BOOLEAN
include_maps    BOOLEAN
include_timeline BOOLEAN
status          TEXT          -- 'queued' | 'processing' | 'done' | 'failed'
file_url        TEXT
file_size_bytes INTEGER
generated_at    TIMESTAMPTZ
error_message   TEXT
[+ base columns]
```

### 10.2 `pdf_templates`
```sql
id              UUID PK
slug            TEXT UNIQUE
name_id         TEXT
name_ar         TEXT
preview_image_url TEXT
template_path   TEXT          -- path ke HTML template
supports_orientation TEXT[]
is_active       BOOLEAN
[+ base columns]
```

---

## 11. Quiz Module

### 11.1 `quizzes`
```sql
id              UUID PK
slug            TEXT UNIQUE
title_ar        TEXT
title_id        TEXT
description_ar  TEXT
description_id  TEXT
category        TEXT          -- 'sahabat' | 'sirah_perang' | 'rijal' | dst
difficulty      TEXT          -- 'easy' | 'medium' | 'hard'
duration_seconds INTEGER
is_active       BOOLEAN
[+ base columns]
```

### 11.2 `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`
Pola standar quiz.

---

## 12. Notifications

### 12.1 `notifications`
```sql
id              UUID PK
user_id         UUID
type            TEXT          -- 'subscription_expiring' | 'pdf_ready' | 'review_assigned' | 'content_approved'
title           TEXT
body            TEXT
action_url      TEXT
is_read         BOOLEAN DEFAULT false
read_at         TIMESTAMPTZ
[+ base columns]
```

---

## 13. Audit Log (Global)

### 13.1 `audit_logs`
```sql
id              UUID PK
actor_id        UUID
actor_role      TEXT
action          TEXT          -- 'create' | 'update' | 'delete' | 'restore' | 'hard_delete' | 'login' | 'role_change'
resource_type   TEXT
resource_id     UUID
diff            JSONB
ip_address      INET
user_agent      TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

Index: `(actor_id, created_at DESC)`, `(resource_type, resource_id)`.

---

## 14. Diagram Relasi (ERD Text)

```
users ─┬─< user_roles >── roles ──< role_permissions >── permissions
       │                       └──< role_menu_access >── menu_items
       ├─< sessions
       ├─< subscriptions >── tiers
       ├─< payments
       ├─< quota_usage
       ├─< ai_usage_logs >── ai_models >── ai_providers
       ├─< pdf_jobs
       ├─< notifications
       ├─< review_assignments ──> figures (or battles)
       └─< audit_logs

figure_categories ──< figures ─┬─< figure_relations
                               ├─< figure_locations ─> locations (PostGIS)
                               ├─< citations >── whitelist_domains
                               ├─< content_revisions
                               └─< review_assignments

battles ─┬─< battle_phases ──> locations
         ├─< battle_participants ──> figures
         └─< battle_locations ──> locations

fonts ─< font_assignments
      ─< font_assignment_history

ai_providers ─< ai_models ─< ai_role_assignments
                          ─< ai_usage_logs
```

---

## 15. Indexes Penting

```sql
-- Soft delete partial indexes (HUGE win)
CREATE INDEX idx_figures_active ON figures (id) WHERE deleted_at IS NULL;
CREATE INDEX idx_figures_category_active ON figures (category_id, gender) WHERE deleted_at IS NULL;

-- Search & filter
CREATE INDEX idx_figures_slug ON figures (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_figures_death_ah ON figures (death_date_ah) WHERE deleted_at IS NULL;
CREATE INDEX idx_figures_specialty ON figures USING GIN (specialty);
CREATE INDEX idx_figures_social ON figures USING GIN (social_category);

-- FTS bilingual
CREATE INDEX idx_figures_fts_id ON figures USING GIN (to_tsvector('indonesian', name_full_id || ' ' || coalesce(summary_id,'')));
CREATE INDEX idx_figures_fts_ar ON figures USING GIN (to_tsvector('arabic', name_full_ar || ' ' || coalesce(summary_ar,'')));

-- Geospatial
CREATE INDEX idx_locations_coords ON locations USING GIST (coordinates);

-- Vector
CREATE INDEX idx_citations_embedding ON content_citation_embeddings USING hnsw (embedding vector_cosine_ops);

-- AI usage
CREATE INDEX idx_ai_usage_user_period ON ai_usage_logs (user_id, created_at DESC);
```

---

## 16. Constraints & Triggers

### 16.1 Update `updated_at` Otomatis
Trigger di tiap tabel: `BEFORE UPDATE → SET updated_at = now()`.

### 16.2 Soft Delete Cascade Logic
Soft delete tidak boleh CASCADE delete pakai SQL FK. Handle di **service layer**:
- Delete parent → cascade soft-delete dependents (manual loop).
- Restore parent → opsi: restore dependents juga (admin pilih).

### 16.3 Unique per Aktif
```sql
-- 1 font per role aktif
CREATE UNIQUE INDEX font_role_unique_active
  ON font_assignments (role) WHERE deleted_at IS NULL;

-- 1 model per AI role aktif
CREATE UNIQUE INDEX ai_role_unique_active
  ON ai_role_assignments (role) WHERE deleted_at IS NULL;
```

### 16.4 Check Constraints
```sql
ALTER TABLE figures ADD CONSTRAINT chk_gender CHECK (gender IN ('male', 'female'));
ALTER TABLE figures ADD CONSTRAINT chk_death_required CHECK (death_status IS NOT NULL);
```

---

## 17. Seeders (Wajib, No Hardcoded Dummy)

Semua data initial **WAJIB** via seeders, tidak boleh hardcoded di kode:

1. **`seeders/001_roles.ts`** — admin, reviewer, subscriber
2. **`seeders/002_permissions.ts`** — semua permission slug
3. **`seeders/003_role_permissions.ts`** — matrix awal
4. **`seeders/004_menu_items.ts`** — definisi menu
5. **`seeders/005_role_menu_access.ts`** — matrix akses menu
6. **`seeders/006_tiers.ts`** — Free, Sampler, Basic, Pro, Premium
7. **`seeders/007_figure_categories.ts`** — Nabi, Sahabat, dst
8. **`seeders/008_ai_providers.ts`** — providers Mei 2026
9. **`seeders/009_ai_models.ts`** — model list per provider
10. **`seeders/010_ai_role_assignments.ts`** — DeepSeek V4 Flash default
11. **`seeders/011_fonts.ts`** — 15+ font default
12. **`seeders/012_font_assignments.ts`** — sesuai BRANDING.md
13. **`seeders/013_whitelist_domains.ts`** — islamqa, dorar, dll
14. **`seeders/014_pdf_templates.ts`** — 4 template
15. **`seeders/015_locations_core.ts`** — Mekkah, Madinah, Yerusalem, dll (~50 lokasi inti)
16. **`seeders/016_admin_user.ts`** — admin awal (email/password dari env)
17. **`seeders/017_demo_figures.ts`** — **HANYA bila NODE_ENV=development** — beberapa tokoh untuk dev

Command:
```
pnpm db:migrate
pnpm db:seed              # production seeders (1–16)
pnpm db:seed:dev          # + demo data (17)
pnpm db:reset             # drop all + migrate + seed (dev only)
```

**Tidak ada `INSERT` di file migration**, kecuali untuk ENUM type creation. Semua data via seeders.

---

## 18. Migrations

- Tools: Drizzle Kit (`drizzle-kit generate` & `drizzle-kit migrate`).
- File naming: `0001_create_users.sql`, `0002_create_figures.sql`, dst.
- Tiap migration **idempotent** dan **reversible** (sediakan down migration).
- Migration di-run otomatis post-deploy via Coolify hook.

---

## 19. Backup & Disaster Recovery

- **Daily pg_dump** ke MinIO/R2 (cron, retention 30 hari).
- **WAL streaming** ke standby (opsional v2).
- **Weekly full dump** dengan retention 1 tahun.
- Test restore tiap kuartal.
