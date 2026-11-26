# PRD Fitur — Pembagian Anggaran Per Kategori (Amplop Jatah Mahasiswa)

**Produk:** SakuIN · **Status:** Draft Diskusi & Review · **Tanggal:** 26 November 2026

> Dokumen ini merangkum usulan konsep, logika perhitungan, dan alur UI/UX untuk fitur **Pembagian Uang Per Kategori** (contoh: Makan Rp 800rb, Bensin Rp 200rb, Kuota Rp 100rb) agar mudah direview bersama sebelum diimplementasikan penuh ke aplikasi.

---

## 1. Konteks Saat Ini di SakuIN

Saat ini SakuIN sudah memiliki fondasi berikut:
- **Fokus Utama Beranda:** Menampilkan **Sisa Batas Hari Ini** (dari saldo bebas setelah dikurangi *Dana Terkunci / Tagihan Wajib* seperti Kos/WiFi dan target penyisihan).
- **Siklus Fleksibel:** Mendukung siklus kiriman **Bulanan (`monthly`)**, **Mingguan (`weekly`)**, dan **Fleksibel (`flexible`)**.
- **Kontrol Pos Dasar:** Di halaman Statistik sudah tersedia dasar *Kontrol Pos Boros* untuk memasang batas bulanan per kategori 1 per 1 dan mengirim peringatan ketika pemakaian kategori menyentuh 80% / 100%.

**Kebutuhan baru yang ingin dijawab:**
Pengguna ingin benar-benar bisa **membagi uang kirimannya ke beberapa pos kategori** (misal Makan 800rb, Bensin 200rb, dll), dengan cara atur yang **cepat, personal, tidak ribet bagi pengguna baru**, dan **jelas hubungannya dengan Batas Hari Ini**.

---

## 2. Masalah Utama yang Harus Dihindari

1. **Mengubah kategori 1 per 1 lewat modal terasa melelahkan:**
   Kalau pengguna mau membagi uang ke 4–6 pos di awal bulan, membuka-tutup modal untuk tiap kategori terlalu memakan waktu.
2. **Kebutuhan tiap orang berbeda-beda:**
   Ada yang merokok dan ada yang tidak; ada yang bawa motor (butuh bensin) dan ada yang jalan kaki; ada yang bayar kos/laundry sendiri dan ada yang tinggal dengan orang tua. Daftar atau persentase yang dipukul rata tidak akan cocok untuk semua orang.
3. **Pengguna baru hari ke-1 belum punya riwayat bulan lalu:**
   Pengguna baru tidak tahu persis pengeluaran bulanannya, sehingga saran "ikuti bulan lalu" masih kosong di minggu pertama pemakaian.

---

## 3. Tujuan Fitur

| Tujuan | Indikator Keberhasilan |
| --- | --- |
| Zero-friction saat baru daftar | Pengguna baru bisa langsung pakai aplikasi di hari ke-1 tanpa wajib isi budget kategori |
| Pengaturan cepat & personal | Mengatur 3–5 pos kategori selesai dalam **< 20 detik** di satu layar |
| Realistis tanpa menebak angka | Pengguna baru terbantu lewat konversi kebiasaan harian/mingguan atau saran otomatis setelah 7 hari |
| Pengingat real-time saat belanja | Sisa jatah kategori langsung terlihat tepat di tombol kategori saat mencatat transaksi |

---

## 4. Alur & Logika yang Diusulkan

### 4.1 Prinsip Pengguna Baru: "Mulai Tanpa Beban + Belajar dari Catatan 7 Hari"

1. **Hari ke-1 (Saat Baru Daftar):**
   - Pengguna **tidak dipaksa** membagi kategori saat onboarding. Ia cukup isi saldo/uang kiriman dan langsung melihat *Sisa Batas Hari Ini* di Beranda.
2. **Hari ke-5 sampai ke-7 (Kalibrasi Otomatis):**
   - Setelah pengguna mencatat transaksi normal selama beberapa hari, sistem menghitung pola pengeluaran aslinya dan memunculkan kartu saran di Statistik/Beranda:
     > *"Selama 7 hari terakhir, pengeluaranmu paling banyak di **Makan** (Rp 175rb) dan **Bensin** (Rp 50rb). Mau pasang patokan otomatis dari kebiasaanmu ini?"*
   - Jika diklik, sistem memproyeksikan rata-rata harian ke sisa/panjang siklus (misal ~Rp 750rb untuk Makan & ~Rp 200rb untuk Bensin) dan langsung mengisi form agar pengguna tinggal menyetujui atau menggeser sedikit.
3. **Jika Pengguna Mau Langsung Atur di Hari ke-1 (Opsional):**
   - Menggunakan **Checklist Personal + Kalkulator Kebiasaan Kecil** (lihat bagian 4.2).

---

### 4.2 Layar "Bagi Pos Sekaligus" (*Batch Allocator*, Bukan Edit 1/1)

