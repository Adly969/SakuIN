# SakuIN — Catat Uang Kiriman, Tenang Sampai Akhir Bulan

Aplikasi web pencatatan keuangan bulanan untuk mahasiswa perantau berbasis **Next.js 14 (App Router) + TypeScript, Supabase (PostgreSQL + Auth), Drizzle ORM, Tailwind CSS, Recharts, dan Framer Motion**.

Dokumen spesifikasi produk lengkap dapat dibaca di:
- [PRD.md](file:///c:/ProjectAdly/SakuIN/PRD.md)
- [docs/PRD.md](file:///c:/ProjectAdly/SakuIN/docs/PRD.md)

---

## 🚀 Fitur Utama (Berdasarkan PRD v2.0)
1. **Layar Selamat Datang (*Welcome Screen*)**: Animasi SVG bertema uang saku dan tipografi modern 3 baris.
2. **Autentikasi Supabase**: Email & password dengan RLS (*Row Level Security*) di semua tabel database.
3. **Pencatatan Cepat (3 Ketukan < 5 Detik)**: Bottom sheet modern dengan nominal otomatis, chip kategori berikon SVG, dan keypad numerik interaktif.
4. **Dashboard Dinamis**: Sisa uang kiriman, sisa hari menuju gajian, batas pemakaian harian (`safe`, `warning`, `danger`), dan kutipan motivasi harian acak dari 120 kutipan database.
5. **Navigasi Bawah Organik (*Mobile Bottom Bar*)**: Bar melengkung dengan kubah dinamis dan elevated active circle ber-ring lime.
6. **Statistik Pengeluaran & Tren**: Donut chart kategori dan grafik tren 8 bulan yang menyorot *Bulan Terboros*.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 14.2 (App Router) + TypeScript
- **Database & Auth**: Supabase PostgreSQL + Supabase SSR
- **ORM & Migrations**: Drizzle ORM + postgres.js
- **Styling**: Tailwind CSS (Mode Gelap `#2B2B2B` & `#353535`, Aksen Lime `#D4FF5A`)
- **Grafik & Animasi**: Recharts + Framer Motion
- **Iconography**: Lucide React (100% SVG line icons, zero emoji)

---

## 💻 Menjalankan Proyek Lokal
1. Install dependencies:
   ```bash
   npm install
   ```
2. Jalankan dev server:
   ```bash
   npm run dev
   ```
3. Buka di browser:
   [http://localhost:3000](http://localhost:3000)
