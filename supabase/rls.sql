-- ========================================================
-- SakuIN Row Level Security (RLS) & Auth Triggers
-- ========================================================

-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 3. Categories Policies
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Transactions Policies
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Budgets Policies
CREATE POLICY "Users can view their own budgets"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets"
  ON budgets FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Category Budgets Policies
CREATE POLICY "Users can manage category budgets for their budgets"
  ON category_budgets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = category_budgets.budget_id
      AND budgets.user_id = auth.uid()
    )
  );

-- 7. Savings Goals Policies
CREATE POLICY "Users can view their own savings goals"
  ON savings_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings goals"
  ON savings_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings goals"
  ON savings_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings goals"
  ON savings_goals FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Savings Entries Policies
CREATE POLICY "Users can view their own savings entries"
  ON savings_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings entries"
  ON savings_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings entries"
  ON savings_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings entries"
  ON savings_entries FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Motivations Policies (Read-only for all authenticated & anon users)
CREATE POLICY "Anyone can view active motivations"
  ON motivations FOR SELECT
  USING (is_active = true);

-- 10. Push Subscriptions Policies
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- 11. Category Pots Policies
ALTER TABLE category_pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_pot_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_pot_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own category pots" ON category_pots;
CREATE POLICY "Users can manage their own category pots"
  ON category_pots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own category pot periods" ON category_pot_periods;
CREATE POLICY "Users can manage their own category pot periods"
  ON category_pot_periods FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own category pot transfers" ON category_pot_transfers;
CREATE POLICY "Users can manage their own category pot transfers"
  ON category_pot_transfers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ========================================================
-- Automatic User Profile & Default Categories Initialization
-- (Set awal Keputusan Desain #4 + 4 kategori pemasukan)
-- ========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- 2. Insert Default Expense Categories (Keputusan Desain #4)
  INSERT INTO public.categories (user_id, name, type, icon, color, is_default, requires_label, default_cadence, sort_order)
  VALUES
    (NEW.id, 'Makan', 'expense', 'Utensils', '#8CCBFF', true, false, 'daily', 1),
    (NEW.id, 'Transport / Bensin', 'expense', 'Bike', '#5BAA6B', true, false, 'weekly', 2),
    (NEW.id, 'Kuota & Internet', 'expense', 'Wifi', '#38BDF8', true, false, 'monthly', 3),
    (NEW.id, 'Jajan & Nongkrong', 'expense', 'Coffee', '#6B72FF', true, false, 'daily', 4),
    (NEW.id, 'Kuliah', 'expense', 'GraduationCap', '#4ADE80', true, false, 'monthly', 5),
    (NEW.id, 'Lainnya', 'expense', 'MoreHorizontal', '#8A8A8A', true, false, 'monthly', 6);

  -- 3. Insert Default Income Categories (K2)
  INSERT INTO public.categories (user_id, name, type, icon, color, is_default, requires_label, sort_order)
  VALUES
    (NEW.id, 'Uang Kiriman', 'income', 'Wallet', '#D4FF5A', true, false, 1),
    (NEW.id, 'Kerja Sambilan', 'income', 'Briefcase', '#8CCBFF', true, false, 2),
    (NEW.id, 'Beasiswa', 'income', 'GraduationCap', '#5BAA6B', true, false, 3),
    (NEW.id, 'Lainnya', 'income', 'Coins', '#8A8A8A', true, false, 4);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
