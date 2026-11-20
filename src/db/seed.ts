import { db } from "./index";
import { motivations } from "./schema";
import { MOTIVATIONS_SEED } from "./seed-data";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function seed() {
  console.log("🌱 Memulai seeding data SakuIN...");

  try {
    console.log(`Mengisi ${MOTIVATIONS_SEED.length} kutipan motivasi...`);
    for (const item of MOTIVATIONS_SEED) {
      await db.insert(motivations).values({
        text: item.text,
        category: item.category,
        hasVariable: item.hasVariable,
        isActive: true,
      });
    }
    console.log("✅ Seeding kutipan motivasi berhasil!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Gagal melakukan seeding:", error);
    process.exit(1);
  }
}

seed();
