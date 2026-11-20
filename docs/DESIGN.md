# DESIGN.md — SakuIN Design System & Visual Specification

> **Versi:** 2.1  
> **Terakhir Diperbarui:** 19 November 2026  
> **Target Platform:** Mobile-First Responsive Web (PWA) + Android APK (TWA) + Desktop Responsive  
> **Teknologi UI:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui tokens + Framer Motion + Recharts + Lucide Icons  

---

## 1. Filosofi & Arah Visual

SakuIN dirancang dengan filosofi **Modern Minimalist Banking UI** yang berfokus pada ketenangan mental finansial mahasiswa. Aplikasi ini menggabungkan dua karakteristik visual utama:
1. **Layar Selamat Datang (Welcome/Splash):** Berlatar warna lime penuh (`#D4FF5A`) dengan tipografi tebal percaya diri, garis ilustrasi SVG bersih, dan nuansa ramah tanpa terasa kekanak-kanakan.
2. **Layar Utama Aplikasi (Dashboard & Workspace):** Latar belakang tenang dan bersih, dominasi kartu bersudut sangat bulat (*heavy border-radius* 24px), banyak ruang kosong (*generous whitespace*), tipografi nominal besar yang jelas, dan **aturan ketat: "Sedikit Warna" (*Little Color Rule*)**.

### Prinsip Utama
- **Zero Emoji:** Seluruh antarmuka **100% menggunakan ikon SVG monoline dari `lucide-react`**. Tidak ada emoji apa pun di dalam tombol, chip, atau label navigasi.
- **Sedikit Warna (Little Color):** Warna Lime (`#D4FF5A`) adalah **satu-satunya aksen interaktif UI** (tombol CTA primer, tab aktif, badge sorotan). Warna-warna lain (coral, oranye, biru, ungu, hijau) **hanya boleh digunakan untuk grafik analitik dan tag jenis transaksi**, bukan untuk ornamen dekoratif.
- **Transparansi & Kejujuran Finansial:** Format angka selalu menyertakan pemisah ribuan Rupiah (`Rp 1.430.000`), kalkulasi saldo bersifat kumulatif tanpa angka fiktif, dan perbandingan tren menggunakan panah netral (bukan merah-hijau yang menghakimi).

---

## 2. Aset Identitas & Logo Otentik

SakuIN menggunakan aset logo otentik resmi berbentuk dompet hitam bersudut bulat dengan aksen lipatan uang lime dan inisial grafis "S" lime, dipadukan dengan tipografi custom "Sakuin" dengan titik huruf 'i' berupa lingkaran lime.

```
                    ┌─────────────────────────┐
                    │    /\  /\  (Lime bills) │
                    │   /  \/  \              │
                    │ ┌─────────────────┐     │
                    │ │  ____    ┌───┐  │     │
                    │ │ / ___|   │ ● │  │     │  Sakuin
                    │ │ \___ \   └───┘  │     │
                    │ │  ___) |         │     │
                    │ │ |____/          │     │
                    │ └─────────────────┘     │
                    └─────────────────────────┘
```

### 2.1 File Aset Resmi (`/public/`)
| File Path | Dimensi / Format | Penggunaan |
| --- | --- | --- |
| `/brand-transparent.png` | 1024x1024 PNG (Transparent) | Ikon aplikasi, PWA manifest, favicon, splash screen, avatar bot |
| `/logo-transparent.png` | 512x512 PNG (Transparent) | Alternatif app icon square, dialog branding |
| `/brand-horizontal.png` | 1024x455 PNG (Transparent) | Header navigasi desktop, banner Selamat Datang, layar login/register |

