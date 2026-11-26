# PRD Perbaikan UI/UX — SakuIN (Mobile-First)

**Produk:** SakuIN · **Fokus:** Penyederhanaan UI/UX Mobile-First · **Tanggal:** 26 November 2026 · **Status:** Disetujui sebagai Rencana Eksekusi

> Dokumen ini berfokus pada perbaikan UI/UX SakuIN (terpisah dari PRD Pembagian Anggaran Per Kategori). Penilaian awal disusun berdasarkan audit UI/UX di [`UI-UX-REVIEW-SAKUIN.md`](UI-UX-REVIEW-SAKUIN.md) dan akan divalidasi langsung lewat rencana tes pengguna di Bagian 12.

---

## 1. Ringkasan Eksekutif

**Penilaian singkat:** Tugas inti sudah simpel, tetapi sebagian besar tampilan masih terasa padat dan ribet bagi pengguna baru di HP.

- **Sudah bagus:** Mencatat jajan lewat tab **Catat** di tengah, serta **Sisa Batas Hari Ini** yang tampil sebagai angka terbesar di Beranda.
- **Masih ribet:** Beranda terlalu panjang dan penuh istilah keuangan, tombol Simpan sering turun di bawah lipatan layar, ukuran teks terlalu kecil, dan pengguna hari ke-1 belum dipandu.
- **Arah perbaikan:** Kurangi elemen yang bersaing mencari perhatian, percepat momen mencatat, dan pandu pengguna baru sejak hari pertama.

---

## 2. Apa yang Sudah Bagus (Wajib Dipertahankan)

- Navigasi **5 tab** bottom bar dengan tombol **Catat** tepat di zona jempol (*thumb zone*).
- **Hero Card** yang menempatkan **Sisa Batas Hari Ini** sebagai angka terbesar.
- Halaman terbuka instan (`0ms`) berkat cache lokal `localStorage`, plus antrean offline untuk area sinyal lemah.
- Sebagian besar tombol utama sudah memenuhi target sentuh minimal `44px`.
- Gaya visual tenang dengan satu warna aksen (**Lime**) yang konsisten.

---

## 3. Prinsip Panduan

1. **Satu layar, satu tugas.** Beranda di HP menjawab satu pertanyaan dalam 3 detik: *"Hari ini boleh jajan berapa?"*
2. **Satu angka utama.** Angka lain bersifat pendukung dan tampil lebih kecil.
3. **Mencatat harus secepat mungkin.** Setiap ketukan atau scroll tambahan di halaman Catat mengurangi kebiasaan mencatat.
4. **Bahasa sehari-hari.** Gunakan istilah yang akrab bagi mahasiswa, bukan istilah teknis/dokumen internal.
5. **Jangan membuat pengguna ragu pada angkanya.** Tampilkan penanda jelas bila ada data yang belum sinkron ke server.

---

## 4. Beranda (Dashboard)

### Masalah
- Di HP, pengguna harus scroll melewati sekitar 10–11 bagian vertikal.
- **Hero Card** memuat 6 istilah sekaligus (*Sisa Batas*, *Terpakai*, *Pemakaian Anggaran*, *Bebas Pakai*, *Terkunci*, *Total Saldo*) dan 2 progress bar, sehingga memakan 55–65% tinggi layar pertama.
- Kartu motivasi berada di atas Hero Card sehingga mendorong angka terpenting ke bawah.
- Donut dan pie chart berdampingan dengan `grid-cols-2` (~160px/kartu di HP), legendanya terpotong dan isinya tumpang tindih.
- Kartu akses cepat **Multi Rekening** di Beranda dobel dengan bagian **Rekening & Dompet** tepat di atasnya.

### Spesifikasi Perbaikan
- **Rampingkan Hero Card:**
  - **1 angka besar:** *Sisa Batas Hari Ini*
  - **1 progress bar:** *Terpakai Hari Ini*
  - **1 chip:** *Dana Terkunci* (jika ada)
  - *Total Saldo* tampil sebagai info ringkas pendukung; *Pemakaian Anggaran Bulanan* cukup 1 baris teks kecil atau dipindahkan ke Statistik.
