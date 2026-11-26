"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  budgets,
  categoryBudgets,
  categoryPots,
  categoryPotPeriods,
  categories,
  profiles,
  transactions,
  accounts,
  savingsEntries,
  lockedFunds,
} from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getJakartaDateKey } from "@/lib/daily-limit-server";
import {
  calculateAdaptiveDailyLimit,
  type AllowanceCycle,
  type ReserveMode,
} from "@/lib/finance";
import {
  calculatePotPeriodAllocation,
  evaluatePotUsage,
  getCyclePeriodInfo,
  type PotCadence,
} from "@/lib/category-pots";

export interface CategoryBudgetItem {
  categoryId: string;
  categoryName: string;
  color: string;
  cadence?: PotCadence;
  isLockedFromDaily?: boolean;
  limitAmount: number;
  spent: number;
  remaining: number;
  overAmount: number;
  usagePercent: number;
  status: "ok" | "warning" | "reached" | "exceeded";
}

export interface CategoryPotsSummaryMeta {
  isCurrentView: boolean;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  availableFunds: number;
  totalAllocated: number;
  freeRemainingBeforeUnallocated: number;
  unallocatedSpent: number;
  freePoolRemaining: number;
  isOverAllocated: boolean;
}

export async function getCategoryBudgetsAction(rawMonthKey?: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const monthKey =
      rawMonthKey && /^\d{4}-\d{2}$/.test(rawMonthKey)
        ? rawMonthKey
        : getJakartaDateKey().slice(0, 7);
    const monthDate = `${monthKey}-01`;

    const [
      userProfile,
      expenseCategories,
      monthBudget,
      allUserTransactions,
      userPots,
      userAccounts,
      activeLockedFunds,
      userSavings,
    ] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
      db.query.categories.findMany({
        where: and(
          eq(categories.userId, userId),
          eq(categories.type, "expense"),
          eq(categories.isHidden, false)
        ),
        orderBy: [asc(categories.sortOrder), asc(categories.name)],
      }),
      db.query.budgets.findFirst({
        where: and(eq(budgets.userId, userId), eq(budgets.month, monthDate)),
      }),
      db.query.transactions.findMany({
        where: and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
      }),
      db.query.categoryPots.findMany({
        where: and(eq(categoryPots.userId, userId), eq(categoryPots.isArchived, false)),
      }),
      db.query.accounts.findMany({ where: eq(accounts.userId, userId) }),
      db.query.lockedFunds.findMany({
        where: and(eq(lockedFunds.userId, userId), eq(lockedFunds.isPaid, false)),
      }),
      db.query.savingsEntries.findMany({ where: eq(savingsEntries.userId, userId) }),
    ]);

    const currentMonthKey = getJakartaDateKey().slice(0, 7);
    const isCurrentMonthView = monthKey === currentMonthKey;
    const cycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
    const paydayDay = userProfile?.paydayDay || 1;
    const paydayWeekday = userProfile?.paydayWeekday ?? 1;
    const reserveMode = (userProfile?.reserveMode as ReserveMode) || "none";
    const reserveValue = Number(userProfile?.reserveValue || 0);
    const allowance = Number(userProfile?.monthlyAllowance || 0);
    const activePeriodInfo = getCyclePeriodInfo(new Date(), cycle, paydayDay, paydayWeekday);

    const periodOverrides =
      isCurrentMonthView && userPots.length > 0
        ? await db.query.categoryPotPeriods.findMany({
            where: and(
              eq(categoryPotPeriods.userId, userId),
              eq(categoryPotPeriods.periodKey, activePeriodInfo.periodKey)
            ),
          })
        : [];
    const overrideByPotId = new Map(
      periodOverrides.map((o) => [o.potId, Number(o.allocatedAmount || 0)])
    );
    const potByCategoryId = new Map(userPots.map((p) => [p.categoryId, p]));

    const spentByCategory: Record<string, number> = {};
    let totalExpenseMonth = 0;
    let totalIncomeMonth = 0;

    for (const tx of allUserTransactions) {
      if (!tx.occurredOn) continue;
      const amt = Number(tx.amount || 0);
      const txMonthKey = tx.occurredOn.slice(0, 7);
      if (tx.type === "income") {
        if (txMonthKey === currentMonthKey) totalIncomeMonth += amt;
        continue;
      }
      if (tx.type !== "expense") continue;
      if (txMonthKey === currentMonthKey) totalExpenseMonth += amt;

      const inWindow =
        isCurrentMonthView && userPots.length > 0
          ? tx.occurredOn >= activePeriodInfo.periodStart && tx.occurredOn <= activePeriodInfo.periodEnd
          : txMonthKey === monthKey;
      if (inWindow) {
        spentByCategory[tx.categoryId] = (spentByCategory[tx.categoryId] || 0) + amt;
      }
    }

    const limitsByCategory: Record<string, number> = {};
    if (monthBudget) {
      const catRows = await db.query.categoryBudgets.findMany({
        where: eq(categoryBudgets.budgetId, monthBudget.id),
      });
      for (const row of catRows) {
        limitsByCategory[row.categoryId] = Number(row.limitAmount || 0);
      }
    }

    if (isCurrentMonthView) {
      for (const pot of userPots) {
        const limitVal =
          overrideByPotId.get(pot.id) ??
          calculatePotPeriodAllocation(
            Number(pot.unitAmount || 0),
            (pot.cadence as PotCadence) || "monthly",
            activePeriodInfo.cycleDays
          );
        if (limitVal > 0) {
          limitsByCategory[pot.categoryId] = limitVal;
        }
      }
    }

    const items: CategoryBudgetItem[] = [];
    for (const cat of expenseCategories) {
      const limitAmount = limitsByCategory[cat.id] || 0;
      if (limitAmount <= 0) continue;

      const spent = spentByCategory[cat.id] || 0;
      const usage = evaluatePotUsage(limitAmount, spent);
      const potMeta = potByCategoryId.get(cat.id);

      items.push({
        categoryId: cat.id,
        categoryName: cat.name,
        color: cat.color || "#8CCBFF",
        cadence: (potMeta?.cadence as PotCadence) || "monthly",
        isLockedFromDaily: Boolean(potMeta?.isLockedFromDaily),
        limitAmount,
        spent,
        remaining: usage.remaining,
        overAmount: usage.overAmount,
        usagePercent: usage.usagePercent,
        status: usage.status === "safe" ? "ok" : usage.status,
      });
    }

    items.sort((a, b) => b.usagePercent - a.usagePercent);

    // Hitung ringkasan Sisa Bebas & pengeluaran tanpa jatah (termasuk kategori Lainnya)
    let totalSavedMonth = 0;
    for (const s of userSavings) {
      if (s.occurredOn?.slice(0, 7) === currentMonthKey) {
        if (s.type === "deposit") totalSavedMonth += Number(s.amount || 0);
        if (s.type === "withdraw") totalSavedMonth -= Number(s.amount || 0);
      }
    }
    const totalAccountsBalance = userAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const hasAccountsData =
      userAccounts.some((a) => Number(a.balance || 0) !== 0) ||
      allUserTransactions.some((t) => Boolean(t.accountId));
    const remainingBudget = Math.max(
      0,
      allowance + totalIncomeMonth - totalExpenseMonth - Math.max(0, totalSavedMonth)
    );
    const remainingBalance = hasAccountsData
      ? Math.max(0, totalAccountsBalance)
      : remainingBudget;
    const billLockedTotal = activeLockedFunds.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const baseAdaptive = calculateAdaptiveDailyLimit(
      remainingBalance,
      activePeriodInfo.remainingDays,
      reserveMode,
      reserveValue,
      billLockedTotal
    );

    const availableFunds = isCurrentMonthView ? baseAdaptive.spendableBalance : allowance;
    const totalAllocated = items.reduce((sum, i) => sum + i.limitAmount, 0);
    const unallocatedSpent = Object.entries(spentByCategory).reduce((sum, [catId, amt]) => {
      if ((limitsByCategory[catId] || 0) > 0) return sum;
      return sum + amt;
    }, 0);
    const freeRemainingBeforeUnallocated = availableFunds - totalAllocated;
    const freePoolRemaining = Math.max(0, freeRemainingBeforeUnallocated) - unallocatedSpent;

    const summary: CategoryPotsSummaryMeta = {
      isCurrentView: isCurrentMonthView,
      periodKey: isCurrentMonthView ? activePeriodInfo.periodKey : monthKey,
      periodStart: isCurrentMonthView ? activePeriodInfo.periodStart : `${monthKey}-01`,
      periodEnd: isCurrentMonthView ? activePeriodInfo.periodEnd : `${monthKey}-31`,
      availableFunds,
      totalAllocated,
      freeRemainingBeforeUnallocated,
      unallocatedSpent,
      freePoolRemaining,
      isOverAllocated: totalAllocated > availableFunds,
    };

    return {
      success: true,
      data: {
        monthKey,
        items,
        summary,
        categories: expenseCategories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color || "#8CCBFF",
          spent: spentByCategory[c.id] || 0,
          limitAmount: limitsByCategory[c.id] || 0,
        })),
      },
    };
  } catch (error) {
    console.error("Gagal mengambil batas kategori:", error);
    return { success: false, error: "Gagal memuat batas kategori" };
  }
}