### 2.2 Komponen Resmi Logo (`<BrandLogo />` & `<BrandText />`)
- **Struktur Logo Utama (`<BrandLogo />`):** Menggunakan tata letak awal yang proporsional: **Lambang Dompet (Icon Mark)** di sebelah kiri dipadukan dengan **Tipografi Nama Aplikasi (`<BrandText />`)** di sebelah kanan.
- **Tipografi Non-Kaku (Fluid Rounded Branding):** Tipografi judul tidak lagi menggunakan font sans kaku/kaku bersudut tajam atau penulisan "SakuIN" huruf besar. Nama aplikasi ditulis sebagai **Sakuin** menggunakan font **Fredoka / Nunito** berkarakter rounded, tebal (*bold*), ramah, dan modern.
- **Aksen Titik Huruf 'i':** Huruf 'i' pada "Sakuin" memiliki ciri khas unik: titik huruf 'i' digantikan dengan **lingkaran bulat warna lime neon (`#D4FF5A`)**, menyelaraskan dot pada kancing dompet logo.
- **Adaptasi Tema (Dark & Light Mode):**
  - Di mode gelap, teks berwarna putih/abu terang (`text-foreground` / `#E8E8E8`) dengan titik 'i' lime bercahaya lembut.
  - Di mode terang, teks otomatis menjadi abu arang (`#1F1F1F`) dengan titik 'i' lime kontras.
  - Di layar Selamat Datang (latar lime penuh), teks otomatis menggunakan warna gelap `#1F1F1F`.
  - `<BrandText size="sm" | "md" | "lg" />`: Menampilkan kombinasi lambang dompet + tulisan tipografi "Sakuin" transparan.
- **Background Support:** Di mode gelap, logo langsung menyatu dengan latar `#2B2B2B` atau `#353535`. Di mode terang, logo horizontal diberi perlakuan kontras yang rapi atau diletakkan di atas kontainer kartu gelap beraksen.

---

## 3. Design Tokens (Warna & Tema)

SakuIN mengusung **Dark Mode Default** dengan dukungan **Light Mode Wajib** yang memenuhi standar kontras **WCAG AA (minimal rasio 4.5:1)**.

### 3.1 Token Warna Sistem

| Token Name | Dark Mode (Default) | Light Mode (Wajib) | Keterangan & Penggunaan |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#2B2B2B` | `#F5F6F2` | Latar belakang seluruh halaman aplikasi |
| `--surface-card` | `#353535` | `#FFFFFF` | Latar kartu, modal, bottom sheet, bottom nav bar |
| `--surface-card-subtle` | `#303030` | `#F0F1ED` | Latar sekunder di dalam kartu, header tabel, keypad |
| `--border-subtle` | `#404040` | `#E5E7EB` | Garis batas kartu, pemisah item, outline input |
| `--border-focus` | `#D4FF5A` | `#2B2B2B` | Outline saat elemen form menerima fokus interaktif |
| `--text-primary` | `#E8E8E8` | `#1F1F1F` | Judul, angka nominal saldo, teks utama |
| `--text-secondary` | `#8A8A8A` | `#5E5E5E` | Label form, caption tanggal, sub-judul, legenda |
| `--text-muted` | `#666666` | `#9CA3AF` | Placeholder input, tanggal lampau, teks nonaktif |
| `--accent` | `#D4FF5A` | `#D4FF5A` | Isian tombol CTA primer, tab aktif, pill |
| `--accent-text` | `#D4FF5A` | `#3F6212` | **Dual-State Token**: Teks link, badge, dan persentase aksen (kontras WCAG AAA) |
| `--accent-border` | `#D4FF5A` | `#4D7C0F` | Garis outline aksen interaktif |
| `--accent-foreground` | `#1F1F1F` | `#1F1F1F` | Teks di atas latar tombol lime **selalu abu gelap/hitam** |

### 3.2 Token Semantik Transaksi & Data (Hanya untuk Label & Visualisasi)
> [!IMPORTANT]
> Warna-warna berikut **hanya boleh dipakai untuk segmen grafik, pill tipe transaksi, dan dot warna rekening**. Dilarang menggunakannya sebagai warna latar tombol utama atau dekorasi halaman.

