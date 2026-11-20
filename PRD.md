# PRD — SakuIN

Aplikasi pencatatan keuangan bulanan untuk mahasiswa perantau · Versi 2.0 · 18 November 2026 · Pemilik produk: Adly

**Perubahan v2.0:** dibangun ulang dari nol memakai Next.js + Supabase + Vercel agar bisa di-hosting gratis. Seluruh fitur v1.3 dipertahankan: layar Selamat Datang, login Google, Riwayat sebagai tab, sisa bulan lalu ke Tabungan, kutipan motivasi harian, mode gelap dan terang.

## 1. Ringkasan Produk

SakuIN adalah aplikasi web responsif (mobile-first, bisa dipasang sebagai PWA) untuk mahasiswa perantau yang hidup dari uang kiriman bulanan. Pengguna mencatat pemasukan, pengeluaran, dan tabungan dalam hitungan detik, lalu melihat sisa uang, batas pemakaian harian, dan grafik pengeluaran terbesar dalam tampilan minimalis yang nyaman di mata.

**Pilar produk**

1. Cepat: mencatat transaksi maksimal 3 ketukan (nominal, kategori, simpan).
2. Jelas: satu angka utama di beranda, yaitu sisa uang bulan ini dan batas pemakaian per hari.
3. Menyenangkan: UI lembut, animasi halus, progres tabungan, dan kutipan motivasi harian.
4. Tertata: anggaran per kategori, target tabungan, statistik yang mudah dibaca.

## 2. Latar Belakang dan Masalah

- Uang kiriman sering habis sebelum akhir bulan karena pengeluaran kecil dan rutin (makan, nongkrong, rokok, kuota, laundry) tidak tercatat.
- Aplikasi keuangan yang ada terlalu rumit, sehingga mahasiswa malas mengisi.
- Mahasiswa perantau belum punya kebiasaan menabung karena tidak melihat sisa uang yang bisa disisihkan.
- Sinyal di kos kadang tidak stabil, sehingga aplikasi harus tetap nyaman dipakai saat koneksi lambat.

## 3. Tujuan dan Metrik Keberhasilan

| Tujuan | Metrik | Target 3 bulan pertama |
| --- | --- | --- |
| Mencatat jadi kebiasaan | Pengguna aktif yang mencatat minimal 5 hari per minggu | 40% |
| Input sangat cepat | Median waktu dari membuka form sampai simpan | di bawah 10 detik |
| Retensi | Pengguna kembali di hari ke-7 / hari ke-30 | 35% / 20% |
| Mendorong menabung | Pengguna dengan minimal 1 target tabungan | 50% |
| Kualitas teknis | Skor Lighthouse (Performance, PWA, Accessibility) | 90 ke atas |

## 4. Pengguna Target

**Persona utama: Dina, 20 tahun**, mahasiswa semester 4 yang ngekos di luar kota. Menerima kiriman bulanan dari orang tua, kadang ada kerja sambilan. Memakai HP untuk hampir semua hal, dan ingin tahu kenapa uangnya cepat habis tanpa harus mencatat panjang-panjang.

**Kebutuhan utama:** catat cepat, tahu sisa uang tiap hari, tahu pengeluaran terbesar, dan bisa menyisihkan tabungan untuk tujuan tertentu (pulang kampung, laptop, dana darurat).

## 5. Ruang Lingkup

| Prioritas | Fitur |
| --- | --- |
| Must (MVP) | Layar Selamat Datang, autentikasi (email dan Google), onboarding, catat transaksi, 7 kategori bawaan + kategori buatan sendiri, anggaran bulanan, target tabungan (setor dan tarik), beranda, statistik (donut, tren, pengeluaran terbanyak), riwayat (tab sendiri), kutipan motivasi harian, pengaturan, UI responsif dengan mode gelap dan terang |
| Should | PWA dapat dipasang, antrean input offline, pengingat harian, insight otomatis, ekspor CSV, sisa bulan lalu otomatis masuk Tabungan |
| Could | Transaksi berulang, sisihkan tabungan otomatis dari uang kiriman, laporan PDF |
| Won't (tahap ini) | Sinkronisasi rekening bank, scan struk, fitur sosial atau patungan, aplikasi native di Play Store/App Store |

## 6. Tech Stack dan Arsitektur

Satu proyek TypeScript (frontend dan backend), tanpa server terpisah, seluruhnya bisa berjalan di paket gratis.

| Lapisan | Teknologi | Catatan |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Halaman, Server Actions, dan Route Handlers dalam satu proyek |
| Hosting | Vercel (paket Hobby) | Gratis untuk penggunaan pribadi non-komersial; HTTPS otomatis |
| Database | Supabase PostgreSQL | Free plan |
| Autentikasi | Supabase Auth | Email + password, reset password, login Google (OAuth) |
| ORM dan migration | Drizzle ORM | Migration tercatat di Git |
| Validasi | Zod | Semua input divalidasi di server |
| Styling | Tailwind CSS + shadcn/ui | Token desain di CSS variables |
| Grafik | Recharts | Donut, pie, line, bar |
| Animasi | Framer Motion | Indikator bottom bar, transisi halus |
| Ikon | lucide-react | Garis tipis, konsisten |
| PWA | Serwist (service worker + manifest) | Dapat dipasang, cache aset, antrean offline |
| Testing | Vitest (kalkulasi saldo), Playwright (alur inti, opsional) | Fokus pada logika keuangan |