- **Hapus kartu motivasi dari Beranda:** Kutipan dikirim lewat notifikasi (lihat Bagian 7) atau opsi terpisah di pengaturan bagi yang ingin menampilkannya.
- **Kartu kontekstual (*Payday*, *Carryover*):** Tampil **satu per satu** tepat di bawah Hero Card saat membutuhkan respons pengguna.
- **Pindahkan semua grafik dari Beranda HP ke Statistik:** Di HP (`< lg`), hapus donut, pie, tren, dan top pengeluaran dari Beranda; di desktop (`>= lg`) grafik tetap boleh tampil.
- **Hapus kartu akses cepat Multi Rekening yang dobel.**
- **Lazy-load** bagian di bawah layar pertama agar render awal ringan.

### Susunan Beranda HP Target (Maksimal 5 Bagian)

```text
+--------------------------------------+
| Halo, Adly            [badge bulan]  |
+--------------------------------------+
| SISA BATAS HARI INI        [Aman]    |
|      Rp 32.000                       |
| [====------] Terpakai hari ini       |
| [Terkunci Rp 450rb]  Saldo Rp 1,2jt  |
+--------------------------------------+
| (kartu kontekstual, hanya jika ada)  |
| Hari kiriman tiba - [Konfirmasi]     |
+--------------------------------------+
| Rekening & Dompet          [Kelola]  |
| [Bank] [E-Wallet] [Tunai]            |
+--------------------------------------+
| Transaksi Terbaru (3)                |
| ...                                  |
| [ + Catat Transaksi ]                |
+--------------------------------------+
```

---

## 5. Halaman Catat (`/record`)

### Masalah
- Tombol **Simpan** sering turun di bawah lipatan layar pada HP berlayar pendek karena semua blok tampil sekaligus.
- Urutan kategori statis, padahal tiap mahasiswa punya kebiasaan pengeluaran yang berbeda.

### Spesifikasi Perbaikan
- **Tombol Simpan sticky** tepat di atas bottom bar (`72px`), dengan penanganan `visualViewport` agar tidak tertutup keyboard di Android WebView.
- **Urutkan kategori berdasarkan frekuensi pakai pengguna:** Tampilkan 5–6 kategori teratas, sisanya masuk ke *"Lainnya"*.
- **Ingat rekening terakhir yang dipakai** sebagai pilihan default.
- **Auto-focus di kolom nominal** dengan `inputMode="numeric"`.
- **Ringkas Catatan dan Tanggal** menjadi 1 baris kompak atau toggle *"Tambah detail"*.
- **Tampilkan dampak langsung setelah simpan:** Misalnya *"Sisa Batas Hari Ini jadi Rp 27.000"* (ditambah 1 kalimat motivasi singkat yang kontekstual).
- **Di Riwayat (`/transactions`):** Ganti dialog konfirmasi hapus menjadi **snackbar "Urungkan" (Undo)** menggunakan mekanisme soft-delete.

---

## 6. Navigasi dan Akses Fitur

- **Jangan tambah tab ke-6:** Bottom bar HP tetap 5 tab utama.
- **Atur Tagihan (*Dana Terkunci*):** Tetap diakses lewat chip di Hero Card karena langsung memengaruhi angka *Sisa Batas Hari Ini*.
- **Utang Piutang dan Multi Rekening:** Diberi jalan pintas lewat menu di **Avatar / Top Header** atau halaman **Profil**, sehingga bisa dibuka dari tab mana pun tanpa harus kembali ke Beranda.
- **Desktop:** Sidebar 8 menu tetap dipertahankan.

---

## 7. Notifikasi dan Kutipan Motivasi

Kutipan motivasi dialihkan ke notifikasi, bukan kartu di atas Beranda, agar angka *Sisa Batas Hari Ini* selalu jadi fokus pertama dan tetap menjangkau pengguna saat app sedang tidak dibuka.