Menggantikan pola edit 1 per 1 menjadi **1 layar terpadu** dengan alur 3 langkah ringkas:

1. **Step 1 — Centang Pos yang Dipakai Saja (*Checklist Personal*):**
   - Pengguna mencentang kategori yang memang ada di pengeluarannya (`Makan`, `Bensin & Transport`, `Kuota & Internet`, `Nongkrong`, `Jajan & Cemilan`, `Laundry`, `Listrik`, `Rokok`, dll).
   - Yang tidak relevan (misal tidak merokok atau tinggal sama ortu) tidak dicentang dan tidak akan memenuhi layar.
2. **Step 2 — Isi Jatah Sekaligus dengan Header Real-time:**
   - Di atas layar menempel (*sticky*) ringkasan langsung:
     ```text
     Dana Tersedia: Rp 1.500.000  |  Sudah Dibagi: Rp 1.100.000  |  Sisa Bebas: Rp 400.000
     ```
   - Jika total pos yang dibagi melebihi *Dana Tersedia*, indikator berubah merah (`Kelebihan alokasi Rp ...`) agar pengguna sadar sebelum menyimpan.
   - **Bantuan Kalkulator Kebiasaan (untuk pengguna baru):**
     Di setiap baris kategori ada opsi bantu kecil sesuai sifat posnya:
     - *Makan:* pilih cepat `15rb`, `25rb`, `35rb/hari` → otomatis dikali jumlah hari siklus (`25rb × 30 = Rp 750.000`).
     - *Bensin:* pilih cepat `25rb`, `50rb`, `100rb/minggu` → otomatis dikali 4 (`50rb × 4 = Rp 200.000`).
     - *Kuota/Tagihan:* input langsung + chip cepat (`+50rb`, `+100rb`, `Ambil Sisa`).
   - **Partial Allocation Diperbolehkan:** Pengguna boleh cuma membatasi 1–2 pos rawan bocor (misal hanya *Nongkrong* max Rp 150rb) dan membiarkan sisanya bebas.
3. **Step 3 — 1 Tombol "Simpan Semua Pos":**
   - Seluruh kategori tersimpan sekaligus ke `category_budgets` untuk siklus berjalan.

**Mulai Periode ke-2 dst.:**
- Aturan pembagian bulan/minggu sebelumnya dapat otomatis **disalin** (*Salin Bulan Lalu*) atau disesuaikan memakai tombol **"Ikuti Pengeluaran Bulan Lalu"** (membulatkan total pengeluaran asli bulan lalu).

---

### 4.3 Rumus Inti & Sinkronisasi ke Halaman Catat (`/record`)

- **Sisa Pos Kategori:**
  $$\text{Sisa Pos} = \text{Jatah Kategori} - \sum \text{Pengeluaran Kategori Periode Berjalan}$$
- **Jatah Harian Khusus Pos Harian (opsional tampil di detail *Makan*):**
  $$\text{Patokan Makan/Hari} = \frac{\text{Sisa Pos Makan}}{\text{Sisa Hari Siklus}}$$
- **Tampilan Langsung di Halaman Catat (`/record`):**
  - Pada grid tombol kategori, kategori yang sudah dipasang jatah langsung menampilkan label mini di bawah namanya, contoh:
    - `[Makan] • Sisa 540rb`
    - `[Bensin] • Sisa 150rb`
    - `[Nongkrong] • Sisa 15rb (⚠️ Hampir habis)`
- **Notifikasi Peringatan:**
  - Tetap memicu peringatan saat pemakaian kategori menyentuh **80%** (*Waspada*), **100%** (*Habis*), dan **>100%** (*Over Budget*).

---

### 4.4 Fitur Tengah Bulan: "Geser Jatah" (*Reallocate*)

Jika di minggu ke-3 pos *Makan* habis tetapi pos *Nongkrong* masih bersisa Rp 100rb, pengguna **tidak perlu** mengedit 2 kategori satu per satu.
- Cukup klik **Geser Jatah**:
  - `Dari Pos:` Nongkrong (sisa Rp 100rb)
  - `Ke Pos:` Makan (sisa Rp 0)
  - `Nominal:` Rp 75.000
- Hasil otomatis: jatah *Nongkrong* berkurang Rp 75rb, jatah *Makan* bertambah Rp 75rb. Total dana tidak berubah.

---

### 4.5 Perilaku Akhir Periode / Ganti Siklus

Saat memasuki awal bulan atau hari kiriman berikutnya (*Payday*):
- **Default yang disarankan:** Jatah kategori **di-reset** ke patokan semula untuk periode baru, sementara jika masih ada sisa di pos tertentu (misal Bensin sisa Rp 40rb) tidak hangus—tapi digabung menjadi potensi tabungan (**Carryover**).

---

## 5. Keputusan Desain yang Perlu Disepakati (Opsi A vs Opsi B)

Bagian ini penting untuk didiskusikan dengan tim/teman: **Bagaimana jatah kategori memengaruhi angka "Sisa Batas Hari Ini" di Beranda?**

