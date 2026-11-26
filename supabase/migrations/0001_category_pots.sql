-- ============================================================================
-- SPRINT 2 MIGRATION: Pembagian Anggaran Per Kategori (Amplop Jatah Mahasiswa)
-- Aman (non-destruktif), idempotent, menyimpan backup untuk rollback 100%.
-- ============================================================================

BEGIN;

-- 1. Snapshot backup ringan untuk rollback nama kategori & pemetaan transaksi yang digabung
CREATE TABLE IF NOT EXISTS public.categories_backup_sprint2 (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  name varchar(100) NOT NULL,
  type varchar(20) NOT NULL,
  is_default boolean,
  is_hidden boolean,
  requires_label boolean,
  sort_order integer,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.categories_backup_sprint2 (
  id, user_id, name, type, is_default, is_hidden, requires_label, sort_order
)
SELECT id, user_id, name, type, is_default, is_hidden, requires_label, sort_order
FROM public.categories
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.transactions_category_backup_sprint2 (
  transaction_id uuid PRIMARY KEY,
  old_category_id uuid NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Kolom sifat bawaan di categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS default_cadence varchar(20) NOT NULL DEFAULT 'monthly';

-- 3. Tabel baru: category_pots (konfigurasi pos persisten lintas siklus)
CREATE TABLE IF NOT EXISTS public.category_pots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  cadence varchar(20) NOT NULL DEFAULT 'monthly',
  unit_amount bigint NOT NULL DEFAULT 0,
  is_locked_from_daily boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  inactive_periods integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS category_pots_user_cat_unq
  ON public.category_pots (user_id, category_id);
CREATE INDEX IF NOT EXISTS category_pots_user_archived_idx
  ON public.category_pots (user_id, is_archived);

-- 4. Tabel baru: category_pot_periods (snapshot jatah & carryover per siklus berjalan)
CREATE TABLE IF NOT EXISTS public.category_pot_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pot_id uuid NOT NULL REFERENCES public.category_pots(id) ON DELETE CASCADE,
  period_key varchar(32) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  base_limit bigint NOT NULL,
  allocated_amount bigint NOT NULL,
  carryover_claimed_amount bigint NOT NULL DEFAULT 0,
  carryover_claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS category_pot_periods_pot_period_unq
  ON public.category_pot_periods (pot_id, period_key);
CREATE INDEX IF NOT EXISTS category_pot_periods_user_period_idx
  ON public.category_pot_periods (user_id, period_key);

-- 5. Tabel baru: category_pot_transfers (audit log Geser Jatah)
CREATE TABLE IF NOT EXISTS public.category_pot_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_key varchar(32) NOT NULL,
  from_pot_id uuid NOT NULL REFERENCES public.category_pots(id) ON DELETE CASCADE,
  to_pot_id uuid NOT NULL REFERENCES public.category_pots(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS category_pot_transfers_user_period_idx
  ON public.category_pot_transfers (user_id, period_key);

-- 6. Aktifkan RLS & policy lengkap untuk 3 tabel baru
ALTER TABLE public.category_pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_pot_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_pot_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own category pots" ON public.category_pots;
CREATE POLICY "Users can manage their own category pots"
  ON public.category_pots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own category pot periods" ON public.category_pot_periods;
CREATE POLICY "Users can manage their own category pot periods"
  ON public.category_pot_periods FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own category pot transfers" ON public.category_pot_transfers;
CREATE POLICY "Users can manage their own category pot transfers"
  ON public.category_pot_transfers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Penyelarasan kategori lama -> set awal Keputusan Desain #4 tanpa menghapus transaksi lama
DO $$
DECLARE
  u RECORD;
  v_jajan_nongkrong_id uuid;
  v_jajan_cemilan_id uuid;
  v_transport_id uuid;
  v_other_bensin_id uuid;
BEGIN
  -- 7a. Pastikan Makan bertipe daily
  UPDATE public.categories
  SET default_cadence = 'daily', is_default = true, is_hidden = false, updated_at = now()
  WHERE type = 'expense' AND lower(trim(name)) = 'makan';

  -- 7b. Seragamkan Kuota / Kuota & Internet -> Kuota & Internet (monthly)
  UPDATE public.categories
  SET name = 'Kuota & Internet', default_cadence = 'monthly', is_default = true, is_hidden = false, updated_at = now()
  WHERE type = 'expense' AND lower(trim(name)) IN ('kuota', 'kuota & internet');

  -- 7c. Seragamkan bensin / Bensin & Transport -> Transport / Bensin (weekly)
  FOR u IN SELECT DISTINCT user_id FROM public.categories WHERE type = 'expense' LOOP
    SELECT id INTO v_transport_id
    FROM public.categories
    WHERE user_id = u.user_id AND type = 'expense' AND lower(trim(name)) = 'transport / bensin'
    LIMIT 1;

    IF v_transport_id IS NULL THEN
      SELECT id INTO v_other_bensin_id
      FROM public.categories
      WHERE user_id = u.user_id AND type = 'expense' AND lower(trim(name)) IN ('bensin', 'bensin & transport')
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1;

      IF v_other_bensin_id IS NOT NULL THEN
        UPDATE public.categories
        SET name = 'Transport / Bensin', default_cadence = 'weekly', is_default = true, is_hidden = false, sort_order = 2, updated_at = now()
        WHERE id = v_other_bensin_id;
        v_transport_id := v_other_bensin_id;
      END IF;
    END IF;

    -- Jika ada duplikat bensin / Bensin & Transport lain pada user yang sama, pindahkan transaksinya
    IF v_transport_id IS NOT NULL THEN
      INSERT INTO public.transactions_category_backup_sprint2 (transaction_id, old_category_id)
      SELECT t.id, t.category_id
      FROM public.transactions t
      JOIN public.categories c ON c.id = t.category_id
      WHERE t.user_id = u.user_id
        AND c.id <> v_transport_id
        AND c.type = 'expense'
        AND lower(trim(c.name)) IN ('bensin', 'bensin & transport')
      ON CONFLICT (transaction_id) DO NOTHING;

      UPDATE public.transactions t
      SET category_id = v_transport_id, updated_at = now()
      FROM public.categories c
      WHERE t.category_id = c.id
        AND t.user_id = u.user_id
        AND c.id <> v_transport_id
        AND c.type = 'expense'
        AND lower(trim(c.name)) IN ('bensin', 'bensin & transport');

      UPDATE public.categories
      SET is_hidden = true, updated_at = now()
      WHERE user_id = u.user_id
        AND id <> v_transport_id
        AND type = 'expense'
        AND lower(trim(name)) IN ('bensin', 'bensin & transport');
    END IF;

    -- 7d. Gabung Nongkrong + Jajan & Cemilan -> Jajan & Nongkrong (daily)
    SELECT id INTO v_jajan_nongkrong_id
    FROM public.categories
    WHERE user_id = u.user_id AND type = 'expense' AND lower(trim(name)) = 'jajan & nongkrong'
    LIMIT 1;

    IF v_jajan_nongkrong_id IS NULL THEN
      SELECT id INTO v_jajan_nongkrong_id
      FROM public.categories
      WHERE user_id = u.user_id AND type = 'expense' AND lower(trim(name)) = 'nongkrong'
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_jajan_nongkrong_id IS NOT NULL THEN
        UPDATE public.categories
        SET name = 'Jajan & Nongkrong', icon = 'Coffee', default_cadence = 'daily', is_default = true, is_hidden = false, sort_order = 4, updated_at = now()
        WHERE id = v_jajan_nongkrong_id;
      ELSE
        SELECT id INTO v_jajan_nongkrong_id
        FROM public.categories
        WHERE user_id = u.user_id AND type = 'expense' AND lower(trim(name)) = 'jajan & cemilan'
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_jajan_nongkrong_id IS NOT NULL THEN
          UPDATE public.categories
          SET name = 'Jajan & Nongkrong', icon = 'Coffee', default_cadence = 'daily', is_default = true, is_hidden = false, sort_order = 4, updated_at = now()
          WHERE id = v_jajan_nongkrong_id;
        END IF;
      END IF;
    END IF;

    IF v_jajan_nongkrong_id IS NOT NULL THEN
      SELECT id INTO v_jajan_cemilan_id
      FROM public.categories
      WHERE user_id = u.user_id
        AND type = 'expense'
        AND id <> v_jajan_nongkrong_id
        AND lower(trim(name)) IN ('jajan & cemilan', 'nongkrong')
      LIMIT 1;

      IF v_jajan_cemilan_id IS NOT NULL THEN
        INSERT INTO public.transactions_category_backup_sprint2 (transaction_id, old_category_id)
        SELECT t.id, t.category_id
        FROM public.transactions t
        JOIN public.categories c ON c.id = t.category_id
        WHERE t.user_id = u.user_id
          AND c.id <> v_jajan_nongkrong_id
          AND c.type = 'expense'
          AND lower(trim(c.name)) IN ('jajan & cemilan', 'nongkrong')
        ON CONFLICT (transaction_id) DO NOTHING;

        UPDATE public.transactions t
        SET category_id = v_jajan_nongkrong_id, updated_at = now()
        FROM public.categories c
        WHERE t.category_id = c.id
          AND t.user_id = u.user_id
          AND c.id <> v_jajan_nongkrong_id
          AND c.type = 'expense'
          AND lower(trim(c.name)) IN ('jajan & cemilan', 'nongkrong');

        -- Pindahkan batas lama jika ada sebelum menyembunyikan kategori lama
        INSERT INTO public.category_budgets (budget_id, category_id, limit_amount)
        SELECT cb.budget_id, v_jajan_nongkrong_id, cb.limit_amount
        FROM public.category_budgets cb
        JOIN public.categories c ON c.id = cb.category_id
        WHERE c.user_id = u.user_id
          AND c.id <> v_jajan_nongkrong_id
          AND c.type = 'expense'
          AND lower(trim(c.name)) IN ('jajan & cemilan', 'nongkrong')
        ON CONFLICT (budget_id, category_id) DO UPDATE
          SET limit_amount = public.category_budgets.limit_amount + EXCLUDED.limit_amount,
              updated_at = now();

        DELETE FROM public.category_budgets cb
        USING public.categories c
        WHERE cb.category_id = c.id
          AND c.user_id = u.user_id
          AND c.id <> v_jajan_nongkrong_id
          AND c.type = 'expense'
          AND lower(trim(c.name)) IN ('jajan & cemilan', 'nongkrong');

        UPDATE public.categories
        SET is_hidden = true, updated_at = now()
        WHERE user_id = u.user_id
          AND id <> v_jajan_nongkrong_id
          AND type = 'expense'
          AND lower(trim(name)) IN ('jajan & cemilan', 'nongkrong');
      END IF;
    END IF;
  END LOOP;

  -- 7e. Seragamkan Kuliah & Fotokopi -> Kuliah
  UPDATE public.categories
  SET name = 'Kuliah', default_cadence = 'monthly', is_default = true, is_hidden = false, updated_at = now()
  WHERE type = 'expense' AND lower(trim(name)) IN ('kuliah', 'kuliah & fotokopi');

  -- 7f. Ubah Kebutuhan Lain (expense) -> Lainnya (expense, selalu ada, opsional label)
  UPDATE public.categories
  SET name = 'Lainnya', default_cadence = 'monthly', is_default = true, is_hidden = false, requires_label = false, sort_order = 6, updated_at = now()
  WHERE type = 'expense' AND lower(trim(name)) = 'kebutuhan lain';

  -- 7g. Keluarkan Kos, WiFi, Listrik dari pos kategori (sembunyikan, jangan hapus transaksi lama!)
  UPDATE public.categories
  SET is_hidden = true, is_default = false, updated_at = now()
  WHERE type = 'expense'
    AND lower(trim(name)) IN ('listrik', 'listrik & token', 'kebutuhan kos', 'kos', 'wifi');

  -- 7h. Laundry & Rokok dijadikan sekunder (+ Tambah pos); user yang sudah punya tx Rokok tetap visible
  UPDATE public.categories
  SET is_default = false, default_cadence = 'monthly', updated_at = now()
  WHERE type = 'expense' AND lower(trim(name)) IN ('laundry', 'rokok', 'rokok / vape');

  -- 7i. Pastikan setiap user yang ada di profiles memiliki 6 set awal Keputusan Desain #4
  INSERT INTO public.categories (user_id, name, type, icon, color, is_default, is_hidden, requires_label, default_cadence, sort_order)
  SELECT p.id, v.name, 'expense', v.icon, v.color, true, false, false, v.cadence, v.sort_order
  FROM public.profiles p
  CROSS JOIN (
    VALUES
      ('Makan', 'Utensils', '#8CCBFF', 'daily', 1),
      ('Transport / Bensin', 'Bike', '#5BAA6B', 'weekly', 2),
      ('Kuota & Internet', 'Wifi', '#38BDF8', 'monthly', 3),
      ('Jajan & Nongkrong', 'Coffee', '#6B72FF', 'daily', 4),
      ('Kuliah', 'GraduationCap', '#4ADE80', 'monthly', 5),
      ('Lainnya', 'MoreHorizontal', '#8A8A8A', 'monthly', 6)
  ) AS v(name, icon, color, cadence, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.user_id = p.id AND c.type = 'expense' AND lower(trim(c.name)) = lower(v.name)
  );
END $$;

-- 8. Migrasi batas lama dari category_budgets -> category_pots + category_pot_periods
INSERT INTO public.category_pots (
  user_id, category_id, cadence, unit_amount, is_locked_from_daily, is_archived, sort_order
)
SELECT DISTINCT ON (b.user_id, cb.category_id)
  b.user_id,
  cb.category_id,
  'monthly',
  cb.limit_amount,
  false,
  false,
  COALESCE(c.sort_order, 0)
FROM public.category_budgets cb
JOIN public.budgets b ON b.id = cb.budget_id
JOIN public.categories c ON c.id = cb.category_id
WHERE cb.limit_amount > 0
ORDER BY b.user_id, cb.category_id, b.month DESC
ON CONFLICT (user_id, category_id) DO UPDATE
  SET unit_amount = EXCLUDED.unit_amount,
      updated_at = now();

INSERT INTO public.category_pot_periods (
  user_id, pot_id, period_key, period_start, period_end, base_limit, allocated_amount
)
SELECT
  b.user_id,
  cp.id,
  to_char(b.month, 'YYYY-MM'),
  b.month,
  (date_trunc('month', b.month) + interval '1 month - 1 day')::date,
  cb.limit_amount,
  cb.limit_amount
FROM public.category_budgets cb
JOIN public.budgets b ON b.id = cb.budget_id
JOIN public.category_pots cp ON cp.user_id = b.user_id AND cp.category_id = cb.category_id
WHERE cb.limit_amount > 0
ON CONFLICT (pot_id, period_key) DO NOTHING;

-- 9. Perbarui trigger handle_new_user() agar user baru mendapat set awal Keputusan Desain #4
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.categories (user_id, name, type, icon, color, is_default, requires_label, default_cadence, sort_order)
  VALUES
    (NEW.id, 'Makan', 'expense', 'Utensils', '#8CCBFF', true, false, 'daily', 1),
    (NEW.id, 'Transport / Bensin', 'expense', 'Bike', '#5BAA6B', true, false, 'weekly', 2),
    (NEW.id, 'Kuota & Internet', 'expense', 'Wifi', '#38BDF8', true, false, 'monthly', 3),
    (NEW.id, 'Jajan & Nongkrong', 'expense', 'Coffee', '#6B72FF', true, false, 'daily', 4),
    (NEW.id, 'Kuliah', 'expense', 'GraduationCap', '#4ADE80', true, false, 'monthly', 5),
    (NEW.id, 'Lainnya', 'expense', 'MoreHorizontal', '#8A8A8A', true, false, 'monthly', 6);

  INSERT INTO public.categories (user_id, name, type, icon, color, is_default, requires_label, sort_order)
  VALUES
    (NEW.id, 'Uang Kiriman', 'income', 'Wallet', '#D4FF5A', true, false, 1),
    (NEW.id, 'Kerja Sambilan', 'income', 'Briefcase', '#8CCBFF', true, false, 2),
    (NEW.id, 'Beasiswa', 'income', 'GraduationCap', '#5BAA6B', true, false, 3),
    (NEW.id, 'Lainnya', 'income', 'Coins', '#8A8A8A', true, false, 4);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
