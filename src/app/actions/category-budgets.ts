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
} from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getJakartaDateKey } from "@/lib/daily-limit-server";
import type { AllowanceCycle } from "@/lib/finance";
import {
  calculatePotPeriodAllocation,
  getCyclePeriodInfo,
  type PotCadence,
} from "@/lib/category-pots";

export interface CategoryBudgetItem {
  categoryId: string;
  categoryName: string;
  color: string;
  limitAmount: number;
  spent: number;
  remaining: number;
  usagePercent: number;
  status: "ok" | "warning" | "reached" | "exceeded";
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

    const [userProfile, expenseCategories, monthBudget, monthExpenses, userPots] = await Promise.all([
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
        where: and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          isNull(transactions.deletedAt)
        ),
      }),
      db.query.categoryPots.findMany({
        where: and(eq(categoryPots.userId, userId), eq(categoryPots.isArchived, false)),
      }),
    ]);

    const currentMonthKey = getJakartaDateKey().slice(0, 7);
    const isCurrentMonthView = monthKey === currentMonthKey;
    const cycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
    const paydayDay = userProfile?.paydayDay || 1;
    const paydayWeekday = userProfile?.paydayWeekday ?? 1;
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

    const spentByCategory: Record<string, number> = {};
    for (const tx of monthExpenses) {
      if (!tx.occurredOn) continue;
      const inWindow = isCurrentMonthView && userPots.length > 0
        ? tx.occurredOn >= activePeriodInfo.periodStart && tx.occurredOn <= activePeriodInfo.periodEnd
        : tx.occurredOn.slice(0, 7) === monthKey;
      if (inWindow) {
        spentByCategory[tx.categoryId] =
          (spentByCategory[tx.categoryId] || 0) + Number(tx.amount || 0);
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
      const usagePercent = Math.round((spent / limitAmount) * 100);
      const remaining = Math.max(0, limitAmount - spent);

      let status: CategoryBudgetItem["status"] = "ok";
      if (spent > limitAmount) status = "exceeded";
      else if (spent === limitAmount || usagePercent >= 100) status = "reached";
      else if (usagePercent >= 80) status = "warning";

      items.push({
        categoryId: cat.id,
        categoryName: cat.name,
        color: cat.color || "#8CCBFF",
        limitAmount,
        spent,
        remaining,
        usagePercent,
        status,
      });
    }

    items.sort((a, b) => b.usagePercent - a.usagePercent);

    return {
      success: true,
      data: {
        monthKey,
        items,
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