- **Pisahkan saluran pengaturan notifikasi:** Notifikasi motivasi tidak boleh digabung dengan notifikasi penting (batas harian, hari kiriman, jatuh tempo utang) agar pengguna yang mematikan motivasi tidak ikut mematikan peringatan penting.
- **Frekuensi:** Maksimal **1 kali sehari** pada jam yang bisa dipilih pengguna (misal pagi hari).
- **Default mati untuk pengguna baru:** Tawarkan dengan sopan saat awal pemakaian (*"Mau dapat kutipan semangat tiap pagi?"*).
- **Kontekstual:** Pasangkan dengan momen nyata (misal kutipan hemat saat sisa batas menipis, atau apresiasi saat 3 hari berturut-turut di bawah batas harian) dan tampilkan juga di layar sukses setelah simpan transaksi.
- **Deep link:** Mengetuk notifikasi langsung membuka `/dashboard`.

| Jenis Notifikasi | Contoh Isi | Frekuensi | Default |
| --- | --- | --- | --- |
| Peringatan batas | *"Sisa batas hari ini tinggal 20%"* | Saat mencapai 80% dan 100% | Aktif |
| Hari kiriman | *"Uang kiriman sudah masuk?"* | Sekali per siklus kiriman | Aktif |
| Jatuh tempo utang | *"Utang Budi jatuh tempo besok"* | H-1 dan Hari-H | Aktif |
| Motivasi harian | Kutipan semangat pagi | Maksimal 1x/hari, jam pilihan user | Mati (ditawarkan di awal) |
| Motivasi kontekstual | *"3 hari berturut-turut di bawah batas!"* | Saat kondisi terpenuhi (maks 1x/hari) | Mengikuti pengaturan motivasi |

---

## 8. Visual, Tipografi, dan Aksesibilitas

### Tipografi
- Ukuran minimum **12px** untuk seluruh teks isi dan legenda grafik (label uppercase kecil minimal `11px`).
- Definisikan **token ukuran font** (`caption`, `body`, `title`) agar konsisten dan hilangkan pemakaian acak `text-[9px]` / `text-[10px]`.
- Perlega jarak antar kartu di tampilan HP.

### Warna dan Kontras
- **Perbaikan kontras Light Mode:** Warna Lime `#D4FF5A` tidak dipakai sebagai warna teks di atas latar terang `#F5F6F2` (rasio kontras terlalu rendah ~1.2:1). `#D4FF5A` hanya dipakai sebagai latar tombol/pil ber-teks `#1F1F1F`; untuk angka/teks positif di Light Mode gunakan hijau gelap `--accent-text`.
- **Aksesibilitas status:** Status *Aman*, *Waspada*, dan *Kritis* wajib didampingi label teks atau ikon (bukan hanya pembeda warna).

### Ukuran Sentuh
- Lakukan audit semua elemen interaktif (terutama chip `+5rb s.d. +100rb` dan chip filter) agar memenuhi ukuran sentuh minimal `44×44px`.

---

## 9. Pengguna Baru dan Kepercayaan pada Angka

### Pengalaman Hari ke-1
- Saat Beranda belum punya transaksi, jangan menampilkan kotak grafik kosong yang membingungkan.
- Ganti area kosong dengan **1 kartu checklist**:
  1. *Isi saldo awal*
  2. *Catat transaksi pertama*
  3. *Atur tagihan wajib (opsional)*
  *(Kartu otomatis menghilang setelah selesai.)*
- Berikan empty state yang ramah dengan 1 CTA jelas di Riwayat dan Statistik.

### Kepercayaan pada Angka & Bahasa Layar
- **Status sinkronisasi offline:** Jika masih ada transaksi di antrean lokal, tampilkan penanda jelas (misal *"1 transaksi menunggu sinyal"*).
- **Istilah seragam & bahasa sehari-hari:**
  - Gunakan *"Pindahkan jatah"* daripada *"Realokasi"*.
  - Gunakan *"Sisa dibawa ke tabungan"* daripada *"Carryover"*.

---

## 10. Performa di HP Kelas Menengah ke Bawah

- Lazy-load grafik hanya saat terlihat di layar (di HP, pemindahan grafik dari Beranda ke Statistik otomatis meringankan Beranda).
- Sediakan fallback ringan untuk animasi kurva SVG *notch* pada bottom bar bagi perangkat rendah dan hormati `prefers-reduced-motion`.
- Ukur waktu render awal Beranda pada 1 perangkat Android kelas menengah sebelum dan sesudah implementasi.

