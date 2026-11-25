"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, categories, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STUDENT_ONBOARDING_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/db/seed-data";

// Skema Validasi Zod Server-side
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
  allowanceCycle: z.enum(["monthly", "weekly", "flexible"]).default("monthly"),
  paydayDay: z
    .number()
    .int("Tanggal kiriman harus berupa bilangan bulat")
    .min(1, "Tanggal kiriman minimal 1")
    .max(31, "Tanggal kiriman maksimal 31")
    .default(1),
  paydayWeekday: z.number().int().min(0).max(6).default(1),
  reserveMode: z.enum(["none", "daily_fixed", "percent", "daily_cap"]).default("none"),
  reserveValue: z.number().min(0).max(100000000).default(0),
  bankBalance: z.number().min(0).max(1000000000).default(0),
  ewalletBalance: z.number().min(0).max(1000000000).default(0),
  cashBalance: z.number().min(0).max(1000000000).default(0),
  selectedCategories: z.array(z.string()).optional(),
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
          allowanceCycle: input.allowanceCycle,
          paydayWeekday: input.paydayWeekday,
          reserveMode: input.reserveMode,
          reserveValue: BigInt(input.reserveValue),
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
        allowanceCycle: input.allowanceCycle,
        paydayWeekday: input.paydayWeekday,
        reserveMode: input.reserveMode,
        reserveValue: BigInt(input.reserveValue),
        updatedAt: new Date(),
      });
    }

    // 1. Simpan Kategori Pengeluaran & Pemasukan Pengguna
    const existingCats = await db.query.categories.findMany({
      where: eq(categories.userId, userId),
    });

    if (existingCats.length === 0) {
      const chosenNames = input.selectedCategories && input.selectedCategories.length > 0
        ? input.selectedCategories
        : STUDENT_ONBOARDING_CATEGORIES.filter((c) => c.defaultSelected).map((c) => c.name);

      const toInsert: (typeof categories.$inferInsert)[] = [];
      let sortIdx = 1;

      // Expense categories terpilih
      chosenNames.forEach((cName) => {
        const found = STUDENT_ONBOARDING_CATEGORIES.find((s) => s.name === cName);
        toInsert.push({
          userId,
          name: cName,
          type: "expense",
          icon: found?.icon || "Tags",
          color: found?.color || "#8CCBFF",
          requiresLabel: false,
          isDefault: true,
          sortOrder: sortIdx++,
        });
      });

      // Selalu sertakan Kebutuhan Lain
      toInsert.push({
        userId,
        name: "Kebutuhan Lain",
        type: "expense",
        icon: "MoreHorizontal",
        color: "#8A8A8A",
        requiresLabel: true,
        isDefault: true,
        sortOrder: sortIdx++,
      });

      // Income categories bawaan
      DEFAULT_INCOME_CATEGORIES.forEach((inc) => {
        toInsert.push({
          userId,
          name: inc.name,
          type: "income",
          icon: inc.icon,
          color: inc.color,
          requiresLabel: false,
          isDefault: true,
          sortOrder: sortIdx++,
        });
      });

      await db.insert(categories).values(toInsert);
    }

    // 2. Buat Rekening Default (Multi Rekening: Tunai, Bank, E-Wallet) jika belum ada
    const existingAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
    });

    if (existingAccounts.length === 0) {
      await db.insert(accounts).values([
        {
          userId,
          name: "Dompet Fisik",
          type: "cash",
          color: "#5BAA6B",
          icon: "Banknote",
          isDefault: true,
          balance: BigInt(input.cashBalance),
        },
        {
          userId,
          name: "Rekening Bank",
          type: "bank",
          color: "#8CCBFF",
          icon: "Landmark",
          isDefault: false,
          balance: BigInt(input.bankBalance),
        },
        {
          userId,
          name: "GoPay",
          type: "ewallet",
          color: "#FFB04A",
          icon: "Smartphone",
          isDefault: false,
          balance: BigInt(input.ewalletBalance),
        },
      ]);
    } else if (
      existingAccounts.every((a) => Number(a.balance || 0) === 0) &&
      (input.cashBalance > 0 || input.bankBalance > 0 || input.ewalletBalance > 0)
    ) {
      for (const acc of existingAccounts) {
        const initVal =
          acc.type === "cash"
            ? input.cashBalance
            : acc.type === "bank"
            ? input.bankBalance
            : input.ewalletBalance;
        if (initVal > 0) {
          await db
            .update(accounts)
            .set({ balance: BigInt(initVal), updatedAt: new Date() })
            .where(eq(accounts.id, acc.id));
        }
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    revalidatePath("/statistics");
    revalidatePath("/record");
    revalidatePath("/accounts");
    revalidatePath("/debts");

    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan onboarding:", error);
    return { success: false, error: "Gagal menyimpan data onboarding" };
  }
}
