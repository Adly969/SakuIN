import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        success: true,
        pinEnabled: false,
        isUnlocked: true,
        userName: "",
      });
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      columns: {
        name: true,
        pinEnabled: true,
        pinHash: true,
      },
    });

    const cookieStore = await cookies();

    if (!profile || !profile.pinEnabled || !profile.pinHash) {
      const res = NextResponse.json({
        success: true,
        pinEnabled: false,
        isUnlocked: true,
        userName: profile?.name || "Kawan",
      });
      res.cookies.delete("sakuin_has_pin");
      return res;
    }

    const isUnlocked = cookieStore.get("sakuin_pin_unlocked")?.value === "true";

    const res = NextResponse.json({
      success: true,
      pinEnabled: true,
      isUnlocked,
      userName: profile.name || "Kawan",
      userId: user.id,
      pinVersion: profile.pinHash.slice(0, 16),
    });

    res.cookies.set("sakuin_has_pin", "true", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return res;
  } catch (err) {
    console.error("Gagal cek status PIN API:", err);
    return NextResponse.json({
      success: false,
      pinEnabled: false,
      isUnlocked: true,
      userName: "",
    });
  }
}
