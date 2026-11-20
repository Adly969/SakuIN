# PRD — SakuIN

Aplikasi pencatatan keuangan bulanan untuk mahasiswa perantau · Versi 2.1 · 19 November 2026 · Pemilik produk: Adly

**Perubahan v2.1 (dari v2.0):** model saldo diubah dari "sisa uang per bulan" menjadi **saldo kumulatif per rekening**. Ditambahkan multi-rekening (bank, e-wallet, tunai) dengan transfer dan sesuaikan saldo, tabungan sebagai target virtual, catatan utang, pemilih bulan dengan perbandingan bulan lalu, ekspor CSV yang lebih lengkap, serta jalur distribusi aplikasi lewat halaman unduh (PWA dan APK Android). Jadwal menjadi 8 minggu. Seluruh fitur v2.0 tetap dipertahankan kecuali yang tertulis pada tabel berikut.

**Perubahan v2.0 (arsip):** dibangun ulang dari nol memakai Next.js + Supabase + Vercel agar bisa di-hosting gratis; layar Selamat Datang, login Google, Riwayat sebagai tab, kutipan motivasi harian, mode gelap dan terang.

| Area | v2.0 | v2.1 |
| --- | --- | --- |
| Model saldo | Sisa uang dihitung per bulan; sisa bulan lalu dipindah manual ke Tabungan | Saldo kumulatif per rekening, tidak direset tiap bulan; sisa bulan lalu terbawa otomatis |
| Rekening | Tidak ada | Bank, E-wallet, Tunai (nama dan warna bebas); transfer antar rekening; sesuaikan saldo |
| Tabungan | Setoran mengurangi sisa uang bulan ini | Target virtual; setoran mengurangi saldo bebas, bukan saldo rekening |
| Angka utama Beranda | Sisa uang bulan ini | Total saldo, lalu saldo bebas dan batas per hari |
| Utang | Tidak ada | Saya berutang dan Orang berutang ke saya, bisa dicicil |
| Periode | Filter bulan hanya di Riwayat | Pemilih bulan di Beranda, Statistik, Riwayat; perbandingan dengan bulan lalu |
| Ekspor | CSV per bulan | CSV dengan kolom rekening dan jenis transaksi; PDF ringkas (Could) |
| Distribusi | PWA lewat URL | PWA, halaman /download, dan APK Android (TWA) lewat tautan unduhan |
| Onboarding | 3 langkah | 4 langkah (tambah Rekening dan saldo awal) |
| Jadwal | 6 minggu | 8 minggu |

## 1. Ringkasan Produk

SakuIN adalah aplikasi web responsif (mobile-first, bisa dipasang sebagai PWA dan dibagikan sebagai APK Android) untuk mahasiswa perantau yang hidup dari uang kiriman bulanan. Pengguna mencatat pemasukan, pengeluaran, tabungan, dan utang di beberapa rekening (bank, e-wallet, tunai) dalam hitungan detik, lalu melihat total saldo, saldo bebas, batas pemakaian harian, dan grafik pengeluaran terbesar dalam tampilan minimalis yang nyaman di mata.

**Pilar produk**

1. Cepat: mencatat transaksi maksimal 3 ketukan (nominal, kategori, simpan).
2. Jelas: satu angka utama di beranda, yaitu saldo bebas dan batas pemakaian per hari, dengan total saldo dan kartu per rekening di dekatnya.
3. Menyenangkan: UI lembut, animasi halus, progres tabungan, dan kutipan motivasi harian.
4. Tertata: anggaran per kategori, target tabungan, statistik yang mudah dibaca.
5. Akurat: saldo di SakuIN selalu bisa dicocokkan dengan saldo asli di aplikasi bank dan e-wallet.

## 2. Latar Belakang dan Masalah

- Uang kiriman sering habis sebelum akhir bulan karena pengeluaran kecil dan rutin (makan, nongkrong, rokok, kuota, laundry) tidak tercatat.
- Aplikasi keuangan yang ada terlalu rumit, sehingga mahasiswa malas mengisi.
- Mahasiswa perantau belum punya kebiasaan menabung karena tidak melihat sisa uang yang bisa disisihkan.
- Sinyal di kos kadang tidak stabil, sehingga aplikasi harus tetap nyaman dipakai saat koneksi lambat.
- Uang tersebar di beberapa tempat (rekening bank, e-wallet, tunai), sehingga sulit tahu berapa uang yang benar-benar dimiliki dan boleh dipakai.
- Mahasiswa sering menalangi teman atau meminjam uang, tetapi tidak ada catatannya, sehingga mudah lupa atau canggung menagih.
- Aplikasi sulit dibagikan ke teman bila hanya berupa alamat web; sebagian pengguna lebih nyaman memasang aplikasi dari berkas yang diunduh.

## 3. Tujuan dan Metrik Keberhasilan

| Tujuan | Metrik | Target 3 bulan pertama |
| --- | --- | --- |
| Mencatat jadi kebiasaan | Pengguna aktif yang mencatat minimal 5 hari per minggu | 40% |
| Input sangat cepat | Median waktu dari membuka form sampai simpan | di bawah 10 detik |
| Retensi | Pengguna kembali di hari ke-7 / hari ke-30 | 35% / 20% |
| Mendorong menabung | Pengguna dengan minimal 1 target tabungan | 50% |
| Kualitas teknis | Skor Lighthouse (Performance, PWA, Accessibility) | 90 ke atas |
| Saldo akurat | Pengguna yang mengisi saldo awal rekening saat onboarding | 80% |
| Multi-rekening dipakai | Pengguna dengan minimal 2 rekening | 50% |
| Aplikasi terpasang | Pengguna aktif yang memasang PWA atau APK | 30% |

## 4. Pengguna Target

**Persona utama: Dina, 20 tahun**, mahasiswa semester 4 yang ngekos di luar kota. Menerima kiriman bulanan dari orang tua, kadang ada kerja sambilan. Memakai HP untuk hampir semua hal, dan ingin tahu kenapa uangnya cepat habis tanpa harus mencatat panjang-panjang.

**Kebutuhan utama:** catat cepat, tahu sisa uang tiap hari, tahu pengeluaran terbesar, dan bisa menyisihkan tabungan untuk tujuan tertentu (pulang kampung, laptop, dana darurat).

