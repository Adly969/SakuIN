"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { savingsGoals, savingsEntries, motivations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createGoalSchema = z.object({
  name: z.string().trim().min(1, "Nama target wajib diisi").max(100),
  targetAmount: z.number().positive("Target tabungan harus lebih dari 0").max(1000000000),
  targetDate: z.string().optional(),
  icon: z.string().optional().default("target"),
  color: z.string().optional().default("#D4FF5A"),
});

const entrySchema = z.object({
  goalId: z.string().uuid("Target tidak valid"),
  amount: z.number().positive("Nominal harus lebih dari 0").max(1000000000),
  date: z.string().optional(),
  note: z.string().max(100).optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type SavingsEntryInput = z.infer<typeof entrySchema>;

/**
 * 1. Ambil Semua Data Tabungan & Target Pengguna (PRD S1, S3)
 */
export async function getSavingsDataAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: true, data: { goals: [], totalSaved: 0 } };
    }

    const goals = await db.query.savingsGoals.findMany({
      where: eq(savingsGoals.userId, userId),
      orderBy: [desc(savingsGoals.createdAt)],
    });

    const entries = await db.query.savingsEntries.findMany({
      where: eq(savingsEntries.userId, userId),
      orderBy: [desc(savingsEntries.occurredOn), desc(savingsEntries.createdAt)],
    });

    // Map total terkumpul per goal
    const goalMap: Record<string, number> = {};
    const goalEntriesMap: Record<string, any[]> = {};

    entries.forEach((e) => {
      const amt = Number(e.amount);
      if (e.type === "deposit") {
        goalMap[e.goalId] = (goalMap[e.goalId] || 0) + amt;
      } else if (e.type === "withdraw") {
        goalMap[e.goalId] = (goalMap[e.goalId] || 0) - amt;
      }

      if (!goalEntriesMap[e.goalId]) {
        goalEntriesMap[e.goalId] = [];
      }
      goalEntriesMap[e.goalId].push({
        id: e.id,
        type: e.type,
        amount: amt,
        date: e.occurredOn,
        note: e.note || (e.type === "deposit" ? "Setoran Tabungan" : "Penarikan Tabungan"),
      });
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSaved = 0;
    const formattedGoals = goals.map((g) => {
      const collected = Math.max(0, goalMap[g.id] || 0);
      const target = Number(g.targetAmount);
      totalSaved += collected;

      // Status
      const isCompleted = collected >= target;
      const status = isCompleted ? "completed" : "active";

      // Saran Setoran (PRD S4)
      let weeklySuggestion = 0;
      let monthlySuggestion = 0;
      let remainingDays = 0;

      if (g.targetDate && !isCompleted) {
        const tDate = new Date(g.targetDate);
        tDate.setHours(0, 0, 0, 0);
        const diffTime = tDate.getTime() - today.getTime();
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (remainingDays > 0) {
          const remainingAmount = target - collected;
          weeklySuggestion = Math.max(1000, Math.ceil(remainingAmount / Math.max(1, remainingDays / 7)));
          monthlySuggestion = Math.max(1000, Math.ceil(remainingAmount / Math.max(1, remainingDays / 30)));
        }
      }

      return {
        id: g.id,
        name: g.name,
        target,
        collected,
        percentage: target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0,
        color: g.color || "#D4FF5A",
        icon: g.icon || "target",
        targetDate: g.targetDate || "Fleksibel",
        rawTargetDate: g.targetDate || null,
        remainingDays,
        weeklySuggestion,
        monthlySuggestion,
        status,
        entries: (goalEntriesMap[g.id] || []).slice(0, 5),
      };
    });

    return {
      success: true,
      data: {
        goals: formattedGoals,
        totalSaved,
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data tabungan:", error);
    return { success: false, error: "Gagal memuat target tabungan" };
  }
}

/**
 * 2. Buat Target Tabungan Baru (PRD S1)
 */
export async function createSavingsGoalAction(rawInput: CreateGoalInput) {
  try {
    const validation = createGoalSchema.safeParse(rawInput);
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
      return { success: false, error: "Pengguna belum login" };
    }

    const [newGoal] = await db
      .insert(savingsGoals)
      .values({
        userId,
        name: input.name,
        targetAmount: BigInt(input.targetAmount),
        targetDate: input.targetDate || null,
        icon: input.icon || "target",
        color: input.color || "#D4FF5A",
        status: "active",
      })
      .returning();

    revalidatePath("/savings");
    revalidatePath("/dashboard");

    return { success: true, data: newGoal };
  } catch (error) {
    console.error("Gagal membuat target tabungan:", error);
    return { success: false, error: "Gagal menyimpan target tabungan" };
  }
}

/**
 * 3. Ubah Target Tabungan (PRD S7)
 */
export async function updateSavingsGoalAction(goalId: string, rawInput: CreateGoalInput) {
  try {
    const validation = createGoalSchema.safeParse(rawInput);
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
      return { success: false, error: "Pengguna belum login" };
    }

    await db
      .update(savingsGoals)
      .set({
        name: input.name,
        targetAmount: BigInt(input.targetAmount),
        targetDate: input.targetDate || null,
        icon: input.icon || "target",
        color: input.color || "#D4FF5A",
        updatedAt: new Date(),
      })
      .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)));

    revalidatePath("/savings");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Gagal mengubah target tabungan:", error);
    return { success: false, error: "Gagal memperbarui target tabungan" };
  }
}