| Jenis / Tipe | Dark Hex | Light Hex | Makna & Penggunaan |
| :--- | :--- | :--- | :--- |
| **Pemasukan (Income)** | `#D4FF5A` | `#4D7C0F` | Pemasukan uang, setoran, kenaikan saldo |
| **Pengeluaran (Expense)** | `#FF7B7B` | `#DC2626` | Pengeluaran transaksi harian, penurunan saldo |
| **Tabungan (Savings)** | `#FFB04A` | `#D97706` | Target tabungan virtual, dana tersisih |
| **Transfer Antar Rekening** | `#8A8A8A` | `#64748B` | Pemindahan netral (tidak mengubah total saldo) |
| **Utang (Saya Berutang)** | `#8CCBFF` | `#0284C7` | Pinjaman dana, pasiva keuangan |
| **Piutang (Orang Berutang)** | `#A78BFA` | `#7C3AED` | Pinjaman yang diberikan ke teman/orang lain |
| **Grafik Palette 1** | `#8CCBFF` | `#38BDF8` | Segmen donut kategori 1 (Transport/Pendidikan) |
| **Grafik Palette 2** | `#6B72FF` | `#6366F1` | Segmen donut kategori 2 (Nongkrong/Hiburan) |
| **Grafik Palette 3** | `#5BAA6B` | `#22C55E` | Segmen donut kategori 3 (Makan/Pokok) |
| **Grafik Palette 4** | `#FFB04A` | `#F59E0B` | Segmen donut kategori 4 (Kebutuhan Lain) |
| **Grafik Palette 5** | `#FF7B7B` | `#EF4444` | Segmen donut kategori 5 (Rokok/Lainnya) |

---

## 4. Tipografi & Skala Teks

Font utama yang digunakan adalah **Plus Jakarta Sans** (dengan fallback **Inter** dan **system-ui**). Seluruh teks angka nominal uang menggunakan pelacakan (*letter-spacing*) proporsional dan bobot tebal agar mudah dibaca sekilas.

```
Display:   40px (Bold)      -> Rp 1.430.000 (Saldo Utama)
Heading 1: 24px (SemiBold)  -> Ringkasan Bulan Ini
Heading 2: 20px (SemiBold)  -> Kategori Pengeluaran
Body 1:    16px (Regular)   -> Kebutuhan sehari-hari
Body 2:    14px (Regular)   -> Keterangan transaksi & badge
Caption:   12px (Medium)    -> 19 Nov 2026 • Mandiri Utama
```

### 4.1 Tabel Hirarki Tipografi
| Tingkat | Ukuran (px / rem) | Weight | Line Height | Tracking | Penggunaan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | 36px - 40px (2.25 - 2.5rem) | 700 (Bold) | 1.1 | `-0.02em` | Angka saldo utama Beranda, total nominal |
| **Heading 1** | 24px (1.5rem) | 600 (SemiBold) | 1.25 | `-0.01em` | Judul halaman (Statistik, Tabungan, Profil) |
| **Heading 2** | 20px (1.25rem) | 600 (SemiBold) | 1.3 | `-0.01em` | Judul kartu sekunder, header modal |
| **Subheading** | 16px - 18px (1 - 1.125rem) | 600 (SemiBold) | 1.4 | `0` | Nama rekening, nama target tabungan |
| **Body Large** | 16px (1rem) | 400 (Regular) | 1.5 | `0` | Isi kutipan motivasi, teks penjelasan |
| **Body Medium** | 14px (0.875rem) | 500 (Medium) | 1.4 | `0` | Nama item riwayat, label form input |
| **Caption** | 12px (0.75rem) | 500 (Medium) | 1.3 | `+0.01em` | Tanggal transaksi, nama rekening kecil, persen |
| **Micro** | 10px - 11px (0.6875rem) | 600 (SemiBold) | 1.2 | `+0.02em` | Label tab bottom navigation bar |

### 4.2 Standar Format Mata Uang
- Selalu menggunakan format: `Rp <nominal_dengan_titik_ribuan>` (contoh: `Rp 50.000`, `Rp 1.250.000`).
- Tanpa desimal koma nol-nol (bukan `Rp 50.000,00`).
- Tanda minus pada pengeluaran atau saldo negatif diletakkan sebelum "Rp" atau sesudah "Rp" secara konsisten: `-Rp 25.000` atau `Rp -25.000` (disarankan `-Rp 25.000` untuk kejelasan arah arus kas).

---

