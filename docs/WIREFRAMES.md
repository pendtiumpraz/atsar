# Atsar — Wireframes & Tech Per Fitur

> ASCII wireframe (LTR layout, beberapa juga punya RTL note) + library/teknologi yang dipakai per fitur.
> Lihat `FRONTEND.md` untuk pattern umum, `UI_UX.md` untuk design system.

**Legend:**
- `[Button]` = button
- `<...>` = input/dropdown
- `▾` = dropdown trigger
- `◉ ○` = radio
- `☑ ☐` = checkbox
- `→` = navigate / click action

---

## 1. Landing Page (`/`)

```
┌────────────────────────────────────────────────────────────┐
│ [أثر ATSAR]                  Tokoh ▾  Peta  Pricing  [Login] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│              أ ث ر                                          │
│              ATSAR                                          │
│                                                            │
│   Jejak generasi terbaik, dalam genggamanmu.                │
│                                                            │
│   [Coba Gratis 3 Hari]   [Lihat Demo Peta →]                │
│                                                            │
│   ⤷ background: ornament arabesque halus, palet Emerald     │
├────────────────────────────────────────────────────────────┤
│  Fitur Unggulan                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ Timeline│ │  Peta   │ │ PDF Book│ │ AI Chat │            │
│  │ Komparas│ │ Interakt│ │Generator│ │ Belajar │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
├────────────────────────────────────────────────────────────┤
│  Cakupan Tokoh                                              │
│  • 25 Nabi & Rasul    • Sahabat & Shahabiyat                │
│  • Tabi'in            • Tabi'ut Tabi'in                     │
│  • Ulama Salaf sampai 2026                                  │
├────────────────────────────────────────────────────────────┤
│  Pricing (preview 5 kartu)                                  │
│  [Free] [Sampler 29k] [Basic 99k] [Pro 299k] [Premium 499k] │
│  → klik kartu = scroll ke halaman pricing detail            │
├────────────────────────────────────────────────────────────┤
│  Footer: Atsar, kontak Galih (WA 0813-1950-4441), T&C       │
└────────────────────────────────────────────────────────────┘
```

**Tech:**
- Next.js RSC (SSG / ISR 1 jam revalidate)
- Framer Motion untuk hero fade-in + scroll reveal
- shadcn `Button`, `Card`
- Lucide icons
- next-intl untuk dwi-bahasa
- Image: `next/image` untuk ornament

---

## 2. Auth Pages

### 2.1 Login (`/login`)
```
┌──────────────────────────────────┐
│           أ ث ر                   │
│         Masuk ke Atsar            │
│                                  │
│  Email     <__________________>   │
│  Password  <__________________> 👁│
│                                  │
│  ☐ Ingat saya       Lupa password?│
│                                  │
│  [        Masuk          ]        │
│                                  │
│  ─── atau ───                     │
│                                  │
│  [G] Masuk dengan Google          │
│  [@] Kirim magic link             │
│                                  │
│  Belum punya akun? Daftar →       │
└──────────────────────────────────┘
```

**Tech:**
- `better-auth` library
- react-hook-form + zod schema
- Sonner toast untuk error
- Server Action untuk submit

### 2.2 Register, Forgot Password, Verify Email
Pattern serupa, single column centered.

---

## 3. Onboarding Trial

Setelah register → email verify → wizard:
```
Step 1: Pilih Bahasa (ID / AR / Both)
Step 2: Pilih Calendar (H / M / Both)
Step 3: Pilih Theme (Light / Dark / Auto)
Step 4: Tour singkat (5 slide) tentang fitur
Step 5: Done → /dashboard, trial 3 hari dimulai
```

**Tech:** Multi-step form pakai `react-hook-form` + framer-motion transitions.

---

## 4. App Shell (Sidebar + Navbar) — `(app)/layout.tsx`

```
┌─────────┬────────────────────────────────────────────────────┐
│         │ 🏠 Dashboard / Sahabat / Abu Bakr     ✨1234 📥47/100 🔔3 🌙 ⊕ 👤│
│  أ ث ر   ├────────────────────────────────────────────────────┤
│  ────   │                                                    │
│ 📊 Dash │                                                    │
│ 👥 Toko │                                                    │
│  ↳ Nabi │                  MAIN CONTENT                      │
│  ↳ Saha │                                                    │
│  ↳ Shah │                                                    │
│  ↳ Tabi │                                                    │
│  ↳ ...  │                                                    │
│ ⏱ Time  │                                                    │
│ 🗺 Peta │                                                    │
│ ⚔ Perang│                                                    │
│ 📚 Quiz │                                                    │
│ 🤖 Chat │                                                    │
│ 📄 PDF  │                                                    │
│ ────    │                                                    │
│ ⚙ Setti │                                                    │
│ 💳 Billi│                                                    │
│ ◀ Tutup │                                                    │
└─────────┴────────────────────────────────────────────────────┘
```

### Sidebar
- **Icon 1 warna** (lihat FRONTEND §11), active state pakai accent.
- Collapsible (240px ↔ 64px).
- Mobile: drawer slide-in.

### Navbar
- **Breadcrumb** (kiri).
- **AI Credit Chip** ✨1,234 credits — hover tooltip = breakdown bulan ini.
- **Quota Indicator** 📥 47/100 (PDF) → klik ke `/billing/usage`.
- **Notification Bell** dengan badge unread.
- **Theme Toggle** 🌙/☀.
- **Calendar Mode Toggle** ⊕ (H / M / both).
- **User Menu** 👤 dropdown: profile, billing, logout.

**Tech:**
- Next.js layout (RSC) load menu config from API
- Zustand store untuk sidebar collapsed state (persist localStorage)
- Lucide icons
- shadcn `DropdownMenu`, `Sheet` (mobile drawer)
- SSE untuk real-time notification badge

---

## 5. Dashboard Subscriber (`/dashboard`)

