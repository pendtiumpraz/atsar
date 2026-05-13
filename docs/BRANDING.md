# Athar — Branding Guidelines

> Brand foundation document. Update di sini bila ada perubahan.
> Cross-reference: lihat `docs/IDEAS.md` untuk fitur produk.

---

## 1. Nama Brand

**Athar** (Arab: **أثر**)

- Makna: "jejak", "warisan", "yang ditinggalkan".
- Pengucapan: /ʔaθar/ — "ATH-ar" (dua suku kata).
- Transliterasi resmi: **Athar** (bukan "Atsar", "Asar", atau variasi lain).
- Logogram Arab: **أثر** — selalu ditulis tanpa harakat.

### Alasan Pemilihan
- **Pendek** — 5 huruf Latin, 3 huruf Arab. Memorable.
- **Makna persis** dengan misi aplikasi: mengumpulkan & menampilkan jejak para salaf untuk dipelajari hari ini.
- **Dual-audience** — istilah "atsar" familiar untuk santri (ilmu hadits), tapi tetap mudah diterima awam.
- **Visual-friendly** — 3 huruf Arab mudah di-styled jadi logo kaligrafi.

### Domain (Perlu Cek)
Prioritas: `athar.app`, `athar.id`, `athar.com`.
Fallback bila taken: `athar.studio`, `atharapp.com`, `goathar.id`, `athar.co.id`.

---

## 2. Tagline

**Utama (Indonesia):**
> Jejak generasi terbaik, dalam genggamanmu.

**Pendamping (Arab):**
> آثار خير القرون بين يديك

**Versi pendek (untuk button / micro-copy):**
> Pelajari jejak salaf.

**Versi internasional (English):**
> Trace the legacy of the best generations.

### Aturan Pemakaian
- Tagline utama selalu muncul di **hero landing page** & **cover PDF**.
- Tagline Arab muncul di hero (di bawah logo) & cover buku PDF.
- Versi pendek untuk **meta description**, **app store**, **social bio**.

---

## 3. Positioning

### Audiens
Brand harus melayani **empat segmen sekaligus**:
1. **Muslim awam** — perlu penjelasan ramah, tidak intimidasi.
2. **Santri & pelajar agama** — apresiasi istilah teknis, sumber, akurasi.
3. **Mahasiswa & peneliti** — butuh data terstruktur, citation, export.
4. **Asatidz, da'i, guru** — butuh material siap pakai untuk pengajaran.

### Karakter Brand
**Hybrid: foundation klasik (turats), UI modern.**