## 5. Bentuk (*Shapes*), Sudut (*Radii*), & Elevasi

Ciri khas kartu SakuIN mengadopsi sudut membulat modern yang rapi (*crisp yet friendly* `rounded-xl` 12px) agar tidak terlalu kaku seperti sudut tajam 90 derajat, namun tidak terlalu membulat berlebihan (*pill-like*).

```
┌──────────────────────────────────────────────┐
│  Card Surface: rounded-xl (12px)             │
│  ┌────────────────────────────────────────┐  │
│  │ Inner Box / Input: rounded-lg (8px)    │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ Pill / Chip: rounded-full (9999px) │ │  │
│  │ └────────────────────────────────────┘ │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

| Token Radii | Nilai Pixel | Kelas Tailwind | Penggunaan |
| :--- | :--- | :--- | :--- |
| **Card Radius** | `12px` | `rounded-xl` / `rounded-card` | Semua kontainer kartu, bottom sheet, modal, dialog |
| **Input / Box** | `8px` | `rounded-lg` | Field input teks, tombol keypad, baris rekening dalam kartu |
| **Control Radius** | `8px` | `rounded-lg` | Tombol kecil sekunder, badge status |
| **Pill Radius** | `9999px` | `rounded-full` | Tombol CTA primer, chip kategori, filter tipe, toggle switch |

### Elevasi & Bayangan (Shadows)
- Mode Gelap **tidak menggunakan shadow hitam tebal** karena latar belakang sudah gelap. Kontras permukaan dicapai melalui perbedaan nilai warna: `--bg-app` (`#2B2B2B`) vs `--surface-card` (`#353535`) + outline border 1px `--border-subtle` (`#404040`).
- Mode Terang menggunakan bayangan halus bertingkat: `shadow-sm` untuk kartu standar dan `shadow-lg` untuk modal/floating sheet.

---

## 6. Layout & Struktur Responsif

SakuIN dirancang dengan pendekatan **Mobile-First** yang bertransformasi mulus menjadi **Desktop Dashboard** pada layar lebar.

```
       MOBILE (<640px)                DESKTOP (>=1024px)
┌───────────────────────────┐  ┌──────────┬─────────────────────────────┐
│ Header: Logo & Avatar     │  │ Sidebar  │ Header & Global Month Picker│
├───────────────────────────┤  │ (Logo,   ├──────────────┬──────────────┤
│ 1 Kolom Vertikal          │  │  Beranda,│ Total Saldo  │ Rekening     │
│ - Kartu Motivasi          │  │  Stat,   │ & Batas Hari │ Grid         │
│ - Total Saldo & Batas Hari│  │  Catat,  ├──────────────┴──────────────┤
│ - Rekening (Scroll Hori)  │  │  Riwayat,│ Transaksi    │ Statistik    │
│ - Transaksi Terbaru       │  │  Tabung, │ Terbaru      │ Donut        │
├───────────────────────────┤  │  Profil) │              │              │
│ 5-Tab Curved Bottom Bar   │  │          │              │              │
└───────────────────────────┘  └──────────┴──────────────┴──────────────┘
```

### 6.1 Breakpoint Grid
- **Mobile (< 640px):** Lebar konten 100%, padding horizontal 16px (`px-4`), layout 1 kolom bertumpuk vertikal.
- **Tablet (640px – 1023px):** Padding horizontal 24px (`px-6`), grid 2 kolom untuk kartu ringkasan dan widget statistik.
- **Desktop (≥ 1024px):** Sidebar kiri tetap (lebar 260px), area konten utama maksimal 1200px terpusat, grid 12 kolom untuk tata letak dasbor luas.

---

## 7. Spesifikasi Komponen Inti

### 7.1 Bottom Navigation Bar (Mobile)
Navigasi bawah di perangkat seluler memiliki 5 tab utama dengan indikator aktif kubah melengkung (*curved notch*) yang ikonik:

```
       ┌──────┐  <- Tab Aktif: Lingkaran Lime Menonjol
       │  +   │     (Background #D4FF5A, Ikon #1F1F1F)
   ────╯      ╰────
  │ (⌂)  (📊)    (📋)  (🎯) │  <- Lekukan SVG Halus di Atas Permukaan Kartu (#353535)
  └────────────────────────┘
```