```
┌────────────────────────────────────────────────────────────┐
│ Selamat datang, Galih                                       │
│ Subscription: Premium • Reset: 7 Jun 2026                   │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ PDF          │ │ AI Chat      │ │ Trial Sisa   │          │
│ │ 47 / 1000    │ │ 12 / 500     │ │ —            │          │
│ │ ████░░░░░░   │ │ █░░░░░░░░░   │ │              │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
├────────────────────────────────────────────────────────────┤
│ Lanjut Belajar              Akses Cepat                    │
│ • Abu Bakr (50% read)       [📖 Tokoh] [🗺 Peta] [📄 PDF]    │
│ • Perang Badar              [🤖 Chat]                       │
│                                                            │
│ Konten Baru                 Pengumuman                     │
│ • Bilal bin Rabah ✓ rev     • Update fitur peta perang     │
│ • Khadijah RA ✓ rev                                        │
└────────────────────────────────────────────────────────────┘
```

**Tech:**
- RSC fetch dashboard data parallel via `Promise.all`
- shadcn `Progress`, `Card`
- TanStack Query untuk refetch real-time

---

## 6. Figures List + Detail (1-Page CRUD)

URL pattern: `/figures` (list) → `/figures/[slug]` (detail). Klik kartu → URL berubah ke slug, panel kanan terbuka.

```
URL: /figures?q=&category=sahabat
┌────────────────────────────────────────────────────────────┐
│ Tokoh                                       [+ Tambah Tokoh*] │ (*admin only)
├────────────────────────────────────────────────────────────┤
│ Filter: [ Kategori ▾ ] [ Gender ▾ ] [ Wilayah ▾ ] [ ...lain ]│
│ Search: <🔍 Cari nama atau kunyah...>                       │
├──────────────────────────────┬─────────────────────────────┤
│ LIST (kiri, virtualized)      │  DETAIL (kanan, sticky)     │
│                              │                             │
│ ┌─────────────────────────┐  │  [◀ Back]    [📥 PDF] [✎ Edit*]│
│ │ ⌬ Abu Bakr ash-Shiddiq  │  │  ┌─────────────────────────┐ │
│ │   Sahabat • 13 H        │  │  │  أبو بكر الصديق          │ │
│ │   Tsiqah, Khalifah I    │  │  │  Abu Bakr ash-Shiddiq RA │ │
│ └─────────────────────────┘  │  │  Sahabat • Quraisy        │ │
│ ┌─────────────────────────┐  │  │  Lahir: 50 SH / 573 M     │ │
│ │ ⌬ Umar bin Khattab      │  │  │  Wafat: 13 H / 634 M      │ │
│ │   ...                    │  │  └─────────────────────────┘ │
│ │                          │  │                             │
│ │ ⌬ Khadijah binti Khuwail│  │  Tabs:                       │
│ │   Shahabiyat • 3 SH     │  │  [Biografi][Timeline][Peta] │
│ │                          │  │  [Hubungan][Hadits][Sumber] │
│ └─────────────────────────┘  │                             │
│ [pagination 1 2 3 ...]       │  Konten tab di sini...      │
└──────────────────────────────┴─────────────────────────────┘
```

### Detail Tabs

**Biografi** — markdown rich content, dwi-bahasa toggle, citation hover popover.

**Timeline** — visual sumbu hidup tokoh (lihat §7).

**Peta** — embed mini-map dari peta utama (lihat §11).

**Hubungan** — network graph guru/murid/keluarga.

**Hadits** — counter "diriwayatkan X–Y hadits", link ke sunnah.com.

**Sumber** — list semua citation, klik = side-by-side modal.

**Tech:**
- Side-by-side layout via CSS Grid `1fr 1.5fr` (desktop)
- `react-virtual` untuk list besar
- shadcn `Tabs`, `HoverCard`, `Badge`, `Sheet`
- `react-markdown` + `remark-gfm` untuk biografi
- `vis-network` atau `react-flow` untuk hubungan graph

---

## 7. Timeline Single (di tab Detail Tokoh)

```
[H ◉ M ○ Both ○]              [Zoom −  +]

50 SH ─────────● Lahir ──── 13 H Wafat ─────────────────► 13 H
                  │
                  ├─ 12 SH Masuk Islam
                  │
                  ├─ 1 H Hijrah
                  │
                  ├─ 2 H Perang Badar (komandan: Nabi ﷺ)
                  │
                  ├─ 11 H Wafat Nabi ﷺ
                  │
                  └─ 11–13 H Khalifah Ar-Rasyidin
```

**Tech:**
- **react-chrono** (vertical/horizontal storytelling mode)
- Custom marker styling (Tailwind classes)
- Hijri-Gregorian display via `formatYear()` util
- Hover marker → tooltip dengan citation

---

## 8. Timeline Komparasi Multi-Tokoh (`/timeline`)

User pilih hingga 5 tokoh untuk dibandingkan dengan baseline Nabi ﷺ.

```
┌────────────────────────────────────────────────────────────┐
│ Pilih Tokoh untuk Dibandingkan (max 5)                      │
│                                                            │
│ Tokoh A: [Abu Bakr ash-Shiddiq ▾]    [✕]                    │
│ Tokoh B: [Umar bin Khattab     ▾]    [✕]                    │
│ Tokoh C: [Aisyah RA            ▾]    [✕]                    │
│ [+ Tambah Tokoh]                                            │
│                                                            │
│ Filter: [H ◉ M ○ Both ○]  [Zoom out] [Zoom in] [Fit all]    │
├────────────────────────────────────────────────────────────┤
│  Sumbu Waktu (Hijriyah)                                    │
│   -50    -10    0    10    20    30    40    50    60      │
│   │      │      │    │     │     │     │     │     │       │
│ ┌─┴──────┴──────┴────┴─────┴─────┴─────┴─────┴─────┴─────┐  │
│ │NABI ﷺ                                                    │  │
│ │           ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●        │  │
│ │           lahir                          11H wafat       │  │
│ │                  ↑bi'tsah                                 │  │
│ ├──────────────────────────────────────────────────────────┤  │
│ │ABU BAKR                                                   │  │
│ │  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●               │  │
│ │  -50         masuk Islam ↑      khalifah↑   13H wafat    │  │
│ ├──────────────────────────────────────────────────────────┤  │
│ │UMAR                                                       │  │
│ │     ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●         │  │
│ ├──────────────────────────────────────────────────────────┤  │
│ │AISYAH (♀)                                                 │  │
│ │              ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●    │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                            │
│ Klik marker → popover dengan peristiwa & citation.          │
└────────────────────────────────────────────────────────────┘
```

