import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL tidak ditemukan di .env.local");
  process.exit(1);
}

const sql = postgres(connectionString, {
  prepare: false,
  ssl: "require",
});

async function main() {
  console.log("🔒 Mengaktifkan Row Level Security (RLS) dan Trigger Otomatisasi Profil...");

  const rlsSqlPath = path.join(process.cwd(), "supabase", "rls.sql");
  const rlsSql = fs.readFileSync(rlsSqlPath, "utf-8");

  try {
    await sql.unsafe(rlsSql);
    console.log("✅ RLS policies dan Trigger Auth berhasil diaktifkan di Supabase!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Gagal menerapkan RLS:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
