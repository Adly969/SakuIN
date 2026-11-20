import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/sakuin";

console.log("[DB Migrate] Connecting to:", connectionString.replace(/:[^:@]+@/, ":***@"));

const isSupabase = connectionString.includes("supabase");

const sql = postgres(connectionString, {
  prepare: false,
  ssl: isSupabase || process.env.NODE_ENV === "production" ? "require" : false,
});

async function runMigration() {
  try {
    console.log("🚀 Menjalankan migrasi tabel Multi-Rekening & Utang Piutang...");

    // 1. Table: accounts
    await sql`
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "type" varchar(20) NOT NULL, -- 'bank' | 'ewallet' | 'cash'
        "account_number" varchar(60),
        "balance" bigint NOT NULL DEFAULT 0,
        "color" varchar(30) NOT NULL DEFAULT '#D4FF5A',
        "icon" varchar(50) NOT NULL DEFAULT 'Wallet',
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" ("user_id");`;
    console.log("✅ Tabel 'accounts' siap");

    // 2. Add account_id column to transactions if not exists
    await sql`
      ALTER TABLE "transactions" 
      ADD COLUMN IF NOT EXISTS "account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL;
    `;
    console.log("✅ Kolom 'account_id' di tabel 'transactions' siap");

    // 3. Table: transfers
    await sql`
      CREATE TABLE IF NOT EXISTS "transfers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "from_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "to_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "amount" bigint NOT NULL,
        "admin_fee" bigint NOT NULL DEFAULT 0,
        "occurred_on" date NOT NULL DEFAULT now(),
        "note" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "transfers_user_idx" ON "transfers" ("user_id", "occurred_on");`;
    console.log("✅ Tabel 'transfers' siap");

    // 4. Table: debts
    await sql`
      CREATE TABLE IF NOT EXISTS "debts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL, -- 'payable' (Saya Berutang) | 'receivable' (Teman Ngutang)
        "person_name" varchar(100) NOT NULL,
        "amount" bigint NOT NULL,
        "paid_amount" bigint NOT NULL DEFAULT 0,
        "due_date" date,
        "status" varchar(20) NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'partial' | 'paid'
        "note" text,
        "account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "debts_user_idx" ON "debts" ("user_id", "status");`;
    console.log("✅ Tabel 'debts' siap");

    // 5. Table: debt_payments
    await sql`
      CREATE TABLE IF NOT EXISTS "debt_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "debt_id" uuid NOT NULL REFERENCES "debts"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "occurred_on" date NOT NULL DEFAULT now(),
        "note" text,
        "account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "debt_payments_debt_idx" ON "debt_payments" ("debt_id");`;
    console.log("✅ Tabel 'debt_payments' siap");

    console.log("🎉 Seluruh tabel baru berhasil dimigrasikan ke Supabase!");
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error saat migrasi:", err);
    await sql.end();
    process.exit(1);
  }
}

runMigration();