### Mode Lazy-Load Dropdown
Pilih sahabat → dropdown tabi'in **otomatis filter** ke yang hidup setelahnya:
```
Tabi'in: [Pilih tabi'in yang hidup setelah Abu Bakr (13 H) ▾]
         ↳ Said bin Musayyab
         ↳ Hasan al-Bashri
         ↳ ...
```

**Tech:**
- **vis-timeline** (mature, mendukung multi-group lane, zoom, drag, dataset besar)
- Wrapper React: `vis-timeline-react`
- Custom rendering item untuk dwi-kalender axis (top H, bottom M)
- Lazy-load dropdown: TanStack Query dengan filter `death_date_ah > selectedRef.death_date_ah`
- Color per gender (subtle, mis. accent gold untuk perempuan)

---

## 9. Timeline Ulama Salaf Plus (`/timeline-ulama`)

View khusus seluruh generasi salaf hingga 2026.

```
┌────────────────────────────────────────────────────────────┐
│ Timeline Ulama Salaf                       [Premium Only]   │
├────────────────────────────────────────────────────────────┤
│ Filter:                                                     │
│  Generasi:    ☑ Sahabat ☑ Tabi'in ☑ Tabi'ut ☑ Pasca-Salaf   │
│  Spesialisasi: ☑ Hadits ☑ Fiqh ☐ Tafsir ☐ Aqidah ☐ Lughah  │
│  Mazhab:       ☐ Syafi'i ☐ Maliki ☐ Hanafi ☐ Hanbali        │
│  Wilayah:      [ Semua ▾ ]   Tahun: [ 1H — 1450H ]          │
│  Genealogi:    [☑ Tampil jalur guru–murid]                  │
├────────────────────────────────────────────────────────────┤
│  1H ─────── 200H ─────── 500H ─────── 1000H ────── 1450H    │
│  │           │            │             │            │      │
│  ● Abu Bakr  ● Bukhari    ● Nawawi     ● Albani              │
│  ● Umar      ● Muslim     ● Ibn Hajar  ● Bin Baz             │
│  ● Aisyah    ● Ahmad      ● Dzahabi    ● Utsaimin            │
│              ↓ student of                                   │
│              ● Said bin Musayyab → ● Az-Zuhri → ● Malik     │
│                                                            │
│  → garis silsilah keilmuan (dashed line, klik = highlight)  │
└────────────────────────────────────────────────────────────┘
```

**Tech:**
- **visx** + D3 force layout untuk genealogi
- Atau **vis-network** kalau lebih simpel (graph + timeline hybrid)
- Custom Canvas / SVG rendering untuk performa (bisa ada ratusan ulama)

---

## 10. Map — All Characters (`/map`)

Peta utama interaktif menampilkan lokasi seluruh tokoh.

```
┌────────────────────────────────────────────────────────────┐
│ [Filter ▾] [Layer ▾] [Search lokasi 🔍]    [─ + ↺]          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│         ┌─────────────────────────────────┐                │
│         │         (Maplibre GL canvas)    │                │
│         │                                 │                │
│         │   📍 Mekkah (124 tokoh)         │                │
│         │   📍 Madinah (256)              │                │
│         │   📍 Damaskus (78)              │                │
│         │   📍 Baghdad (143)              │                │
│         │   📍 Bashrah (67)               │                │
│         │   📍 Mesir / Fustat (54)        │                │
│         │   📍 Andalusia / Cordoba (32)   │                │
│         │                                 │                │
│         │   (heat map ketebalan = jumlah) │                │
│         └─────────────────────────────────┘                │
│                                                            │
│  Side Panel (right):                                       │
│  📍 Mekkah                                                  │
│  124 tokoh terkait                                          │
│  • Tinggal: Khadijah, Abu Bakr, ...                         │
│  • Lahir di sini: ...                                       │
│  • Wafat di sini: ...                                       │
│  [Lihat semua tokoh di Mekkah →]                            │
└────────────────────────────────────────────────────────────┘
```

