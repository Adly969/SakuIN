import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 100000, 64, "sha512").toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const pin = typeof body?.pin === "string" ? body.pin : "";

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: "PIN harus 6 digit angka" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sesi telah berakhir, silakan login ulang" },
        { status: 401 }
      );
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      columns: {
        pinHash: true,
      },
    });

    if (!profile || !profile.pinHash) {
      return NextResponse.json(
        { success: false, error: "PIN belum diatur" },
        { status: 400 }
      );
    }

    const hashedInput = hashPin(pin, user.id);
    if (hashedInput !== profile.pinHash) {
      return NextResponse.json(
        { success: false, error: "PIN yang kamu masukkan salah" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      userId: user.id,
      pinVersion: profile.pinHash.slice(0, 16),
    });

    response.cookies.set("sakuin_pin_unlocked", "true", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    console.error("Gagal verifikasi PIN API:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat memverifikasi PIN" },
      { status: 500 }
    );
  }
}