**Catatan arsitektur dan keamanan**

- Semua kalkulasi saldo ada di modul server (`lib/finance`) dan diuji otomatis; frontend hanya menampilkan hasil.
- Row Level Security (RLS) **aktif di semua tabel** dengan policy `user_id = auth.uid()`, sehingga pengguna hanya bisa membaca dan menulis datanya sendiri meski ada celah di kode.
- Kunci service Supabase hanya ada di variabel lingkungan server (Vercel), tidak pernah di kode klien. Hanya URL dan anon key yang boleh publik.
- Koneksi database dari Drizzle memakai connection pooler Supabase; verifikasi mode yang kompatibel di dokumentasi Supabase.

**Hosting gratis.** Target biaya Rp0 selama penggunaan pribadi. Hobby Vercel hanya untuk penggunaan non-komersial dan menjeda proyek (tanpa tagihan) bila batas bulanan terlewati; free plan Supabase punya batas penyimpanan dan dapat menjeda proyek yang lama tidak aktif. Syarat paket gratis sering berubah, periksa halaman resminya. Jika SakuIN dipakai banyak orang atau berbayar, pindah ke paket berbayar.

## 7. Panduan UI/UX

### 7.1 Arah visual

Gaya aplikasi perbankan modern mengikuti dua referensi: layar Selamat Datang berlatar lime dengan ilustrasi dan tipografi besar, serta layar Statistik gelap dengan kartu bersudut sangat membulat, donut berujung membulat, dropdown berbentuk pil, dan toggle Bulan/Tahun. Nuansa: tenang, bersih, banyak ruang kosong, profesional.

**Aturan warna: sedikit warna.** Lime adalah satu-satunya aksen UI (tombol utama, tab aktif, indikator). Warna lain (coral, oranye, biru, ungu, hijau) hanya di grafik dan label tipe transaksi, tidak untuk dekorasi.

### 7.2 Design token

Mode gelap default; mode terang wajib sejak MVP dengan struktur token sama. Pengguna memilih Gelap, Terang, atau Ikuti sistem.

| Token | Gelap | Terang | Fungsi |
| --- | --- | --- | --- |
| Latar halaman | #2B2B2B | #F5F6F2 | Background aplikasi |
| Permukaan kartu | #353535 | #FFFFFF | Kartu, bottom bar |
| Teks utama | #E8E8E8 | #1F1F1F | Judul, angka |
| Teks sekunder | #8A8A8A | #5E5E5E | Label, legenda |
| Aksen utama (pemasukan) | #D4FF5A | #D4FF5A | Tombol utama, tab aktif; teks di atasnya selalu #1F1F1F |
| Pengeluaran | #FF7B7B | #E85D5D | Grafik dan label |
| Tabungan | #FFB04A | #E8932A | Grafik dan label |
| Kategori grafik | #8CCBFF, #6B72FF, #5BAA6B, #8A8A8A | sama | Segmen donut |
| Radius | 24 px kartu, 999 px pil | sama | Bentuk komponen |
| Font | Plus Jakarta Sans atau Inter | sama | Angka nominal besar |

Di mode terang, lime hanya sebagai isian; teks dan ikon di atas latar terang memakai abu tua agar kontras memenuhi WCAG AA.

### 7.3 Layar Selamat Datang

Layar pertama bagi pengguna baru, mengikuti referensi onboarding lime.