### Layer Toggle
- Tokoh (semua) — heatmap.
- Per kategori (Nabi / Sahabat / Tabi'in / dst).
- Per gender.
- Perang (lihat §13).
- Hijrah routes (animasi garis hijrah Nabi ﷺ).

### Marker Interaction
- Klik marker lokasi → side panel daftar tokoh.
- Klik tokoh di list → buka `/figures/[slug]` (sesuai 1-page pattern).

**Tech:**
- **MapLibre GL JS** + `react-map-gl/maplibre` (modern, WebGL, no API key, performa baik untuk dataset besar)
- Tile: OpenStreetMap atau MapTiler free tier
- Marker custom dengan SVG + CSS animation
- Heatmap layer: MapLibre `heatmap` layer type
- Clustering: MapLibre cluster source untuk performa ratusan marker
- Hijrah animasi: GeoJSON LineString + custom layer

---

## 11. Map Single Character

Embed mini di tab Detail Tokoh, juga full-page accessible.

```
┌──────────────────────────────────────────┐
│ Lokasi sepanjang hidup Abu Bakr RA        │
├──────────────────────────────────────────┤
│  (Map showing connected points)           │
│   1. Mekkah (lahir, 50 SH)                │
│   2. Madinah (hijrah, 1 H)                │
│   3. Yamamah (ekspedisi, 12 H)            │
│   4. Madinah (wafat, 13 H)                │
│                                          │
│   Garis kronologis menghubungkan titik.   │
│   Marker bernomor sesuai urutan kejadian. │
└──────────────────────────────────────────┘
```

**Tech:** sama dengan §10, tapi data terbatas ke 1 tokoh + GeoJSON LineString untuk kronologi.

---

## 12. Battles List (`/battles`)

```
┌────────────────────────────────────────────────────────────┐
│ Sirah Perang                                                │
├────────────────────────────────────────────────────────────┤
│ Filter: [Jenis ▾ ghazwah/sariyyah] [Tahun] [Lokasi]         │
├────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐                            │
│  │ ⚔ Perang Badar             │  Detail panel →             │
│  │ 2 H / 624 M                │                            │
│  │ Panglima: Nabi ﷺ            │                            │
│  │ 313 vs 1,000                │                            │
│  │ Kemenangan ✓                │                            │
│  └─────────────────────────────┘                            │
│  ⚔ Perang Uhud         3 H                                   │
│  ⚔ Khandaq            5 H                                    │
│  ⚔ Khaibar             7 H                                   │
│  ⚔ Fath Mekkah         8 H                                   │
│  ...                                                        │
└────────────────────────────────────────────────────────────┘
```

---

## 13. Battle Detail + War Map

```
┌────────────────────────────────────────────────────────────┐
│ ◀ Back   Perang Badar — 2 H / 624 M       [📥 PDF]          │
├────────────────────────────────────────────────────────────┤
│ Tabs: [Narasi][Peta Strategi][Tokoh][Fase][Sumber]          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  PETA STRATEGI:                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  (MapLibre + custom layer overlay)                    │  │
│  │                                                       │  │
│  │   🟢 313 Pasukan Muslim                                │  │
│  │   🔴 1,000 Pasukan Quraisy                             │  │
│  │   ━━▶ panah pergerakan pasukan (animated)              │  │
│  │   ⭐ titik kunci (lembah Badar)                         │  │
│  │   ⚐ titik strategi pengamanan sumur                    │  │
│  │                                                       │  │
│  │   Phase Slider: 1/5  [◀]  Setting peta  [▶]            │  │
│  │   Fase 1: Pergerakan menuju Badar                      │  │
│  │   Fase 2: Penyergapan sumur                            │  │
│  │   Fase 3: Pertemuan dua pasukan                        │  │
│  │   Fase 4: Pertempuran                                  │  │
│  │   Fase 5: Kemenangan                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  Komandan Muslim: Nabi Muhammad ﷺ                           │
│  Sahabat penting: Abu Bakr, Umar, Ali, Hamzah, ...          │
│  Yang gugur: 14 (syuhada)                                   │
│  Tawanan musuh: 70                                          │
└────────────────────────────────────────────────────────────┘
```

### Phase Slider
- Slider mengontrol "fase" pertempuran.
- Tiap fase punya GeoJSON layer berbeda + narasi terkait.
- Animasi smooth antar fase (Framer Motion).

**Tech:**
- **MapLibre GL JS** dengan custom GeoJSON layers per fase
- `react-map-gl/maplibre`
- Animated arrows via SVG + Framer Motion (di atas map sebagai overlay div, atau MapLibre custom layer)
- shadcn `Slider`
- Toggle troop visibility via layer.visible

---

## 14. Quiz (`/quiz`)

```
┌────────────────────────────────────────────────────────────┐
│ Quiz Para Sahabat — Level: Mudah                            │
├────────────────────────────────────────────────────────────┤
│ Q3 / 10                              Timer: 02:35 ⏱        │
│                                                            │
│ Siapa Khalifah pertama setelah wafatnya Nabi ﷺ?             │
│                                                            │
│   ○  A. Umar bin Khattab RA                                 │
│   ○  B. Abu Bakr ash-Shiddiq RA                             │
│   ○  C. Ali bin Abi Thalib RA                               │
│   ○  D. Utsman bin Affan RA                                 │
│                                                            │
│  [← Sebelumnya]              [Lanjut →]                    │
└────────────────────────────────────────────────────────────┘
```

Selesai → halaman skor + review jawaban + button retry / share.

**Tech:** react-hook-form, Framer Motion untuk transisi soal, Zustand untuk session state.

---

## 15. AI Chat (`/chat`)

```
┌────────────────────────────────────────────────────────────┐
│ AI Chat                            ✨ Sisa: 487 credits     │
├────────────────────────────────────────────────────────────┤
│ Conversations            │ Main                              │
│ + Baru                   │  ┌────────────────────────────┐  │
│ • Tentang Khadijah       │  │ You: Siapa istri pertama   │  │
│ • Perbedaan tabi'in      │  │       Nabi ﷺ?               │  │
│ • Tokoh Andalusia        │  │                            │  │
│ ...                      │  │ AI: Istri pertama Nabi ﷺ   │  │
│                          │  │ adalah Khadijah binti      │  │
│                          │  │ Khuwailid radhiyallaahu... │  │
│                          │  │ [Lihat profil Khadijah →]  │  │
│                          │  │ Sumber: islamqa.info/12345  │  │
│                          │  └────────────────────────────┘  │
│                          │  <Ketik pesan...>       [Send →]│
└────────────────────────────────────────────────────────────┘
```

- Streaming response.
- Link otomatis ke tokoh dari database bila terdeteksi.
- Citation source di footer reply.

**Tech:**
- **Vercel AI SDK** (`useChat`)
- Server endpoint `streamText` (BACKEND §6.2)
- Markdown rendering dengan citation parser
- Sonner toast saat quota tinggal sedikit

---

## 16. PDF Book Builder (`/pdf-builder`)

```
┌────────────────────────────────────────────────────────────┐
│ Buat Buku PDF                            Sisa quota: 47/100 │
├────────────────────────────────────────────────────────────┤
│ Step 1: Pilih Tokoh (2 — 60 max)                            │
│  [🔍 Cari tokoh...]                                          │
│  Filter: [Kategori ▾] [Gender ▾]                            │
│                                                            │
│  Dipilih (5):                                               │
│  • Abu Bakr ash-Shiddiq RA  [✕]                             │
│  • Umar bin Khattab RA      [✕]                             │
│  • Utsman bin Affan RA      [✕]                             │
│  • Ali bin Abi Thalib RA    [✕]                             │
│  • Khadijah RA               [✕]                             │
│                                                            │
│ Step 2: Judul Buku                                          │
│  Judul Arab : <خلفاء الراشدين___________________>            │
│  Judul Indo : <Khulafa ar-Rasyidin_______________>          │
│  [ ✨ Generate Judul Otomatis dari AI ]                      │
│                                                            │
│ Step 3: Template & Layout                                   │
│  Template:                                                  │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐                                │
│   │Klas│ │Mode│ │Kali│ │Mini│                                │
│   │ ◉  │ │ ○  │ │ ○  │ │ ○  │                                │
│   └────┘ └────┘ └────┘ └────┘                                │
│  Kertas: [A4 ▾]  Orientasi: ◉ Portrait  ○ Landscape         │
│  Bahasa: ◉ Dwi-Bahasa  ○ ID  ○ AR                            │
│  Sertakan: ☑ Timeline ☑ Peta ☑ Ilustrasi CSS                │
│                                                            │
│ Step 4: Cover                                               │
│  Penulis    : Galih (auto, tidak bisa diubah)                │
│  Email      : galih@... (auto)                              │
│  [Preview Cover →]                                          │
│                                                            │
│  [Preview PDF]               [💾 Generate & Download]        │
└────────────────────────────────────────────────────────────┘
```

### Live Preview
Klik [Preview PDF] → iframe popup dengan rendering 5 halaman pertama (faster).

**Tech:**
- shadcn `Stepper`, `RadioGroup`, `MultiSelect` (combobox)
- Worker job dispatch saat klik Generate
- Sonner `toast.loading` → update ke success dengan action download
- Live preview: server endpoint render HTML → iframe

---

## 17. PDF Templates Preview

```
Template Klasik                Template Modern
┌──────────────┐               ┌──────────────┐
│   أ ث ر       │               │   ATSAR      │
│              │               │              │
│   كتاب       │               │  Khulafa     │
│  الخلفاء     │               │  ar-Rasyidin │
│              │               │              │
│ Penulis: G   │               │ by Galih     │
└──────────────┘               └──────────────┘
   [Preview]                      [Preview]

Template Kaligrafi             Template Minimalis
   ...                            ...
```

---

## 18. Trash View (`/(admin|app)/trash/[type]`)

```
┌────────────────────────────────────────────────────────────┐
│ Trash — Tokoh                       [🗑 Kosongkan Semua*]    │
├────────────────────────────────────────────────────────────┤
│ ⚠ Item akan dihapus permanen jika lebih dari 30 hari.        │
├────────────────────────────────────────────────────────────┤
│ ☐ Pilih semua                                               │
│                                                            │
│ ☐ Abu Said al-Khudri         deleted 3 hari lalu by Admin   │
│   [↺ Restore]   [🗑 Hapus Permanen]                          │
│                                                            │
│ ☐ Salman al-Farisi           deleted 7 hari lalu            │
│   [↺ Restore]   [🗑 Hapus Permanen]                          │
│                                                            │
│ [Restore Terpilih]   [Hapus Permanen Terpilih]              │
└────────────────────────────────────────────────────────────┘
```

- Hapus Permanen → SweetAlert dengan input "HAPUS" untuk konfirmasi.
- Auto-purge cron: item > 30 hari di trash dihapus permanen.

**Tech:** SweetAlert2 konfirmasi (FRONTEND §6).

---

## 19. Admin — Users Management (`/admin/users`)

```
┌────────────────────────────────────────────────────────────┐
│ Users                                    [+ Undang User]    │
├────────────────────────────────────────────────────────────┤
│ Search: <🔍 ___>     Role: [Semua ▾]  Status: [Aktif ▾]    │
├────────────────────────────────────────────────────────────┤
│ ☐ Email             Nama         Role      Tier    Tindakan │
├────────────────────────────────────────────────────────────┤
│ ☐ galih@...        Galih        Admin     —       ⋯        │
│ ☐ ust1@...         Ust. Ahmad   Reviewer  —       ⋯        │
│ ☐ user1@...        Fulan        Subscr.   Pro     ⋯        │
│   trial sampai 16 Mei 2026                                  │
│                                                            │
│ [...]                                                      │
│                                                            │
│ pagination 1 2 3                                            │
└────────────────────────────────────────────────────────────┘
```

⋯ dropdown: View, Edit Role, Suspend, Reset Password, Activate Subscription, Soft Delete.

---

## 20. Admin — Role Management & Menu Matrix (`/admin/roles`)

User instruction: **role management & menu matrix, tiap role bisa diatur akses-nya**.

```
┌────────────────────────────────────────────────────────────┐
│ Roles & Permissions                   [+ Buat Role Custom]  │
├────────────────────────────────────────────────────────────┤
│ Roles: [Admin] [Reviewer] [Subscriber] [+ ...]              │
├────────────────────────────────────────────────────────────┤
│ Permission Matrix (klik untuk toggle)                       │
│                                                            │
│ Group           Admin  Reviewer  Subscriber                 │
│ ─────────────────────────────────────────────               │
│ figures.view    ✅     ✅       ✅                            │
│ figures.create  ✅     ⛔       ⛔                            │
│ figures.update  ✅     ⛔       ⛔                            │
│ figures.delete  ✅     ⛔       ⛔                            │
│ figures.review  ✅     ✅       ⛔                            │
│ figures.publish ✅     ⛔       ⛔                            │
│ trash.view      ✅     ⛔       ⛔                            │
│ trash.restore   ✅     ⛔       ⛔                            │
│ trash.hard_delete ✅   ⛔       ⛔                            │
│ ai.chat         ✅     ✅       quota                        │
│ ai.agent.use    ✅     ⛔       ⛔                            │
│ ...                                                        │
│                                                            │
│ [💾 Simpan Perubahan]                                       │
└────────────────────────────────────────────────────────────┘
```

### Menu Matrix Tab
```
Menu Item              Admin  Reviewer  Subscriber
Dashboard              ✅    ✅       ✅
Sahabat                ✅    ✅       ✅
Trash                  ✅    ⛔       ⛔
Admin Panel            ✅    ⛔       ⛔
AI Providers           ✅    ⛔       ⛔
Audit Log              ✅    view-own  ⛔
...
```

**Tech:**
- shadcn `Tabs`, `Switch`, `Table`
- Optimistic UI update (Sonner toast "Tersimpan" muncul instant, rollback bila API fail)
- Single payload POST `/api/v1/admin/roles/:id/permissions`

---

## 21. Admin — AI Providers & Models (`/admin/ai-providers`)

```
┌────────────────────────────────────────────────────────────┐
│ AI Providers                          [+ Tambah Provider]   │
├────────────────────────────────────────────────────────────┤
│ Tabs: [Provider Aktif] [Semua Model] [Role Assignment]      │
├────────────────────────────────────────────────────────────┤
│ Active Providers                                            │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 🟢 DeepSeek                                          │    │
│ │   API Key: sk-•••••8d73   [Test] [Rotate]            │    │
│ │   Models: deepseek-v4-pro, deepseek-v4-flash (aktif) │    │
│ │   [Edit]  [Disable]                                  │    │
│ └──────────────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⚪ Anthropic     [Enable]                             │    │
│ │   Models: claude-opus-4-7, claude-sonnet-4-6...      │    │
│ └──────────────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⚪ OpenAI         [Enable]                            │    │
│ │   Models: gpt-5.5-instant, gpt-5...                  │    │
│ └──────────────────────────────────────────────────────┘    │
│ ...                                                        │
└────────────────────────────────────────────────────────────┘
```

### Role Assignment Tab
```
AI Role          Model Aktif                Provider     Ganti
chat             deepseek-v4-flash          DeepSeek     [▾]
agent            deepseek-v4-flash          DeepSeek     [▾]
doc_analyzer     claude-sonnet-4-6          Anthropic    [▾]
embedding        text-embedding-3-large     OpenAI       [▾]
avatar           — (belum diset)            —            [▾]
```

---

## 22. Admin — Fonts (`/admin/fonts`)

(Sudah didetailkan di IDEAS §3b.4)

```
┌────────────────────────────────────────────────────────────┐
│ Font Management                       [+ Tambah Font]       │
├────────────────────────────────────────────────────────────┤
│ ACTIVE SLOTS                                                │
│ display_latin    Playfair Display      [Change ▾] [Preview] │
│ body_latin       Inter                 [Change ▾] [Preview] │
│ display_arab     Amiri                 [Change ▾] [Preview] │
│ section_arab     Reem Kufi             [Change ▾] [Preview] │
│ body_arab        Cairo                 [Change ▾] [Preview] │
│ quran_arab       Amiri                 [Change ▾] [Preview] │
│ mono             JetBrains Mono        [Change ▾] [Preview] │
│                                                            │
│ ALL FONTS                                                   │
│ ☑ Playfair Display    latin   active                        │
│ ☑ Inter              latin    active                        │
│ ☑ Amiri              arabic   active                        │
│ ☑ Reem Kufi          arabic   active                        │
│ ☐ EB Garamond        latin    inactive                      │
│ ...                                                        │
└────────────────────────────────────────────────────────────┘
```

Klik Change → modal dropdown semua font kompatibel + preview Arab + Latin.

---

## 23. Admin — Whitelist Domains (`/admin/whitelist`)

```
┌────────────────────────────────────────────────────────────┐
│ Whitelist Domains                     [+ Tambah Domain]     │
├────────────────────────────────────────────────────────────┤
│ ☑ islamqa.info       AR  prio=10  rate=30/min  active       │
│ ☑ dorar.net          AR  prio=10  rate=30/min  active       │
│ ☑ islamweb.net       AR  prio=8   rate=20/min  active       │
│ ☑ shamela.ws         AR  prio=9   rate=10/min  active       │
│ ☑ sunnah.com         EN  prio=7   rate=30/min  active       │
│ ☑ alukah.net         AR  prio=6   rate=20/min  active       │
│ ☐ rumaysho.com       ID  prio=5   rate=10/min  inactive     │
└────────────────────────────────────────────────────────────┘
```

---

## 24. Admin — Subscriptions & Payments

```
┌────────────────────────────────────────────────────────────┐
│ Subscriptions                                               │
├────────────────────────────────────────────────────────────┤
│ Pending Activation (3) — perlu konfirmasi pembayaran        │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ Fulan • Premium Tahunan • Rp 5.389.200                │    │
│ │ Bukti: bca_transfer.jpg [👁]                          │    │
│ │ Diajukan: 13 Mei 2026 14:32                           │    │
│ │ [✓ Aktifkan]   [✗ Tolak]                              │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                            │
│ Active Subscriptions (152)                                  │
│ table dengan filter & search...                             │
└────────────────────────────────────────────────────────────┘
```

---

## 25. Admin — Audit Log (`/admin/audit-logs`)

```
┌────────────────────────────────────────────────────────────┐
│ Audit Log                              [Export CSV]         │
├────────────────────────────────────────────────────────────┤
│ Filter: Actor / Action / Resource / DateRange               │
├────────────────────────────────────────────────────────────┤
│ Time            Actor    Role      Action           Resourc │
│ 13/05 14:23     Galih    admin     update           figures │
│ 13/05 14:20     U.Ahmad  reviewer  approve          figures │
│ 13/05 13:10     System   system    crawl_complete   figures │
│ ...                                                        │
│                                                            │
│ Klik row → diff viewer modal                                │
└────────────────────────────────────────────────────────────┘
```

---

## 26. Reviewer — Review Queue (`/reviewer/queue`)

```
┌────────────────────────────────────────────────────────────┐
│ Antrian Review (Ustadz Ahmad)              12 menunggu      │
├────────────────────────────────────────────────────────────┤
│ Filter: [Status ▾] [Kategori ▾]                             │
├────────────────────────────────────────────────────────────┤
│ ⏱ Pending (8)                                                │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⌬ Abu Bakr ash-Shiddiq RA       di-assign 2 jam lalu  │    │
│ │   Sumber: 3 citation (islamqa, dorar)                 │    │
│ │   AI confidence: 87%   [Review →]                     │    │
│ └──────────────────────────────────────────────────────┘    │
│ ...                                                        │
│ 🔄 Sedang Revisi (3)                                         │
│ ✓ Selesai Bulan Ini (47)                                     │
└────────────────────────────────────────────────────────────┘
```

---

## 27. Reviewer — Review Side-by-Side (`/reviewer/review/[id]`)

User instruction: **side-by-side dengan sumber, klik citation → buka halaman sumber**.

```
┌────────────────────────────────────────────────────────────┐
│ ◀ Antrian   Review: Abu Bakr ash-Shiddiq RA      [Diff v1↔2]│
├──────────────────────────────────┬─────────────────────────┤
│ SUMBER (live fetch)              │ KONTEN ATSAR (draft)    │
│ islamqa.info/123 [↗ buka tab]    │                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ ━━━━━━━━━━━━━━━━━━━━━━━━│
│ <iframe sandbox>                  │ # Abu Bakr ash-Shiddiq  │
│  Nama Lengkap:                    │   ash-Shiddiq RA        │
│  Abdullah bin Abi Quhafah         │                         │
│  ath-Tha'labi at-Taimi...         │ Nama lengkap: Abdullah  │
│                                  │ bin Abi Quhafah         │
│  Lahir 2 tahun setelah            │ ath-Tha'labi at-Taimi.. │
│  Tahun Gajah...                   │                         │
│ </iframe>                         │ Lahir tahun 50 SH /     │
│                                  │ 573 M, dua tahun setela │
│ ⌖ scroll ke citation aktif        │ tahun gajah.            │
│                                  │ ...                     │
│                                  │ [HIGHLIGHTED CITATION]  │
│                                  │ tahun gajah...          │
│                                  │  ↑ klik = scroll source │
├──────────────────────────────────┴─────────────────────────┤
│                                                            │
│  [✓ Approve]   [✎ Request Edit]   [✗ Reject]                │
└────────────────────────────────────────────────────────────┘
```

**Tech:**
- Side-by-side: CSS Grid 1fr 1fr
- Source panel: `<iframe sandbox>` ke halaman whitelist (CORS issues? fallback: server-side fetched + sanitized HTML displayed in shadow DOM)
- Sync scroll between panels (optional)
- Citation highlight: `<mark>` dengan onClick scroll-to-source-anchor
- Diff viewer modal: `react-diff-viewer`

---

## 28. Reviewer — AI-Assisted Edit

Klik [Request Edit] → modal SweetAlert:
```
┌──────────────────────────────────────────────────┐
│ Request Edit untuk Abu Bakr ash-Shiddiq           │
│                                                  │
│ Tulis instruksi untuk AI dalam bahasa natural:    │
│ ┌────────────────────────────────────────────┐    │
│ │ Tambahkan informasi tentang perang Yarmuk │    │
│ │ di bagian akhir. Tahun wafat yang benar     │    │
│ │ adalah 13 H, bukan 14 H (lihat Tahdzib).    │    │
│ │ Ganti "beliau berkata" jadi "beliau RA      │    │
│ │ berkata".                                  │    │
│ └────────────────────────────────────────────┘    │
│                                                  │
│ AI akan menerapkan instruksi ini ke konten.      │
│                                                  │
│ [Batal]                  [✨ Submit ke AI]        │
└──────────────────────────────────────────────────┘
```

Submit → loading state → diff viewer:
```
┌────────────────────────────────────────────┐
│ Diff: Original vs AI Revisi                │
├────────────────────────────────────────────┤
│ - Wafat tahun 14 H                         │
│ + Wafat tahun 13 H (Tahdzib at-Tahdzib)    │
│                                            │
│ + ## Peran di Perang Yarmuk                │
│ + Pada masa khilafahnya, Abu Bakr RA       │
│ + mengirim pasukan ke Yarmuk yang dipimpin │
│ + ...                                      │
│                                            │
│ [Tolak Revisi]  [✓ Setujui & Save Draft]    │
└────────────────────────────────────────────┘
```

**Tech:** server endpoint `/api/v1/reviewer/ai-edit` enqueue worker job → SSE notify back.

---

## 29. Settings (`/settings`)

```
Tabs: [Profile] [Preferences] [Subscription] [Security]

Profile:
  Foto avatar
  Nama Lengkap   <__>
  Email           ___@___  (verified ✓)
  Phone           <__>

Preferences:
  Bahasa UI:      ◉ Indonesia ○ Arab ○ Auto
  Tema:           ◉ Auto ○ Light ○ Dark
  Calendar:       ◉ Both ○ H ○ M
  [Simpan]

Subscription:
  Tier:           Premium (yearly)
  Sejak:          15 Mar 2026
  Reset:          15 Apr 2026 / 15 Jun 2026 / ...
  Penggunaan bulan ini:
   PDF download:  47 / 1000
   AI chat:       12 / 500
  [Lihat history] [Upgrade] [Kontak Admin untuk berhenti]

Security:
  Ubah password
  2FA: [Aktifkan]
  Active sessions: [Lihat]
```

---

## 30. Billing & AI Usage History (`/billing/ai-usage`)

```
┌────────────────────────────────────────────────────────────┐
│ Penggunaan AI                                               │
├────────────────────────────────────────────────────────────┤
│ Periode: 7 Mei – 7 Jun 2026                                  │
│ Total credits: 1,234 / 5,000   ████████░░░░░░░               │
│                                                            │
│  Chart bar bulanan per role (Chart.js / Recharts)          │
│  ▮ chat  ▮ agent  ▮ doc_analyzer                            │
│                                                            │
│ History (table)                                             │
│ Time         Role    Model              Tokens    Credits   │
│ 13/05 14:23  chat    deepseek-v4-flash  1,234     12        │
│ 13/05 13:10  chat    deepseek-v4-flash  890       9         │
│ ...                                                        │
│ Filter: [DateRange] [Role ▾] [Model ▾]                      │
└────────────────────────────────────────────────────────────┘
```

**Tech:** Recharts (Tailwind-friendly) untuk chart, TanStack Table untuk data table dengan filter.

---

## 31. Notifications Panel (`/notifications`)

```
┌────────────────────────────────────────────────────────────┐
│ Notifikasi                              [Tandai semua read]  │
├────────────────────────────────────────────────────────────┤
│ Hari ini                                                    │
│ • 📥 PDF "Khulafa ar-Rasyidin" siap [Download]              │
│ • ✅ Konten Salman al-Farisi disetujui                       │
│ • ⏰ Subscription akan berakhir 5 hari lagi [Perpanjang]     │
│                                                            │
│ Minggu ini                                                  │
│ • ⚠ Reviewer request edit ke Abu Bakr [Lihat]                │
│ ...                                                        │
└────────────────────────────────────────────────────────────┘
```

**Tech:** SSE atau polling 30s, Sonner toast untuk new notification.

---

## 32. Pricing Page (`/pricing`)

```
┌────────────────────────────────────────────────────────────┐
│        Pilih paket yang sesuai untukmu                      │
│                                                            │
│ Toggle: ◉ Bulanan ○ Tahunan (diskon 10%)                    │
│                                                            │
│ ┌─────┐ ┌─────┐ ┌──────┐ ┌─────┐ ┌─────────┐                │
│ │Free │ │Sampl│ │Basic │ │Pro  │ │Premium  │                │
│ │ Rp0 │ │29k  │ │99k   │ │299k │ │499k     │                │
│ │     │ │PROMO│ │      │ │     │ │MOST POP │                │
│ │30   │ │20+20│ │Semua │ │+    │ │+ Tabi'ut│                │
│ │sahab│ │+20  │ │sahab │ │tabii│ │ + pasca │                │
│ │     │ │     │ │      │ │     │ │         │                │
│ │[Mul]│ │[Pil]│ │[Pil] │ │[Pil]│ │[Pilih]  │                │
│ └─────┘ └─────┘ └──────┘ └─────┘ └─────────┘                │
│                                                            │
│ Tabel detail fitur (toggle ▾)                                │
│                                                            │
│ ⚠ Pembayaran tidak dapat dikembalikan (lihat T&C).           │
│ ⚠ Aktivasi manual oleh admin. Kontak: Galih WA 0813-1950-44 │
└────────────────────────────────────────────────────────────┘
```

---

## 33. Halaman "Subscription Expired"

User instruction: **kalau subscription habis, hanya bisa lihat halaman bayar**.

```
┌────────────────────────────────────────────────────────────┐
│           ⏳ Langganan Anda Telah Berakhir                  │
│                                                            │
│   Untuk melanjutkan akses ke Atsar, silakan perpanjang     │
│   langganan Anda.                                          │
│                                                            │
│   Tier sebelumnya: Premium                                  │
│   Habis pada:       7 Mei 2026                              │
│                                                            │
│   [Lihat Pricing]   [Saya sudah bayar — minta aktivasi]    │
│                                                            │
│   Kontak Admin: Galih • WA 0813-1950-4441                   │
│                                                            │
│   [Logout]                                                  │
└────────────────────────────────────────────────────────────┘
```

Menu semua disabled, sidebar hilangkan.

---

## 34. Mobile Layouts (Responsive Note)

- Sidebar → drawer slide-in (hamburger menu kiri navbar).
- 1-page CRUD → stack (list lalu detail), back button = browser back.
- Timeline → horizontal scroll dengan momentum.
- Map → fullscreen toggle.
- Filter panels → bottom sheet.

**Breakpoints (Tailwind default):**
- `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- Desktop split layout aktif pada `lg+`.

---

## 35. Ringkasan Library per Fitur

| Fitur | Library Utama | Alternatif |
|---|---|---|
| Timeline biografi tunggal | react-chrono | visx custom |
| Timeline komparasi | vis-timeline (vis.js) | visx + D3 |
| Timeline Ulama Salaf | visx + D3 force | vis-network |
| Peta (semua) | MapLibre GL + react-map-gl | Leaflet (fallback) |
| Peta perang fase | MapLibre + GeoJSON animated | Leaflet + custom |
| Family/hubungan graph | vis-network atau react-flow | D3 force |
| Chart (usage) | Recharts | visx |
| Data table | TanStack Table | shadcn Table |
| Form | react-hook-form + zod | — |
| Modal konfirmasi | SweetAlert2 + sweetalert2-react-content | — |
| Toast | Sonner | react-hot-toast |
| AI chat streaming | Vercel AI SDK | — |
| PDF gen (server) | Puppeteer (in worker) + fonts pre-installed (Amiri, Cairo, Noto Naskh) | WeasyPrint fallback |
| Markdown render | react-markdown + remark-gfm | — |
| Diff viewer (revisi) | react-diff-viewer-continued | — |
| Drag & drop | dnd-kit | — |
| Date | dayjs + plugin hijri | moment-hijri |
| Hijri converter | hijri-converter (server, Python) atau hijri-js (client) | — |
| i18n | next-intl | — |
| Theme switch | next-themes pattern manual | — |
| Animation | Framer Motion | — |

---

## 36. Performa Tips per Fitur

- **Timeline 100+ tokoh**: pakai canvas mode di vis-timeline.
- **Peta 1000+ marker**: pakai clustering MapLibre `cluster` source.
- **PDF besar**: progressive render di worker, chunk halaman.
- **Biografi panjang**: lazy load tab content (load on click).
- **Chat history**: virtualize dengan TanStack Virtual.