/**
 * 4. Hapus Target Tabungan (PRD S7)
 */
export async function deleteSavingsGoalAction(goalId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    await db
      .delete(savingsGoals)
      .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)));

    revalidatePath("/savings");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus target tabungan:", error);
    return { success: false, error: "Gagal menghapus target tabungan" };
  }
}

/**
 * 5. Setor Dana ke Target Tabungan (PRD S2, S5, M7)
 * Mengurangi sisa uang bulan ini & memunculkan kutipan motivasi tabungan
 */
export async function depositToGoalAction(rawInput: SavingsEntryInput) {
  try {
    const validation = entrySchema.safeParse(rawInput);
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
      return { success: false, error: "Pengguna belum login" };
    }

    // Pastikan target milik user
    const goal = await db.query.savingsGoals.findFirst({
      where: and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, userId)),
    });

    if (!goal) {
      return { success: false, error: "Target tabungan tidak ditemukan" };
    }

    const dateStr = input.date || new Date().toISOString().split("T")[0];

    // Simpan entri setoran
    await db.insert(savingsEntries).values({
      goalId: input.goalId,
      userId,
      type: "deposit",
      amount: BigInt(input.amount),
      occurredOn: dateStr,
      note: input.note || "Setoran Tabungan",
      source: "manual",
    });

    // Ambil kutipan motivasi acak kategori tabungan (PRD M7)
    const tabunganQuotes = await db.query.motivations.findMany({
      where: eq(motivations.category, "tabungan"),
      limit: 45,
    });

    let motivationQuote = "Setiap setoran adalah janji kecil pada dirimu di masa depan.";
    if (tabunganQuotes.length > 0) {
      const randomIdx = Math.floor(Math.random() * tabunganQuotes.length);
      motivationQuote = tabunganQuotes[randomIdx].text.replace(/{nama}/g, user.user_metadata?.name || "Kawan");
    }

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/statistics");

    return {
      success: true,
      data: {
        motivationQuote,
      },
    };
  } catch (error) {
    console.error("Gagal menyetor dana tabungan:", error);
    return { success: false, error: "Gagal menyimpan setoran tabungan" };
  }
}

/**
 * 6. Tarik Dana dari Target Tabungan (PRD S2, S5)
 * Menambah saldo sisa uang bulan ini
 */
export async function withdrawFromGoalAction(rawInput: SavingsEntryInput) {
  try {
    const validation = entrySchema.safeParse(rawInput);
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
      return { success: false, error: "Pengguna belum login" };
    }

    // Pastikan target milik user
    const goal = await db.query.savingsGoals.findFirst({
      where: and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, userId)),
    });

    if (!goal) {
      return { success: false, error: "Target tabungan tidak ditemukan" };
    }

    // Hitung saldo terkumpul pada target ini
    const entries = await db.query.savingsEntries.findMany({
      where: and(eq(savingsEntries.goalId, input.goalId), eq(savingsEntries.userId, userId)),
    });

    let currentBalance = 0;
    entries.forEach((e) => {
      if (e.type === "deposit") currentBalance += Number(e.amount);
      if (e.type === "withdraw") currentBalance -= Number(e.amount);
    });

    if (input.amount > currentBalance) {
      return {
        success: false,
        error: `Saldo tabungan tidak mencukupi (Tersedia: Rp ${currentBalance.toLocaleString("id-ID")})`,
      };
    }

    const dateStr = input.date || new Date().toISOString().split("T")[0];

    // Simpan entri penarikan
    await db.insert(savingsEntries).values({
      goalId: input.goalId,
      userId,
      type: "withdraw",
      amount: BigInt(input.amount),
      occurredOn: dateStr,
      note: input.note || "Penarikan Tabungan",
      source: "manual",
    });

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/statistics");

    return { success: true };
  } catch (error) {
    console.error("Gagal menarik dana tabungan:", error);
    return { success: false, error: "Gagal memproses penarikan tabungan" };
  }
}
