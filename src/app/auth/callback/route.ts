import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  // Tangani reverse proxy Vercel agar tidak redirect ke localhost / http
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const baseOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      try {
        // Cek apakah profil sudah ada (misal pengguna baru via Google OAuth)
        const existingProfile = await db.query.profiles.findFirst({
          where: eq(profiles.id, data.user.id),
        });

        if (!existingProfile) {
          const displayName =
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split("@")[0] ||
            "Mahasiswa";

          await db.insert(profiles).values({
            id: data.user.id,
            name: displayName,
            email: data.user.email,
            avatarUrl:
              data.user.user_metadata?.avatar_url ||
              data.user.user_metadata?.picture ||
              null,
            theme: "dark",
          });

          // Otomatis buat rekening awal Tunai (PRD Section 10 & 14)
          await db.insert(accounts).values({
            userId: data.user.id,
            name: "Dompet Tunai",
            type: "cash",
            balance: BigInt(0),
            color: "#D4FF5A",
            icon: "Banknote",
            isDefault: true,
          });

          // Arahkan pengguna baru Google ke Onboarding untuk set uang saku & kategori
          return NextResponse.redirect(`${baseOrigin}/onboarding`);
        }
      } catch (dbErr) {
        console.error("Gagal inisialisasi profil Google OAuth:", dbErr);
      }

      // Pengguna lama atau sesi recovery password
      return NextResponse.redirect(`${baseOrigin}${next}`);
    } else if (error) {
      console.error("Gagal exchange auth code:", error.message);
    }
  }

  // Jika gagal, kembalikan ke login dengan pesan error
  return NextResponse.redirect(`${baseOrigin}/login?error=auth_failed`);
}