- **Berwibawa** — karena substansi seriu (sirah, rijal, jarh wa ta'dil).
- **Welcoming** — awam tidak boleh merasa intimidated.
- **Berbasis sumber** — anti-hallucination, selalu cite.
- **Visual** — peta & timeline adalah USP utama.

### Tidak Boleh
- Terasa "joke-y" / meme-y.
- Terlalu kaku & akademik sampai awam kabur.
- Pakai imagery figuratif (wajah, gambar tokoh).
- Comic Sans, emoji berlebihan, gradien neon, ilustrasi kartun anak-anak.

---

## 4. Color Palette — Emerald Turats

### Core Colors
```
NAME              HEX       USAGE
─────────────────────────────────────────────────────
Emerald Primary   #0F4C3A   Logo, primary button, header
Warm Cream        #FAF5EB   Background, surface
Antique Gold      #B89968   Accent, link, decorative
Dark Espresso     #1F1810   Body text, heading
```

### Extended Palette (Derived)
```
Emerald 700       #0A3A2C   Hover state primary
Emerald 500       #1A6B53   Lighter primary variant
Emerald 100       #D7E5DE   Tint background, badge

Cream 200         #F2EBD9   Card background contrast
Cream 300         #E8DFC8   Divider, subtle border

Gold 700          #8E7349   Pressed gold
Gold 300          #D4BC93   Soft accent, hover gold

Ink 700           #3A2E1F   Secondary text
Ink 500           #6B5E4D   Muted text
Ink 300           #A89A85   Placeholder text
```

### Semantic Colors
```
Success           #2E7D52   (emerald-adjacent)
Warning           #C68A2E   (gold-adjacent)
Danger            #A8412E   (terracotta, restrained)
Info              #3A5F8A   (muted navy)
```

### Aturan Pemakaian (Light Mode)
- **Emerald** = primary action only. Jangan jadi background besar (terlalu berat).
- **Cream** = background utama, surface card.
- **Gold** = accent saja — **maksimal 5–10%** dari area visual. Berlebihan = murahan.

---

### 4b. Dark Mode — Emerald Turats Night

Dark mode adalah **first-class citizen**, bukan afterthought. Palette dipikirkan ulang agar karakter "kitab kuno dimodernisasi" tetap terasa (bukan sekadar invert warna).

#### Core Dark Colors
```
NAME              HEX       USAGE
─────────────────────────────────────────────────────
Night Ink         #0F0D0A   Background utama (deep warm black)
Espresso Surface  #1F1810   Card / surface (= old ink, naik 1 tone)
Surface Elevated  #2A2218   Modal, dropdown, hover surface
Cream Text        #FAF5EB   Body text utama (= old cream)
Cream Muted       #C9BFAB   Secondary text
Cream Faint       #8A7F6D   Placeholder, disabled
```

#### Brand Colors (Dark-tuned)
```
NAME              HEX       USAGE
─────────────────────────────────────────────────────
Emerald Bright    #4ABC95   Primary button, link (lebih terang dari light)
Emerald Soft      #2D7558   Emerald variant untuk surface hint
Gold Warm         #D4B783   Accent (lebih cream-leaning untuk readability)
Gold Deep         #B89968   Gold gelap (= old accent), border emphasis
```

#### Semantic Dark
```
Success           #5DC79A   (emerald-bright adjacent)
Warning           #E0B25E   (gold lebih terang)
Danger            #D9755E   (terracotta diterangkan)
Info              #6A8FBE   (navy muted yang dicerahkan)
```

#### Aturan Khusus Dark Mode
- **Background tidak boleh pure black** (#000000). Selalu warm-black #0F0D0A — menjaga karakter "lampu minyak / kitab kuno".
- **Emerald primary di-brighten** (#4ABC95 vs #0F4C3A) agar tetap kontras pada bg gelap. WCAG AA minimum.
- **Gold tidak di-brighten** secara liar — pakai versi cream-leaning (#D4B783) supaya tidak "ngangenin retina".
- **Border & divider**: gunakan Espresso Surface (#1F1810) atau lebih gelap, bukan abu-abu netral. Mempertahankan warmth.
- **Image & ilustrasi**: kaligrafi yang di light mode emerald → di dark mode jadi gold (#D4B783) atau cream (#FAF5EB).
- **Peta interaktif**: pakai tile dark mode (mis. Mapbox dark, CartoDB dark) dengan overlay warna emerald untuk marker.
- **PDF export tetap LIGHT MODE selalu** (printed media), tidak peduli setting user.

#### Mapping Otomatis (Light → Dark)
Bila pakai CSS variable:
```css
:root[data-theme="light"] {
  --bg:         #FAF5EB;
  --surface:    #F2EBD9;
  --primary:    #0F4C3A;
  --accent:     #B89968;
  --text:       #1F1810;
  --text-muted: #6B5E4D;
  --border:     #E8DFC8;
}

:root[data-theme="dark"] {
  --bg:         #0F0D0A;
  --surface:    #1F1810;
  --primary:    #4ABC95;
  --accent:     #D4B783;
  --text:       #FAF5EB;
  --text-muted: #C9BFAB;
  --border:     #2A2218;
}
```

#### Toggle Behavior
- **Default**: ikuti `prefers-color-scheme` OS user (auto).
- **User dapat override** via toggle di header / settings → tersimpan di `localStorage` + DB (per akun, sync antar device).
- **3 mode pilihan user**: `Light` / `Dark` / `Auto (system)`.
- **Transisi**: smooth fade 200ms saat switch, hindari flicker.
- **First-paint anti-flash**: inline script di `<head>` baca preference sebelum CSS load (hindari FOUC).

#### Admin Configurable (Future)
Mirip dengan §3b Font Management di IDEAS.md, **palette warna juga bisa di-override admin** kelak. Default Emerald Turats sebagai seed, admin bisa create custom palette (mis. tema Ramadan, tema Maulid). Tapi v1 cukup hardcoded sebagai default.

---

## 5. Typography — Pairing 3 (Balanced)

### Stack
```
FAMILY              ROLE                            SOURCE
──────────────────────────────────────────────────────────────────
Amiri               Display Arab (logo, hero)       Google Fonts
Reem Kufi           Section Header Arab             Google Fonts
Playfair Display    Display Latin (heading)         Google Fonts
Inter               Body Latin (UI, paragraf)       Google Fonts
Cairo               Body Arab (paragraf)            Google Fonts
```

### Hierarchy
```
LEVEL          FONT                  SIZE       WEIGHT   LINE-HEIGHT
────────────────────────────────────────────────────────────────────
Logo (AR)      Amiri                 64–96 px   Regular  1
Logo (LT)      Playfair Display      24–32 px   Bold     1.1
H1 (LT)        Playfair Display      48 px      Bold     1.15
H1 (AR)        Reem Kufi             48 px      Bold     1.3
H2 (LT)        Playfair Display      32 px      SemiBold 1.2
H2 (AR)        Reem Kufi             32 px      SemiBold 1.35
H3 (LT)        Inter                 24 px      SemiBold 1.3
Body (LT)      Inter                 16 px      Regular  1.6
Body (AR)      Cairo                 18 px      Regular  1.8
Small / Meta   Inter                 13 px      Regular  1.5
Button         Inter                 15 px      SemiBold 1
```

### Aturan
- **Arabic body lebih besar 2pt** dari Latin (Arab butuh lebih banyak ruang vertikal).
- **Nama tokoh Arab di body** selalu di-styled dengan Cairo, bukan inline Inter (Inter punya Arabic fallback yang buruk).
- **Ayat & hadits Arab** selalu dengan Amiri (klasik) + indentasi + sedikit lebih besar (20 px).
- **Tidak ada italic untuk Arab** (italik tidak ada di skrip Arab).
- **Jangan pakai** Comic Sans, Papyrus, atau font "Arabic-look" Latin.

---

## 6. Logo

### Konsep
**Wordmark sederhana: kaligrafi أثر dengan typographic pairing nama Latin di bawah.**

```
            ┌─────────────────┐
            │                 │
            │       أثر       │   ← Amiri, 1.5–2× Latin size
            │                 │
            │      ATHAR      │   ← Playfair Display, letterspacing +50
            │                 │
            └─────────────────┘
```

### Varian
1. **Primary (vertikal)** — Arab di atas, Latin di bawah. Untuk landing hero, cover PDF, app icon.
2. **Horizontal** — Arab kiri, Latin kanan (atau sebaliknya untuk RTL). Untuk header website.
3. **Iconmark only** — hanya kaligrafi أثر. Untuk favicon, app icon, watermark PDF.
4. **Monogram** — huruf ث (tha) di-styled jadi ikon tunggal, dalam lingkaran ornamental. Untuk profile, social avatar.

### Aturan
- **Warna logo default**: Emerald (#0F4C3A) di atas Cream.
- **Warna logo alternatif**: Cream di atas Emerald (untuk dark surface), Gold (#B89968) untuk versi emas premium di cover PDF.
- **Clear space** minimum = tinggi huruf "ث" di tiap sisi.
- **Jangan**:
  - Outline / stroke pada kaligrafi.
  - Drop shadow.
  - Gradient.
  - Rotasi (kaligrafi Arab dibaca dari kanan ke kiri — rotasi merusak makna).
  - Pakai harakat (tetap polos).

### Ornament Optional
Tidak wajib, tapi bila perlu pengayaan visual:
- **Bingkai geometris Islamic** (pola muqarnas / arabesque sederhana, monokrom).
- **Single gold dot** sebagai aksen di salah satu sudut.
- **Tidak ada**: bulan sabit, bintang, kubah masjid (terlalu klise).

---

## 7. Tone of Voice

### Karakter
- **Hormat** — selalu pakai shalawat & doa pada tokoh:
  - Nabi ﷺ → "ﷺ" (Arabic Presentation Form) atau "shallallaahu 'alaihi wa sallam".
  - Sahabat → "radhiyallaahu 'anhu" (laki-laki) / "radhiyallaahu 'anha" (perempuan) / "radhiyallaahu 'anhum" (jamak).
  - Tabi'in & ulama → "rahimahullah".
- **Lugas** — kalimat pendek, paragraf pendek. Tidak bertele-tele.
- **Visual-first** — utamakan grafik, timeline, peta. Teks pendamping, bukan utama.
- **Cite-by-default** — setiap klaim biografis harus punya sumber. Tone: "menurut kitab X" / "diriwayatkan oleh Y", bukan "konon" / "katanya".

### Aturan Bahasa
- **Indonesia primary** (UI, dokumentasi).
- **Arab sebagai ornamen & sumber** (nama tokoh, judul kitab, ayat, hadits).
- **English seperlunya** (technical terminology di admin panel, dokumentasi developer).

### Istilah Syar'i — Konsisten
| Istilah | Penulisan |
|---|---|
| Nabi Muhammad ﷺ | Selalu pakai shalawat |
| Para sahabat | "sahabat" (bukan "companions of the prophet") |
| Anshar / Muhajirin | "Anshar" & "Muhajirin" (kapital, italik tidak perlu) |
| Tabi'in / Tabi'ut Tabi'in | Pakai apostrof, kapital |
| Tsiqah / Dha'if / Matruk | Transliterasi konsisten dengan apostrof |
| Hijriyah / Masehi | Dipisah dengan slash: "11 H / 632 M" |

### Tidak Boleh
- Bahasa marketing hyperbolic ("revolusioner", "terdahsyat", "satu-satunya").
- Klaim spiritual tanpa sumber ("dengan app ini iman Anda akan kuat").
- Joke / pun pada nama tokoh atau ayat/hadits.
- Emoji di copy resmi (kecuali pada admin panel internal).

### Contoh Copywriting

**Hero landing — bagus:**
> # Jejak generasi terbaik, dalam genggamanmu.
> Pelajari sirah para sahabat, tabi'in, dan tabi'ut tabi'in lewat peta interaktif, timeline komparatif, dan biografi berbasis sumber.

**Hero landing — buruk:**
> # Aplikasi Islami #1 di Indonesia!!! 🔥🕌
> Dapatkan ilmu sirah TERLENGKAP dengan AI super canggih, langsung ahli sirah dalam 30 hari!

---

## 8. Imagery & Illustration

### Boleh
- Kaligrafi Arab (semua aliran: Naskh, Tsuluts, Kufi, Diwani).
- Pola geometris Islamic (muqarnas, arabesque, bintang 8/12 sudut).
- Peta historis (cetakan, vector).
- Manuskrip-style ornament (corner flourish, drop cap).
- Foto landscape (gurun, oasis, kota klasik) — non-figuratif.
- Ilustrasi vector arsitektur (siluet kota, bukan close-up wajah).

### Tidak Boleh
- Wajah manusia (sahabat, ulama, atau orang biasa).
- Karakter animasi humanoid.
- Imagery yang ambigu antara Islam-Arab vs Islam-Indonesia (jangan kebablasan stereotip).
- Stock photo "muslim model" generic.

### Ilustrasi PDF (Lihat IDEAS §5b.5)
Generator CSS/SVG, bukan AI image-gen. Tipe yang sudah disetujui:
- Lingkaran kaligrafi nama tokoh.
- Bingkai kartu nama (arabesque).
- Timeline ribbon.
- Family tree node.
- Heat-map peta.
- Stat ring (jumlah hadits).

---

## 9. Sound & Motion (Future)

Belum jadi prioritas, tapi placeholder:
- **Sound**: tidak ada musik default (kontroversial). Notification chime: sangat halus, non-melodic.
- **Motion**: animasi UI lembut (ease-out, 200–300ms). Tidak ada efek bounce / spring berlebihan.
- **Splash screen**: kaligrafi أثر fade-in dengan timing ~600ms.

---

## 10. Application Map (Quick Reference)

| Touchpoint | Asset |
|---|---|
| Landing hero | Logo primary + tagline ID + tagline AR |
| App header | Logo horizontal |
| Favicon | Iconmark (kaligrafi أثر) |
| App icon (iOS/Android) | Iconmark dalam square Emerald background |
| PDF cover | Logo gold variant + judul Arab kaligrafi |
| PDF footer | Watermark "Dibuat oleh Athar" + iconmark mini |
| Social card (OG image) | Logo + tagline + palet penuh |
| Loading state | Iconmark + subtle pulse |
| Email signature admin | Logo horizontal + kontak Galih |

---

## 11. Open Items

- [ ] Cek availability domain: `athar.app`, `athar.id`, `athar.com`.
- [ ] Cek handle social media: `@athar.app` / `@athar.id` di IG, X, TikTok, YouTube.
- [ ] Trademark check di DJKI (Direktorat Jenderal Kekayaan Intelektual) untuk nama "Athar".
- [ ] Final logo file: pesan ke desainer atau generate via Figma + AI dengan brief di atas.
- [ ] Buat sample design (mockup hero + dashboard + cover PDF) sebelum koding UI.
- [ ] Tentukan apakah ada **brand secondary** (sub-brand untuk admin panel? misal "Athar Studio")?
