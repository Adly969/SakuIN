"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Skema Validasi Zod Server-side (tidak diekspor karena file "use server" hanya boleh mengekspor async functions)
const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama panggilan wajib diisi")
    .max(50, "Nama maksimal 50 karakter"),
  monthlyAllowance: z
    .number()
    .min(0, "Nominal uang kiriman tidak boleh negatif")
    .max(100000000, "Nominal melebihi batas wajar"),
  paydayDay: z
    .number()
    .int("Tanggal kiriman harus berupa bilangan bulat")
    .min(1, "Tanggal kiriman minimal 1")
    .max(31, "Tanggal kiriman maksimal 31"),
});

export type SaveOnboardingInput = z.infer<typeof onboardingSchema>;

export async function saveOnboardingAction(rawInput: SaveOnboardingInput) {
  try {
    const validation = onboardingSchema.safeParse(rawInput);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((e) => e.message).join(", ");
      return { success: false, error: errorMsg };
    }

    const input = validation.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;

    if (!userId) {
      return { success: false, error: "Pengguna belum masuk. Silakan login terlebih dahulu." };
    }

    // Periksa apakah profil sudah ada atau belum
    const existing = await db.query.profiles.findFirst({
      where: eq(profiles.id, userId),
    });

    if (existing) {
      await db
        .update(profiles)
        .set({
          name: input.name,
          email: user?.email || existing.email,
          monthlyAllowance: BigInt(input.monthlyAllowance),
          paydayDay: input.paydayDay,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, userId));
    } else {
      await db.insert(profiles).values({
        id: userId,
        name: input.name,
        email: user?.email || null,
        monthlyAllowance: BigInt(input.monthlyAllowance),
        paydayDay: input.paydayDay,
        updatedAt: new Date(),
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    revalidatePath("/statistics");

    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan onboarding:", error);
    return { success: false, error: "Gagal menyimpan data onboarding" };
  }
}
