# Sirah App — Catatan Ide

> Dokumen ini adalah brain dump ide awal. Belum arsitektur final.
> Akan dilanjutkan brainstorming arsitektur setelah ide dilengkapi.

---

## 1. Visi Aplikasi

Aplikasi untuk **membandingkan timeline** para sahabat Nabi ﷺ, tabi'in, dan tabi'ut tabi'in dengan masa Rasulullah ﷺ. Tujuan utamanya membuat pengguna benar-benar paham geografi, kronologi, dan hubungan antar tokoh dalam sirah — bukan sekadar baca biografi terpisah.

Fokus: **visual, komparatif, dan berbasis sumber yang bisa diverifikasi.**

---

## 2. Fitur Utama

### 2.0 Cakupan Tokoh (Figure Scope)

App mencakup **5 kategori tokoh utama**, semua dengan biografi + timeline + lokasi peta:

| # | Kategori | Sub-kategori | Catatan |
|---|---|---|---|
| 1 | **Para Nabi & Rasul** | 25 nabi wajib + lainnya yang shahih disebut | Lihat §2.0a |
| 2 | **Sahabat** | Sahabat (ﻟ) / **Shahabiyat** (ﻦ) | Anshar / Muhajirin / dll |
| 3 | **Tabi'in** | Tabi'in (ﻟ) / **Tabi'iyyat** (ﻦ) | Murid sahabat |
| 4 | **Tabi'ut Tabi'in** | Tabi'ut Tabi'in (ﻟ) / **Tabi'at Tabi'iyyat** (ﻦ) | Murid tabi'in |
| 5 | **Orang Shalih & Shalihah** | Pre-Rasul ﷺ / Pasca-Rasul ﷺ (s.d. 2026) | Lihat §2.0b |

Legend: ﻟ = laki-laki, ﻦ = perempuan.

#### Menu Navigasi (Gender Dipisah)
Setiap kategori dengan dimensi gender ditampilkan sebagai **dua menu terpisah**:

```
NAVIGASI
├── Para Nabi & Rasul
├── Sahabat
│   ├── Sahabat (Laki-laki)         ← Ash-Shahabah
│   └── Shahabiyat (Perempuan)
├── Tabi'in
│   ├── Tabi'in (Laki-laki)
│   └── Tabi'iyyat (Perempuan)
├── Tabi'ut Tabi'in
│   ├── Tabi'ut Tabi'in (Laki-laki)
│   └── Tabi'at Tabi'iyyat (Perempuan)
└── Shalih & Shalihah
    ├── Pre-Rasul ﷺ (sebelum kenabian Muhammad)
    └── Pasca-Rasul ﷺ (setelah Rasul wafat → 2026)
        ├── Shalih (Laki-laki)
        └── Shalihah (Perempuan)
```

**Filter "Tampilkan Semua"** tetap ada di tiap kategori (gabung laki & perempuan) sebagai opsi.

