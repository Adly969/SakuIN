import { db } from "@/db";
import { categories, categoryPots, categoryPotPeriods, transactions } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { AllowanceCycle } from "@/lib/finance";
import {
  calculatePotPeriodAllocation,
  getCyclePeriodInfo,
  type PotCadence,
} from "@/lib/category-pots";

/**
 * Alias kompatibilitas untuk transaksi lama / antrean offline dengan nama kategori sebelum Sprint 2.
 */
const EXPENSE_CATEGORY_ALIAS_MAP: Record<string, string> = {
  nongkrong: "Jajan & Nongkrong",
  "jajan & cemilan": "Jajan & Nongkrong",
  bensin: "Transport / Bensin",
  "bensin & transport": "Transport / Bensin",
  kuota: "Kuota & Internet",
  "kuliah & fotokopi": "Kuliah",
  "kebutuhan lain": "Lainnya",
};

/**
 * Kategori tagihan wajib yang dikelola di Dana Terkunci (tidak boleh jadi pos kategori).
 */
export const EXCLUDED_BILL_CATEGORIES = new Set([
  "kos",
  "wifi",
  "listrik",
  "listrik & token",
  "kebutuhan kos",
]);

export function resolveExpenseCategoryName(rawName: string): string {
  const normalized = (rawName || "").toLowerCase().trim();
  return EXPENSE_CATEGORY_ALIAS_MAP[normalized] || rawName;
}

export function isProtectedCategory(category: { name: string; type: string }): boolean {
  return (category.name || "").toLowerCase().trim() === "lainnya" && category.type === "expense";
}

/**
 * Menjaga agar kategori "Lainnya" (expense) selalu ada dan terlihat untuk user,
 * serta tidak bisa dihapus/disembunyikan.
 */
export async function ensureFallbackLainnyaCategory(userId: string) {
  const existing = await db.query.categories.findFirst({
    where: and(
      eq(categories.userId, userId),
      eq(categories.type, "expense"),
      eq(categories.name, "Lainnya")
    ),
  });
  if (existing) {
    if (existing.isHidden || !existing.isDefault) {
      const [fixed] = await db
        .update(categories)
        .set({ isHidden: false, isDefault: true, updatedAt: new Date() })
        .where(eq(categories.id, existing.id))
        .returning();
      return fixed;
    }
    return existing;
  }

  const [created] = await db
    .insert(categories)
    .values({
      userId,
      name: "Lainnya",
      type: "expense",
      icon: "MoreHorizontal",
      color: "#8A8A8A",
      isDefault: true,
      isHidden: false,
      requiresLabel: false,
      defaultCadence: "monthly",
      sortOrder: 6,
    })
    .returning();
  return created;
}

/**
 * Menghitung total sisa jatah pos kategori yang dikunci dari Batas Hari Ini (`isLockedFromDaily = true`).
 * Mengembalikan:
 * - `currentRemaining`: sisa jatah terkunci setelah semua transaksi periode berjalan (untuk `dailyLimit`)
 * - `todayStartRemaining`: sisa jatah terkunci sebelum transaksi hari ini (untuk `todayBudget`)
 * Jika user belum punya pos terkunci, keduanya bernilai `0`.
 */
export async function getLockedCategoryDeductionsForUser(params: {
  userId: string;
  today?: Date;
  todayKey: string;
  cycle: AllowanceCycle;
  paydayDay: number;
  paydayWeekday: number;
}): Promise<{ currentRemaining: number; todayStartRemaining: number }> {
  const userPots = await db.query.categoryPots.findMany({
    where: and(
      eq(categoryPots.userId, params.userId),
      eq(categoryPots.isArchived, false),
      eq(categoryPots.isLockedFromDaily, true)
    ),
  });

  if (userPots.length === 0) {
    return { currentRemaining: 0, todayStartRemaining: 0 };
  }

  const periodInfo = getCyclePeriodInfo(
    params.today || new Date(),
    params.cycle,
    params.paydayDay,
    params.paydayWeekday
  );

  const [periodOverrides, periodExpenses] = await Promise.all([
    db.query.categoryPotPeriods.findMany({
      where: and(
        eq(categoryPotPeriods.userId, params.userId),
        eq(categoryPotPeriods.periodKey, periodInfo.periodKey)
      ),
    }),
    db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, params.userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt)
      ),
    }),
  ]);

  const overrideByPotId: Record<string, number> = {};
  for (const ov of periodOverrides) {
    overrideByPotId[ov.potId] = Number(ov.allocatedAmount || 0);
  }

  const spentByCategoryId: Record<string, number> = {};
  const todaySpentByCategoryId: Record<string, number> = {};
  for (const tx of periodExpenses) {
    if (!tx.occurredOn) continue;
    if (tx.occurredOn < periodInfo.periodStart || tx.occurredOn > periodInfo.periodEnd) {
      continue;
    }
    const amt = Number(tx.amount || 0);
    spentByCategoryId[tx.categoryId] = (spentByCategoryId[tx.categoryId] || 0) + amt;
    if (tx.occurredOn === params.todayKey) {
      todaySpentByCategoryId[tx.categoryId] = (todaySpentByCategoryId[tx.categoryId] || 0) + amt;
    }
  }

  let currentRemaining = 0;
  let todayStartRemaining = 0;

  for (const pot of userPots) {
    const cadence = (pot.cadence as PotCadence) || "monthly";
    const allocated =
      overrideByPotId[pot.id] !== undefined
        ? overrideByPotId[pot.id]
        : calculatePotPeriodAllocation(Number(pot.unitAmount || 0), cadence, periodInfo.cycleDays);

    const periodSpent = spentByCategoryId[pot.categoryId] || 0;
    const todaySpent = todaySpentByCategoryId[pot.categoryId] || 0;
    const beforeTodaySpent = Math.max(0, periodSpent - todaySpent);

    currentRemaining += Math.max(0, allocated - periodSpent);
    todayStartRemaining += Math.max(0, allocated - beforeTodaySpent);
  }

  return { currentRemaining, todayStartRemaining };
}
