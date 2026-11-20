import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/sakuin";

console.log("[DB] Connecting to:", connectionString.replace(/:[^:@]+@/, ":***@"));

const isSupabase = connectionString.includes("supabase");

const client = postgres(connectionString, {
  prepare: false,
  ssl: isSupabase || process.env.NODE_ENV === "production" ? "require" : false,
});

export const db = drizzle(client, { schema });