### 2.0a Para Nabi & Rasul
- **25 nabi wajib diketahui** (Adam → Muhammad ﷺ) sebagai daftar inti.
- Tokoh lain yang disebut dalam Quran/hadits shahih sebagai nabi (mis. Yusya', Syits) — bisa ditambah dengan catatan tingkat keyakinan.
- **Data per nabi**:
  - Nama Arab + transliterasi + nama umat sasaran.
  - Tahun (estimasi, dengan catatan `precision: approximate`).
  - Lokasi dakwah (di peta).
  - Mu'jizat utama.
  - Kaum / umat.
  - Ringkasan kisah (sumber: Quran + tafsir muktabar + Qashash al-Anbiya).
  - Hubungan nasab antar nabi (Adam → ... → Ibrahim → Ismail/Ishaq → ...).
- **Peta khusus nabi**: jalur dakwah, lokasi mu'jizat (Bahtera Nuh, Sinai Musa, dll).
- **Timeline khusus**: skala lebih besar (ribuan tahun), pakai Masehi estimatif. Catatan: jarak antar nabi awal sangat estimasi → flag transparan.

### 2.0b Orang Shalih & Shalihah
Dua sub-kategori berdasarkan masa:

**1. Pre-Rasul ﷺ (Sebelum Kenabian Muhammad)**
Tokoh shalih/shalihah yang disebut Quran atau hadits shahih, di luar nabi:
- Maryam binti Imran (ibu Nabi Isa) — shalihah.
- Asiyah binti Muzahim (istri Fir'aun) — shalihah.
- Luqman al-Hakim — shalih (bukan nabi menurut jumhur).
- Ashabul Kahfi (7 pemuda) — shalih.
- Habil — shalih.
- Khidir → kategorisasi diperdebatkan (nabi vs shalih) → di-flag transparan di tampilannya.
- Dll, sesuai sumber shahih.

**2. Pasca-Rasul ﷺ (Setelah Rasul wafat → 2026)**
Orang shalih & shalihah dari **luar** klasifikasi generasi (sahabat / tabi'in / tabi'ut tabi'in):
- Para imam ulama besar **setelah generasi tabi'ut tabi'in** hingga ulama modern.
- Contoh tokoh laki-laki:
  - Imam Nawawi (rahimahullah, w. 676 H).
  - Syaikhul Islam Ibnu Taimiyyah (w. 728 H).
  - Ibnul Qayyim (w. 751 H).
  - Adz-Dzahabi (w. 748 H).
  - Ibnu Hajar al-Asqalani (w. 852 H).
  - Imam As-Suyuthi (w. 911 H).
  - Muhammad bin Abdul Wahhab (w. 1206 H).
  - Syaikh Bin Baz (w. 1420 H / 1999 M).
  - Syaikh Al-Albani (w. 1420 H / 1999 M).
  - Syaikh Utsaimin (w. 1421 H / 2001 M).
  - Dll, hingga ulama modern yang sudah wafat.
- Contoh tokoh perempuan:
  - Aisyah binti Yusuf al-Bauniyyah (penulis & sufi syari'i, w. 922 H).
  - Sayyidah Nafisah (ulama hadits, w. 208 H — tapi periode beliau tabi'iyyat lebih tepat).
  - Para istri & putri ulama yang dikenal keilmuannya.
  - Dll.

**Catatan kategori:**
- Tokoh seperti **Imam Bukhari, Muslim, Ahmad** → tetap di kategori **Tabi'ut Tabi'in**, bukan di sini (mereka generasi itu).
- Kategori "Pasca-Rasul" bukan bagian dari *salaf shalih* secara generasi murni — disclaimer ditampilkan di header kategori agar tidak salah paham.
- **Tokoh yang masih hidup**: lihat §2.0c.

### 2.0c Aturan Tokoh yang Masih Hidup

Karena scope mencakup hingga **2026**, ada kemungkinan tokoh yang masih hidup terbawa dalam pertimbangan.

**Default app: HANYA tokoh yang sudah wafat.**

Alasan:
- **Adab**: pujian kepada orang yang masih hidup berisiko (manusia bisa berubah).
- **Akurasi**: biografi belum final selama orangnya masih hidup.
- **Konten review**: ustadz lebih berat menilai tokoh kontemporer karena masih hidup.
- **Sumber**: kitab rijal & tarjamah biasanya hanya cover yang sudah wafat.

**Kemungkinan exception** (perlu konsensus ustadz):
- Untuk tokoh modern yang sudah lama wafat (mis. sebelum 2010), aman dimasukkan.
- Untuk tokoh wafat baru-baru ini (mis. < 5 tahun), tetap masuk dengan badge "Wafat baru".

**TIDAK** termasuk: ulama kontemporer yang masih hidup, da'i populer masa kini, dll.

### 2.0d Timeline Khusus Ulama Salaf (Plus)

View timeline khusus yang **menggabungkan beberapa generasi** dalam satu sumbu waktu — fokus pada **jalur keilmuan**:

```
Sumbu waktu (Hijriyah & Masehi):

  1 H ────────── 200 H ────────── 500 H ────────── 1000 H ──── 1450 H (2026)
  │                │                 │                 │            │
  Sahabat         Tabi'in          Imam-imam         Ibn Taimiyyah  Albani
  Tabi'in awal    Tabi'ut Tabi'in  besar             Ibnul Qayyim   Bin Baz
                  Bukhari/Muslim   Nawawi            Dzahabi        Utsaimin
                  Ahmad            Ibnu Hajar
```

Fitur:
- **Filter spesialisasi**: hadits / fiqh / aqidah / tafsir / lughah.
- **Filter genealogi keilmuan**: tampilkan hanya guru-murid chain (mis. "siapa muridnya Imam Ahmad, siapa muridnya muridnya...").
- **Filter mazhab**: Syafi'i / Maliki / Hanafi / Hanbali / non-mazhab.
- **Filter wilayah**: ulama Hijaz / Iraq / Syam / Mesir / Andalusia / Indonesia, dll.
- Hover marker → mini-card biografi.
- Klik marker → buka halaman biografi lengkap.

Tujuan: pengguna paham **silsilah keilmuan Islam** dari masa sahabat hingga masa modern dalam satu peta visual.

### 2.1 Timeline Komparatif
- Bandingkan **timeline tahun** beberapa tokoh sekaligus (misal tokoh A, B, C vs Nabi ﷺ).
- Sumbu waktu menampilkan: kelahiran, masuk Islam, peristiwa penting, wafat.
- Bisa overlay dengan timeline Nabi ﷺ sebagai baseline.
- **Dropdown lazy-load** bertingkat:
  - Pilih sahabat → muncul daftar tabi'in **yang hidup setelah sahabat fulan wafat**.
  - Pilih tabi'in → muncul daftar tabi'ut tabi'in setelahnya.

### 2.1b Calendar Mode — Hijriyah & Masehi

Timeline (dan semua tampilan tanggal di app) punya **dua mode kalender** yang bisa di-toggle user:

#### Mode
1. **Hijriyah (H)** — kalender Islam (lunar), default untuk audiens utama.
2. **Masehi (M)** — kalender Gregorian, untuk konteks akademik & komparasi sejarah dunia.
3. **Keduanya** — tampilkan side-by-side: `11 H / 632 M`.

#### Toggle
- **Global preference** di user settings → default tampilan di semua halaman (biografi, peta, perang, timeline).
- **Per-timeline override** → tombol kecil di pojok timeline untuk switch on-the-fly tanpa ubah preference global.
- 3 pilihan: `H` / `M` / `H & M`.

#### Penyimpanan Data
- Tiap entitas tanggal di database **menyimpan keduanya**:
  ```
  date_ah    INT       // tahun Hijriyah (bisa negatif untuk pre-Hijra)
  date_ce    INT       // tahun Masehi
  date_ah_full DATE    // bila ada bulan & tanggal AH
  date_ce_full DATE    // bila ada bulan & tanggal CE
  date_precision ENUM  // 'year' | 'month' | 'day' | 'approximate'
  date_notes TEXT      // 'sekitar', 'antara', 'menurut riwayat A vs B'
  ```
- Source-of-truth tahun → **Hijriyah** (sumber sirah pakai H), Masehi di-derive via converter.
- Untuk pre-Hijra (sebelum 622 M / 1 H), pakai notasi **SH (Sebelum Hijrah)** atau **BH (Before Hijra)**.

#### Konversi
- Pakai library kalender terpercaya — bukan rumus manual.
- Kandidat: `hijri-js`, `moment-hijri`, atau backend Python `hijri-converter`.
- **Catatan**: konversi tidak selalu pasti karena perbedaan rukyat & hisab. Untuk peristiwa historis, sering ada **rentang ±1 tahun** — di-flag dengan `date_precision: 'approximate'`.

#### Format Tampilan
```
Mode H:         3 Rabi'ul Awwal 11 H
Mode M:         8 Juni 632 M
Mode H & M:     3 Rabi'ul Awwal 11 H / 8 Juni 632 M
Tahun saja:     11 H  |  632 M  |  11 H (632 M)
Approximate:    ~50 H  |  sekitar 670 M
Pre-Hijra:      40 SH  |  584 M
```

#### Bulan Hijriyah (Konsisten)
Selalu pakai transliterasi standar (jangan campur Arab dan Indonesia):
> Muharram, Safar, Rabi'ul Awwal, Rabi'ul Akhir, Jumadil Awwal, Jumadil Akhir, Rajab, Sya'ban, Ramadhan, Syawwal, Dzulqa'dah, Dzulhijjah

#### Timeline Visual
- Sumbu utama timeline bisa pakai **H, M, atau dual axis** (H di atas, M di bawah).
- Marker peristiwa menampilkan **tooltip dua format** saat hover.
- Saat tokoh dibandingkan, semua di-normalisasi ke sumbu yang sama (bila mixed pre/post Hijra → sumbu pakai Masehi untuk menghindari nilai negatif yang membingungkan).

### 2.2 Biografi Tokoh
Untuk setiap tokoh (sahabat / shahabiyat / tabi'in / tabi'iyyat / tabi'ut tabi'in / tabi'at tabi'iyyat / nabi / shalih / shalihah):
- Nama lengkap, kunyah, laqab.
- **Gender** (laki-laki / perempuan).
- Tahun kelahiran & wafat (Hijriyah & Masehi, dengan `date_precision`).
- **Kategori utama** (Nabi / Sahabat / Tabi'in / Tabi'ut Tabi'in / Shalih Pre-Rasul / Shalih Pasca-Rasul).
- Kategori sosial (Anshar / Muhajirin / dll, bila relevan).
- **Penilaian rijal / jarh wa ta'dil** (lihat §2.7) — hanya untuk perowi hadits.
- Riwayat masuk Islam (bila masuk Islam — tidak relevan untuk Nabi & pre-Rasul).
- Aktivitas dakwah **sebelum** Rasul ﷺ wafat (bila relevan).
- Aktivitas dakwah **setelah** Rasul ﷺ wafat (bila relevan).
- Tempat tinggal sepanjang hidup (untuk plotting peta).
- **Jumlah hadits yang diriwayatkan** (kisaran X–Y, dengan catatan sumber).
- Hubungan dengan tokoh lain (guru, murid, kerabat, suami/istri, ayah/ibu).
- **Spesialisasi keilmuan** (hadits / fiqh / aqidah / tafsir / lughah / qira'ah / dll).
- **Mazhab** (bila ada — untuk ulama pasca-tabi'in).
- **Wafat status**: sudah wafat (default & wajib) — tokoh masih hidup tidak masuk per §2.0c.

### 2.3 Quiz Sahabat
- Quiz interaktif tentang nama, peristiwa, periwayatan, peran dalam perang.
- Bisa dipakai user gratis (dengan limit?) atau user berlisensi.

### 2.4 Peta Interaktif
- Peta dunia Islam awal yang **bisa di-zoom**.
- Plotting:
  - Tempat tinggal tokoh (per fase hidup).
  - Lokasi peristiwa / hijrah / dakwah.
  - Koordinat / pinpoint untuk setiap entitas.
- Tujuan utama: pengguna paham **daerah-daerah dalam sirah** secara visual.

### 2.5 Sirah Perang (Ghazwah & Sariyyah)
Untuk setiap perang / ekspedisi:
- Panglima.
- Komposisi pasukan (jumlah, asal-usul).
- Strategi & jalannya pertempuran.
- **Peta perang** dengan koordinat lokasi pertempuran.
- Hasil & dampak.
- Tokoh-tokoh yang terlibat (link ke biografi).
- Semua data hasil **AI mapping** dari hasil deep research.

### 2.6 Kategori & Filter
Filter yang tersedia di semua list tokoh:
- **Gender**: Laki-laki / Perempuan / Semua.
- **Kategori utama**: Nabi / Sahabat / Tabi'in / Tabi'ut Tabi'in / Shalih Pre-Rasul / Shalih Pasca-Rasul.
- **Kategori sosial**: Anshar / Muhajirin / dll.
- **Generasi**: bila lintas-kategori.
- **Tempat tinggal / mati syahid / kota tujuan dakwah**.
- **Bidang keilmuan**: fiqh, hadits, tafsir, qira'ah, lughah, dll.
- **Mazhab**: Syafi'i / Maliki / Hanafi / Hanbali / non-mazhab (untuk ulama).
- **Penilaian rijal**: tsiqah, shaduq, dha'if, dst — lihat §2.7.
- **Rentang tahun wafat** (slider H/M).
- **Wilayah geografis** (auto-pakai data lokasi).

### 2.7 Penilaian Rijal (Jarh wa Ta'dil)
Mengikuti istilah **mustholah hadits**, tiap tokoh (terutama tabi'in & tabi'ut tabi'in) punya field penilaian:

**Tingkatan ta'dil (positif):**
- Tsiqah (ثقة) — terpercaya.
- Tsiqah tsiqah / tsiqah hafidz — tingkat lebih tinggi.
- Shaduq (صدوق) — jujur, kadang ada kesalahan kecil.
- La ba'sa bih / Shalih al-hadits.

**Tingkatan jarh (negatif):**
- Layyin al-hadits (لين الحديث).
- Dha'if (ضعيف).
- Matruk (متروك) — ditinggalkan.
- Kadzdzab / Wadhdha' (كذاب / وضّاع) — pendusta, pemalsu hadits.

**Aturan otomatis:**
- **Sahabat Nabi ﷺ → otomatis 'udul (kullu shahabah 'udul)**, tidak masuk skema jarh.
- **Perowi hadits di Kutub at-Tis'ah dan kitab rijal mu'tabar** → default minimal **tsiqah** kecuali kitab rijal eksplisit menyebut sebaliknya.
- Setiap penilaian wajib menyertakan **sumber kitab rijal** (Tahdzibul Kamal, Tahdzibut Tahdzib, Mizan al-I'tidal, Taqrib at-Tahdzib, dll) — bukan opini AI.
- Jika sumber tidak ada → status: **"belum diverifikasi"**, bukan default tsiqah.

---

## 3. Sistem AI Multi-Provider

### 3.1 Manajemen Provider
- **Semua AI provider terbaru per Mei 2026** masuk database (OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral, Meta, dll — daftar final di-finalisasi saat brainstorming arsitektur).
- Tiap provider punya **daftar model terbaru per Mei 2026**.
- Admin bisa **aktifkan / nonaktifkan** provider & model.
- Tiap fungsi AI bisa di-assign model yang berbeda.

### 3.2 Fungsi AI dalam Aplikasi
1. **AI Chat** — chat untuk user (limited use).
2. **AI Agent** — agent untuk admin (deep research, crawling, mapping).
3. **AI Doc Analyzer** — baca dokumen → extract tokoh + data → masuk database.
4. **Avatar** — generative avatar (TBD: untuk tokoh? untuk user? perlu diperjelas).

### 3.3 Default AI (Awal)
- Model: **deepseek-v4-flash**
- Diaktifkan untuk: **AI Chat** dan **AI Agent**.
- API key: `sk-REDACTED` (stored in `.env.local` as `SEED_DEEPSEEK_API_KEY`, gitignored — **rotate this key in DeepSeek dashboard since it was pasted in chat**)
  - ⚠️ **PERINGATAN KEAMANAN**: API key di atas **TIDAK BOLEH** di-commit ke git. Sebelum push pertama:
    1. Pindahkan ke `.env` atau secret manager.
    2. Tambahkan `docs/IDEAS.md` ke `.gitignore`, ATAU redact key dari file ini.
    3. Final-nya disimpan **encrypted di database** (kolom dienkripsi, bukan plaintext).
  - Saat ini ditulis di sini hanya sebagai catatan ide. Saat implementasi → harus dipindahkan.

---

## 3b. Font Management (Admin Configurable)

Admin bisa **menambah, mengaktifkan, dan menonaktifkan font** untuk Latin (Indonesia/Inggris) dan Arab — tanpa deploy ulang. Konfigurasi tersimpan di database, frontend mengambil via API.

### 3b.1 Font Roles (Slot)
Setiap role hanya boleh ada **1 font aktif** pada satu waktu:

| Role | Default | Untuk |
|---|---|---|
| `display_latin` | Playfair Display | H1–H2 Latin, hero, judul card |
| `body_latin` | Inter | Body text Latin, UI, paragraf |
| `display_arab` | Amiri | Logo, hero Arab, judul kaligrafi |
| `section_arab` | Reem Kufi | Section header Arab |
| `body_arab` | Cairo | Body text Arab |
| `quran_arab` | Amiri | Ayat & hadits (line-height extra) |
| `mono` | JetBrains Mono | Code blocks, ID/timestamp |

### 3b.2 Database Model (Konsep)
```
fonts {
  id, name, family, script (latin | arabic | mono | both),
  source (google_fonts | custom_url | uploaded_file),
  google_family_name,      // bila Google Fonts
  custom_url,              // bila CDN lain
  file_paths {              // bila uploaded (per weight/style)
    400_normal: '/storage/fonts/xxx-400.woff2',
    700_normal: '/storage/fonts/xxx-700.woff2',
    ...
  },
  weights: [400, 600, 700],
  styles: ['normal', 'italic'],
  unicode_range,           // untuk subsetting Arab (Quranic vs modern)
  preview_text_ar,
  preview_text_id,
  license,
  is_active (bool),
  created_at, created_by_admin_id
}

font_assignments {
  id, role (display_latin | body_latin | display_arab | ...),
  font_id (FK -> fonts.id),
  activated_at, activated_by_admin_id,
  unique_constraint: only 1 active per role
}
```

### 3b.3 Default Fonts (Seed Data — Pre-aktif)
Saat first install, font berikut **otomatis ter-seed dan aktif** di rolesnya:

```
SEED:
  Playfair Display  → display_latin   (active)
  Inter             → body_latin      (active)
  Amiri             → display_arab    (active)
  Amiri             → quran_arab      (active)
  Reem Kufi         → section_arab    (active)
  Cairo             → body_arab       (active)
  JetBrains Mono    → mono            (active)

ADDITIONAL (pre-installed, tidak aktif — siap dipilih):
  EB Garamond, Source Serif, Fraunces, Cormorant   (display_latin alts)
  IBM Plex Sans, Source Sans 3, Geist              (body_latin alts)
  Reem Kufi, Aref Ruqaa, Lateef                    (display_arab alts)
  Scheherazade New, Noto Naskh Arabic              (quran_arab alts)
  Tajawal, Noto Sans Arabic, IBM Plex Arabic       (body_arab alts)
```

Total ~15 font siap pakai di first install. Admin bisa langsung **switch tanpa upload**.

### 3b.4 Admin UI — Font Management
```
┌─────────────────────────────────────────────────────────────┐
│  FONT MANAGEMENT                          [+ Add New Font]  │
├─────────────────────────────────────────────────────────────┤
│  Tab:  [ All Fonts ] [ Active Slots ]                       │
├─────────────────────────────────────────────────────────────┤
│  ACTIVE SLOTS                                               │
│  ─────────────────────────────────────────────────────────  │
│  display_latin    Playfair Display     [Change ▾] [Preview] │
│  body_latin       Inter                [Change ▾] [Preview] │
│  display_arab     Amiri                [Change ▾] [Preview] │
│  section_arab     Reem Kufi            [Change ▾] [Preview] │
│  body_arab        Cairo                [Change ▾] [Preview] │
│  quran_arab       Amiri                [Change ▾] [Preview] │
│  mono             JetBrains Mono       [Change ▾] [Preview] │
└─────────────────────────────────────────────────────────────┘

[ Change ▾ ] → dropdown semua font yang compatible dengan slot ini
[ Preview ] → modal dengan sample text Arab + Latin sebelum activate
```

### 3b.5 Add New Font — 3 Cara
1. **Google Fonts** — input family name → backend fetch metadata via Google Fonts API → simpan ke DB. Paling simple.
2. **Custom URL** — admin input CDN URL (e.g., Bunny Fonts, Adobe Fonts). Tested first.
3. **Upload file** — upload `.woff2` / `.ttf` per weight & style. Simpan di storage. Pakai bila font berlisensi atau tidak di Google Fonts.

### 3b.6 Aturan Validasi
- **Font Arab wajib include glyph Arab** — backend cek via Opentype.js / fonttools (Python). Bila tidak ada glyph Arab → reject.
- **Font Latin tidak boleh di-assign ke role Arab** (dan sebaliknya).
- **License check** — admin wajib centang konfirmasi font tersebut bebas dipakai (open source / berlisensi sah).

### 3b.7 Frontend Integration
- Frontend ambil config aktif dari endpoint `/api/theme/fonts` (cached 1 jam).
- CSS variables di-inject di `<head>`:
  ```css
  :root {
    --font-display-latin: 'Playfair Display', serif;
    --font-body-latin: 'Inter', sans-serif;
    --font-display-arab: 'Amiri', serif;
    --font-body-arab: 'Cairo', sans-serif;
    --font-quran-arab: 'Amiri', serif;
    --font-mono: 'JetBrains Mono', monospace;
  }
  ```
- `<link>` font dimuat dinamis dari source yang sesuai (Google/CDN/self).
- Saat admin save → invalidate cache → broadcast event ke client (mis. SSE) untuk reload font tanpa F5 (opsional).

### 3b.8 PDF Engine Integration
- PDF engine (Puppeteer/WeasyPrint) butuh file font **tersedia di server**, bukan referenced ke Google.
- Bila admin pilih Google Font:
  - Backend **auto-download** file `.woff2`/`.ttf` saat font diaktifkan → simpan di `/storage/fonts/`.
  - Stored permanen agar PDF tetap konsisten meski Google Fonts down.
- Manifest font yang sudah disubset Arab untuk performance.

### 3b.9 Audit & Rollback
- Setiap perubahan slot tersimpan di `font_assignment_history`.
- Admin bisa **rollback** ke konfigurasi sebelumnya.
- Notifikasi ke semua admin saat font default diganti.

---

## 3c. Theme: Light & Dark Mode

Dark mode adalah **fitur dasar (bukan opsional)** — banyak user baca sirah di malam hari.

### 3c.1 User Toggle
- 3 mode di settings: **Light / Dark / Auto (ikuti OS)**.
- Default: **Auto**.
- Tersimpan di:
  - `localStorage` (instant, anti-flash di first paint).
  - Database (user preference, sync antar device login).
- Toggle quick-access: ikon kecil di header (matahari/bulan).

### 3c.2 Palette Spec
Detail palet Light & Dark lengkap di **`docs/BRANDING.md` §4 & §4b**. Ringkasan:
- **Light**: Emerald Turats — cream background, deep emerald primary, antique gold accent.
- **Dark**: Emerald Turats Night — warm black bg (#0F0D0A, **bukan pure black**), brighter emerald (#4ABC95), gold cream-leaning (#D4B783).

### 3c.3 Implementasi
- CSS variables di `:root[data-theme="light|dark"]`.
- Anti-flash: inline script di `<head>` set `data-theme` sebelum CSS render.
- Smooth transition 200ms saat user toggle.
- Image asset: ada varian untuk light & dark (logo emerald vs gold/cream).

### 3c.4 Komponen yang Beda di Dark Mode
- **Peta**: pakai tile dark (Mapbox dark / CartoDB dark) — auto-switch.
- **Code block** (admin panel): syntax theme switch (Solarized Light → Tokyo Night).
- **PDF export**: **TETAP LIGHT MODE selalu** (printed media). Tidak ada PDF dark version.
- **Cover Image / OG image**: light version untuk preview link (social media).
- **Email**: light only (email client compatibility).

### 3c.5 Aksesibilitas
- Light mode: kontras minimum **WCAG AA** (4.5:1 untuk body text).
- Dark mode: kontras minimum **WCAG AA**, target AAA untuk reading-heavy area (biografi panjang).
- User dengan `prefers-reduced-motion` → disable transisi theme switch.

---

## 4. AI Deep Research Pipeline (Untuk Mengisi Database)

Pipeline crawling otomatis untuk membangun database tokoh:

```
Step 1: AI Web Search → dapat LIST NAMA sahabat
Step 2: Untuk tiap nama → AI Web Search per-tokoh
Step 3: Hasil di-extract menjadi structured data:
        - Timeline
        - Biografi
        - Tanggal lahir / wafat
        - Aktivitas dakwah (pre & post Rasul ﷺ wafat)
        - Tempat tinggal
        - Koordinat geografis
        - Periwayatan hadits
Step 4: Simpan ke database
Step 5: Lanjut ke generasi berikutnya (tabi'in, tabi'ut tabi'in)
        — relasi: "tabi'in yang hidup setelah [sahabat X] wafat"
```

### Untuk Sirah Perang
- AI mapping otomatis: dari nama perang → panglima, pasukan, strategi, koordinat lokasi.
- Hasil masuk database, ditampilkan di peta.

### Sumber yang Diutamakan (Whitelist Salaf)
Crawling **HANYA** dari daftar putih website salaf yang dikelola admin. AI tidak boleh menjawab dari "pengetahuan internalnya" sendiri — semua klaim harus punya URL sumber.

Kandidat awal whitelist (perlu konfirmasi & dilengkapi):
- **islamqa.info** (Syaikh Munajjid) — fatwa & biografi.
- **dorar.net** (Durar as-Saniyyah) — ensiklopedia + mausu'ah rijal.
- **islamweb.net** — fatwa & artikel.
- **shamela.ws** (Maktabah Syamilah online) — sumber kitab klasik.
- **sunnah.com** — hadits + biografi rijal.
- **alukah.net** — artikel ilmiah.
- (Tambahkan oleh admin sesuai kebutuhan.)

**Pengelolaan whitelist:**
- Admin bisa add / remove / disable domain.
- Tiap domain ditandai bahasa primer (ar / id / en).
- Tiap hasil crawling **wajib** menyimpan URL sumber + timestamp + bahasa asli.

### Anti-Hallucination Guard
- AI **hanya boleh** menjawab berdasarkan hasil web search dari whitelist (RAG-style).
- Output AI yang tidak punya citation → ditolak, bukan disimpan.
- Setiap field di database menyimpan `source_url` dan `source_excerpt` (kutipan asli dari halaman sumber).
- Jika sumber tidak ditemukan → field di-set "unknown / pending review", **bukan ditebak**.

---

## 4b. Bilingual (Arab ↔ Indonesia)

### Prinsip
- Sumber primer adalah **konten berbahasa Arab** dari website salaf (karena lebih akurat & lebih banyak).
- AI bertugas sebagai **(a) translator** dan **(b) structured-data extractor**.
- Pengguna bisa toggle antara tampilan **Arab** dan **Indonesia** — keduanya disimpan di database.

### Pipeline Single-Crawl (Sekali Crawl, Output Dwi-Bahasa)
```
1. Fetch halaman sumber (bahasa asli, biasanya Arab).
2. Simpan raw HTML + extract teks Arab.
3. AI tugas-1 (extraction): dari teks Arab → structured JSON
   (nama, tanggal, lokasi, peristiwa, penilaian rijal, dst)
   dalam bahasa asli (Arab).
4. AI tugas-2 (translation): translate field-field berbahasa
   Arab ke Indonesia. Nama orang & tempat tetap dipertahankan
   dalam ejaan transliterasi standar.
5. Simpan ke database:
   - field_ar  : teks asli Arab
   - field_id  : terjemahan Indonesia
   - source_url, source_excerpt, source_lang
6. (Opsional) AI tugas-3 (summary): buat ringkasan dwi-bahasa.
```

### Aturan Translasi
- **Nama orang & tempat**: pakai transliterasi konsisten (mis. "عمر بن الخطاب" → "Umar bin al-Khattab" dengan opsi tampilkan Arab di samping).
- **Istilah syar'i** (sahabat, tabi'in, hijrah, ghazwah, sariyyah, jarh, ta'dil, dll): **tidak diterjemahkan**, hanya ditransliterasi + tooltip definisi.
- **Ayat & hadits Arab**: simpan teks Arab asli + terjemahan Indonesia di bawahnya. Jangan parafrase teks suci.
- AI translator **wajib pakai model yang kuat di Arab klasik** (bukan sekadar Arab modern) — perlu evaluasi model mana yang paling baik.

### Penyimpanan Multi-Bahasa
Struktur kolom (konsep):
```
biografi_ar TEXT      -- bahasa asli
biografi_id TEXT      -- hasil translate AI
biografi_id_status    -- 'ai-translated' | 'human-reviewed'
source_url TEXT
source_lang TEXT      -- 'ar' | 'id' | 'en'
```
Status `human-reviewed` di-set manual oleh admin setelah verifikasi.

---

## 5. AI Doc Analyzer (Ingestion dari Dokumen)

Alur:
1. Admin (atau user berlisensi tinggi?) upload dokumen (PDF / docx / txt).
2. AI menganalisis dokumen.
3. AI melakukan **mapping**: deteksi nama tokoh + atribut data terkait.
4. Sistem cek apakah tokoh sudah ada di database:
   - **Jika belum ada** → tambahkan record baru.
   - **Jika sudah ada** → **lengkapi / tambahi data**, jangan overwrite.
     - Misal: bila biografi lama belum punya field "tempat wafat" dan dokumen baru menyebutkan → field itu yang diisi.
     - Bila ada konflik (data berbeda untuk field yang sama) → flag untuk review admin, jangan auto-replace.

### Prinsip "Lengkapi, jangan timpa"
- Setiap field punya **provenance** (sumber asal data).
- Update bersifat **append + merge**, bukan overwrite.
- Konflik = manual review, bukan auto-resolve.

---

## 5b. PDF Export (Book Generator)

User bisa generate **PDF buku** dari data yang ada di platform — bukan dump teks, tapi benar-benar **buku yang didesain elegan untuk dibaca**.

### 5b.1 Mode Pemilihan Konten
- **Single mode** — 1 sahabat, output buku biografi tunggal.
- **Multi mode** — pilih 2 sampai **60 sahabat** sekaligus → digabung jadi 1 buku tematik.
- **Auto title generator** — judul buku digenerate berdasarkan tokoh yang dipilih (mis. "Sirah 12 Sahabat dari Kalangan Anshar" / "Biografi Khulafa ar-Rasyidin").

### 5b.2 Cover Buku
- **Judul utama dalam bahasa Arab** (besar, kaligrafis).
- **Sub-judul Indonesia** (opsional).
- **Penulis** = nama lengkap user.
- **Email user** ditampilkan kecil di cover.
- **Footer cover**: "Dibuat oleh platform [namaplatform]" / watermark logo.
- Watermark halus di tiap halaman juga (nama platform).

### 5b.3 Opsi Layout
| Opsi | Pilihan |
|---|---|
| Ukuran kertas | A5, A4, Letter, Legal |
| Orientasi | Portrait / Landscape |
| Template desain | Beberapa preset elegan (klasik, modern, kaligrafi, minimalis) |
| Font | Default per template; nama Arab pakai font Arab yang bagus (Amiri / Scheherazade / Naskh) |
| Bahasa konten | ID only / AR only / Dwi-bahasa berdampingan |

### 5b.4 Desain Isi (Bukan Textbook)
Isi buku **tidak monoton**. Tiap biografi punya komponen visual:
- **Timeline mini** per tokoh (rendered sebagai SVG/CSS di dalam PDF).
- **Peta mini** lokasi penting tokoh tersebut.
- **Infografis komparasi** (mis. usia masuk Islam vs tokoh lain di buku yang sama).
- **Ilustrasi generatif** (lihat §5b.5).
- **Pull quote** untuk perkataan / hadits penting yang diriwayatkan.
- **Sidebar fakta** (jumlah hadits, kategori, penilaian rijal).
- Khusus mode **landscape** — layout 2-kolom dengan timeline horizontal yang lebar, harus benar-benar enak dibaca.

### 5b.5 Ilustrasi Generator (CSS-Based)
Karena AI image-gen rawan menggambar wajah/figur (dilarang dalam konteks ini), ilustrasi pakai **CSS / SVG generator** — bukan AI image generation.

Contoh tipe ilustrasi:
- **Lingkaran kaligrafi**: lingkaran ornamental, di tengahnya nama tokoh dalam Arab **tanpa harakat**, tipografi besar.
- **Kartu nama**: bingkai geometris Islami (pola arabesque sederhana), nama Arab + transliterasi.
- **Timeline ribbon**: pita horizontal/vertikal dengan node tahun + peristiwa.
- **Family tree node**: kotak terhubung dengan garis silsilah.
- **Heat-map peta**: SVG peta dengan titik lokasi.
- **Stat ring**: lingkaran progress untuk visualisasi "jumlah hadits diriwayatkan".

Semua dirender via HTML/CSS/SVG → di-convert ke PDF (mis. via Puppeteer / wkhtmltopdf / WeasyPrint). Hasilnya:
- Konsisten, deterministik (sama tiap render).
- Tidak ada hallucination visual.
- File ukuran wajar (vector, bukan raster).
- Sesuai adab (tidak menggambarkan rupa manusia).

### 5b.6 Batas Download
| Tier | Batas |
|---|---|
| Trial | 1 PDF / trial period (preview-only, watermark besar) |
| User berlisensi | X PDF / bulan (jumlah TBD, mis. 10/bulan) |
| Admin | Unlimited |

- **User** → field penulis & email otomatis dari profile, **tidak bisa diubah**.
- **Admin** → bisa custom nama penulis & email apa saja (untuk keperluan testing / membuat buku atas nama orang lain dengan izin).

### 5b.7 Engine PDF (Pertimbangan)
- **Puppeteer / Playwright** (HTML→PDF, paling fleksibel untuk CSS modern, font Arab OK).
- **WeasyPrint** (Python, bagus untuk print CSS, lebih ringan).
- **React-PDF / pdfkit** (programmatic, kurang cocok untuk layout typografi kompleks).
- Pilihan final TBD saat brainstorming arsitektur — kemungkinan **Puppeteer** karena dukungan CSS modern (grid, flex, web font Arab) paling baik.

---

## 5c. Review & Approval Workflow (Role Ustadz)

Tidak ada konten AI yang **langsung publish**. Setiap entri biografi / perang / data tokoh wajib melewati **review oleh minimal 1 ustadz** sebelum visible ke user.

### 5c.1 Role Baru: Ustadz (Reviewer + Editor)
- Selain User & Admin, ada role **Ustadz**.
- Diundang manual oleh Admin (tidak bisa self-register).
- Tiap ustadz punya profil: nama, gelar, bio singkat, foto (opsional, hanya inisial), specialty (rijal / sirah perang / tafsir / dll).
- **Multi-reviewer**: 1 konten bisa di-assign ke 2+ ustadz.

### 5c.2 Status Konten (State Machine)
```
draft  →  under_review  →  needs_edit  →  under_review  →  approved  →  published
                                ↑                                ↓
                                └────── (edit cycle) ────────────┘
```

- **draft** — baru di-extract dari AI deep research, belum di-assign ke ustadz.
- **under_review** — sudah di-assign, sedang ditelaah ustadz.
- **needs_edit** — ustadz request perubahan dengan catatan; AI akan menggenerate revisi.
- **approved** — minimal 1 ustadz approve (threshold konfigurabel, lihat §5c.6).
- **published** — visible ke user.
- (Bisa unpublish kembali ke draft bila ada laporan.)

### 5c.3 Mandatory Citation (Anti-Hallucination)
Setiap konten yang di-generate AI **WAJIB** menyertakan:
- `source_url` — link ke halaman whitelist tempat data diambil.
- `source_excerpt_ar` — kutipan teks asli berbahasa Arab (atau bahasa sumber).
- `source_excerpt_id` — terjemahan kutipan asli (bila beda dengan konten utama).
- `extracted_at` — timestamp.
- `model_used` — model AI yang melakukan ekstraksi (untuk audit).
- `confidence_score` — opsional, score AI sendiri untuk hint reviewer.

**Jika sumber tidak ada → konten tidak boleh dibuat.** Bukan diisi "unknown" — entrinya tidak existed sama sekali.

### 5c.4 Review UI (Side-by-Side Comparison)
Saat ustadz membuka konten untuk direview:

```
┌────────────────────────────────┬────────────────────────────────┐
│  SUMBER ASLI (websumber)       │  KONTEN ATSAR                  │
│  ───────────────────────────   │  ───────────────────────────   │
│  [embed / live-fetch halaman   │  Biografi yang akan dipublish, │
│   atau text excerpt dalam Arab │  dwi-bahasa (AR + ID).         │
│   sebagai blockquote]          │                                │
│                                │  Highlight bagian yang berbeda │
│  URL: https://islamqa.info/... │  / tambahan dari source.       │
│                                │                                │
│  [klik utk buka tab baru &     │                                │
│   verify langsung di sumber]   │                                │
└────────────────────────────────┴────────────────────────────────┘

[ ✓ APPROVE ]   [ ✎ REQUEST EDIT ]   [ ✗ REJECT ]
```

- **Klik citation link** → split-view: panel kanan menampilkan halaman sumber **langsung dari website asli** (iframe atau live-fetch terbaru), panel kiri konten Atsar.
- Ustadz bisa **highlight bagian** konten Atsar untuk komentar inline.
- **Diff view** otomatis bila konten sudah pernah direvisi (revision 1 vs revision 2).

### 5c.5 AI-Assisted Edit (Ustadz → Instruksi → AI → Konten)
**Ustadz tidak edit teks secara manual** (kecuali ingin). Alurnya:

1. Ustadz klik "Request Edit".
2. Ustadz menulis **catatan / instruksi** dalam bahasa natural, mis:
   > "Tambahkan informasi tentang perang Yarmuk di bagian akhir. Tahun wafat yang benar adalah 13 H, bukan 14 H (lihat Tahdzib at-Tahdzib jilid 5). Ganti penyebutan 'beliau berkata' menjadi 'beliau radhiyallaahu 'anhu berkata'."
3. AI menerima:
   - Konten saat ini.
   - Source excerpt asli (tetap sebagai ground truth, tidak boleh dikontradiksi).
   - Catatan ustadz.
4. AI generate **konten revisi** dengan menerapkan instruksi.
5. **Diff** ditampilkan ke ustadz untuk konfirmasi sebelum save.
6. Bila OK → save & status balik ke `under_review` untuk approval final.
7. Bila masih kurang → iterasi lagi (round 2, 3, dst).

**Opsi manual edit**: ustadz bisa juga edit teks langsung bila yakin (override AI). Tetap tersimpan sebagai revisi terpisah.

### 5c.6 Multi-Reviewer & Approval Threshold
- 1 entri konten bisa di-assign ke **N ustadz** oleh admin.
- **Threshold approval** konfigurabel per kategori konten:
  - Biografi sahabat: minimal **1 ustadz** approve (karena sahabat = 'udul, less sensitive).
  - Penilaian rijal tabi'in: minimal **2 ustadz** approve (jarh wa ta'dil sensitif).
  - Sirah perang & strategi: minimal **1 ustadz** + 1 reviewer geografi.
  - Khilaf antar ulama: minimal **2 ustadz** approve.
- Bila ada **disagreement** antar ustadz (1 approve, 1 reject) → eskalasi ke **head reviewer** (peran sub-admin).

### 5c.7 Audit Log & Attribution
Setiap aksi tercatat permanen, tidak bisa dihapus:

```
ContentRevision {
  revision_id, content_id, revision_number,
  diff_from_previous,
  action: 'created' | 'edited_by_ai' | 'edited_manually' | 'approved' | 'rejected',
  actor_id: ustadz_id | admin_id | system,
  actor_role,
  notes: text,
  ai_instruction: text (bila edit oleh AI),
  ai_model_used,
  timestamp
}
```

### 5c.8 Display ke User
Konten yang sudah published menampilkan **attribution** secara transparan:

```
─────────────────────────────────────────────
Biografi Abu Bakr ash-Shiddiq radhiyallaahu 'anhu
─────────────────────────────────────────────
[konten biografi]
─────────────────────────────────────────────
Sumber: islamqa.info/123, dorar.net/456
Direview oleh: Ustadz A, Ustadz B
Diedit oleh: Ustadz A (3 revisi)
Terakhir diperbarui: 15 Mei 2026
─────────────────────────────────────────────
[Lapor masalah pada konten ini]
```

Tujuan: membangun **kepercayaan** user. Konten bukan "kata AI", tapi "AI yang ditinjau ulama".

### 5c.9 Insentif Ustadz
- **Tidak gratis** — ustadz dibayar per artikel direview / per jam.
- Atau model "fee ulama" — fixed bulanan untuk ustadz yang siap on-call review.
- Bisa juga model "akademik" — ustadz mahasiswa S2/S3 dapat akses Premium gratis + sertifikat reviewer untuk CV.
- Detail kompensasi: TBD (diskusi terpisah dengan Galih).

### 5c.10 Tabel Permission (Role Ustadz)
| Permission | Ustadz |
|---|---|
| Lihat semua konten (termasuk draft) | ✅ |
| Approve / Reject konten yang di-assign | ✅ |
| Request edit (via AI atau manual) | ✅ |
| Akses semua tier konten (sahabat, tabi'in, tabi'ut tabi'in) | ✅ unlimited |
| Akses AI Chat | ✅ unlimited (untuk research) |
| Akses AI Agent / Doc Analyzer | ❌ (admin only) |
| Invite ustadz lain | ❌ (admin only) |
| Manage provider AI | ❌ |
| Aktifkan lisensi user | ❌ |
| Lihat audit log | ✅ (read-only) |

### 5c.11 Update Tabel Tier Akses
*(Tabel di §6.7 akan diupdate dengan kolom "Ustadz" di brainstorm selanjutnya.)*

---

## 6. Model Bisnis & Lisensi

### 6.1 Landing Page
- Tampilan "keren" — modern, visual, menampilkan preview fitur peta & timeline.
- Section: hero, fitur, screenshot, **pricing (4 tier + promo)**, testimoni (nanti), CTA daftar.
- **Kontak admin**: Galih — WA **0813-1950-4441** (untuk konfirmasi pembayaran & aktivasi lisensi).

### 6.2 Trial
- **3 hari gratis** setelah registrasi (preview tier Premium agar user bisa coba semua fitur).
- Setelah trial habis → user otomatis turun ke **tier Free** (lihat §6.3), atau ke halaman bayar bila ingin upgrade.
- **Tidak ada auto-renewal** — admin (Galih) yang manual mengaktifkan lisensi setelah pembayaran masuk.

### 6.3 Pricing — 4 Tier + Promo

Semua harga dalam **Rupiah (IDR)**.

| Tier | Bulanan | Tahunan (diskon 10%) | Cakupan Konten | Download PDF / bulan |
|---|---|---|---|---|
| **Free** | Rp 0 | — | Nabi + Shalih Pre-Rasul + 30 Sahabat (curated) | 0 |
| **Basic** | Rp 99.000 | **Rp 1.069.200** | + Semua Sahabat & Shahabiyat | 100× |
| **Pro** | Rp 299.000 | **Rp 3.229.200** | + Tabi'in & Tabi'iyyat | 500× |
| **Premium** | Rp 499.000 | **Rp 5.389.200** | + Tabi'ut Tabi'in & Tabi'at Tabi'iyyat + Shalih Pasca-Rasul | 1.000× |

**Promo Spesial:**
| Tier | Bulanan | Tahunan (promo) | Cakupan Konten | Download PDF / bulan |
|---|---|---|---|---|
| **Sampler** | Rp 29.000 | **Rp 249.000** (≈28% off) | Nabi + Shalih Pre-Rasul + 20 Sahabat + 20 Tabi'in + 20 Tabi'ut Tabi'in (mix gender, curated) | 50× |

**Catatan Pricing:**

1. **Konten fundamental gratis di semua tier**:
   - **Para Nabi & Rasul** (25 nabi wajib + tambahan).
   - **Shalih & Shalihah Pre-Rasul** (Maryam, Asiyah, Luqman, Ashabul Kahfi, dll).
   - Alasan: konten Quranik fundamental, audiens awam (target Free) wajib mendapat akses.

2. **Pemisahan gender = navigasi saja**:
   - Akses tier mencakup **kedua gender** (sahabat + shahabiyat) sekaligus.
   - Menu dipisah hanya agar mudah jelajah, bukan untuk monetisasi.

3. **"30 Sahabat" di Free / "20 + 20 + 20" di Sampler**:
   - Dikurasi admin sebagai **mix laki & perempuan** (mis. 20 sahabat + 10 shahabiyat di Free).
   - Fokus tokoh paling utama tiap generasi.

4. **Timeline Ulama Salaf (Plus)** (§2.0d):
   - **Free / Basic** → preview saja (sumbu utama tanpa tokoh post-sahabat).
   - **Pro** → tampil sahabat + tabi'in di sumbu.
   - **Premium** → tampil semua generasi termasuk pasca-rasul.

5. **Annual price Sampler `249.000`** = deal flat (diskon ≈28%), bukan 10% standar — promo khusus.

### 6.4 Quota & Reset
- **Anchor reset = tanggal pendaftaran** user. Misal user daftar tanggal 7 → quota direset tiap tanggal 7 bulan berikutnya.
- **Use-it-or-lose-it** — quota yang tidak terpakai **tidak di-rollover** ke bulan depan.
- Counter quota terlihat di dashboard user (mis. "Sisa download bulan ini: 73 / 100").

### 6.5 Status Langganan Habis
Bila bulan berikutnya user **tidak memperpanjang**:
- Akses ke seluruh menu **diblokir**.
- User **hanya melihat**:
  1. Halaman **billing / harga**.
  2. Informasi kontak admin (Galih, WA 0813-1950-4441).
  3. Tombol "Saya sudah bayar — minta aktivasi".
- Dashboard, biografi, peta, AI chat, PDF — semua **tidak bisa diakses** sampai admin aktifkan kembali.

### 6.6 Pembayaran & Aktivasi
- Pembayaran manual via transfer / payment gateway (TBD).
- User klik "Saya sudah bayar" → kirim notif ke admin.
- Admin verifikasi → **manual aktifkan** lisensi di admin panel.
- Tidak ada auto-renewal (cocok dengan model "admin yang mengaktifkan").

### 6.6b Kebijakan No-Refund
**Pembayaran tidak dapat dikembalikan (final, no refund).**

**Alasan kebijakan:**
- Pembelian dilakukan **atas kesadaran sendiri** setelah user mendapat akses:
  1. **Tier Free** — bisa lihat 30 sahabat, peta, quiz tanpa bayar.
  2. **Trial 3 hari** — preview fitur paid sebelum keputusan beli.
- Karena ada Free + Trial yang cukup, **tidak ada alasan "tidak tahu apa yang saya beli"**.
- Menutup celah penipuan / chargeback abuse (user pakai sebulan lalu minta refund).

**Wajib di-disclosure di:**
- Landing page (section pricing).
- Halaman checkout (checkbox "Saya setuju, pembayaran tidak dapat dikembalikan").
- Email konfirmasi pembayaran.
- Syarat & Ketentuan.

**Pengecualian (sesuai UU Perlindungan Konsumen):**
No-refund **tidak berlaku** untuk:
- Pembayaran ganda (double charge) — refund kelebihan saja.
- Kegagalan teknis dari sisi platform yang menyebabkan user tidak bisa pakai fitur yang dibayar dalam waktu signifikan (mis. server down berhari-hari).
- Fitur yang dijanjikan tidak tersedia (misrepresentasi).

Penanganan kasus pengecualian: kontak admin (Galih) manual review case-by-case.

### 6.6c Kebijakan Upgrade & Downgrade
- **Upgrade** mid-cycle → bayar penuh tier baru, tier lama hangus (atau pro-rata, TBD di §6.8).
- **Downgrade** → berlaku di siklus berikutnya, tidak menghanguskan sisa quota tier yang sedang berjalan.
- **Tidak ada refund** atas selisih tier.

### 6.7 Tier Akses (Tabel Fitur Lengkap)

**A. Akses Konten** (per kategori tokoh — gender tidak memisahkan akses)

| Kategori Tokoh | Free | Sampler | Basic | Pro | Premium | Ustadz | Admin |
|---|---|---|---|---|---|---|---|
| Para Nabi & Rasul | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all |
| Shalih & Shalihah Pre-Rasul | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all |
| Sahabat & Shahabiyat | 30 curated | 20 curated | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all |
| Tabi'in & Tabi'iyyat | ❌ | 20 curated | ❌ | ✅ all | ✅ all | ✅ all | ✅ all |
| Tabi'ut Tabi'in & Tabi'at Tabi'iyyat | ❌ | 20 curated | ❌ | ❌ | ✅ all | ✅ all | ✅ all |
| Shalih & Shalihah Pasca-Rasul (s.d. 2026) | ❌ | ❌ | ❌ | ❌ | ✅ all | ✅ all | ✅ all |

**B. Akses Fitur**

| Fitur | Free | Sampler | Basic | Pro | Premium | Ustadz | Admin |
|---|---|---|---|---|---|---|---|
| Timeline komparasi (basic) | ✅ (curated only) | ✅ (curated) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timeline Ulama Salaf Plus (§2.0d) | preview | preview | preview | ✅ s.d. tabi'in | ✅ full | ✅ full | ✅ full |
| Peta interaktif (figur) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Peta perang (sirah perang) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quiz | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Chat | ✅ (vlimited) | ✅ (limited) | ✅ (limited) | ✅ (medium) | ✅ (high) | ✅ unlimited | ✅ unlimited |
| Export PDF / bulan | ❌ | 50× | 100× | 500× | 1.000× | unlimited | unlimited, custom |
| Pilih font UI | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (admin only via §3b) |
| Toggle dark/light/auto | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**C. Akses Khusus Role (Ustadz / Admin — Tidak Dijual)**

| Fitur | Ustadz | Admin |
|---|---|---|
| Review konten (Approve / Reject) | ✅ | ✅ |
| Request edit via AI atau manual | ✅ | ✅ |
| Lihat draft / under_review / needs_edit | ✅ | ✅ |
| Audit log (read-only) | ✅ | ✅ |
| AI Agent (deep research) | ❌ | ✅ |
| AI Crawling whitelist | ❌ | ✅ |
| AI Doc Analyzer | ❌ | ✅ |
| Manage provider AI | ❌ | ✅ |
| Manage fonts (§3b) | ❌ | ✅ |
| Manage whitelist domains | ❌ | ✅ |
| Curate Free / Sampler tokoh list | ❌ | ✅ |
| Aktifkan lisensi user | ❌ | ✅ |
| Invite ustadz | ❌ | ✅ |
| Set custom nama/email di PDF export | ❌ | ✅ |

### 6.9 Status Pajak (Awal)

**PPN: TIDAK dipungut** (belum PKP).
- Harga di §6.3 adalah **harga jual final / net** — tidak ada PPN ditambahkan.
- Berlaku selama **omzet < Rp 4,8 miliar / tahun** (threshold wajib PKP, PMK 197/PMK.03/2013).

**Revisit ketika:**
- Omzet mendekati Rp 4 M / tahun → mulai konsultasi pajak untuk siap-siap PKP.
- Begitu wajib PKP → revisi pricing strategy (inclusive vs exclusive PPN).
- Bila tarif PPN berubah / regulasi baru di 2026+ → review ulang.

**PPh tetap berlaku** (PPh berbeda dari PPN, dipotong dari penghasilan Anda):
- Sebagai UMKM bisa pakai **PPh Final 0,5%** dari omzet (PP 23/2018) — paling sederhana di awal.
- Pilihan struktur (perorangan / PT / CV) berdampak ke skema PPh — di luar scope dokumen ini, perlu konsultasi pajak terpisah.

⚠️ **Disclaimer**: Section ini bukan nasihat pajak resmi. Konsultasikan dengan konsultan pajak / DJP sebelum keputusan final.

### 6.8 Pertanyaan Terbuka (Pricing)
- [ ] Trial 3 hari: preview **tier Premium** atau preview **tier Basic**?
- [ ] Tier Free: hanya 30 sahabat — apakah 30-nya **dikurasi admin** atau 30 paling populer otomatis?
- [ ] Sampler `50× download` itu betul atau angka lain?
- [ ] Apakah ada **upgrade pro-rata** mid-cycle? (mis. user Basic upgrade ke Pro di tengah bulan)
- [x] **Refund policy: NO REFUND** — final, kecuali kasus pengecualian (lihat §6.6b).
- [x] **PPN: harga = NET (belum PKP)**. Pricing tabel di §6.3 adalah harga jual final, tidak ada PPN dipungut. Berlaku selama omzet < Rp 4,8 M/tahun (threshold wajib PKP). Lihat §6.9.
- [ ] AI Chat "limited" untuk tier paid — berapa pesan / token per bulan masing-masing tier?

---

## 7. Pertanyaan Terbuka (Untuk Diisi Sebelum Arsitektur)

- [x] **Bahasa UI: Arab + Indonesia (dwi-bahasa, toggle)** — sumber crawl primer Arab, AI translate ke ID. Lihat §4b.
- [ ] Hijriyah-Masehi converter — pakai library atau dataset manual?
- [ ] Peta: Leaflet + OpenStreetMap, Mapbox, atau Google Maps?
- [ ] Tile peta historis — pakai modern map atau custom historical overlay?
- [ ] Penyimpanan dokumen yang di-upload — local, S3, atau lainnya?
- [ ] Avatar — generatif (image-gen AI) atau preset?
- [ ] Validasi data hasil AI deep research — siapa yang verifikasi? Apakah ada workflow "draft → reviewed → published"?
- [ ] Apakah ada API publik untuk pihak ketiga?
- [ ] Offline / PWA support?
- [ ] Hosting target (VPS, cloud, serverless)?

---

## 8. Catatan Keamanan & Etika

- **API key** tidak boleh di-commit ke repo. Pindahkan ke `.env` + secret manager.
- **Data tokoh sirah** sangat sensitif — keakuratan adalah prioritas. AI deep research output **harus** punya jejak sumber, dan idealnya direview manusia sebelum di-publish.
- **AI hallucination** untuk konten sirah bisa berbahaya (menyebarkan info palsu tentang sahabat). Perlu safeguard:
  - Selalu cite sumber.
  - Tandai konten "AI-generated, pending review".
  - Workflow review oleh admin sebelum data jadi public.

---

## 9. To-Be-Added oleh User

> Ruang kosong untuk ide tambahan sebelum kita lanjut brainstorming arsitektur.

-
-
-