## 5. Ruang Lingkup

| Prioritas | Fitur |
| --- | --- |
| Must (MVP) | Layar Selamat Datang, autentikasi (email dan Google), onboarding 4 langkah (termasuk rekening dan saldo awal), **multi-rekening (bank, e-wallet, tunai)**, **transfer antar rekening**, **sesuaikan saldo**, catat transaksi dengan rekening, 7 kategori bawaan + kategori buatan sendiri, anggaran bulanan, target tabungan virtual (setor dan tarik), **saldo bebas dan batas per hari berbasis saldo kumulatif**, **catatan utang dengan cicilan**, **pemilih bulan di Beranda, Statistik, Riwayat**, beranda, statistik (donut, tren, pengeluaran terbanyak), riwayat (tab sendiri), kutipan motivasi harian, pengaturan, UI responsif dengan mode gelap dan terang |
| Should | PWA dapat dipasang, **halaman /download dan APK Android**, antrean offline (pemasukan dan pengeluaran), pengingat harian, **pengingat jatuh tempo utang**, insight otomatis, **perbandingan dengan bulan lalu**, ekspor CSV (kolom rekening dan jenis), opsi sisihkan saldo bulan lalu ke Tabungan, **kunci aplikasi dengan PIN** |
| Could | Transaksi berulang, sisihkan tabungan otomatis dari uang kiriman, laporan PDF, biaya admin transfer, rekening yang tidak disertakan dalam total, opsi kurangi utang dari saldo bebas, saran nama orang pada catatan utang |
| Won't (tahap ini) | Sinkronisasi rekening bank (membaca mutasi otomatis), scan struk, fitur sosial atau patungan, aplikasi native di Play Store/App Store, berkas pasang untuk iOS di luar App Store |

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
| Paket Android (APK) | PWABuilder atau Bubblewrap (Trusted Web Activity) | Membungkus PWA menjadi APK untuk dibagikan lewat tautan unduhan; lihat 6.1 |

**Catatan arsitektur dan keamanan**

- Semua kalkulasi (saldo rekening, total saldo, saldo bebas, batas per hari, sisa utang) ada di modul server (`lib/finance`) dan diuji otomatis; frontend hanya menampilkan hasil.
- Row Level Security (RLS) **aktif di semua tabel** dengan policy `user_id = auth.uid()`, sehingga pengguna hanya bisa membaca dan menulis datanya sendiri meski ada celah di kode.
- Kunci service Supabase hanya ada di variabel lingkungan server (Vercel), tidak pernah di kode klien. Hanya URL dan anon key yang boleh publik.
- Koneksi database dari Drizzle memakai connection pooler Supabase; verifikasi mode yang kompatibel di dokumentasi Supabase.

**Hosting gratis.** Target biaya Rp0 selama penggunaan pribadi. Hobby Vercel hanya untuk penggunaan non-komersial dan menjeda proyek (tanpa tagihan) bila batas bulanan terlewati; free plan Supabase punya batas penyimpanan dan dapat menjeda proyek yang lama tidak aktif. Syarat paket gratis sering berubah, periksa halaman resminya. Jika SakuIN dipakai banyak orang atau berbayar, pindah ke paket berbayar.

### 6.1 Distribusi aplikasi (PWA dan APK)

