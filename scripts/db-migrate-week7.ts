import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/sakuin";

console.log("[DB Migrate Week 7] Connecting to:", connectionString.replace(/:[^:@]+@/, ":***@"));

const isSupabase = connectionString.includes("supabase");

const sql = postgres(connectionString, {
  prepare: false,
  ssl: isSupabase || process.env.NODE_ENV === "production" ? "require" : false,
});

async function runMigration() {
  try {
    console.log("🚀 Menjalankan migrasi tabel app_releases (PRD Minggu 7)...");

    // 1. Table: app_releases
    await sql`
      CREATE TABLE IF NOT EXISTS "app_releases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "version" varchar(20) NOT NULL UNIQUE,
        "version_code" integer NOT NULL DEFAULT 1,
        "apk_url_primary" text NOT NULL,
        "apk_url_mirror" text,
        "sha256" varchar(64),
        "size_bytes" bigint DEFAULT 2621440,
        "released_at" timestamp with time zone NOT NULL DEFAULT now(),
        "changelog" text,
        "is_latest" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "app_releases_latest_idx" ON "app_releases" ("is_latest");`;
    console.log("✅ Tabel 'app_releases' siap");

    // 2. RLS: Public Read Only
    await sql`ALTER TABLE "app_releases" ENABLE ROW LEVEL SECURITY;`;
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'app_releases' AND policyname = 'Public read for app_releases'
        ) THEN
          CREATE POLICY "Public read for app_releases" ON "app_releases" FOR SELECT USING (true);
        END IF;
      END
      $$;
    `;
    console.log("✅ RLS 'Public read for app_releases' aktif");

    // 3. Seed release perdana v1.0.0
    await sql`
      INSERT INTO "app_releases" (
        "version",
        "version_code",
        "apk_url_primary",
        "apk_url_mirror",
        "sha256",
        "size_bytes",
        "released_at",
        "changelog",
        "is_latest"
      ) VALUES (
        '1.0.0',
        1,
        'https://github.com/Adly969/SakuIN/releases/download/v1.0.0/sakuin-v1.0.0.apk',
        'https://saku-in.vercel.app/download',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        2621440,
        now(),
        '• Rilis perdana SakuIN v1.0.0 untuk Android.\n• Sangat ringan (~2.5 MB), hemat kuota dan memori HP.\n• Fitur lengkap: Multi Rekening, Utang Piutang, Catat Instan, Tabungan, Statistik, dan PWA Offline Ready.\n• Login dengan Akun Google tetap aman via Trusted Web Activity (TWA).',
        true
      )
      ON CONFLICT ("version") DO UPDATE SET
        "is_latest" = EXCLUDED."is_latest",
        "changelog" = EXCLUDED."changelog",
        "updated_at" = now();
    `;
    console.log("✅ Data rilis v1.0.0 berhasil di-seed");

    console.log("🎉 Migrasi Minggu 7 Selesai!");
  } catch (err) {
    console.error("❌ Gagal migrasi:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
