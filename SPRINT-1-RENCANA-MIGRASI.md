# SPRINT 1 — Audit & Rencana Migrasi Pembagian Anggaran Per Kategori

**Status:** Menunggu Persetujuan *(BELUM dieksekusi — tidak ada perubahan kode, skema, atau data)*  
**Tanggal:** 26 November 2026

---

## 1. Audit Skema Database & RLS Saat Ini

Sumber audit: [`src/db/schema.ts`](src/db/schema.ts), [`supabase/rls.sql`](supabase/rls.sql), [`src/db/apply-rls.ts`](src/db/apply-rls.ts), serta inspeksi langsung read-only ke Postgres Supabase.

### 1.1 Tabel Terkait Fitur

| Tabel | Kolom Utama & Tipe | Relasi & Constraint | Status RLS |
| --- | --- | --- | --- |
| **`profiles`** | `id` (`uuid` PK), `monthly_allowance` (`bigint`), `payday_day` (`int`, default `1`), `allowance_cycle` (`varchar(20)`, default `'monthly'`), `payday_weekday` (`int`, default `1`), `reserve_mode` (`varchar(20)`, default `'none'`), `reserve_value` (`bigint`), `auto_carryover_goal_id` (`uuid`) | 1-to-1 dengan `auth.users.id`. **Data DB:** 3 profil, semua `allowance_cycle = 'monthly'`. | RLS aktif; policy `SELECT`, `UPDATE` (`auth.uid() = id`). |
| **`categories`** | `id` (`uuid` PK), `user_id` (`uuid`), `name` (`varchar(100)`), `type` (`varchar(20)`: `'income'\|'expense'`), `icon` (`varchar(50)`), `color` (`varchar(50)`), `is_default` (`bool`), `is_hidden` (`bool`), `requires_label` (`bool`), `sort_order` (`int`) | Index `categories_user_sort_idx(user_id, sort_order)`. | RLS aktif; policy `SELECT`, `INSERT`, `UPDATE`, `DELETE` (`auth.uid() = user_id`). |
| **`transactions`** | `id` (`uuid` PK), `user_id` (`uuid`), `category_id` (`uuid` NOT NULL), `type` (`varchar(20)`), `amount` (`bigint`), `occurred_on` (`date`), `note` (`text`), `custom_label` (`varchar(60)`), `account_id` (`uuid`), `deleted_at` (`timestamptz`) | FK `category_id -> categories.id` (`ON DELETE RESTRICT`). Index `(user_id, occurred_on)` & `(user_id, category_id, occurred_on)`. | RLS aktif; policy CRUD lengkap (`auth.uid() = user_id`). |
| **`budgets`** | `id` (`uuid` PK), `user_id` (`uuid`), `month` (`date`, `YYYY-MM-01`), `total_limit` (`bigint`) | Unique index `(user_id, month)`. | RLS aktif; policy CRUD lengkap (`auth.uid() = user_id`). |
| **`category_budgets`** | `id` (`uuid` PK), `budget_id` (`uuid`), `category_id` (`uuid`), `limit_amount` (`bigint`) | FK `budget_id -> budgets.id` (`CASCADE`), FK `category_id -> categories.id` (`CASCADE`). Unique index `(budget_id, category_id)`. **Data DB:** `0` baris. | RLS aktif; policy `ALL` via `EXISTS (SELECT 1 FROM budgets WHERE id = budget_id AND user_id = auth.uid())`. |
| **`locked_funds`** | `id` (`uuid` PK), `user_id` (`uuid`), `name` (`varchar(100)`), `amount` (`bigint`), `due_day` (`int`), `is_paid` (`bool`), `paid_at` (`timestamptz`), `paid_account_id` (`uuid`), `note` (`text`) | FK `paid_account_id -> accounts.id` (`SET NULL`). Index `(user_id)`. **Data DB:** `0` baris. | `relrowsecurity = true`, **catatan:** belum memiliki policy di `pg_policies` *(berjalan karena Drizzle memakai koneksi server role; tabel baru wajib dibuatkan policy lengkap)*. |

---

## 2. Audit Kode "Kontrol Pos Boros" Saat Ini