- **Jalur utama: PWA lewat alamat web.** Tidak perlu mengunduh berkas; bekerja di Android dan iOS lewat "Tambahkan ke Layar Utama".
- **Jalur tambahan: APK Android** yang dibuat dari PWA yang sama memakai Trusted Web Activity (TWA), lewat PWABuilder (tanpa koding) atau Bubblewrap. Pakai TWA, bukan WebView biasa, karena Google menolak login OAuth di dalam WebView; TWA memakai Chrome sehingga "Lanjut dengan Google" tetap berfungsi.
- **Layar penuh tanpa bilah alamat** memerlukan Digital Asset Links: berkas `public/.well-known/assetlinks.json` berisi package name dan sidik jari (SHA-256) sertifikat penandatangan APK.
- **Hosting berkas APK:** GitHub Releases sebagai tautan utama (stabil, gratis, tanpa iklan); MediaFire atau Google Drive sebagai tautan cadangan. Jangan menyimpan APK di dalam repositori Git atau di Vercel. Kedua tautan disimpan di tabel `app_releases` agar bisa diganti tanpa deploy ulang.
- **Keystore:** APK ditandatangani dengan keystore sendiri. Simpan cadangan keystore dan kata sandinya di dua tempat aman di luar repositori. Package name dan keystore harus tetap sama; jika hilang, pengguna harus menghapus aplikasi lama sebelum memasang yang baru.
- **Pembaruan:** karena isinya dimuat dari web, perubahan fitur dan tampilan tidak memerlukan APK baru. APK baru hanya dibuat bila nama, ikon, package, atau pengaturan TWA berubah.
- **Keterbatasan yang harus dijelaskan di halaman unduh:** APK hanya untuk Android (iOS memakai PWA); pengguna perlu mengizinkan pemasangan dari sumber tidak dikenal dan mungkin melihat peringatan Play Protect; aplikasi tetap membutuhkan internet untuk data (offline terbatas pada antrean pencatatan); Chrome harus terpasang di HP.

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
- Kartu rekening: titik atau ikon berwarna, nama, saldo. Di HP berupa deretan kartu yang digeser horizontal; di desktop berupa grid. Warna rekening hanya muncul sebagai titik atau ikon kecil, bukan latar kartu, agar aturan "sedikit warna" tetap terjaga.
- Pemilih bulan: ← November 2026 → dengan tombol kembali ke bulan ini; tidak dapat melewati bulan berjalan.
- Chip rekening di form Catat (terisi rekening terakhir dipakai); segmented Pengeluaran | Pemasukan | Transfer di bagian atas form.
- Warna jenis: Transfer memakai abu netral (#8A8A8A) dan Utang memakai biru (#8CCBFF); keduanya hanya sebagai label, bukan dekorasi.

### 7.5 Bottom navigation bar (mobile)

Bar permukaan membulat di dasar layar; tab aktif berupa lingkaran lime yang menonjol ke atas dengan lekukan (notch) melengkung; tab tidak aktif berupa ikon garis abu-abu dengan label kecil.

| Urutan | Tab | Isi |
| --- | --- | --- |
| 1 | Beranda | Ringkasan bulan, kutipan motivasi, transaksi terbaru, avatar menuju Profil |
| 2 | Statistik | Grafik dan pengeluaran terbanyak |
| 3 | Catat | Form tambah transaksi |
| 4 | Riwayat | Daftar transaksi, filter, pencarian |
| 5 | Tabungan | Daftar dan detail target |

Profil dibuka lewat avatar di Beranda, dan menjadi item sendiri di sidebar desktop. Rekening dan Utang dibuka dari kartu di Beranda (juga dari Profil) dan menjadi item sendiri di sidebar desktop, sehingga bottom bar tetap 5 tab agar tidak sesak.

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
| A3 | Onboarding 4 langkah: nama, uang kiriman bulanan, tanggal biasa menerima kiriman, rekening dan saldo awal (lihat R3) | Must |
| A4 | Daftar dan login dengan Google (Supabase Auth); akun dengan email sama tertaut | Must |
| A5 | Tombol "Lanjut dengan Google" di Daftar dan Login, di bawah form email | Must |

### 8.2 Transaksi

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| T1 | Tambah pemasukan atau pengeluaran: nominal, kategori, **rekening (wajib, default rekening yang terakhir dipakai)**, tanggal (default hari ini), catatan opsional | Must |
| T2 | Keypad angka dan format Rupiah otomatis; nominal wajib lebih dari 0 | Must |
| T3 | Kategori Kebutuhan Lain memunculkan kolom wajib "Untuk kebutuhan apa?" (maksimal 60 karakter) | Must |
| T4 | Ubah dan hapus transaksi (soft delete) dengan Urungkan lewat toast | Must |
| T5 | Riwayat (tab sendiri) dengan pemilih bulan, filter kategori, rekening, jenis (pemasukan, pengeluaran, transfer, penyesuaian, utang), dan pencarian catatan | Must |
| T6 | Antrean offline untuk pemasukan dan pengeluaran (termasuk rekening): disimpan lokal lalu dikirim saat online. Transfer, penyesuaian saldo, dan utang memerlukan koneksi | Should |
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
| B4 | Batas per hari = saldo bebas dibagi sisa hari bulan ini (termasuk hari ini), minimal 0; hanya untuk bulan berjalan | Must |
| B5 | Saldo tidak direset tiap bulan, sehingga sisa bulan lalu otomatis terbawa; lihat S9 untuk opsi menyisihkannya ke Tabungan | Must |

### 8.5 Tabungan

Tabungan adalah target virtual: uangnya tetap berada di rekening, tidak berpindah tempat. Setoran hanya mengurangi saldo bebas.

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| S1 | Buat target: nama, target nominal, tenggat (opsional), ikon dan warna | Must |
| S2 | Setor dan tarik dana dari target, lengkap dengan tanggal dan catatan | Must |
| S3 | Progress ring dan persentase terkumpul di daftar dan detail | Must |
| S4 | Jika ada tenggat, saran setoran per minggu atau per bulan | Should |
| S5 | Setoran mengurangi saldo bebas (saldo rekening tidak berubah), penarikan menambahnya | Must |
| S6 | Saat mencapai target, status menjadi Tercapai dengan animasi singkat | Should |
| S7 | Arsipkan atau hapus target (dana tersisa harus ditarik atau dipindah dulu) | Must |
| S8 | Sisihkan otomatis persentase tertentu dari uang kiriman ke target | Could |
| S9 | Sisa bulan lalu terbawa otomatis lewat saldo. Opsional: di awal bulan, jika saldo bebas akhir bulan lalu lebih dari 0, tampil kartu "Sisa bulan lalu Rp X" dengan tombol Sisihkan ke tabungan (pilih target dan nominal, default Dana Darurat); tercatat sebagai setoran bertanggal 1 bulan baru dengan sumber `carryover`. Opsi otomatis di Pengaturan | Should |

### 8.6 Beranda dan statistik

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| G1 | Beranda: kartu motivasi, total saldo, saldo bebas, batas per hari, kartu per rekening, ringkasan pemasukan/pengeluaran/tabungan bulan terpilih, ringkasan Utang saya dan Piutang, 3 pengeluaran terbesar, 5 transaksi terbaru | Must |
| G2 | Donut pengeluaran per kategori, persentase terbesar di tengah, dengan legenda | Must |
| G3 | Toggle Bulan / Tahun dan pil dropdown Pengeluaran / Pemasukan / Tabungan yang mengganti data donut | Must |
| G4 | Grafik komposisi bulan: persentase pemasukan, pengeluaran, tabungan | Must |
| G5 | Tren 8 bulan terakhir (dropdown Pemasukan / Pengeluaran) dengan gelembung nilai pada bulan aktif | Must |
| G6 | Pengeluaran Terbanyak: peringkat 5 kategori teratas dalam bar horizontal, nominal dan persentase | Must |
| G7 | Untuk Kebutuhan Lain, tampilkan 5 keterangan teratas (dikelompokkan berdasarkan teks pengguna) | Must |
| G8 | Daftar 5 transaksi pengeluaran terbesar pada periode terpilih | Should |
| G9 | Insight otomatis, misalnya "Nongkrong naik 20% dibanding bulan lalu" | Should |
| G10 | Statistik hanya menghitung pemasukan dan pengeluaran. Transfer, penyesuaian saldo, pinjam/pinjamkan, dan pembayaran utang tidak masuk | Must |

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
| N3 | Pengingat jatuh tempo utang (H-1 dan hari H), syarat sama dengan N1 | Should |
| P1 | Ubah profil, kata sandi, tema (Gelap / Terang / Ikuti sistem), dan tombol kutipan motivasi | Must |
| P2 | Ekspor transaksi bulanan ke CSV (lihat PB4) | Should |
| P3 | Hapus akun beserta seluruh data | Must |
| P4 | Kunci aplikasi dengan PIN 4–6 digit (hash disimpan di perangkat). PIN hanya mengunci tampilan di perangkat itu dan bukan pengganti login; keamanan data tetap bergantung pada login dan RLS | Should |

### 8.9 Rekening, transfer, dan sesuaikan saldo

Istilah di aplikasi: **Rekening**, dengan tiga jenis: Bank, E-wallet (GoPay, DANA, dan sebagainya), dan Tunai. Nama dan warna dibuat sendiri; tidak ada daftar bank yang dikunci.

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| R1 | Buat rekening: nama bebas, jenis (Bank / E-wallet / Tunai), warna, ikon, saldo awal | Must |
| R2 | Ubah nama, warna, dan urutan rekening. Rekening yang sudah punya riwayat hanya bisa diarsipkan, tidak dihapus; pengarsipan hanya bila saldo 0 (sisa dipindah lewat Transfer atau Sesuaikan saldo) | Must |
| R3 | Onboarding langkah "Rekening dan saldo awal": minimal 1 rekening, saran cepat Tunai, Bank, E-wallet yang namanya bisa diganti | Must |
| R4 | Setiap pemasukan dan pengeluaran wajib memilih rekening; saldo rekening itu otomatis bertambah atau berkurang | Must |
| R5 | Transfer antar rekening: dari, ke (harus berbeda), nominal lebih dari 0, tanggal, catatan. Contoh: tarik tunai, isi e-wallet. Mengubah saldo kedua rekening, bukan pemasukan atau pengeluaran | Must |
| R6 | Sesuaikan saldo: pengguna mengetik saldo asli dari aplikasi bank; sistem menghitung selisih dan menyimpannya sebagai entri penyesuaian bertanda (+/−) dan bertanggal. Tidak masuk Statistik | Must |
| R7 | Total saldo = jumlah saldo semua rekening aktif yang disertakan dalam total | Must |
| R8 | Ubah dan hapus transfer atau penyesuaian (soft delete dengan Urungkan); saldo otomatis dihitung ulang | Must |
| R9 | Saldo rekening boleh minus; tampil peringatan lembut "Saldo minus. Cek catatanmu atau gunakan Sesuaikan saldo" | Should |
| R10 | Rekening bisa ditandai "tidak disertakan dalam total" (misalnya dana titipan) | Could |
| R11 | Biaya admin pada transfer (opsional) otomatis tercatat sebagai pengeluaran terpisah | Could |

### 8.10 Catatan utang

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| U1 | Dua jenis: **Saya berutang** (meminjam) dan **Orang berutang ke saya** (meminjamkan atau menalangi) | Must |
| U2 | Isi: nama orang, jumlah, tanggal, jatuh tempo (opsional), catatan, rekening terkait (wajib) | Must |
| U3 | Saat dicatat: Saya berutang menambah saldo rekening; Orang berutang ke saya mengurangi saldo rekening. Tidak masuk pemasukan atau pengeluaran di Statistik | Must |
| U4 | Bisa dicicil: setiap pembayaran tercatat (nominal, tanggal, rekening, catatan); nominal tidak boleh melebihi sisa; sisa utang dihitung otomatis | Must |
| U5 | Pembayaran: pada Saya berutang mengurangi saldo rekening, pada Orang berutang ke saya menambah saldo rekening; tidak masuk Statistik | Must |
| U6 | Status: Belum lunas, Lunas (otomatis saat sisa 0), dan label Lewat jatuh tempo (diturunkan dari tanggal, tidak disimpan) | Must |
| U7 | Daftar dikelompokkan menjadi Saya berutang dan Orang berutang ke saya dengan total tiap kelompok; filter Belum lunas / Lunas; halaman detail berisi riwayat cicilan | Must |
| U8 | Ubah dan hapus utang atau pembayaran (soft delete dengan Urungkan); menghapus utang yang sudah punya pembayaran meminta konfirmasi | Must |
| U9 | Pengingat jatuh tempo (lihat N3) | Should |
| U10 | Saran nama orang dari catatan sebelumnya dan total utang per orang | Could |
| U11 | Pengaturan "Kurangi utang saya dari saldo bebas" (default mati) | Could |

### 8.11 Periode bulan, perbandingan, dan ekspor

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| PB1 | Pemilih bulan (← November 2026 →) di Beranda, Statistik, dan Riwayat; bulan terpilih ikut berpindah antar tab dalam satu sesi lewat parameter `?month=YYYY-MM`; default bulan berjalan; tidak bisa melewati bulan berjalan | Must |
| PB2 | Pada bulan lalu: Beranda menampilkan ringkasan bulan itu dan "Saldo akhir bulan" (total dan per rekening); kartu batas per hari dan kartu sisa bulan lalu disembunyikan | Must |
| PB3 | Perbandingan dengan bulan sebelumnya: selisih nominal dan persentase untuk pemasukan, pengeluaran, dan per kategori, dengan panah netral (bukan merah-hijau yang menghakimi) | Should |
| PB4 | Ekspor CSV per bulan dengan kolom: tanggal, jenis, rekening, rekening_tujuan, kategori, keterangan, nominal, arah (masuk / keluar / netral), catatan. Jenis: Pemasukan, Pengeluaran, Transfer, Penyesuaian saldo, Pinjam, Pinjamkan, Bayar utang, Terima pembayaran. UTF-8 dengan BOM agar terbuka rapi di Excel; sel yang diawali `=`, `+`, `-`, atau `@` diberi awalan apostrof untuk mencegah CSV injection | Should |
| PB5 | Laporan PDF ringkas bulanan (ringkasan, donut, kategori teratas, saldo per rekening) | Could |

### 8.12 Distribusi aplikasi

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| D1 | Halaman publik `/download` (tanpa login): tombol Pasang aplikasi, tombol Unduh APK, versi, tanggal rilis, ukuran, SHA-256 APK, changelog singkat, dan petunjuk 3 langkah | Should |
| D2 | Tombol Pasang aplikasi memakai prompt pemasangan browser bila tersedia; di iOS tampil petunjuk Bagikan → Tambahkan ke Layar Utama | Should |
| D3 | APK Android dibuat dari PWA lewat TWA dengan package name yang ditetapkan sekali dan tidak berubah | Should |
| D4 | Tautan unduhan: utama GitHub Releases, cadangan MediaFire atau Google Drive; disimpan di `app_releases` sehingga bisa diganti tanpa deploy | Should |
| D5 | APK ditandatangani dengan keystore sendiri; cadangan keystore disimpan di luar repositori | Should |
| D6 | `/.well-known/assetlinks.json` tersedia agar APK tampil layar penuh | Should |
| D7 | Setiap rilis APK dicatat: versi, tanggal, SHA-256 APK, changelog | Should |

## 9. Layar dan Alur

**Alur catat transaksi (inti):** ketuk Catat, keypad aktif, ketik nominal, pilih chip kategori (Kebutuhan Lain: ketik keterangan), rekening sudah terisi rekening terakhir dipakai (ketuk chip untuk mengganti), Simpan, toast "Tersimpan" dengan Urungkan, kembali ke layar sebelumnya.

**Alur pengguna baru:** Selamat Datang → Mulai → Daftar (email atau Google) → Onboarding 4 langkah (nama, uang kiriman, tanggal kiriman, rekening dan saldo awal) → Beranda.

**Alur transfer:** Catat → segmented Transfer → pilih rekening asal dan tujuan → nominal → Simpan. Saldo kedua rekening berubah, total saldo tetap.

**Alur sesuaikan saldo:** Rekening → pilih rekening → Sesuaikan saldo → ketik saldo asli di aplikasi bank → tampil selisih → Simpan.

**Alur utang:** Utang → Tambah → pilih jenis (Saya berutang / Orang berutang ke saya) → nama, jumlah, rekening, jatuh tempo → Simpan. Cicilan lewat tombol Bayar atau Terima di halaman detail.

**Alur pemasangan:** buka `/download` → Pasang aplikasi (PWA) atau Unduh APK → buka berkas → izinkan pemasangan → Masuk dengan Google.

| Layar | Isi |
| --- | --- |
| Selamat Datang | Latar lime, ilustrasi, judul besar, Lewati dan Mulai |
| Login / Daftar | Form email + password, tombol utama lime, "Lanjut dengan Google", lupa password |
| Onboarding | Nama, uang kiriman bulanan, tanggal kiriman, rekening dan saldo awal |
| Beranda | Pemilih bulan; sapaan singkat; kartu motivasi; total saldo; saldo bebas dan batas per hari dengan progress bar; kartu per rekening (geser horizontal) dengan "Kelola"; kartu kecil Pemasukan, Pengeluaran, Tabungan; kartu Utang saya dan Piutang; kartu sisa bulan lalu (jika ada); 3 pengeluaran terbesar; transaksi terbaru dengan "Lihat semua" |
| Statistik | Pemilih bulan; kartu ringkasan dengan perbandingan bulan lalu; pil dropdown dan toggle Bulan/Tahun; donut + legenda; komposisi bulan; tren; Pengeluaran Terbanyak |
| Catat | Bottom sheet atau dialog: Pengeluaran / Pemasukan / Transfer, nominal, chip kategori, chip rekening, tanggal, catatan, Simpan |
| Riwayat | Pemilih bulan; daftar per tanggal untuk semua jenis; filter kategori, rekening, jenis; pencarian |
| Tabungan | Daftar target dengan progress ring; detail dengan riwayat setoran, tombol Setor dan Tarik |
| Rekening | Daftar rekening dengan saldo; detail dengan riwayat; tombol Transfer, Sesuaikan saldo, Arsipkan |
| Utang | Dua kelompok dengan total; detail dengan riwayat cicilan; tombol Bayar atau Terima |
| Profil | Akun, kategori, anggaran, rekening, tema, kutipan motivasi, pengingat, kunci PIN, ekspor, unduh aplikasi, hapus akun |
| Unduh (/download) | Publik; tombol Pasang dan Unduh APK, versi, SHA-256, changelog, petunjuk |

## 10. Desain Database (Supabase PostgreSQL)

Semua tabel memakai `id` uuid, `created_at`, `updated_at`. Nominal disimpan sebagai bigint Rupiah (tanpa desimal). Semua tabel data pengguna punya kolom `user_id` (uuid, merujuk `auth.users`) dan RLS aktif dengan policy `user_id = auth.uid()` untuk baca dan `WITH CHECK` untuk tulis. Setiap kolom rujukan ke rekening, kategori, target, atau utang wajib divalidasi milik pengguna yang sama (lewat foreign key gabungan `(id, user_id)` atau `WITH CHECK`), agar pengguna tidak bisa menautkan data milik orang lain.

| Tabel | Kolom penting | Catatan |
| --- | --- | --- |
| profiles | id (= auth.users.id), name, avatar\_url, monthly\_allowance, payday\_day, timezone (default Asia/Jakarta), theme, reminder\_time, reminder\_enabled, show\_motivation (default true), recent\_motivation\_ids (jsonb, 15 ID terakhir), last\_active\_at, auto\_carryover\_goal\_id, subtract\_debt\_from\_free (default false) | Dibuat otomatis saat pengguna mendaftar |
| accounts | user\_id, name, type (bank/ewallet/cash), icon, color, initial\_balance (bigint, default 0), include\_in\_total (default true), sort\_order, archived\_at | Tanpa daftar bank bawaan; nama bebas. Unik (user\_id, lower(name)) untuk rekening yang belum diarsipkan. Tidak ada kolom saldo; saldo selalu dihitung dari entri |
| categories | user\_id, name, type (income/expense), icon, color, is\_default, is\_hidden, requires\_label, sort\_order | requires\_label = true untuk Kebutuhan Lain |
| transactions | user\_id, account\_id, category\_id, type (income/expense), amount, occurred\_on, note, custom\_label, deleted\_at | account\_id wajib. Indeks (user\_id, occurred\_on), (user\_id, account\_id, occurred\_on), (user\_id, category\_id, occurred\_on) |
| account\_transfers | user\_id, from\_account\_id, to\_account\_id, amount, fee\_transaction\_id (nullable, Could), occurred\_on, note, deleted\_at | CHECK from ≠ to dan amount > 0 |
| balance\_adjustments | user\_id, account\_id, previous\_balance, actual\_balance, amount (bertanda = actual − previous), occurred\_on, note, deleted\_at | Tidak masuk Statistik |
| budgets | user\_id, month (tanggal 1), total\_limit | Unik (user\_id, month) |
| category\_budgets | budget\_id, category\_id, limit\_amount | Unik (budget\_id, category\_id) |
| savings\_goals | user\_id, name, target\_amount, target\_date (nullable), icon, color, status (active/completed/archived) | Target virtual, tanpa rujukan rekening. Saldo dihitung dari entries |
| savings\_entries | goal\_id, user\_id, type (deposit/withdraw), amount, occurred\_on, note, source (manual/carryover) | Indeks (user\_id, occurred\_on) |
| debts | user\_id, direction (i\_owe/owed\_to\_me), person\_name, principal\_amount, account\_id, occurred\_on, due\_on (nullable), note, deleted\_at | Status diturunkan dari pembayaran, tidak disimpan |
| debt\_payments | debt\_id, user\_id, account\_id, amount, occurred\_on, note, deleted\_at | Total pembayaran tidak boleh melebihi principal\_amount |
| motivations | text (maks 140 karakter), category (tabungan/orang\_tua/umum), has\_variable, is\_active | Tanpa user\_id; semua pengguna masuk boleh baca, tidak boleh tulis |
| push\_subscriptions | user\_id, endpoint, keys | Untuk pengingat (Should) |
| app\_releases | version, version\_code, apk\_url\_primary, apk\_url\_mirror, sha256, size\_bytes, released\_at, changelog, is\_latest | Tanpa user\_id; boleh dibaca publik (termasuk tamu), tidak ada policy tulis (diisi lewat dasbor atau service role) |

**Aturan hitung** (semua entri dengan `deleted_at` kosong; "hingga T" berarti `occurred_on` ≤ T; bulan memakai zona waktu Asia/Jakarta)

1. **Saldo rekening hingga T** = saldo awal + pemasukan − pengeluaran + transfer masuk − transfer keluar + penyesuaian + pinjaman diterima (Saya berutang) − pinjaman diberikan (Orang berutang ke saya) − pembayaran utang saya + pembayaran piutang yang diterima. Saldo awal adalah saldo sebelum transaksi pertama yang dicatat; transaksi bertanggal mundur tetap dihitung.
2. **Total saldo** = jumlah saldo rekening aktif yang `include_in_total`.
3. **Total tabungan** = jumlah (deposit − withdraw) semua target aktif dan tercapai.
4. **Saldo bebas** = total saldo − total tabungan. Bila negatif, tampil peringatan dan batas per hari bernilai 0. Bila `subtract_debt_from_free` aktif, kurangi juga total sisa Saya berutang.
5. **Batas per hari** = lantai(saldo bebas ÷ jumlah hari tersisa di bulan berjalan termasuk hari ini), minimal 0. Hanya dihitung untuk bulan berjalan.
6. **Statistik bulan**: pemasukan dan pengeluaran hanya dari tabel transactions. Transfer, penyesuaian, pinjam/pinjamkan, dan pembayaran utang tidak dihitung. Komposisi bulan: pemasukan = 100% sebagai pembanding, lalu persentase pengeluaran dan tabungan (setoran bersih bulan itu) terhadap pemasukan.
7. **Terkumpul sebuah target** = total deposit − total withdraw pada target itu.
8. **Sisa utang** = principal\_amount − jumlah pembayaran; Lunas bila 0. Total Saya berutang dan total Piutang = jumlah sisa utang yang belum lunas per arah.
9. **Saldo akhir bulan M** = aturan 1 hingga hari terakhir bulan M. Sisa bulan lalu (S9) = saldo bebas akhir bulan lalu.
10. **Perbandingan** = (nilai bulan ini − bulan lalu) ÷ bulan lalu; bila bulan lalu 0, tampil "baru" tanpa persentase.

**Contoh hitung.** Tunai 150.000, rekening bank 1.200.000, GoPay 80.000: total saldo 1.430.000. Tabungan terkumpul 300.000: saldo bebas 1.130.000. Pada 20 November tersisa 11 hari (20 sampai 30): batas per hari = lantai(1.130.000 ÷ 11) = Rp102.727. Transfer Rp200.000 dari bank ke Tunai: saldo bank 1.000.000, Tunai 350.000, total saldo tetap 1.430.000, Statistik tidak berubah.

**Kasus uji wajib (Vitest):** transfer tidak mengubah total saldo dan Statistik; penyesuaian saldo menghasilkan saldo sama dengan angka yang diketik; hapus transaksi lama menghitung ulang saldo dengan benar; pinjam dan bayar utang tidak masuk Statistik; pembayaran melebihi sisa ditolak; utang otomatis Lunas saat sisa 0; saldo bebas negatif menghasilkan batas per hari 0; hari terakhir bulan membagi dengan 1; saldo akhir bulan lalu tidak berubah oleh transaksi bulan ini; akses lintas pengguna ke rekening, transfer, dan utang ditolak RLS.

**Migrasi dari v2.0.** Data yang sudah ada tidak boleh dihapus: migrasi membuat rekening "Tunai" (saldo awal 0) untuk setiap pengguna, mengisi `account_id` pada semua transaksi lama, lalu menjadikan kolom itu NOT NULL. Setoran tabungan lama tetap berlaku sebagai tabungan virtual.

## 11. Struktur Halaman dan Endpoint (Next.js App Router)

Proteksi rute lewat middleware (belum login diarahkan ke Login). Rute publik: `/`, `/login`, `/register`, `/reset-password`, `/auth/callback`, `/download`, dan `/.well-known/assetlinks.json`. Mutasi data memakai Server Actions dengan validasi Zod; transfer dan penyesuaian saldo berjalan dalam satu transaksi database.

| Rute | Jenis | Fungsi |
| --- | --- | --- |
| / | Halaman | Selamat Datang (tamu pertama) atau redirect ke /dashboard |
| /login, /register, /reset-password | Halaman | Autentikasi email dan Google |
| /auth/callback | Route Handler | Penukaran sesi OAuth Google |
| /onboarding | Halaman | 4 langkah awal (termasuk rekening dan saldo awal) |
| /dashboard | Halaman | Beranda (query: month) |
| /statistics | Halaman | Statistik (query: period, type, month, year) |
| /transactions | Halaman | Riwayat semua jenis (query: month, account, kind); tambah, ubah, hapus lewat Server Actions |
| /accounts, /accounts/\[id\] | Halaman | Daftar dan detail rekening; transfer, sesuaikan saldo, arsip lewat Server Actions |
| /savings, /savings/\[id\] | Halaman | Daftar dan detail target; setor, tarik, arsip, sisihkan sisa bulan lalu lewat Server Actions |
| /debts, /debts/\[id\] | Halaman | Daftar dan detail utang; tambah, bayar atau terima cicilan, ubah, hapus lewat Server Actions |
| /profile | Halaman | Akun, kategori, anggaran, tema, kutipan, pengingat, kunci PIN, ekspor, unduh aplikasi |
| /download | Halaman (publik) | Pasang PWA, unduh APK, versi, SHA-256, changelog (data dari app\_releases) |
| /.well-known/assetlinks.json | Berkas statis | Digital Asset Links untuk APK (TWA) |
| /api/motivations/next | Route Handler (GET) | Satu kutipan baru untuk sesi ini, mencatat ID-nya |
| /api/export/transactions | Route Handler (GET) | Ekspor CSV per bulan (query: month) |

## 12. User Story dan Kriteria Penerimaan

| Story | Kriteria penerimaan |
| --- | --- |
| Pengguna baru ingin disambut layar yang jelas | Selamat Datang tampil sekali; Mulai ke Daftar, Lewati ke Login |
| Ingin masuk dengan Google | Tombol Google di Daftar dan Login; akun baru langsung ke onboarding |
| Ingin mencatat pengeluaran dengan cepat | 3 ketukan setelah mengetik nominal; langsung muncul di riwayat dan beranda |
| Ingin menulis sendiri kebutuhan di Kebutuhan Lain | Kolom wajib; tanpa keterangan Simpan nonaktif; keterangan tampil di riwayat dan statistik |
| Ingin tahu batas pemakaian per hari | Beranda menampilkan saldo bebas dan batas per hari yang berubah setelah transaksi baru atau setoran tabungan |
| Ingin target tabungan dan menyetor | Target dibuat; progress ring muncul; setoran mengurangi saldo bebas (saldo rekening tetap) dan tampil di segmen Tabungan |
| Ingin sisa uang bulan lalu ditabung | Sisa bulan lalu sudah terbawa di saldo; di awal bulan muncul kartu opsional untuk menyisihkannya, dan setelah dikonfirmasi masuk target pilihan sebagai setoran |
| Ingin kata motivasi tiap membuka aplikasi | Tiap sesi baru satu kutipan berbeda dari 15 terakhir; pindah halaman tidak menggantinya; bisa ditutup dan dimatikan di Pengaturan |
| Ingin melihat riwayat dari bottom bar | Tab Riwayat membuka daftar per tanggal dengan filter dan pencarian |
| Ingin melihat pengeluaran paling banyak | 5 kategori teratas dengan nominal dan persentase; Kebutuhan Lain menampilkan keterangan teratas |
| Ingin berganti Bulan dan Tahun | Toggle mengubah semua grafik tanpa memuat ulang halaman penuh |
| Ingin memilih mode gelap atau terang | Pilihan Gelap/Terang/Ikuti sistem tersimpan; semua layar terbaca baik |
| Ingin tampilan menyesuaikan layar | Tidak ada scroll horizontal pada 360 px; bottom bar di HP, sidebar di 1024 px ke atas |
| Ingin salah ketuk bisa dibatalkan | Toast Urungkan muncul sedikitnya 5 detik |
| Ingin punya beberapa rekening | Bisa membuat rekening Bank, E-wallet, Tunai dengan nama bebas dan saldo awal; setiap transaksi memilih rekening dan saldonya berubah |
| Ingin tarik tunai tanpa mengacaukan statistik | Transfer bank → Tunai Rp200.000: saldo bank turun, Tunai naik, total saldo tetap, Pemasukan dan Pengeluaran di Statistik tidak berubah |
| Ingin saldo cocok dengan aplikasi bank | Sesuaikan saldo menyimpan selisih; saldo rekening sama dengan angka yang diketik; Statistik tidak berubah |
| Ingin mencatat menalangi teman | Orang berutang ke saya Rp50.000 dari GoPay: saldo GoPay turun, tidak muncul di Pengeluaran; cicilan Rp20.000 menaikkan saldo dan sisa menjadi Rp30.000; Lunas otomatis saat sisa 0 |
| Ingin mencatat uang yang dipinjam | Saya berutang menambah saldo rekening dan tidak muncul di Pemasukan; pembayaran mengurangi saldo dan sisa utang |
| Ingin melihat bulan sebelumnya | Pemilih bulan di Beranda, Statistik, dan Riwayat; bulan lalu menampilkan saldo akhir bulan dan perbandingan dengan bulan sebelumnya |
| Ingin mengekspor data bulanan | CSV berisi rekening, jenis transaksi, dan arah; terbuka rapi di Excel |
| Ingin membagikan aplikasi ke teman lewat tautan | Dari HP Android, /download membuka petunjuk, APK terunduh dan terpasang, login Google berhasil; di iPhone tampil petunjuk PWA |

## 13. Kebutuhan Non-Fungsional

- **Performa:** LCP di bawah 2,5 detik pada 4G; bundle awal ramping; grafik lazy load; ilustrasi Selamat Datang berupa SVG ringan.
- **Performa saldo:** saldo dihitung dengan query agregat di SQL (bukan memuat seluruh transaksi ke aplikasi) dan diindeks per rekening dan tanggal; bila lambat setelah data bertambah, tambahkan cache per rekening yang dibatalkan setiap ada entri berubah.
- **Keandalan data:** kalkulasi saldo di server dan diuji otomatis; saldo rekening selalu dihitung dari seluruh entri (tidak ada kolom saldo yang diubah manual), sehingga mengubah atau menghapus entri lama tetap menghasilkan saldo benar; transfer dan penyesuaian disimpan dalam satu transaksi database; pemasukan dan pengeluaran tidak hilang saat koneksi putus (antrean offline).
- **Keamanan:** HTTPS, validasi Zod di server, RLS di semua tabel dengan pemeriksaan kepemilikan pada setiap rujukan, rate limit pada login, state OAuth divalidasi, kunci rahasia hanya di variabel lingkungan server; app\_releases hanya baca publik; ekspor CSV menetralkan sel berawalan rumus; keystore APK tidak pernah masuk repositori.
- **Privasi:** data keuangan hanya dilihat pemilik akun; hapus akun menghapus seluruh data.
- **Aksesibilitas:** kontras WCAG AA di kedua mode, target sentuh 44 px, label ARIA pada bottom bar dan grafik (ringkasan teks).
- **Kompatibilitas:** Chrome dan Safari modern di Android dan iOS, serta browser desktop utama; APK memerlukan Android dengan Chrome terpasang.
- **Lokalisasi:** Bahasa Indonesia, format Rupiah (Rp 25.000), zona waktu Asia/Jakarta default.

## 14. Rencana Rilis (satu developer, sekitar 8 minggu)

| Minggu | Fokus |
| --- | --- |
| 1 | Setup Next.js + TypeScript, Supabase (database, Auth), Drizzle migration (termasuk tabel accounts sejak awal), seeder kategori dan kutipan, RLS, design token gelap + terang, layout responsif (bottom bar 5 tab + sidebar), layar Selamat Datang, deploy awal ke Vercel |
| 2 | Auth email dan Google, onboarding 4 langkah, kategori (termasuk Kebutuhan Lain), CRUD rekening dengan saldo awal |
| 3 | Catat transaksi dengan rekening, transfer antar rekening, sesuaikan saldo, Riwayat dengan filter rekening dan jenis, modul `lib/finance` dan tes saldo (Vitest) |
| 4 | Tabungan virtual (target, setor, tarik, progres), catatan utang dengan cicilan dan status, anggaran |
| 5 | Beranda (total saldo, saldo bebas, batas per hari, kartu rekening, kartu utang, kartu motivasi), Statistik, pemilih bulan di tiga layar, perbandingan bulan lalu, sisa bulan lalu ke Tabungan |
| 6 | PWA, antrean offline, pengingat harian dan jatuh tempo utang, kunci PIN, ekspor CSV |
| 7 | Halaman /download, tabel app\_releases, APK Android (TWA) dengan assetlinks.json dan keystore, uji login Google di perangkat nyata, polesan UI |
| 8 | Uji dengan 5–10 mahasiswa, perbaikan, rilis APK pertama lewat GitHub Releases dan tautan cadangan |

Bila jadwal molor, potong dalam urutan ini: laporan PDF, kunci PIN, pengingat jatuh tempo utang, perbandingan bulan lalu.

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
| Saldo di SakuIN tidak cocok dengan bank karena ada transaksi terlupa | Fitur Sesuaikan saldo, pengingat harian, dan selisih tercatat jelas di Riwayat |
| Transfer dikira pengeluaran, statistik menjadi salah | Jenis Transfer terpisah di form dan Riwayat dengan label netral; tes otomatis bahwa Statistik tidak berubah |
| Saldo bebas tampak tinggi padahal ada utang | Tampilkan Utang saya tepat di bawah saldo bebas; opsi mengurangkan utang (U11) |
| Data v2.0 tidak punya rekening | Migrasi membuat rekening Tunai, mengisi account\_id, lalu menjadikannya NOT NULL; uji di salinan data dulu |
| Keystore APK hilang | Cadangan di dua tempat aman di luar repositori sebelum rilis pertama |
| Tautan MediaFire mati, berubah, atau penuh iklan | GitHub Releases sebagai tautan utama; tautan disimpan di app\_releases dan bisa diganti tanpa deploy |
| Peringatan Play Protect atau izin sumber tidak dikenal membuat pengguna ragu | Petunjuk dan SHA-256 di /download; APK tanpa izin berlebihan |
| Login Google gagal di APK | Pakai TWA, bukan WebView; uji di perangkat nyata pada minggu 7 |
| PIN disangka pengaman data | Jelaskan di Pengaturan bahwa PIN hanya mengunci tampilan di perangkat; keamanan data tetap login dan RLS |
| Jadwal 8 minggu molor | Potong sesuai urutan di bagian 14 |

## 16. Keputusan

| Topik | Keputusan |
| --- | --- |
| Nama dan aksen | SakuIN; lime #D4FF5A sebagai aksen UI, warna lain hanya untuk grafik |
| Stack | Next.js + TypeScript, Supabase (Postgres + Auth), Vercel Hobby, agar gratis |
| Tab bottom bar | Beranda, Statistik, Catat, Riwayat, Tabungan; Profil lewat avatar |
| Sisa bulan lalu | Terbawa otomatis lewat saldo kumulatif; S9 menjadi opsi menyisihkannya ke Tabungan |
| Login Google | Must |
| Mode terang | Must sejak MVP |
| Kutipan motivasi | Must, ganti otomatis tiap sesi dari database |
| Model saldo | Kumulatif per rekening, tidak direset tiap bulan; saldo selalu dihitung dari entri |
| Rekening | Bank, E-wallet, Tunai; nama dan warna bebas; wajib dipilih di setiap pemasukan dan pengeluaran |
| Transfer dan penyesuaian | Bukan pemasukan atau pengeluaran; tidak masuk Statistik |
| Tabungan | Target virtual; saldo bebas = total saldo − total tabungan |
| Batas per hari | Saldo bebas ÷ sisa hari bulan ini (termasuk hari ini) |
| Utang | Dua jenis, bisa dicicil, ubah saldo rekening tetapi tidak masuk Statistik; tidak mengurangi saldo bebas kecuali opsi U11 diaktifkan |
| Navigasi | Tetap 5 tab; Rekening dan Utang lewat kartu di Beranda dan Profil |
| Offline | Hanya pemasukan dan pengeluaran; transfer, penyesuaian, dan utang butuh koneksi |
| Distribusi | PWA sebagai jalur utama; APK Android via TWA; GitHub Releases utama, MediaFire cadangan; iOS memakai PWA |
| Jadwal | 8 minggu |

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