1. **5 Tab Utama:**
   - `Beranda` (`Home` icon)
   - `Statistik` (`PieChart` icon)
   - `Catat` (`Plus` icon di tengah)
   - `Riwayat` (`History` icon)
   - `Tabungan` (`Target` icon)
2. **Perilaku Transisi:**
   - Tab aktif berupa lingkaran floating lime berdiameter 50px yang terangkat keluar dari bilah.
   - Lekukan kubah bawah dibuat menggunakan kurva SVG presisi.
   - Pergeseran posisi antar tab menggunakan **Framer Motion spring (stiffness 380, damping 30)** dengan `layoutId="bubble"`.
   - Mengakomodasi safe-area ponsel modern: `pb-[calc(env(safe-area-inset-bottom)+0.75rem)]`.
   - Target sentuh setiap item minimal `44x44px`.

### 7.2 Kartu Saldo Utama (Beranda)
- **Komponen Display Angka:**
  - `Total Saldo`: Jumlah seluruh saldo rekening aktif yang `include_in_total`. Ditampilkan dengan font 36-40px bold.
  - `Saldo Bebas`: `Total Saldo - Total Tabungan Virtual` (dapat dikurangi utang bila toggle di profil aktif).
  - `Batas per Hari`: `floor(Saldo Bebas / Sisa Hari Bulan Ini)`. Progress bar menunjukkan rasio pemakaian harian.
- **Kondisi Khusus:**
  - Jika bulan yang dipilih adalah bulan lampau (`?month=2026-10`), kartu batas per hari otomatis disembunyikan dan diganti dengan status "Saldo Akhir Bulan".
  - Jika saldo bebas bernilai negatif, batas per hari bernilai `Rp 0` disertai teks peringatan lembut berwarna coral/merah muda: *"Pengeluaran melebihi saldo bebas"*.

### 7.3 Pemilih Bulan Global (`MonthPicker`)
- Format visual: `← November 2026 →` dengan tombol "Bulan ini".
- Terpasang seragam di 3 halaman: **Beranda**, **Statistik**, dan **Riwayat**.
- Status bulan tersinkronisasi antar halaman lewat query URL parameter `?month=YYYY-MM`.
- **Batas Maksimal:** Tidak dapat memilih bulan di masa depan yang belum berjalan.

### 7.4 Form Input Transaksi (Catat)
- **Form Factor:** Berupa **Bottom Sheet** bersudut 24px di mobile (<640px) dan **Dialog Modal Terpusat** di desktop (≥1024px).
- **Segmented Type Selector:** `Pengeluaran` | `Pemasukan` | `Transfer`.
- **Rekening Selector:** Wajib memilih salah satu rekening sumber. Secara default langsung terisi rekening terakhir yang pernah digunakan pengguna.
- **Keypad Cepat:** Tombol angka besar dengan format Rupiah otomatis seketika.
- **Kebutuhan Lain:** Jika kategori "Kebutuhan Lain" dipilih, otomatis memunculkan input wajib *"Untuk kebutuhan apa?"* (maks 60 karakter).

### 7.5 Kartu Motivasi Harian
- **Lokasi:** Terletak tepat di atas kartu saldo utama di Beranda.
- **Tampilan:** Kartu permukaan `#353535`, radius 24px, ikon tanda kutip lime di sudut kiri atas, teks maksimal 140 karakter tanpa ornamen berlebihan.
- **Interaksi:** Dilengkapi tombol tutup (X) dan tombol acak/ganti kutipan.
- **Rotasi Cerdas:** Memilih 1 kutipan setiap sesi baru (berjarak 30 menit), menghindari 15 kutipan terakhir yang sudah dilihat pengguna.

---

## 8. Panduan Data Visualization (Grafik Recharts)

Visualisasi data keuangan di SakuIN dirancang agar langsung dapat dipahami dalam 3 detik tanpa kebingungan:

### 8.1 Donut Chart Kategori
- Segmen donut memiliki **ujung membulat (*rounded segment ends / cornerRadius*)** dengan ketebalan ring yang pas (*innerRadius 65%*, *outerRadius 85%*).
- Di tengah ring donut terdapat ringkasan persentase kategori terbesar dengan teks tebal.
- Legenda di bawah donut menampilkan dot warna bulat kecil, nama kategori, persentase, dan nominal.

### 8.2 Tren Pengeluaran / Pemasukan (Line Chart)
- Garis grafik menggunakan **kurva Bézier mulus (`type="monotone"`) berwarna lime (`#D4FF5A`)** dengan ketebalan stroke 3px.
- Area di bawah garis diberi gradien halus memudar (*gradient fill opacity 20% ke 0%*).
- Pada titik bulan yang sedang aktif terdapat indikator gelembung nilai (*active dot bubble*).
- Garis grid vertikal ditiadakan; hanya terdapat garis grid horizontal samar untuk menjaga kebersihan visual.

### 8.3 Peringkat Pengeluaran Terbanyak (Horizontal Bar)
- Menampilkan 5 kategori teratas dalam bentuk bilah horizontal dengan sudut ujung membulat penuh (`rounded-full`).
- Diurutkan dari nilai rupiah terbesar ke terkecil dengan label nama di kiri dan nominal serta persentase di kanan.

---

## 9. Aturan Animasi & Gerakan (Motion)

Animasi di SakuIN berfungsi untuk memberikan umpan balik taktil (*tactile feedback*), bukan untuk dekorasi yang memperlambat alur kerja:

| Interaksi | Tipe Animasi | Parameter Framer Motion |
| :--- | :--- | :--- |
| **Pindah Tab Bottom Bar** | Spring layoutId | `transition: { type: "spring", stiffness: 380, damping: 30 }` |
| **Buka Bottom Sheet** | Slide Up + Fade | `initial: { y: "100%", opacity: 0 }, animate: { y: 0, opacity: 1 }` |
| **Tutup Bottom Sheet** | Slide Down | `exit: { y: "100%", opacity: 0, transition: { duration: 0.2 } }` |
| **Toast Undo Notification** | Pop In Bottom | `initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 }` |
| **Ganti Angka Saldo** | Number Count-up | `duration: 0.4s, ease: "easeOut"` |

> [!NOTE]
> **Aksesibilitas Gerakan:** Seluruh animasi wajib menghormati pengaturan sistem pengguna `prefers-reduced-motion: reduce`. Jika opsi ini aktif, seluruh animasi spring dan slide digantikan dengan transisi opacity instan (0.1s).

---

## 10. Aksesibilitas & Standar Kualitas (Quality Checklist)

Setiap halaman dan komponen baru yang dibuat wajib lulus verifikasi checklist berikut sebelum dinyatakan siap:
1. [ ] **Kontras Teks:** Semua teks utama memiliki kontras minimal 4.5:1 terhadap latar belakang kartu/halaman.
2. [ ] **Teks di Atas Lime:** Setiap teks atau ikon yang diletakkan di atas background Lime (`#D4FF5A`) **harus berwarna gelap `#1F1F1F`**, tidak boleh putih.
3. [ ] **Ukuran Target Sentuh:** Semua tombol, ikon tab, dan pill filter memiliki target sentuh minimal `44px x 44px`.
4. [ ] **Zero Emoji:** Tidak ada emoji karakter teks (seperti 💰, 💳, 🍔) di dalam kode UI. Seluruh simbol menggunakan ikon SVG `lucide-react`.
5. [ ] **Responsif Ekstrem:** Tidak ada elemen yang terpotong atau menimbulkan scrollbar horizontal pada viewport terkecil smartphone Android (360px lebar).
6. [ ] **Feedback Aksi:** Setiap operasi hapus atau mutasi data penting menyertakan Toast konfirmasi dengan tombol **Urungkan (Undo)** yang aktif minimal 5 detik.
7. [ ] **Logo Resmi:** Menggunakan asset otentik `/brand-horizontal.png` dan `/brand-transparent.png` via `<BrandLogo />` dan `<BrandText />`.