- **Latar:** lime penuh (#D4FF5A), teks dan ikon #1F1F1F.
- **Ilustrasi:** gambar garis tipis bertema uang saku (tangan memegang dompet, koin, kartu, struk, ikon QR) dengan lingkaran lime lebih gelap di belakangnya, dibuat sendiri sebagai SVG. Ikon kecil melayang pelan (transform saja, mati bila reduced-motion).
- **Judul besar (3 baris):** "Catat Uang Kiriman, Tenang Sampai Akhir Bulan", dengan satu pil gelap berisi panah di tengah teks.
- **Subjudul:** "Catat, atur, dan tabung uang bulananmu".
- **Aksi bawah:** tombol teks **Lewati** di kiri; **Mulai** di kanan dengan tombol lingkaran gelap berpanah.
- **Perilaku:** tampil sekali pada kunjungan pertama (penanda di cookie). **Mulai** menuju Daftar; **Lewati** menuju Login. Pengguna yang sudah login tidak melihatnya.
- **Responsif:** HP satu kolom penuh layar; desktop dua kolom (ilustrasi kiri, teks kanan).
- **Aksesibilitas:** ilustrasi `aria-hidden`, fokus tombol terlihat, kontras AA.

### 7.4 Komponen utama

- Kartu ringkasan: sisa uang bulan ini (angka besar), batas per hari, progress bar anggaran.
- Pil dropdown (Pengeluaran, Pemasukan, Tabungan) dan toggle segmented Bulan | Tahun.
- Chip kategori: ikon dan nama, diurutkan dari yang paling sering dipakai.
- Bottom sheet untuk form catat di layar kecil, dialog di layar besar.
- Toast dengan tombol Urungkan setelah simpan atau hapus.
- Keypad angka besar dengan format Rupiah otomatis (Rp 25.000).

### 7.5 Bottom navigation bar (mobile)

Bar permukaan membulat di dasar layar; tab aktif berupa lingkaran lime yang menonjol ke atas dengan lekukan (notch) melengkung; tab tidak aktif berupa ikon garis abu-abu dengan label kecil.

| Urutan | Tab | Isi |
| --- | --- | --- |
| 1 | Beranda | Ringkasan bulan, kutipan motivasi, transaksi terbaru, avatar menuju Profil |
| 2 | Statistik | Grafik dan pengeluaran terbanyak |
| 3 | Catat | Form tambah transaksi |
| 4 | Riwayat | Daftar transaksi, filter, pencarian |
| 5 | Tabungan | Daftar dan detail target |

Profil dibuka lewat avatar di Beranda, dan menjadi item sendiri di sidebar desktop.

- Lingkaran dan lekukan bergeser mulus (pegas 250–300 ms, Framer Motion `layoutId`), hormati `prefers-reduced-motion`; lekukan digambar dengan SVG path.
- Target sentuh minimal 44 x 44 px, mendukung `env(safe-area-inset-bottom)`, setiap tab punya `aria-label` dan `aria-current`.
- Di layar 1024 px ke atas, bottom bar diganti sidebar kiri dengan item yang sama ditambah Profil.

### 7.6 Responsif dan gaya grafik

| Lebar layar | Tata letak |
| --- | --- |
| Di bawah 640 px (HP) | Satu kolom, bottom bar, form sebagai bottom sheet |
| 640–1023 px (tablet) | Grid 2 kolom untuk kartu dan grafik, bottom bar tetap |
| 1024 px ke atas (desktop) | Sidebar kiri, konten maksimal sekitar 1200 px, grid 12 kolom, form sebagai dialog |

Grafik memakai ResponsiveContainer dan dimuat lazy. Donut berujung segmen membulat dengan persentase terbesar di tengah, legenda titik berwarna, garis tren halus lime dengan gelembung nilai di bulan aktif, bar horizontal berurutan untuk peringkat, tanpa garis grid berlebihan. Tabel besar bisa digulir horizontal di dalam kontainernya.

### 7.7 Kartu motivasi harian

- **Posisi:** kartu kecil di atas kartu "Sisa uang bulan ini", radius 24 px, permukaan kartu, ikon tanda kutip lime, teks utama, tanpa warna tambahan.
- **Isi:** satu kutipan maksimal 140 karakter, tanpa gambar.
- **Aksi:** tombol tutup (X) dan tombol ganti kutipan; kartu yang ditutup tidak muncul lagi sampai sesi berikutnya.
- **Animasi:** fade masuk 200 ms, mati bila `prefers-reduced-motion`.
- **Aksesibilitas:** `role="note"`, kontras AA di kedua mode, tidak terpotong di 360 px.

## 8. Kebutuhan Fungsional

### 8.1 Selamat Datang, autentikasi, onboarding

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| W1 | Layar Selamat Datang sesuai 7.3, tampil sekali untuk pengguna baru | Must |
| W2 | Mulai menuju Daftar, Lewati menuju Login | Must |
| A1 | Daftar dan login email + password; logout | Must |
| A2 | Reset password lewat email | Must |
| A3 | Onboarding 3 langkah: nama, uang kiriman bulanan, tanggal biasa menerima kiriman | Must |
| A4 | Daftar dan login dengan Google (Supabase Auth); akun dengan email sama tertaut | Must |
| A5 | Tombol "Lanjut dengan Google" di Daftar dan Login, di bawah form email | Must |

### 8.2 Transaksi

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| T1 | Tambah pemasukan atau pengeluaran: nominal, kategori, tanggal (default hari ini), catatan opsional | Must |
| T2 | Keypad angka dan format Rupiah otomatis; nominal wajib lebih dari 0 | Must |
| T3 | Kategori Kebutuhan Lain memunculkan kolom wajib "Untuk kebutuhan apa?" (maksimal 60 karakter) | Must |
| T4 | Ubah dan hapus transaksi (soft delete) dengan Urungkan lewat toast | Must |
| T5 | Riwayat (tab sendiri) dengan filter bulan, kategori, tipe, dan pencarian catatan | Must |
| T6 | Antrean offline: transaksi disimpan lokal lalu dikirim saat online | Should |
| T7 | Transaksi berulang (misalnya bayar kos) | Could |

### 8.3 Kategori

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| K1 | Saat daftar, sistem menyalin 7 kategori pengeluaran bawaan: Makan, Nongkrong, Rokok, Listrik, Kuota, Laundry, Kebutuhan Lain | Must |
| K2 | Kategori pemasukan bawaan: Uang Kiriman, Kerja Sambilan, Beasiswa, Lainnya | Must |
| K3 | Pengguna menambah kategori sendiri (nama, ikon, warna) dan mengubah urutan | Must |
| K4 | Kategori bawaan boleh disembunyikan, tidak dihapus permanen; kategori yang sudah dipakai hanya bisa disembunyikan | Must |
| K5 | Chip kategori diurutkan berdasarkan frekuensi pemakaian | Should |

### 8.4 Anggaran

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| B1 | Batas pengeluaran bulanan (default sama dengan pemasukan bulan itu) | Must |
| B2 | Batas opsional per kategori | Must |
| B3 | Peringatan lembut saat pemakaian mencapai 80% dan 100% | Must |
| B4 | Batas per hari = sisa uang dibagi sisa hari bulan ini (termasuk hari ini) | Must |
| B5 | Sisa bulan lalu tidak otomatis menambah uang bulan baru; lihat S9 | Must |

### 8.5 Tabungan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| S1 | Buat target: nama, target nominal, tenggat (opsional), ikon dan warna | Must |
| S2 | Setor dan tarik dana dari target, lengkap dengan tanggal dan catatan | Must |
| S3 | Progress ring dan persentase terkumpul di daftar dan detail | Must |
| S4 | Jika ada tenggat, saran setoran per minggu atau per bulan | Should |
| S5 | Setoran mengurangi "sisa uang bulan ini", penarikan menambahnya | Must |
| S6 | Saat mencapai target, status menjadi Tercapai dengan animasi singkat | Should |
| S7 | Arsipkan atau hapus target (dana tersisa harus ditarik atau dipindah dulu) | Must |
| S8 | Sisihkan otomatis persentase tertentu dari uang kiriman ke target | Could |
| S9 | Sisa bulan lalu masuk Tabungan: di awal bulan, jika sisa lebih dari 0, tampil kartu "Sisa bulan lalu Rp X" dengan tombol Pindahkan ke tabungan (pilih target, default Dana Darurat); tercatat sebagai setoran bertanggal 1 bulan baru. Opsi otomatis di Pengaturan | Should |

### 8.6 Beranda dan statistik

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| G1 | Beranda: kartu motivasi, kartu sisa uang, batas per hari, ringkasan pemasukan/pengeluaran/tabungan, 3 pengeluaran terbesar, 5 transaksi terbaru | Must |
| G2 | Donut pengeluaran per kategori, persentase terbesar di tengah, dengan legenda | Must |
| G3 | Toggle Bulan / Tahun dan pil dropdown Pengeluaran / Pemasukan / Tabungan yang mengganti data donut | Must |
| G4 | Grafik komposisi bulan: persentase pemasukan, pengeluaran, tabungan | Must |
| G5 | Tren 8 bulan terakhir (dropdown Pemasukan / Pengeluaran) dengan gelembung nilai pada bulan aktif | Must |
| G6 | Pengeluaran Terbanyak: peringkat 5 kategori teratas dalam bar horizontal, nominal dan persentase | Must |
| G7 | Untuk Kebutuhan Lain, tampilkan 5 keterangan teratas (dikelompokkan berdasarkan teks pengguna) | Must |
| G8 | Daftar 5 transaksi pengeluaran terbesar pada periode terpilih | Should |
| G9 | Insight otomatis, misalnya "Nongkrong naik 20% dibanding bulan lalu" | Should |

### 8.7 Kutipan motivasi

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| M1 | Kutipan disimpan di tabel database dengan 3 kategori (tabungan, orang\_tua, umum); seeder awal 120 kutipan (bagian 17) | Must |
| M2 | Setiap sesi baru (aplikasi dibuka, atau dibuka lagi setelah tidak aktif lebih dari 30 menit) server memilih satu kutipan baru; pindah halaman tidak menggantinya | Must |
| M3 | Pemilihan acak, tidak sama dengan 15 kutipan terakhir yang dilihat pengguna; kategori tabungan dan orang\_tua selang-seling; bila kutipan aktif kurang dari 15, batas diabaikan | Must |
| M4 | Variabel `{nama}` dan `{uang_kiriman}` diisi di server; bila datanya kosong, pilih kutipan tanpa variabel | Must |
| M5 | Pada tanggal kiriman dan tanggal 1 setiap bulan, utamakan kategori orang\_tua | Must |
| M6 | Pengguna dapat mematikan kartu di Pengaturan (default aktif) | Must |
| M7 | Setelah setoran tabungan tersimpan, toast menampilkan satu kutipan kategori tabungan | Should |
| M8 | 10 kutipan cadangan di cache PWA agar kartu tetap tampil offline | Should |
| M9 | Kutipan baru ditambah lewat seeder atau skrip impor tanpa ubah kode tampilan | Should |
| M10 | Pengguna bisa menyembunyikan kutipan tertentu | Could |

### 8.8 Pengingat dan pengaturan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| N1 | Pengingat harian pada jam pilihan (web push; di iOS hanya jika PWA terpasang) | Should |
| N2 | Pengingat akhir bulan untuk meninjau anggaran dan tabungan | Could |
| P1 | Ubah profil, kata sandi, tema (Gelap / Terang / Ikuti sistem), dan tombol kutipan motivasi | Must |
| P2 | Ekspor transaksi bulanan ke CSV | Should |
| P3 | Hapus akun beserta seluruh data | Must |

## 9. Layar dan Alur

**Alur catat transaksi (inti):** ketuk Catat, keypad aktif, ketik nominal, pilih chip kategori (Kebutuhan Lain: ketik keterangan), Simpan, toast "Tersimpan" dengan Urungkan, kembali ke layar sebelumnya.

**Alur pengguna baru:** Selamat Datang → Mulai → Daftar (email atau Google) → Onboarding 3 langkah → Beranda.

| Layar | Isi |
| --- | --- |
| Selamat Datang | Latar lime, ilustrasi, judul besar, Lewati dan Mulai |
| Login / Daftar | Form email + password, tombol utama lime, "Lanjut dengan Google", lupa password |
| Onboarding | Nama, uang kiriman bulanan, tanggal kiriman |
| Beranda | Sapaan singkat; kartu motivasi; kartu "Sisa uang bulan ini"; batas per hari dan progress bar; kartu kecil Pemasukan, Pengeluaran, Tabungan; kartu sisa bulan lalu (jika ada); 3 pengeluaran terbesar; transaksi terbaru dengan "Lihat semua" |
| Statistik | Kartu ringkasan; pil dropdown dan toggle Bulan/Tahun; donut + legenda; komposisi bulan; tren; Pengeluaran Terbanyak |
| Catat | Bottom sheet atau dialog: nominal, chip kategori, tanggal, catatan, Simpan |
| Riwayat | Daftar per tanggal, filter, pencarian |
| Tabungan | Daftar target dengan progress ring; detail dengan riwayat setoran, tombol Setor dan Tarik |
| Profil | Akun, kategori, anggaran, tema, kutipan motivasi, pengingat, ekspor, hapus akun |

## 10. Desain Database (Supabase PostgreSQL)

Semua tabel memakai `id` uuid, `created_at`, `updated_at`. Nominal disimpan sebagai bigint Rupiah (tanpa desimal). Semua tabel data pengguna punya kolom `user_id` (uuid, merujuk `auth.users`) dan RLS aktif dengan policy `user_id = auth.uid()`.

| Tabel | Kolom penting | Catatan |
| --- | --- | --- |
| profiles | id (= auth.users.id), name, avatar\_url, monthly\_allowance, payday\_day, timezone (default Asia/Jakarta), theme, reminder\_time, reminder\_enabled, show\_motivation (default true), recent\_motivation\_ids (jsonb, 15 ID terakhir), last\_active\_at, auto\_carryover\_goal\_id | Dibuat otomatis saat pengguna mendaftar |
| categories | user\_id, name, type (income/expense), icon, color, is\_default, is\_hidden, requires\_label, sort\_order | requires\_label = true untuk Kebutuhan Lain |
| transactions | user\_id, category\_id, type, amount, occurred\_on, note, custom\_label, deleted\_at | Indeks (user\_id, occurred\_on), (user\_id, category\_id, occurred\_on) |
| budgets | user\_id, month (tanggal 1), total\_limit | Unik (user\_id, month) |
| category\_budgets | budget\_id, category\_id, limit\_amount | Unik (budget\_id, category\_id) |
| savings\_goals | user\_id, name, target\_amount, target\_date (nullable), icon, color, status (active/completed/archived) | Saldo dihitung dari entries |
| savings\_entries | goal\_id, user\_id, type (deposit/withdraw), amount, occurred\_on, note, source (manual/carryover) | Indeks (user\_id, occurred\_on) |
| motivations | text (maks 140 karakter), category (tabungan/orang\_tua/umum), has\_variable, is\_active | Tanpa user\_id; semua pengguna masuk boleh baca, tidak boleh tulis |
| push\_subscriptions | user\_id, endpoint, keys | Untuk pengingat (Should) |

**Aturan hitung**

- Terkumpul sebuah target = total deposit dikurangi total withdraw pada target itu.
- Sisa uang bulan ini = total pemasukan − total pengeluaran − (deposit − withdraw tabungan pada bulan itu).
- Batas per hari = sisa uang ÷ jumlah hari tersisa di bulan itu (termasuk hari ini), minimal 0.
- Sisa bulan lalu dipindahkan lewat entri deposit bersumber `carryover`, sehingga tidak menggelembungkan uang bulan baru.
- Komposisi bulan: pemasukan = 100% sebagai pembanding, lalu persentase pengeluaran dan tabungan terhadap pemasukan.

## 11. Struktur Halaman dan Endpoint (Next.js App Router)

Proteksi rute lewat middleware (belum login diarahkan ke Login). Mutasi data memakai Server Actions dengan validasi Zod.

| Rute | Jenis | Fungsi |
| --- | --- | --- |
| / | Halaman | Selamat Datang (tamu pertama) atau redirect ke /dashboard |
| /login, /register, /reset-password | Halaman | Autentikasi email dan Google |
| /auth/callback | Route Handler | Penukaran sesi OAuth Google |
| /onboarding | Halaman | 3 langkah awal |
| /dashboard | Halaman | Beranda |
| /statistics | Halaman | Statistik (query: period, type, month, year) |
| /transactions | Halaman | Riwayat; tambah, ubah, hapus lewat Server Actions |
| /savings, /savings/\[id\] | Halaman | Daftar dan detail target; setor, tarik, arsip, pindahkan sisa bulan lalu lewat Server Actions |
| /profile | Halaman | Akun, kategori, anggaran, tema, kutipan, pengingat |
| /api/motivations/next | Route Handler (GET) | Satu kutipan baru untuk sesi ini, mencatat ID-nya |
| /api/export/transactions | Route Handler (GET) | Ekspor CSV |

## 12. User Story dan Kriteria Penerimaan

| Story | Kriteria penerimaan |
| --- | --- |
| Pengguna baru ingin disambut layar yang jelas | Selamat Datang tampil sekali; Mulai ke Daftar, Lewati ke Login |
| Ingin masuk dengan Google | Tombol Google di Daftar dan Login; akun baru langsung ke onboarding |
| Ingin mencatat pengeluaran dengan cepat | 3 ketukan setelah mengetik nominal; langsung muncul di riwayat dan beranda |
| Ingin menulis sendiri kebutuhan di Kebutuhan Lain | Kolom wajib; tanpa keterangan Simpan nonaktif; keterangan tampil di riwayat dan statistik |
| Ingin tahu batas pemakaian per hari | Beranda menampilkan sisa uang dan batas per hari yang berubah setelah transaksi baru |
| Ingin target tabungan dan menyetor | Target dibuat; progress ring muncul; setoran mengurangi sisa uang dan tampil di segmen Tabungan |
| Ingin sisa uang bulan lalu ditabung | Di awal bulan muncul kartu sisa; setelah dikonfirmasi masuk target pilihan sebagai setoran |
| Ingin kata motivasi tiap membuka aplikasi | Tiap sesi baru satu kutipan berbeda dari 15 terakhir; pindah halaman tidak menggantinya; bisa ditutup dan dimatikan di Pengaturan |
| Ingin melihat riwayat dari bottom bar | Tab Riwayat membuka daftar per tanggal dengan filter dan pencarian |
| Ingin melihat pengeluaran paling banyak | 5 kategori teratas dengan nominal dan persentase; Kebutuhan Lain menampilkan keterangan teratas |
| Ingin berganti Bulan dan Tahun | Toggle mengubah semua grafik tanpa memuat ulang halaman penuh |
| Ingin memilih mode gelap atau terang | Pilihan Gelap/Terang/Ikuti sistem tersimpan; semua layar terbaca baik |
| Ingin tampilan menyesuaikan layar | Tidak ada scroll horizontal pada 360 px; bottom bar di HP, sidebar di 1024 px ke atas |
| Ingin salah ketuk bisa dibatalkan | Toast Urungkan muncul sedikitnya 5 detik |

## 13. Kebutuhan Non-Fungsional

- **Performa:** LCP di bawah 2,5 detik pada 4G; bundle awal ramping; grafik lazy load; ilustrasi Selamat Datang berupa SVG ringan.
- **Keandalan data:** kalkulasi saldo di server dan diuji otomatis; transaksi tidak hilang saat koneksi putus (antrean offline).
- **Keamanan:** HTTPS, validasi Zod di server, RLS di semua tabel, rate limit pada login, state OAuth divalidasi, kunci rahasia hanya di variabel lingkungan server.
- **Privasi:** data keuangan hanya dilihat pemilik akun; hapus akun menghapus seluruh data.
- **Aksesibilitas:** kontras WCAG AA di kedua mode, target sentuh 44 px, label ARIA pada bottom bar dan grafik (ringkasan teks).
- **Kompatibilitas:** Chrome dan Safari modern di Android dan iOS, serta browser desktop utama.
- **Lokalisasi:** Bahasa Indonesia, format Rupiah (Rp 25.000), zona waktu Asia/Jakarta default.

## 14. Rencana Rilis (satu developer, sekitar 6 minggu)

| Minggu | Fokus |
| --- | --- |
| 1 | Setup Next.js + TypeScript, Supabase (database, Auth), Drizzle migration, seeder kategori dan kutipan, RLS, design token gelap + terang, layout responsif (bottom bar 5 tab + sidebar), layar Selamat Datang, deploy awal ke Vercel |
| 2 | Auth email dan Google, onboarding, catat transaksi, kategori (termasuk Kebutuhan Lain), Riwayat |
| 3 | Beranda, anggaran, kalkulasi sisa uang dan batas per hari, kartu motivasi (endpoint dan seeder) |
| 4 | Tabungan (target, setor, tarik, progres, sisa bulan lalu ke tabungan) |
| 5 | Statistik: donut, komposisi, tren, pengeluaran terbanyak, toggle Bulan/Tahun |
| 6 | PWA, antrean offline, pengingat, polesan UI, uji dengan 5–10 mahasiswa, perbaikan |

## 15. Risiko dan Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Pengguna berhenti mencatat setelah beberapa hari | Input super cepat, pengingat, progres tabungan, kutipan motivasi |
| Data terbuka karena RLS salah | RLS aktif di semua tabel, uji akses lintas pengguna, kunci service hanya di server |
| Koneksi database bermasalah karena mode pooler | Uji koneksi sejak minggu 1; pakai mode yang kompatibel dengan Drizzle |
| Paket gratis berubah, atau proyek Supabase dijeda | Cek syarat berkala; buka aplikasi rutin; siapkan paket berbayar bila dipakai banyak orang |
| Cron gratis terbatas untuk pengingat per jam pilihan | Pengingat berstatus Should; jadwal bisa kurang presisi di paket gratis |
| Notifikasi web terbatas di iOS | Jelaskan syarat pemasangan PWA |
| Animasi bottom bar berat di HP lama | Gunakan transform saja dan hormati reduced-motion |
| Cakupan fitur melebar | Pegang daftar Must; fitur Could setelah rilis pertama |

## 16. Keputusan

| Topik | Keputusan |
| --- | --- |
| Nama dan aksen | SakuIN; lime #D4FF5A sebagai aksen UI, warna lain hanya untuk grafik |
| Stack | Next.js + TypeScript, Supabase (Postgres + Auth), Vercel Hobby, agar gratis |
| Tab bottom bar | Beranda, Statistik, Catat, Riwayat, Tabungan; Profil lewat avatar |
| Sisa bulan lalu | Masuk Tabungan (S9) |
| Login Google | Must |
| Mode terang | Must sejak MVP |
| Kutipan motivasi | Must, ganti otomatis tiap sesi dari database |

## 17. Daftar Kutipan Motivasi (seeder awal, 120 kutipan)

Total 120 kutipan: 45 tabungan, 45 orang\_tua, 30 umum. Dengan aturan 15 terakhir tidak diulang, pengguna tidak melihat kutipan yang sama setidaknya selama 15 sesi. `{nama}` dan `{uang_kiriman}` diganti server.

### Kategori tabungan (45)

1. Menabung Rp5.000 hari ini lebih baik daripada menyesal di akhir bulan.
2. Tabungan kecil yang konsisten mengalahkan niat besar yang tertunda.
3. Sisihkan dulu sebelum belanja, bukan menabung dari sisa.
4. {nama}, satu langkah kecil hari ini mendekatkanmu ke tujuan tabunganmu.
5. Uang yang ditabung hari ini adalah ketenangan di hari yang sulit.
6. Dana darurat bukan soal kaya, tapi soal siap.
7. Jajan bisa ditunda, masa depan tidak bisa diulang.
8. Setiap setoran adalah janji kecil pada dirimu di masa depan.
9. Kebiasaan menabung dibangun dari hari ini, bukan dari gaji pertama.
10. Cek sisa uangmu sebelum belanja, bukan setelah dompet kosong.
11. Target yang jelas membuat menabung terasa seperti permainan yang bisa kamu menangkan.
12. Rp10.000 per hari menjadi Rp300.000 per bulan. Hitung, lalu mulai.
13. Hemat bukan pelit, hemat adalah memilih yang benar-benar penting.
14. Jangan menunggu uang lebih untuk menabung; mulai dari yang ada.
15. Tabungan yang tumbuh pelan tetap tumbuh. Terus setor, {nama}.
16. Beli yang dibutuhkan, tabung untuk yang diinginkan.
17. Satu gelas kopi yang tidak dibeli hari ini bisa jadi setoran hari ini.
18. Uang kiriman habis itu biasa, tabungan yang tidak ada itu yang perlu dikhawatirkan.
19. Catat hari ini, tenang sampai akhir bulan.
20. Kamu tidak perlu menabung banyak, kamu perlu menabung terus.
21. Disiplin kecil hari ini, kebebasan finansial besok.
22. Lihat progres tabunganmu: setiap persen adalah hasil keputusanmu sendiri.
23. Sebelum checkout, tanya dulu: butuh atau cuma ingin?
24. Laptop impian dimulai dari setoran pertama.
25. Pulang kampung dengan tabungan sendiri rasanya jauh lebih bangga.
26. Menabung itu seperti mencuci baju: ditunda hanya menumpuk.
27. Sisa uang bulan lalu bisa jadi bekal bulan ini. Pindahkan ke tabungan.
28. Hari ini kamu mencatat, berarti hari ini kamu lebih bijak dari kemarin.
29. Tabungan adalah teman setia saat kiriman telat datang.
30. Orang yang tahu ke mana uangnya pergi jarang kehabisan di tengah bulan.
31. Mulai dari Rp2.000 pun tetap mulai.
32. Batas harian bukan hukuman, tapi cara supaya uangmu cukup sampai akhir bulan.
33. Jangan bandingkan tabunganmu dengan orang lain, bandingkan dengan dirimu bulan lalu.
34. Setiap catatan pengeluaran adalah satu langkah menuju kendali.
35. Target tercapai karena konsisten, bukan karena kebetulan.
36. Dana darurat hari ini menyelamatkanmu dari utang besok.
37. {nama}, kamu sudah menabung sejauh ini. Jangan berhenti sekarang.
38. Keinginan datang dan pergi, tabungan menetap.
39. Kurangi satu jajan, tambah satu langkah ke targetmu.
40. Uang yang dicatat jarang hilang tanpa jejak.
41. Menabung bukan menahan diri, tapi memilih masa depan.
42. Sedikit demi sedikit, lama-lama jadi bukit. Terus tabung.
43. Sisa banyak bulan ini? Pindahkan sebagian ke tabungan sebelum tergoda.
44. Pertanyaan terbaik sebelum membeli: apakah ini membawaku ke tujuanku?
45. Tabunganmu adalah rencana cadangan yang kamu buat sendiri.

### Kategori orang\_tua (45)

1. Setiap rupiah kiriman ini dicari dengan capek. Pakai secukupnya, sisihkan sisanya.
2. Orang tuamu rela berhemat supaya kamu bisa kuliah. Hargai dengan mengatur uangnya.
3. Uang Rp{uang\_kiriman} ini bukan angka kecil bagi orang tuamu. Pakai dengan bijak, {nama}.
4. Ada yang bangun pagi-pagi supaya kamu bisa makan hari ini. Jangan sia-siakan.
5. Di rumah, orang tuamu mungkin menunda membeli yang mereka mau demi kamu.
6. Kiriman ini adalah keringat yang dikemas jadi angka. Jaga baik-baik.
7. Ingat lelah mereka setiap kali kamu ingin jajan berlebihan.
8. Orang tuamu tidak minta balasan, hanya ingin kamu lulus dan baik-baik saja.
9. Menghemat uang kiriman adalah cara sederhana berterima kasih pada orang tua.
10. Sebelum belanja, ingat siapa yang bekerja keras untuk uang itu.
11. Doa mereka menyertaimu setiap malam. Balas dengan sungguh-sungguh kuliah.
12. Setiap bulan mereka berjuang supaya kirimanmu tidak telat. Jangan boros, {nama}.
13. Kamu jauh dari rumah, tapi uang ini adalah pelukan dari rumah. Jaga.
14. Orang tuamu mungkin tak pernah bilang lelah. Kamu tahu, jadi hargai.
15. Kuliahmu adalah harapan terbesar mereka. Uang ini adalah dukungannya.
16. Hemat hari ini, supaya mereka tidak perlu menambah kiriman bulan depan.
17. Mereka bekerja puluhan tahun agar kamu bisa belajar. Lanjutkan perjuanganmu.
18. Kalau ingin menghamburkan uang, ingat wajah orang tuamu saat bekerja.
19. Telepon mereka hari ini. Satu menit kabar lebih berharga dari uang.
20. Uang kiriman bisa habis, jerih payah mereka tidak boleh sia-sia.
21. Setiap nasi yang kamu makan hari ini adalah hasil kerja mereka. Syukuri.
22. Bapak dan ibu mungkin tidak punya banyak, tapi memberi yang terbaik untukmu.
23. Tabungan kecilmu hari ini bisa jadi hadiah untuk mereka di hari wisuda.
24. Jangan malu hidup hemat. Itu bentuk hormat pada orang tua.
25. Mereka bekerja di bawah panas dan hujan. Kamu cukup mengatur uang dengan baik.
26. Orang tuamu bangga padamu bahkan saat kamu merasa belum berbuat apa-apa.
27. Kirim kabar ke rumah, {nama}. Mereka juga rindu seperti kamu.
28. Cara membahagiakan orang tua: uang kiriman tidak habis sebelum waktunya.
29. Jangan minta tambahan kalau masih bisa diatur. Mereka sudah memberi semampunya.
30. Pulang nanti, bawa cerita baik dan sedikit tabungan untuk ibu.
31. Orang tua tidak menuntut kamu kaya, hanya ingin kamu mandiri dan selamat.
32. Hari ini mungkin berat, bayangkan beratnya hari-hari mereka. Tetap semangat.
33. Uang jajanmu hari ini adalah jam kerja mereka kemarin.
34. Di balik setiap transfer ada tangan lelah yang tetap tersenyum.
35. Tabung sebagian kiriman ini untuk membalas jasa mereka suatu hari nanti.
36. Setiap catatan pengeluaranmu adalah tanggung jawab atas kepercayaan mereka.
37. Mereka percaya padamu sampai rela melepasmu ke perantauan. Jaga kepercayaan itu.
38. Kiriman telat bukan salah mereka. Semoga kamu sudah siapkan dana darurat.
39. Setiap semester yang kamu lewati adalah impian mereka yang terwujud.
40. Orang tuamu rela tidur larut demi mencari rezeki. Jangan sia-siakan hasilnya.
41. Jadilah anak yang membuat orang tua tidak khawatir soal uangmu.
42. Satu jajan ditahan, satu beban orang tua berkurang.
43. Nilai uang diukur dari keringat yang mendapatkannya.
44. Ibu mungkin sedang menghitung uang di rumah supaya kirimanmu cukup. Hitung juga di sini.
45. Suatu hari kamu akan membalas semua pengorbanan ini. Mulai dengan menjaga uangnya.

### Kategori umum (30)

1. Selamat datang kembali, {nama}. Catat dulu, tenang kemudian.
2. Satu catatan hari ini menyelamatkan satu hari di akhir bulan.
3. Sisa uangmu masih ada. Atur supaya cukup.
4. Tidak perlu sempurna, cukup konsisten mencatat.
5. Pengeluaran kecil yang tak tercatat adalah penyebab dompet cepat kosong.
6. Kamu lebih baik dari kemarin selama kamu mau mencatat.
7. Uang adalah alat, bukan tujuan. Pakai untuk hal yang berarti.
8. Kendali ada di tanganmu, {nama}. Mulai dari satu catatan.
9. Mahasiswa yang hemat hari ini adalah orang mapan di kemudian hari.
10. Jangan panik di tanggal tua. Siapkan dari tanggal muda.
11. Mengatur uang adalah pelajaran yang tidak ada di kelas tapi sangat berguna.
12. Cek batas harianmu, lalu nikmati harimu tanpa cemas.
13. Satu hari tanpa jajan impulsif adalah kemenangan kecil.
14. Pilih kebutuhan, tunda keinginan. Besok masih ada.
15. Yang penting bukan seberapa banyak uangmu, tapi seberapa baik kamu mengelolanya.
16. Pengeluaran yang tercatat membuatmu sadar, dan sadar membuatmu hemat.
17. Boleh senang-senang, asal batas harian tetap aman.
18. Perantauan mengajarkan kemandirian. Uangmu adalah latihan pertamanya.
19. Hari baru, kesempatan baru mengatur keuangan lebih baik.
20. Tenang saat tanggal tua. Kamu sudah punya rencana.
21. Rencana kecil hari ini mencegah kekacauan besar nanti.
22. Malu itu bukan karena hemat, tapi karena tak punya apa-apa saat darurat.
23. Sedikit lebih bijak setiap hari, hasilnya terasa di akhir bulan.
24. Catat, atur, tabung. Tiga langkah sederhana, hasil besar.
25. Kamu sedang membangun kebiasaan yang berguna seumur hidup.
26. Masak sendiri sesekali bisa menghemat lebih banyak dari yang kamu kira.
27. Kuota, laundry, listrik: yang kecil dan rutin itulah yang perlu dicatat.
28. Semangat, {nama}! Satu bulan lagi dikelola dengan baik.
29. Uang cukup bukan karena banyak, tapi karena diatur.
30. Terima kasih sudah mencatat hari ini. Itu langkah yang bagus.