1. **Pemasangan Batas (`statistics/page.tsx` & `src/app/actions/category-budgets.ts`):**
   - Modal di [`statistics/page.tsx`](src/app/%28main%29/statistics/page.tsx#L1053-L1133) memilih 1 kategori dan 1 angka batas bulanan, lalu memanggil `upsertCategoryBudgetAction({ categoryId, limitAmount, monthKey })`.
   - `upsertCategoryBudgetAction` mencari/membuat row di `budgets` berdasarkan `YYYY-MM-01` dan melakukan upsert/delete di `category_budgets`. `limitAmount <= 0` menghapus batas kategori tersebut.
2. **Perhitungan Pemakaian (`getCategoryBudgetsAction`):**
   - Mengambil `categories` (`type = 'expense'`, `isHidden = false`) + `transactions` (`type = 'expense'`, `deletedAt IS NULL`).
   - Memfilter transaksi dengan `occurredOn.slice(0, 7) === monthKey` (**hanya mendukung bulan kalender `YYYY-MM`**, belum mendukung siklus `paydayDay`, `weekly`, maupun `flexible`).
   - `usagePercent = Math.round((spent / limitAmount) * 100)`, `status`: `exceeded` (`spent > limitAmount`), `reached` (`spent === limitAmount || usagePercent >= 100`), `warning` (`usagePercent >= 80`), selain itu `ok`.
3. **Peringatan 80% / 100% / >100% (`transactions.ts`, `daily-limit-server.ts`, `native-notifications.ts`):**
   - Saat transaksi baru disimpan lewat `createTransactionAction`, server memanggil `evaluateCategoryBudgetForUser(userId, category.id, category.name, dateStr.slice(0, 7))`.
   - Jika level bukan `ok`, payload `categoryLimitAlert` dikembalikan ke [`record/page.tsx`](src/app/%28main%29/record/page.tsx#L502-L505), yang memanggil `notifyCategoryLimitAlert` (mengirim event `sakuin:smart-alert` untuk banner in-app + `sendInstantNotification` OS notification).
   - *Gap saat ini:* `updateTransactionAction` dan `restoreTransactionAction` belum memicu `evaluateCategoryBudgetForUser`, dan belum ada tampilan sisa jatah pos langsung di tombol kategori `/record`.

---

## 3. Audit Perhitungan "Sisa Batas Hari Ini" & Titik Integrasi Pos Terkunci

### 3.1 Peta Pemanggilan Saat Ini
Seluruh aplikasi memakai **1 fungsi murni**: `calculateAdaptiveDailyLimit(totalBalance, remainingDays, reserveMode, reserveValue, lockedTotal)` di [`src/lib/finance.ts`](src/lib/finance.ts#L133-L198):
1. `appliedLocked = Math.min(safeTotal, Math.max(0, lockedTotal))`
2. `safeBalance = Math.max(0, safeTotal - appliedLocked)`
3. Mengurangi `reservedTotal` (bila `daily_fixed`, `percent`, atau `daily_cap`) → `spendableBalance` → `dailyLimit = Math.floor(spendableBalance / remainingDays)`.

Titik pemanggil aktif:
- [`src/app/actions/dashboard.ts`](src/app/actions/dashboard.ts#L184-L223): untuk `dailyLimit` saat ini, `todayBudget` (awal hari), dan `yesterdayAdaptive`. Mengambil `lockedTotal` dari `locked_funds WHERE is_paid = false`.
- [`src/lib/daily-limit-server.ts`](src/lib/daily-limit-server.ts#L147-L207): `evaluateDailyLimitForUser` untuk peringatan batas harian saat catat/wake.
- [`src/app/(main)/dashboard/page.tsx`](src/app/%28main%29/dashboard/page.tsx#L402-L420): kalkulasi live di klien menggunakan `dashboardData.rawLockedTotal ?? dashboardData.lockedTotal` agar sinkron jika saldo rekening diperbarui di cache lokal.
- [`src/app/onboarding/page.tsx`](src/app/onboarding/page.tsx#L127): preview onboarding (`lockedTotal = 0`).

### 3.2 Titik Terbaik Memasukkan Pengurangan Pos Terkunci
**Rumus aman (anti double-counting):**
Untuk setiap pos kategori aktif yang memiliki `is_locked_from_daily = true`, yang dikurangkan dari `safeBalance` adalah **sisa jatah pos terkunci yang belum dibelanjakan pada siklus aktif**:

$$\text{lockedCategoryRemaining} = \sum_{p \in \text{pos terkunci}} \max(0, \text{allocatedAmount}_p - \text{periodSpent}_p)$$

- **Kenapa sisa jatah, bukan jatah penuh?** Saat user berbelanja memakai pos terkunci (misal *Kuota* jatah Rp 100rb, terpakai Rp 40rb), saldo rekening/kas (`totalBalance`) sudah berkurang Rp 40rb. Jika yang dikunci tetap Rp 100rb penuh, saldo harian akan terpotong ganda (`40rb + 100rb = 140rb`). Memakai sisa jatah (`60rb`) melindungi sisa anggaran pos tanpa memotong ulang uang yang sudah keluar.
- **Khusus `todayBudget` (awal hari):** gunakan `todayStartSpent = periodSpent - todaySpentInThatLockedPot` agar `Sisa Batas Hari Ini` dan `Jatah hari ini` di Hero Card konsisten sebelum dan sesudah transaksi hari ini.
- **Integrasi:** Di `dashboard.ts` dan `daily-limit-server.ts`, hitung `effectiveLockedTotal = activeBillLockedTotal + lockedCategoryRemaining` dan kirim sebagai `rawLockedTotal` / `lockedTotal` ke `calculateAdaptiveDailyLimit`.
- **Jaminan Netralitas:** Bagi pengguna yang belum memasang jatah atau tidak menyalakan toggle kunci di pos mana pun, `lockedCategoryRemaining = 0`, sehingga hasil perhitungan **100% identik** dengan kondisi sebelum fitur ini.

---

## 4. Audit Daftar Kategori Saat Ini vs Keputusan Desain #4

### 4.1 Data Aktual di Database & Kode
- **Live DB (`categories` & `transactions` aktif):**
  - `Makan` (3 user, 11 tx), `Nongkrong` (3 user, 7 tx), `Rokok` (3 user, 8 tx), `Listrik` (3 user, 3 tx), `Kuota` (3 user, 2 tx), `Laundry` (3 user, 0 tx), `Kebutuhan Lain` (3 user, 12 tx; 2 user `requires_label = true`, 1 user `false`), dan `bensin` (2 user, 6 tx, `is_default = false`).
  - Pemasukan: `Uang Kiriman`, `Kerja Sambilan`, `Beasiswa`, `Gaji / Upah`, `Lainnya`.
- **Ketidaksesuaian sumber seeder di kode:**
  - Trigger DB [`handle_new_user()`](supabase/rls.sql#L148-L156) masih menanam 7 kategori lama (`Makan`, `Nongkrong`, `Rokok`, `Listrik`, `Kuota`, `Laundry`, `Kebutuhan Lain`).
  - [`src/db/seed-data.ts`](src/db/seed-data.ts#L2-L85) berisi 10 kategori berbeda (`Bensin & Transport`, `Jajan & Cemilan`, `Kuota & Internet`, `Kebutuhan Kos`, `Listrik & Token`, `Kuliah & Fotokopi`, `Rokok / Vape`).
  - [`src/app/actions/transactions.ts`](src/app/actions/transactions.ts#L641-L646) dan [`src/app/(main)/record/page.tsx`](src/app/%28main%29/record/page.tsx#L213-L253) memfilter daftar kategori memakai array hardcode `officialNames`.

### 4.2 Matriks Penyesuaian Terhadap Keputusan Desain #4

| Kategori Target (Keputusan #4) | Kondisi Saat Ini | Aksi Migrasi | Dampak ke Transaksi Lama |
| --- | --- | --- | --- |
| **Makan** *(Harian)* | `Makan` (11 tx) | Pertahankan | Tetap utuh (`category_id` sama) |
| **Transport / Bensin** *(Mingguan)* | `bensin` (6 tx, `is_default=false`) / `Bensin & Transport` | Rename `bensin` / `Bensin & Transport` → `Transport / Bensin`, set `is_default = true`; insert jika user belum punya | Semua 6 tx `bensin` otomatis tampil rapi di `Transport / Bensin` |
| **Kuota & Internet** *(Bulanan)* | `Kuota` (2 tx) / `Kuota & Internet` | Rename `Kuota` → `Kuota & Internet` | Semua 2 tx `Kuota` otomatis masuk `Kuota & Internet` |
| **Jajan & Nongkrong** *(Harian)* | `Nongkrong` (7 tx) + `Jajan & Cemilan` (0 tx di DB, ada di seed) | Rename `Nongkrong` → `Jajan & Nongkrong`; jika user juga punya `Jajan & Cemilan`, pindahkan `transactions.category_id` ke `Jajan & Nongkrong` lalu `is_hidden = true` pada `Jajan & Cemilan` | Semua 7 tx `Nongkrong` (+ tx `Jajan & Cemilan` jika ada) tergabung mulus tanpa kehilangan data |
| **Kuliah** *(Bulanan/Fleksibel)* | `Kuliah & Fotokopi` hanya ada di `seed-data.ts` (0 di DB) | Tambah `Kuliah` (`is_default = true`); rename jika ada `Kuliah & Fotokopi` | Tidak memengaruhi data lama (belum ada tx) |
| **Lainnya** *(Wajib ada, Sisa Bebas)* | `Kebutuhan Lain` (`expense`, 12 tx) & `Lainnya` (`income`, 2 user) | Rename `Kebutuhan Lain` (`type = 'expense'`) → `Lainnya` (`type = 'expense'`). Query selalu memfilter `type` agar tidak bentrok dengan `Lainnya` (`income`) | Semua 12 tx lama tetap utuh dalam pos fallback `Lainnya` |
| **Laundry** *(via `+ Tambah pos`)* | `Laundry` (3 user, 0 tx) | Set `is_default = false` (tersedia di `+ Tambah pos`); jika belum ada tx & belum dianggarkan, tetap bisa ditambahkan kapan saja | Aman (0 tx) |
| **Rokok** *(via `+ Tambah pos`)* | `Rokok` (3 user, 8 tx) | User yang sudah punya tx `Rokok` (`8 tx`) tetap melihatnya aktif; user baru menampilkannya lewat `+ Tambah pos` | Semua 8 tx lama tetap tampil penuh |
| **Listrik, WiFi, Kebutuhan Kos** *(DIKELUARKAN)* | `Listrik` (3 user, 3 tx), `Listrik & Token`, `Kebutuhan Kos` | **Jangan dihapus** (`ON DELETE RESTRICT`). Tandai `is_hidden = true` agar keluar dari pilihan pos & Catat baru, arahkan ke **Dana Terkunci** | Riwayat & Statistik lama untuk 3 tx `Listrik` tetap utuh terbaca; tidak dihitung dobel |

---

## 5. Rencana Migrasi Skema, Data & Rollback

### 5.1 Struktur Tabel & Kolom Baru (Non-Destruktif)

Tidak menghapus atau merusak `budgets` dan `category_budgets` yang ada; kita menambahkan 3 tabel khusus pos anggaran serta 1 kolom penanda ringan di `categories`:

1. **Kolom tambahan pada `categories`:**
   - `default_cadence varchar(20) NOT NULL DEFAULT 'monthly'` — sifat bawaan (`daily` / `weekly` / `monthly`) untuk preset pos baru.
2. **Tabel baru `category_pots` (Konfigurasi Pos Tetap User — bertahan lintas siklus):**
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id uuid NOT NULL`
   - `category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE`
   - `cadence varchar(20) NOT NULL DEFAULT 'monthly'` (`'daily' | 'weekly' | 'monthly'`)
   - `unit_amount bigint NOT NULL DEFAULT 0` *(nominal per hari / minggu / bulan)*
   - `is_locked_from_daily boolean NOT NULL DEFAULT false` *(toggle kunci per pos, default OFF)*
   - `is_archived boolean NOT NULL DEFAULT false`
   - `inactive_periods integer NOT NULL DEFAULT 0` *(untuk penawaran arsip setelah >= 2 periode tanpa transaksi)*
   - `sort_order integer NOT NULL DEFAULT 0`
   - `created_at`, `updated_at` (`timestamptz`)
   - `UNIQUE (user_id, category_id)`, index `(user_id, is_archived)`
3. **Tabel baru `category_pot_periods` (Snapshot Jatah & Penyesuaian Siklus Berjalan):**
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id uuid NOT NULL`
   - `pot_id uuid NOT NULL REFERENCES category_pots(id) ON DELETE CASCADE`
   - `period_key varchar(32) NOT NULL` *(misal `2026-11` atau `2026-11-25_2026-12-01`)*
   - `period_start date NOT NULL`, `period_end date NOT NULL`
   - `base_limit bigint NOT NULL` *(hasil hitungan sifat pos x hari siklus)*
   - `allocated_amount bigint NOT NULL` *(patokan akhir setelah Geser Jatah)*
   - `carryover_claimed_amount bigint NOT NULL DEFAULT 0`
   - `carryover_claimed_at timestamptz`
   - `created_at`, `updated_at` (`timestamptz`)
   - `UNIQUE (pot_id, period_key)`, index `(user_id, period_key)`
4. **Tabel baru `category_pot_transfers` (Log Geser Jatah Tengah Periode):**
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id uuid NOT NULL`, `period_key varchar(32) NOT NULL`
   - `from_pot_id uuid NOT NULL REFERENCES category_pots(id) ON DELETE CASCADE`
   - `to_pot_id uuid NOT NULL REFERENCES category_pots(id) ON DELETE CASCADE`
   - `amount bigint NOT NULL`, `note text`, `created_at timestamptz`
5. **RLS Policies Wajib:**
   - Aktifkan `ENABLE ROW LEVEL SECURITY` dan policy `SELECT/INSERT/UPDATE/DELETE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` pada `category_pots`, `category_pot_periods`, dan `category_pot_transfers`.

### 5.2 Urutan Langkah Migrasi (Idempotent & Transaksional)

1. **Langkah 1 — Snapshot Backup Ringan (untuk rollback aman):**
   Buat tabel arsip sementara `categories_backup_sprint2` dan `transactions_category_backup_sprint2` (menyimpan pasangan `tx_id, old_category_id` hanya untuk kategori yang di-merge/rename).
2. **Langkah 2 — DDL Skema Baru + RLS:**
   Tambah kolom `categories.default_cadence`, buat tabel `category_pots`, `category_pot_periods`, `category_pot_transfers` beserta index dan RLS policies.
3. **Langkah 3 — Penyelarasan Kategori & Transaksi Lama (dalam 1 transaksi SQL):**
   - Rename `bensin` / `Bensin & Transport` → `Transport / Bensin` (`default_cadence = 'weekly'`, `is_default = true`).
   - Rename `Kuota` → `Kuota & Internet` (`default_cadence = 'monthly'`).
   - Rename `Nongkrong` → `Jajan & Nongkrong` (`default_cadence = 'daily'`), re-point transaksi `Jajan & Cemilan` (jika ada) ke `Jajan & Nongkrong`, lalu sembunyikan `Jajan & Cemilan` (`is_hidden = true`).
   - Rename `Kebutuhan Lain` (`type = 'expense'`) → `Lainnya` (`type = 'expense'`).
   - Tambah `Kuliah` dan pos default yang belum dimiliki masing-masing user (`INSERT ... WHERE NOT EXISTS`).
   - Set `is_hidden = true` pada `Listrik`, `Listrik & Token`, `Kebutuhan Kos` (`transactions` lama tetap ter-join aman).
   - Set `is_default = false` pada `Laundry` & `Rokok` (tetap visible bila user punya transaksi sebelumnya; sisanya tersedia di `+ Tambah pos`).
4. **Langkah 4 — Migrasi Data `category_budgets` Lama (Jika Ada Saat Hari-H):**
   - Untuk setiap baris `category_budgets` JOIN `budgets`:
     - Upsert ke `category_pots` dengan `cadence = 'monthly'`, `unit_amount = limit_amount`, `is_locked_from_daily = false`.
     - Upsert ke `category_pot_periods` untuk bulan bersangkutan (`base_limit = limit_amount`, `allocated_amount = limit_amount`).
   - Tabel `category_budgets` & `budgets` **tidak dihapus** dulu (disiapkan untuk fallback / rollback).
5. **Langkah 5 — Update Trigger `handle_new_user()`, `seed-data.ts`, `onboarding.ts`, dan hapus whitelist statis `officialNames`.**

### 5.3 Rencana Rollback

Jika terjadi kendala setelah migrasi:
```sql
BEGIN;
-- 1. Pulihkan mapping category_id transaksi yang sempat digabung (jika ada)
UPDATE transactions t
SET category_id = b.old_category_id
FROM transactions_category_backup_sprint2 b
WHERE t.id = b.transaction_id;

-- 2. Pulihkan nama/flag kategori asli dari snapshot backup
UPDATE categories c
SET name = cb.name,
    is_default = cb.is_default,
    is_hidden = cb.is_hidden,
    requires_label = cb.requires_label
FROM categories_backup_sprint2 cb
WHERE c.id = cb.id;

-- 3. Hapus struktur baru tanpa menyentuh budgets / category_budgets lama
DROP TABLE IF EXISTS category_pot_transfers;
DROP TABLE IF EXISTS category_pot_periods;
DROP TABLE IF EXISTS category_pots;
ALTER TABLE categories DROP COLUMN IF EXISTS default_cadence;
COMMIT;
```

---

## 6. Risiko, Hal Tidak Jelas & Usulan Pilihan Terbaik

| No | Risiko / Temuan di Kode | Dampak | Usulan Pilihan Terbaik |
| --- | --- | --- | --- |
| 1 | **Siklus Kalender (`YYYY-MM`) vs Siklus Payday (`monthly`, `weekly`, `flexible`)** | `getCategoryBudgetsAction`, `evaluateCategoryBudgetForUser`, dan `statistics.ts` saat ini memotong bulan kalender, sedangkan Beranda memakai `paydayDay` / `paydayWeekday`. | Buat satu helper `getActiveCyclePeriod(cycle, paydayDay, paydayWeekday, date)` untuk semua hitung pos, peringatan, dan carryover. |
| 2 | **Whitelist Statis `officialNames` & Cache Lokal (`sakuin_cached_categories`)** | [`transactions.ts`](src/app/actions/transactions.ts#L641) dan [`record/page.tsx`](src/app/%28main%29/record/page.tsx#L213) memfilter kategori secara statis; pos kustom (`+ Tambah pos`) atau `Kuliah` akan terbuang jika tidak diperbarui, dan HP user lama masih menyimpan cache `Nongkrong`/`Listrik`/`Kuota`. | Gunakan kolom DB (`is_hidden = false` & `type`) tanpa whitelist statis, serta naikkan kunci/versi cache `sakuin_cached_categories` agar otomatis sinkron. |
| 3 | **Antrean Offline (`offline-queue.ts`) dengan Nama Kategori Lama** | Transaksi offline yang belum terkirim masih membawa string nama lama (`Nongkrong`, `bensin`, `Kuota`, `Kebutuhan Lain`). | Tambahkan kamus alias kompatibilitas di `createTransactionAction` / `updateTransactionAction` agar nama lama otomatis diarahkan ke kategori barunya. |
| 4 | **`updateTransactionAction` & `restoreTransactionAction` Belum Cek Batas Pos** | Mengubah nominal/kategori transaksi di Riwayat tidak memicu evaluasi ulang peringatan 80%/100%. | Terapkan `evaluateCategoryBudgetForUser` di ketiganya (`create`, `update`, `restore`). |
| 5 | **Pembulatan Rumus Mingguan (`nominal x hari / 7`)** | Pada siklus 30/31 hari (misal 50rb/mgg × 30 / 7 = Rp 214.285), angka jatah periode jadi pecahan ganjil. | Bulatkan ke ribuan terdekat (`Math.round(raw / 1000) * 1000`) agar bersih dan mudah dibaca mahasiswa. |
| 6 | **Kebijakan `requires_label` untuk `Lainnya`** | `Kebutuhan Lain` saat ini memaksa user mengetik keterangan tambahan sebelum bisa menyimpan di `/record`. | Jadikan `Lainnya` **tidak wajib** isi keterangan (`requires_label = false`, catatan tetap opsional) agar pencatatan tetap < 5 detik. |

---

## 7. Pertanyaan Keputusan Sebelum Eksekusi Sprint 2

1. **Penamaan & Keterangan Pos:**  
   - Apakah `Kebutuhan Lain` di-rename menjadi **`Lainnya`** dengan keterangan **opsional** (`requires_label = false`), atau tetap wajib ketik keterangan?
   - Untuk nama kategori baru yang diseragamkan: pakai **`Transport / Bensin`** atau **`Bensin & Transport`** (saat ini di beberapa bagian sudah memakai `Bensin & Transport`)?
2. **Pembulatan Rumus Mingguan:**  
   - Saat menghitung `nominal per minggu × hari siklus / 7` pada siklus bulanan (30/31 hari), apakah setuju dibulatkan ke ribuan terdekat (misal `50rb × 30 / 7 → Rp 214.000`)?
3. **Kategori `Rokok` (8 transaksi di DB) & `Laundry` (0 transaksi):**  
   - Untuk akun lama yang sudah punya transaksi `Rokok`, setuju `Rokok` tetap tampil aktif bagi akun tersebut sementara untuk pengguna baru diakses lewat `+ Tambah pos`?
4. **Persetujuan Skema Migrasi:**  
   - Apakah desain 3 tabel (`category_pots`, `category_pot_periods`, `category_pot_transfers`) + `categories.default_cadence` serta pemetaan data kategori di Bagian 5 sudah disetujui untuk dieksekusi di **Sprint 2**?
