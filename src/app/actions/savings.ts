"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { savingsGoals, savingsEntries, motivations, accounts, profiles, categoryPotPeriods } from "@/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getJakartaDateKey } from "@/lib/daily-limit-server";

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
  accountId: z.string().uuid("Rekening tidak valid").nullish().or(z.literal("")),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type SavingsEntryInput = z.infer<typeof entrySchema>;

const carryoverSchema = z.object({
  goalId: z.string().uuid("Target tabungan tidak valid"),
  amount: z.number().positive("Nominal sisa hemat harus lebih dari 0").max(1000000000),
  carryoverKey: z.string().trim().min(1).max(40),
  accountId: z.string().uuid("Rekening tidak valid").nullish().or(z.literal("")),
  note: z.string().max(100).optional(),
});

export type ClaimCarryoverInput = z.infer<typeof carryoverSchema>;

async function pickTabunganMotivation(userName: string): Promise<string> {
  const tabunganQuotes = await db.query.motivations.findMany({
    where: eq(motivations.category, "tabungan"),
    limit: 45,
  });

  if (tabunganQuotes.length === 0) {
    return "Setiap setoran adalah janji kecil pada dirimu di masa depan.";
  }

  const randomIdx = Math.floor(Math.random() * tabunganQuotes.length);
  return tabunganQuotes[randomIdx].text.replace(/{nama}/g, userName || "Kawan");
}

/** Validasi & mutasi saldo rekening yang terhubung saat setor/tarik tabungan. */
async function applySavingsAccountMutation(
  userId: string,
  rawAccountId: string | null | undefined,
  amount: number,
  direction: "deposit" | "withdraw"
): Promise<{ accountId: string | null; accountName: string | null; error: string | null }> {
  const targetAccountId = rawAccountId && rawAccountId.trim() ? rawAccountId.trim() : null;
  if (!targetAccountId) {
    return { accountId: null, accountName: null, error: null };
  }

  const acc = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId)),
  });

  if (!acc) {
    return {
      accountId: null,
      accountName: null,
      error: direction === "deposit" ? "Rekening sumber tidak ditemukan" : "Rekening tujuan tidak ditemukan",
    };
  }

  if (direction === "deposit") {
    if (Number(acc.balance) < amount) {
      return {
        accountId: null,
        accountName: null,
        error: `Saldo ${acc.name} tidak mencukupi (Tersedia: Rp ${Number(acc.balance).toLocaleString("id-ID")}, Setoran: Rp ${amount.toLocaleString("id-ID")})`,
      };
    }

    const updated = await db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} - ${BigInt(amount)}`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId), gte(accounts.balance, BigInt(amount))))
      .returning();

    if (updated.length === 0) {
      return {
        accountId: null,
        accountName: null,
        error: `Saldo ${acc.name} tidak mencukupi untuk setoran ini`,
      };
    }
  } else {
    await db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} + ${BigInt(amount)}`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId)));
  }

  return { accountId: acc.id, accountName: acc.name, error: null };
}

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

    const [goals, entries, userProfile] = await Promise.all([
      db.query.savingsGoals.findMany({
        where: eq(savingsGoals.userId, userId),
        orderBy: [desc(savingsGoals.createdAt)],
      }),
      db.query.savingsEntries.findMany({
        where: eq(savingsEntries.userId, userId),
        with: {
          account: true,
        },
        orderBy: [desc(savingsEntries.occurredOn), desc(savingsEntries.createdAt)],
      }),
      db.query.profiles.findFirst({
        where: eq(profiles.id, userId),
      }),
    ]);

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
        source: e.source || "manual",
        accountId: e.accountId || null,
        accountName: e.account?.name || null,
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
        autoCarryoverGoalId: userProfile?.autoCarryoverGoalId || null,
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

    const dateStr = input.date || getJakartaDateKey();

    const accResult = await applySavingsAccountMutation(userId, input.accountId, input.amount, "deposit");
    if (accResult.error) {
      return { success: false, error: accResult.error };
    }

    // Simpan entri setoran
    await db.insert(savingsEntries).values({
      goalId: input.goalId,
      userId,
      type: "deposit",
      amount: BigInt(input.amount),
      occurredOn: dateStr,
      note: input.note || "Setoran Tabungan",
      source: "manual",
      accountId: accResult.accountId,
    });

    // Ambil kutipan motivasi acak kategori tabungan (PRD M7)
    const motivationQuote = await pickTabunganMotivation(user.user_metadata?.name || "Kawan");

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/statistics");
    revalidatePath("/accounts");

    return {
      success: true,
      data: {
        motivationQuote,
        accountName: accResult.accountName,
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

    const dateStr = input.date || getJakartaDateKey();

    const accResult = await applySavingsAccountMutation(userId, input.accountId, input.amount, "withdraw");
    if (accResult.error) {
      return { success: false, error: accResult.error };
    }

    // Simpan entri penarikan
    await db.insert(savingsEntries).values({
      goalId: input.goalId,
      userId,
      type: "withdraw",
      amount: BigInt(input.amount),
      occurredOn: dateStr,
      note: input.note || "Penarikan Tabungan",
      source: "manual",
      accountId: accResult.accountId,
    });

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/statistics");
    revalidatePath("/accounts");

    return {
      success: true,
      data: {
        accountName: accResult.accountName,
      },
    };
  } catch (error) {
    console.error("Gagal menarik dana tabungan:", error);
    return { success: false, error: "Gagal memproses penarikan tabungan" };
  }
}

