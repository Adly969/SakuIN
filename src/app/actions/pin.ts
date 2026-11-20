"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 100000, 64, "sha512").toString("hex");
}

/**
 * 1. Cek Status Kunci PIN Pengguna
 */
export async function getPinStatusAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: true, pinEnabled: false, isUnlocked: true, userName: "" };
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
    });

    if (!profile || !profile.pinEnabled || !profile.pinHash) {
      return { success: true, pinEnabled: false, isUnlocked: true, userName: profile?.name || "Kawan" };
    }

    const cookieStore = await cookies();
    const isUnlocked = cookieStore.get("sakuin_pin_unlocked")?.value === "true";

    return {
      success: true,
      pinEnabled: true,
      isUnlocked,
      userName: profile.name || "Kawan",
    };
  } catch (err) {
    console.error("Gagal cek status PIN:", err);
    return { success: false, pinEnabled: false, isUnlocked: true, userName: "" };
  }
}

/**
 * 2. Pasang atau Ubah PIN 6-Digit Baru
 */
export async function setupPinAction(pin: string) {
  try {
    if (!/^\d{6}$/.test(pin)) {
      return { success: false, error: "PIN harus terdiri dari 6 digit angka" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Pengguna belum login" };
    }

    const hashed = hashPin(pin, user.id);

    await db
      .update(profiles)
      .set({
        pinHash: hashed,
        pinEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id));

    // Jangan simpan sesi terbuka lama agar selalu terkunci saat aplikasi baru dibuka
    const cookieStore = await cookies();
    cookieStore.set("sakuin_pin_unlocked", "true", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    console.error("Gagal menyimpan PIN:", err);
    return { success: false, error: "Gagal menyimpan PIN baru" };
  }
}

/**
 * 3. Verifikasi PIN untuk Membuka Kunci SakuIN (Quick Unlock)
 */
export async function verifyPinAction(pin: string) {
  try {
    if (!/^\d{6}$/.test(pin)) {
      return { success: false, error: "PIN harus 6 digit angka" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi telah berakhir, silakan login ulang" };
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
    });

    if (!profile || !profile.pinHash) {
      return { success: false, error: "PIN belum diatur" };
    }

    const hashedInput = hashPin(pin, user.id);

    if (hashedInput !== profile.pinHash) {
      return { success: false, error: "PIN yang kamu masukkan salah" };
    }

    // Set cookie sesi terverifikasi (hanya untuk sesi aktif)
    const cookieStore = await cookies();
    cookieStore.set("sakuin_pin_unlocked", "true", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    revalidatePath("/dashboard");
    revalidatePath("/profile");

    return { success: true };
  } catch (err) {
    console.error("Gagal verifikasi PIN:", err);
    return { success: false, error: "Terjadi kesalahan saat memverifikasi PIN" };
  }
}

/**
 * 4. Nonaktifkan Kunci PIN
 */
export async function disablePinAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Pengguna belum login" };
    }

    await db
      .update(profiles)
      .set({
        pinEnabled: false,
        pinHash: null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id));

    const cookieStore = await cookies();
    cookieStore.delete("sakuin_pin_unlocked");

    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    console.error("Gagal nonaktifkan PIN:", err);
    return { success: false, error: "Gagal menonaktifkan PIN" };
  }
}

/**
 * 5. Kunci Aplikasi Manual (Lock Now)
 */
export async function lockAppAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("sakuin_pin_unlocked");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}
