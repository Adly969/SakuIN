"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Nama panggilan tidak boleh kosong").max(50),
  monthlyAllowance: z.number().min(0, "Nominal tidak boleh negatif").max(1000000000),
  paydayDay: z.number().int().min(1).max(31),
  allowanceCycle: z.enum(["monthly", "weekly", "flexible"]).optional(),
  paydayWeekday: z.number().int().min(0).max(6).optional(),
  reserveMode: z.enum(["none", "daily_fixed", "percent", "daily_cap"]).optional(),
  reserveValue: z.number().min(0).max(100000000).optional(),
  showMotivation: z.boolean().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().max(10).optional(),
  motivationNotifEnabled: z.boolean().optional(),
  motivationNotifTime: z.string().max(10).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export async function getProfileAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Pengguna belum masuk", data: null };
    }

    let profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
    });

    if (!profile) {
      // Buat profile awal jika belum ada
      const [newProfile] = await db
        .insert(profiles)
        .values({
          id: user.id,
          name: user.user_metadata?.full_name || "Mahasiswa",
          email: user.email || null,
          monthlyAllowance: BigInt(0),
          paydayDay: 1,
          reminderTime: "20:00",
          reminderEnabled: false,
          updatedAt: new Date(),
        })
        .returning();
      profile = newProfile;
    }

    return {
      success: true,
      data: {
        id: profile.id,
        name: profile.name || "Mahasiswa",
        email: profile.email || user.email || "",
        monthlyAllowance: Number(profile.monthlyAllowance ?? 0),
        paydayDay: profile.paydayDay ?? 1,
        allowanceCycle: (profile.allowanceCycle as "monthly" | "weekly" | "flexible") ?? "monthly",
        paydayWeekday: profile.paydayWeekday ?? 1,
        reserveMode: (profile.reserveMode as "none" | "daily_fixed" | "percent" | "daily_cap") ?? "none",
        reserveValue: Number(profile.reserveValue ?? 0),
        showMotivation: profile.showMotivation ?? true,
        reminderEnabled: profile.reminderEnabled ?? false,
        reminderTime: profile.reminderTime ?? "20:00",
        motivationNotifEnabled: profile.motivationNotifEnabled ?? false,
        motivationNotifTime: profile.motivationNotifTime ?? "07:30",
      },
    };
  } catch (err) {
    console.error("Gagal get profile:", err);
    return { success: false, error: "Gagal mengambil data profil", data: null };
  }
}

export async function updateProfileAction(rawInput: UpdateProfileInput) {
  try {
    const validation = updateProfileSchema.safeParse(rawInput);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((e) => e.message).join(", ");
      return { success: false, error: errorMsg };
    }

    const input = validation.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Pengguna belum login" };
    }

    await db
      .insert(profiles)
      .values({
        id: user.id,
        name: input.name,
        email: user.email || null,
        monthlyAllowance: BigInt(input.monthlyAllowance),
        paydayDay: input.paydayDay,
        allowanceCycle: input.allowanceCycle || "monthly",
        paydayWeekday: input.paydayWeekday ?? 1,
        reserveMode: input.reserveMode || "none",
        reserveValue: BigInt(input.reserveValue ?? 0),
        showMotivation: input.showMotivation !== undefined ? input.showMotivation : true,
        reminderEnabled: input.reminderEnabled !== undefined ? input.reminderEnabled : false,
        reminderTime: input.reminderTime || "20:00",
        motivationNotifEnabled:
          input.motivationNotifEnabled !== undefined ? input.motivationNotifEnabled : false,
        motivationNotifTime: input.motivationNotifTime || "07:30",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          name: input.name,
          email: user.email || undefined,
          monthlyAllowance: BigInt(input.monthlyAllowance),
          paydayDay: input.paydayDay,
          ...(input.allowanceCycle !== undefined ? { allowanceCycle: input.allowanceCycle } : {}),
          ...(input.paydayWeekday !== undefined ? { paydayWeekday: input.paydayWeekday } : {}),
          ...(input.reserveMode !== undefined ? { reserveMode: input.reserveMode } : {}),
          ...(input.reserveValue !== undefined ? { reserveValue: BigInt(input.reserveValue) } : {}),
          ...(input.showMotivation !== undefined ? { showMotivation: input.showMotivation } : {}),
          ...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
          ...(input.reminderTime !== undefined ? { reminderTime: input.reminderTime } : {}),
          ...(input.motivationNotifEnabled !== undefined
            ? { motivationNotifEnabled: input.motivationNotifEnabled }
            : {}),
          ...(input.motivationNotifTime !== undefined
            ? { motivationNotifTime: input.motivationNotifTime }
            : {}),
          updatedAt: new Date(),
        },
      });

    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/statistics");

    return { success: true };
  } catch (err) {
    console.error("Gagal update profile:", err);
    return { success: false, error: "Gagal menyimpan perubahan profil" };
  }
}
