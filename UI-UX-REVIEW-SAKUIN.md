# Dokumentasi & Audit UI/UX — SakuIN (Versi Mobile-First & Web)

**Tujuan Dokumen:** Menjelaskan secara jujur dan detail bagaimana tampilan UI, struktur navigasi, dan pengalaman pengguna (UX) SakuIN bekerja saat ini—termasuk evaluasi apakah layarnya **sudah user-friendly** atau **masih terlalu padat di HP**—agar teman/reviewer bisa memberi masukan yang tepat sasaran.

---

## 1. Konsep Visual & Bahasa Desain SakuIN

Mengacu pada [`DESIGN.md`](file:///c:/ProjectAdly/SakuIN/DESIGN.md) dan implementasi komponen nyata:
- **Gaya Utama:** *Modern Minimalist Banking UI* (tenang, latar gelap default agar nyaman di mata malam hari, mendukung Light Mode).
- **Palet Warna (*Little Color Rule*):**
  - **Latar Utama (Dark):** `#2B2B2B` (halaman) & `#353535` (kartu), dengan kontras terang `#F5F6F2` / `#FFFFFF` di Light Mode.
  - **Aksen Interaktif Tunggal:** Lime (`#D4FF5A`) dipakai khusus untuk CTA utama, tombol aktif, dan sorotan angka positif (teks di atas lime selalu gelap `#1F1F1F` supaya kontras terbaca jelas).
  - **Warna Semantik Data (Khusus Grafik & Tag):** Coral/Merah (`#FF7B7B`) untuk pengeluaran/over-limit, Oranye (`#FFB04A`) untuk tabungan/dana terkunci/waspada, serta palet grafik (`#8CCBFF`, `#6B72FF`, `#5BAA6B`, `#A78BFA`).
- **Tipografi:** `Plus Jakarta Sans` (angka besar pada nominal utama, label kecil uppercase untuk metadata).

---

## 2. Arsitektur Navigasi: HP vs Desktop

### A. Tampilan HP (`< 768px`, Target Utama Mahasiswa)
1. **Top Header ([`top-header.tsx`](file:///c:/ProjectAdly/SakuIN/src/components/layout/top-header.tsx)):**
   - Sticky di atas dengan tinggi aman *safe-area* notch HP (`env(safe-area-inset-top)`).
   - Hanya berisi 3 elemen bersih: **Logo Sakuin**, **Tombol Ganti Tema (Dark/Light)**, dan **Avatar Profil** (`44×44px`).
2. **Bottom Navigation Bar ([`mobile-bottom-bar.tsx`](file:///c:/ProjectAdly/SakuIN/src/components/layout/mobile-bottom-bar.tsx)):**
   - Tinggi bar `72px` dengan animasi kurva **SVG concave notch** + lingkaran mengambang (`56px`) pada tab aktif.
   - Berisi **5 tab utama**:
     1. **Beranda** (`/dashboard`)
     2. **Statistik** (`/statistics`)
     3. **Catat** (`/record`) — tepat di tengah jangkauan ibu jari (*thumb zone*)
     4. **Riwayat** (`/transactions`)
     5. **Tabungan** (`/savings`)
3. **Akses Fitur Tambahan di HP:**
   - Halaman **Multi Rekening & Dana Terkunci** (`/accounts`) serta **Utang Piutang** (`/debts`) belum masuk ke Bottom Bar (agar bar tetap 5 tab), sehingga di HP diakses lewat Beranda.

### B. Tampilan Desktop (`>= 768px`)
- Menggunakan **Sidebar Kiri Sticky** ([`desktop-sidebar.tsx`](file:///c:/ProjectAdly/SakuIN/src/components/layout/desktop-sidebar.tsx)) berisi 8 menu penuh (termasuk `Multi Rekening`, `Utang Piutang`, dan `Profil`), sementara konten utama memakai max-width terpusat (`1100px`, grid 2 kolom di layar `>= 1024px`).

---

## 3. Bedah UI & Alur Tiap Halaman Utama

### 3.1 Layar Kunci PIN ([`pin-lock-screen.tsx`](file:///c:/ProjectAdly/SakuIN/src/components/auth/pin-lock-screen.tsx))
- **Alur UX:** Keypad angka kustom fullscreen, auto-submit di digit ke-6 (tanpa tombol OK).
- **Optimasi Mobile:** Sentuhan tombol memakai `onPointerDown` (`0ms` delay di Android WebView), indikator 6 titik pakai animasi CSS GPU (`transition-transform duration-75`), dan verifikasi SHA-256 lokal sinkron (`< 1ms`).

### 3.2 Beranda / Dashboard ([`dashboard/page.tsx`](file:///c:/ProjectAdly/SakuIN/src/app/%28main%29/dashboard/page.tsx))
Urutan konten yang dilihat pengguna dari atas ke bawah di layar HP (`1 kolom`):
1. **Header Tanggal & Sapaan** (*"Halo, Nama"*) + badge bulan.
2. **Kartu Motivasi Harian** (bisa di-refresh kutipannya atau ditutup).
3. **Hero Card Fokus Jatah Harian** *(baru diperbarui)*:
   - **Paling atas & paling besar:** **Sisa Batas Hari Ini** (warna dinamis: Lime aman, Oranye >= 80%, Merah habis/over limit) + badge status (**Aman / Waspada / Kritis**) + info sisihan.
   - **Bar 1:** Progress bar **Terpakai Hari Ini** vs jatah hari ini + pesan peringatan jika >= 80%.
   - **Bar Dana Terkunci** *(muncul jika ada tagihan Kos/WiFi)*: `Terkunci` vs `Bebas Pakai` + link *Atur Tagihan*.
   - **Footer Kartu:** **Total Saldo** (gabungan Bank, E-Wallet, Tunai) + info **Siklus Bulanan/Mingguan** (*Sisa X Hari*).
   - **Bar 2:** Progress bar **Pemakaian Anggaran Bulanan**.
4. **Kartu Kontekstual Otomatis** *(muncul hanya saat relevan)*:
   - Kartu konfirmasi **Hari Kiriman (Payday)** 1-ketuk jika hari kiriman tiba.
   - Kartu **Carryover Sisa Hemat Kemarin** untuk memindahkan sisa hemat harian ke Tabungan.
5. **Grid Rekening & Dompet:** Kartu saldo Bank, E-Wallet, dan Tunai + badge Total + tombol *Kelola*.
6. **2 Tombol Akses Cepat:** *Multi Rekening* dan *Utang Piutang*.
7. **Filter Tipe & Periode:** Pil `Pengeluaran/Pemasukan/Tabungan` dan toggle `Bulan/Tahun`.
8. **Grafik Donut Kategori & Pie Komposisi:** 2 kartu bersebelahan (`grid-cols-2`).
9. **Top Pengeluaran Terbanyak Bulan Ini** (peringkat bar).
10. **Tren 6 Bulan & Deteksi Bulan Terboros** (line chart interaktif).
11. **Transaksi Terbaru** (maksimal 5 item) + tombol CTA **Tambah Transaksi Baru**.

### 3.3 Catat Transaksi ([`record/page.tsx`](file:///c:/ProjectAdly/SakuIN/src/app/%28main%29/record/page.tsx))
- Layout ramping `max-w-[480px]` satu kolom.
- Alur 4 langkah cepat: Toggle `Pengeluaran / Pemasukan` $\rightarrow$ Input Nominal besar + 5 pil `+5rb s.d. +100rb` $\rightarrow$ Grid Kategori `3 kolom` (plus opsi *Kategori Lainnya*) $\rightarrow$ Pilih Rekening (`Dompet Tunai / Bank / GoPay` beserta sisa saldo & peringatan kalau saldo kurang) $\rightarrow$ Catatan & Tanggal opsional $\rightarrow$ Simpan (otomatis masuk antrean offline kalau sinyal putus).

### 3.4 Riwayat, Statistik, Tabungan, Rekening, & Utang
- **Riwayat (`/transactions`):** Filter bulan/tipe/pencarian, daftar transaksi dikelompokkan, edit lewat *bottom sheet* dengan footer sticky, dan dialog konfirmasi hapus kustom.
- **Statistik (`/statistics`):** Donut kategori, tren 8 bulan, top 5 transaksi terbesar, rincian *Kebutuhan Lain*, kontrol batas kategori (*Kontrol Pos Boros*), dan *Insight Cerdas*.
- **Tabungan (`/savings`):** Ringkasan total tabungan, target impian + progress + saran mingguan, modal Setor/Tarik yang terhubung langsung ke saldo rekening, serta pengaturan target default *Sisa Hemat*.
- **Multi Rekening (`/accounts`):** Ringkasan total & rincian Bank/E-Wallet/Tunai, pindah saldo antar rekening, sesuaikan saldo, dan bagian **Pos Dana Terkunci / Tagihan Wajib** (Kos, WiFi, Token, Cicilan).
- **Utang Piutang (`/debts`):** Tab filter (`Semua`, `Teman Ngutang`, `Saya Berutang`, `Lunas`), pelacakan cicilan, dan penanda jatuh tempo (`Terlewat`, `Hari Ini!`, `Besok`).

---

## 4. Evaluasi Jujur: Apakah Sudah User-Friendly & Tidak Padat di HP?

### Yang Sudah Terasa User-Friendly
1. **Navigasi jempol (*thumb-friendly*) & bebas menumpuk menu atas:** 5 tab bawah jelas dan tombol `+ Catat` mudah dijangkau satu tangan.
2. **Kecepatan respon & persepsi ringan:** Cache `localStorage` membuat halaman terbuka instan (`0ms`) sebelum sync server selesai; antrean offline membuat input di tempat susah sinyal tetap jalan.
3. **Hero Card fokus pada angka yang dipakai tiap hari:** Menjadikan **Sisa Batas Hari Ini** sebagai angka terbesar langsung membantu mahasiswa mengambil keputusan saat mau jajan.
4. **Target sentuh utama cukup aman:** Sebagian besar tombol aksi utama memakai `min-h-[44px]` sesuai standar sentuh mobile.

### Bagian yang Masih Terasa PADAT / Kurang Nyaman di Layar HP (Area Perbaikan)
Jika dibuka di HP berlayar standar (`360px – 390px` lebar, `~740px – 840px` tinggi), ada **5 titik padat** yang paling terasa:

1. **Beranda (`/dashboard`) terlalu panjang ke bawah & Hero Card memuat terlalu banyak baris:**
   - Di HP, pengguna harus menggulir melewati **~10 sampai 11 bagian vertikal** di Beranda saja.
   - Di dalam **Hero Card** sendiri ada 2 progress bar (*Terpakai Hari Ini* dan *Pemakaian Anggaran*), 2 pasang angka besar/sedang (*Sisa Batas Hari Ini* + *Total Saldo*), plus baris *Dana Terkunci*. Di layar kecil, kartu ini bisa memakan hampir **55–65% tinggi layar HP pertama**.
   - **Solusi yang bisa dipertimbangkan:**
     - Pindahkan progress bar *Pemakaian Anggaran Bulanan* atau sebagian grafik analitik mendalam ke tab **Statistik** (karena di bawah sudah ada tab Statistik khusus!).
     - Cukup tampilkan di Beranda HP: **Hero Card + Rekening + 5 Transaksi Terbaru** (atau ringkasan 1 grafik saja).

2. **Grafik Donut & Komposisi di Beranda masih pakai `grid-cols-2` di HP (`dashboard/page.tsx:1178`):**
   - Dua kartu chart dipaksa bersebelahan di lebar ~340px (masing-masing kartu hanya mendapat lebar `~160px`!). Akibatnya teks legenda kategori gampang terpotong (`...`) dan angka terasa sempit.
   - **Solusi:** Gunakan `grid-cols-1 sm:grid-cols-2` agar di HP tiap grafik tampil lega selebar layar, atau tampilkan 1 chart utama di Beranda.

3. **Kartu Akses Cepat `Multi Rekening` di Beranda bersifat dobel (redundan):**
   - Tepat di atasnya sudah ada bagian **Rekening & Dompet** lengkap dengan kartu rekening dan link `Kelola -> /accounts`. Lalu tepat di bawahnya ada tombol **Multi Rekening -> `/accounts`** lagi. Ini membuang ruang vertikal di HP.
   - **Solusi:** Hapus kartu dobel *Multi Rekening*, ganti ruangnya menjadi pintasan yang benar-benar belum ada tombol cepatnya (misal **Tagihan Terkunci** & **Utang Piutang**).

4. **Banyak teks kecil berukuran `10px`–`11px` (`text-[10px]`, `text-[11px]`):**
   - Di beberapa kartu (label subteks, badge, legenda, rincian modal), ukuran font `10px` cukup melelahkan mata jika dibaca sambil jalan atau di luar ruangan, dan masih di bawah standar nyaman mobile (`12px` minimum untuk caption, `14px` untuk teks isi).

5. **Form Catat Transaksi (`/record`) bisa membutuhkan scroll untuk mencapai tombol Simpan:**
   - Ketika seluruh blok tampil bersamaan (Tipe + Nominal + Quick Chips + Grid 6 Kategori + 3 Kartu Rekening + Catatan + Tanggal), di HP berlayar pendek tombol **"Simpan Transaksi"** sering turun ke bawah lipatan layar (*below the fold*).
   - **Solusi:** Jadikan tombol **"Simpan Transaksi"** menempel (*sticky*) di bagian bawah layar saat di `/record`, atau ringkas padding/tinggi kolom Catatan & Tanggal dalam 1 baris kompak / toggle *"Tambah detail"*.

6. **Akses ke `/accounts` dan `/debts` di HP hanya bergantung dari Beranda:**
   - Karena Bottom Bar HP hanya 5 tab, saat pengguna sedang berada di tab *Statistik* atau *Riwayat*, mereka harus kembali ke *Beranda* dulu jika ingin membuka *Utang Piutang* atau *Multi Rekening*.
   - **Solusi:** Tambahkan pintasan kecil ke `/accounts` dan `/debts` di halaman **Profil** (atau gabungkan aksesnya di **Top Header** / menu **Lainnya**).

---

## 5. Pertanyaan untuk Diskusi & Saran Teman

1. Saat pertama kali membuka **Beranda di HP**, apakah tampilannya terasa terlalu penuh / terlalu panjang ke bawah? Bagian mana yang menurutmu boleh dipindah ke **Statistik** supaya Beranda lebih lega?
2. Untuk 2 grafik di Beranda (Donut Kategori & Pie Komposisi), lebih nyaman **ditumpuk 1 kolom ke bawah (`16:9`)** di HP atau **1 grafik saja (bisa digeser/swipe)**?
3. Pada **Halaman Catat (`/record`)**, apakah perlu tombol **Simpan** dibuat melayang/sticky di bawah supaya tidak usah scroll saat buru-buru mencatat jajan?
4. Apakah ukuran tulisan dan jarak antar kartu di HP sudah nyaman dibaca mata, atau masih terasa terlalu kecil & rapat?
5. Untuk menu tambahan seperti **Utang Piutang** dan **Multi Rekening**, lebih enak diakses lewat Beranda saja, di halaman Profil, atau lewat menu khusus?