/**
 * 7. Simpan Target Default Auto-Carryover Sisa Hemat (PRD S9)
 */
export async function updateAutoCarryoverGoalAction(goalId: string | null) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    if (goalId) {
      const goal = await db.query.savingsGoals.findFirst({
        where: and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)),
      });
      if (!goal) {
        return { success: false, error: "Target tabungan tidak ditemukan" };
      }
    }

    await db
      .update(profiles)
      .set({
        autoCarryoverGoalId: goalId,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan target carryover:", error);
    return { success: false, error: "Gagal memperbarui target default sisa hemat" };
  }
}

/**
 * 8. Pindahkan Sisa Hemat Harian / Siklus ke Target Tabungan (Idempoten per carryoverKey)
 */
export async function claimCarryoverSavingsAction(rawInput: ClaimCarryoverInput) {
  try {
    const validation = carryoverSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validation.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const [goal, existingClaim] = await Promise.all([
      db.query.savingsGoals.findFirst({
        where: and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, userId)),
      }),
      db.query.savingsEntries.findFirst({
        where: and(
          eq(savingsEntries.userId, userId),
          eq(savingsEntries.carryoverKey, input.carryoverKey)
        ),
      }),
    ]);

    if (!goal) {
      return { success: false, error: "Target tabungan tidak ditemukan" };
    }

    if (existingClaim) {
      return {
        success: false,
        error: "Sisa hemat untuk periode ini sudah dipindahkan ke tabungan.",
      };
    }

    const accResult = await applySavingsAccountMutation(userId, input.accountId, input.amount, "deposit");
    if (accResult.error) {
      return { success: false, error: accResult.error };
    }

    const dateStr = getJakartaDateKey();

    await db.insert(savingsEntries).values({
      goalId: input.goalId,
      userId,
      type: "deposit",
      amount: BigInt(input.amount),
      occurredOn: dateStr,
      note: input.note || "Carryover sisa hemat harian",
      source: "carryover",
      carryoverKey: input.carryoverKey,
      accountId: accResult.accountId,
    });

    // Simpan goal pilihan ini sebagai default jika belum diset
    await db
      .update(profiles)
      .set({ autoCarryoverGoalId: input.goalId, updatedAt: new Date() })
      .where(eq(profiles.id, userId));

    // Jika carryover berasal dari akhir periode pos kategori ("cycle:<periodKey>"), tandai sebagai sudah diklaim
    if (input.carryoverKey.startsWith("cycle:")) {
      const targetPeriodKey = input.carryoverKey.slice("cycle:".length);
      if (targetPeriodKey) {
        await db
          .update(categoryPotPeriods)
          .set({
            carryoverClaimedAmount: BigInt(input.amount),
            carryoverClaimedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(categoryPotPeriods.userId, userId),
              eq(categoryPotPeriods.periodKey, targetPeriodKey)
            )
          );
      }
    }

    const motivationQuote = await pickTabunganMotivation(user.user_metadata?.name || "Kawan");

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/statistics");
    revalidatePath("/accounts");

    return {
      success: true,
      data: {
        goalName: goal.name,
        accountName: accResult.accountName,
        motivationQuote,
      },
    };
  } catch (error) {
    console.error("Gagal memindahkan sisa hemat ke tabungan:", error);
    return { success: false, error: "Gagal memindahkan sisa hemat" };
  }
}