---

## 11. Urutan Pengerjaan (Roadmap Implementasi)

### Tahap 1: Cepat (1–2 Hari)
1. Ubah `grid-cols-2` grafik Beranda menjadi `grid-cols-1` di HP *(solusi sementara sebelum grafik HP dipindah ke Statistik)*.
2. Hapus kartu akses cepat **Multi Rekening** yang dobel di Beranda.
3. Naikkan ukuran font minimum menjadi **12px** untuk teks isi & legenda (label uppercase min `11px`).
4. Buat tombol **Simpan** sticky di `/record` (aman dari keyboard lewat `visualViewport`).
5. Hapus kartu motivasi dari Beranda HP *(pindahkan ke notifikasi / pengaturan opsional)*.
6. Perbaiki kontras teks **Lime** di **Light Mode**.

### Tahap 2: Menengah
1. Rampingkan **Hero Card** (1 angka besar, 1 progress bar, 1 chip *Terkunci*, *Total Saldo* ringkas).
2. Pindahkan semua grafik dari Beranda HP ke Statistik; batasi *Transaksi Terbaru* di Beranda jadi 3 item dan kartu kontekstual tampil 1 per 1.
3. Di `/record`: urutkan kategori sesuai frekuensi pakai, ingat rekening terakhir sebagai default, auto-focus nominal, ringkas Catatan & Tanggal ke toggle detail, dan tampilkan dampak saldo setelah simpan.
4. Ganti dialog konfirmasi hapus transaksi di Riwayat menjadi **snackbar "Urungkan" (Undo)**.
5. Tambah penanda status antrean offline (*"X transaksi menunggu sinyal"*).
6. Terapkan token ukuran font seragam.
7. Pisahkan pengaturan notifikasi motivasi (maks 1x/hari, jam pilihan user, default mati).

### Tahap 3: Lanjutan
1. Tambah kartu **checklist pengguna baru** dan perbaiki empty state Riwayat & Statistik.
2. Terapkan *lazy-load* komponen bawah Beranda & audit performa animasi di HP kelas menengah.
3. Tambah akses **Utang Piutang** dan **Multi Rekening** di menu Avatar / Profil.
4. Audit menyeluruh target sentuh `>= 44px` dan aksesibilitas ikon/teks status.
5. Aktifkan notifikasi motivasi kontekstual + kalimat motivasi di layar sukses simpan transaksi + deep-link notifikasi ke `/dashboard`.

---

## 12. Rencana Tes Pengguna (Validasi)

- **Peserta:** 5 mahasiswa yang belum pernah menggunakan SakuIN (utamakan HP Android kelas menengah).
- **Skenario Uji (Tanpa Dibantu):**
  1. Buka aplikasi, sebutkan *"hari ini boleh jajan berapa?"* dalam 3 detik.
  2. Catat 1 transaksi jajan Makan Rp 15.000.
  3. Hapus transaksi tersebut, lalu batalkan penghapusannya (Undo).
  4. Cari tempat untuk mencatat utang teman.
  5. Jelaskan dengan kata sendiri arti angka besar di Beranda.
- **Metrik Pengamatan:** Waktu skenario 1 & 2, jumlah ketukan/scroll saat mencatat, ketepatan menjelaskan angka besar, serta titik ragu atau salah ketuk.
- **Ambang Keputusan:** Jika >= 3 dari 5 peserta tersendat atau salah paham pada satu bagian, bagian tersebut diprioritaskan untuk disederhanakan ulang.

---

## 13. Indikator Keberhasilan

| Indikator | Target |
| --- | --- |
| Waktu mencatat 1 transaksi | < 10 detik tanpa perlu scroll |
| Pengguna baru menyebut jatah hari ini dengan benar | Minimal 4 dari 5 peserta tes |
| Tinggi Hero Card di layar pertama HP | < 40% tinggi layar |
| Jumlah bagian vertikal di Beranda HP | <= 5 bagian |
| Retensi & pencatatan hari ke-1 dan minggu ke-2 | Meningkat dibanding versi sebelumnya |
