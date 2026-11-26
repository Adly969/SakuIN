-- ============================================================================
-- SPRINT 2 ROLLBACK: Mengembalikan database persis seperti sebelum 0001_category_pots.sql
-- ============================================================================

BEGIN;

-- 1. Pulihkan pemetaan transaksi yang digabung (jika tabel backup ada)
DO $$
BEGIN
  IF to_regclass('public.transactions_category_backup_sprint2') IS NOT NULL THEN
    UPDATE public.transactions t
    SET category_id = b.old_category_id,
        updated_at = now()
    FROM public.transactions_category_backup_sprint2 b
    WHERE t.id = b.transaction_id;
  END IF;

  IF to_regclass('public.categories_backup_sprint2') IS NOT NULL THEN
    -- Pulihkan nilai asli kategori lama
    UPDATE public.categories c
    SET name = cb.name,
        is_default = cb.is_default,
        is_hidden = cb.is_hidden,
        requires_label = cb.requires_label,
        sort_order = cb.sort_order,
        updated_at = now()
    FROM public.categories_backup_sprint2 cb
    WHERE c.id = cb.id;

    -- Hapus kategori baru yang hanya dibuat oleh migrasi Sprint 2 (dan belum punya transaksi)
    DELETE FROM public.categories c
    WHERE NOT EXISTS (SELECT 1 FROM public.categories_backup_sprint2 cb WHERE cb.id = c.id)
      AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.category_id = c.id);
  END IF;
END $$;

-- 2. Hapus tabel & kolom baru Sprint 2 (budgets & category_budgets lama tetap utuh)
DROP TABLE IF EXISTS public.category_pot_transfers;
DROP TABLE IF EXISTS public.category_pot_periods;
DROP TABLE IF EXISTS public.category_pots;
ALTER TABLE public.categories DROP COLUMN IF EXISTS default_cadence;

-- 3. Kembalikan trigger handle_new_user() ke versi awal
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.categories (user_id, name, type, icon, color, is_default, requires_label, sort_order)
  VALUES
    (NEW.id, 'Makan', 'expense', 'Utensils', '#8CCBFF', true, false, 1),
    (NEW.id, 'Nongkrong', 'expense', 'Coffee', '#6B72FF', true, false, 2),
    (NEW.id, 'Rokok', 'expense', 'Cigarette', '#FF7B7B', true, false, 3),
    (NEW.id, 'Listrik', 'expense', 'Zap', '#FFB04A', true, false, 4),
    (NEW.id, 'Kuota', 'expense', 'Wifi', '#5BAA6B', true, false, 5),
    (NEW.id, 'Laundry', 'expense', 'Shirt', '#A78BFA', true, false, 6),
    (NEW.id, 'Kebutuhan Lain', 'expense', 'MoreHorizontal', '#8A8A8A', true, true, 7);

  INSERT INTO public.categories (user_id, name, type, icon, color, is_default, requires_label, sort_order)
  VALUES
    (NEW.id, 'Uang Kiriman', 'income', 'Wallet', '#D4FF5A', true, false, 1),
    (NEW.id, 'Kerja Sambilan', 'income', 'Briefcase', '#8CCBFF', true, false, 2),
    (NEW.id, 'Beasiswa', 'income', 'GraduationCap', '#5BAA6B', true, false, 3),
    (NEW.id, 'Lainnya', 'income', 'Coins', '#8A8A8A', true, false, 4);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Bersihkan tabel backup setelah rollback selesai
DROP TABLE IF EXISTS public.transactions_category_backup_sprint2;
DROP TABLE IF EXISTS public.categories_backup_sprint2;

COMMIT;