Contoh skenario: Saldo Bebas user **Rp 1.500.000** untuk **30 hari**, lalu dibagi: **Makan 800rb**, **Bensin 200rb**, **Kuota 100rb**, dan **Sisa Tidak Dibagi 400rb**.

### Opsi B — Pagar Kontrol & Panduan Kategori *(Rekomendasi untuk Pengguna Baru)*
- **Cara kerja:**
  - **Sisa Batas Hari Ini** di Beranda tetap dihitung dari keseluruhan saldo bebas: `Rp 1.500.000 / 30 = Rp 50.000/hari`.
  - Jatah per kategori (Makan 800rb, Bensin 200rb, Kuota 100rb) berfungsi sebagai **pagar kontrol bulanan/mingguan** dan tampil sisa nominalnya di tombol kategori saat mau catat transaksi + Statistik.
- **Kelebihan:** Paling mudah dipahami pemula; angka *Batas Hari Ini* tidak tiba-tiba terlihat kecil atau aneh ketika user baru membagi sebagian kategori.
- **Kekurangan:** Jika user tidak disiplin melihat sisa kategori, uang yang sebenarnya niatnya untuk bensin masih terlihat ikut masuk dalam kuota harian umum.

### Opsi A — Amplop Ketat (*Strict Envelope Locking*)
- **Cara kerja:**
  - Kategori non-harian yang diberi jatah (seperti *Bensin 200rb*, *Kuota 100rb*, *Laundry 80rb*) otomatis **dikunci/dipisahkan** dari hitungan *Batas Hari Ini* (sehingga tidak terpakai untuk jajan).
  - **Sisa Batas Hari Ini** hanya dihitung dari **Pos Harian (seperti Makan 800rb) + Sisa Tidak Dibagi (400rb)** = `Rp 1.200.000 / 30 = Rp 40.000/hari`.
- **Kelebihan:** Secara disiplin keuangan jauh lebih akurat—uang bensin/kuota benar-benar terlindungi tidak termakan uang jajan harian.
- **Kekurangan:** Pengguna baru bisa bingung kenapa *"Saldo saya Rp 1.500.000 tapi jatah harian cuma Rp 40.000"* jika ia belum terbiasa dengan konsep amplop ketat (bisa diatasi jika dijelaskan sebagai toggle **"Mode Amplop Ketat"** di pengaturan).

---

## 6. Wireframe Ringkas Layar "Bagi Pos Sekaligus"

```text
+----------------------------------------------------+
| <- Atur Jatah Kategori      [ Ikuti Bulan Lalu ]   |
+----------------------------------------------------+
| Dana Tersedia   : Rp 1.500.000                     |
| Sudah Dibagi    : Rp 1.100.000                     |
| Sisa Dana Bebas : Rp   400.000   [===========---]  |
+----------------------------------------------------+
| Pos yang saya pakai:                               |
| [v Makan] [v Bensin] [v Kuota] [+ Nongkrong]       |
| [+ Jajan] [+ Laundry] [+ Listrik] [+ Rokok]        |
+----------------------------------------------------+
| 1. Makan                                           |
|    Nominal: [ Rp   800.000 ]                       |
|    Hitung cepat: [15rb/hr] [25rb/hr] [35rb/hr]     |
+----------------------------------------------------+
| 2. Bensin & Transport                              |
|    Nominal: [ Rp   200.000 ]                       |
|    Hitung cepat: [25rb/mgg] [50rb/mgg] [Ambil Sisa]|
+----------------------------------------------------+
| 3. Kuota & Internet                                |
|    Nominal: [ Rp   100.000 ]                       |
|    Hitung cepat: [+50rb] [+100rb] [Ambil Sisa]     |
+----------------------------------------------------+
|         [ Simpan Pembagian Pos (3 Pos) ]           |
+----------------------------------------------------+
```

---

## 7. Pertanyaan untuk Diskusi & Masukan Teman

1. Dari **Opsi B (Pagar Kontrol)** vs **Opsi A (Amplop Ketat)** di Bagian 5, mana yang terasa lebih masuk akal dan tidak bikin bingung anak kuliahan saat baru instal? Atau perlu dibuat default **Opsi B** dengan opsi sakelar **Mode Ketat** bagi yang mau?
2. Untuk pengguna baru hari ke-1, apakah pendekatan **"tidak usah atur di awal, baru ditawari otomatis setelah 7 hari mencatat"** + **kalkulator harian/mingguan** (`25rb/hr`, `50rb/mgg`) sudah cukup membantu?
3. Di halaman **Catat (`/record`)**, apakah menampilkan label kecil `Sisa Rp X` di tombol kategori sudah cukup jelas, atau justru terasa ramai?
4. Apakah fitur **Geser Jatah** antar kategori di tengah bulan sering dibutuhkan dalam kebiasaan sehari-hari?
5. Menurutmu kategori bawaan apa saja yang paling wajib ada di checklist awal?
