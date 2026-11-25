"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { budgets, categoryBudgets, categories, transactions } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getJakartaDateKey } from "@/lib/daily-limit-server";

const upsertCategoryBudgetSchema = z.object({
  categoryId: z.string().uuid("Kategori tidak valid"),
  limitAmount: z.number().min(0, "Nominal tidak boleh negatif").max(1000000000),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

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

    const [expenseCategories, monthBudget, monthExpenses] = await Promise.all([
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
    ]);

    const spentByCategory: Record<string, number> = {};
    for (const tx of monthExpenses) {
      if (tx.occurredOn && tx.occurredOn.slice(0, 7) === monthKey) {
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

export async function upsertCategoryBudgetAction(
  rawInput: z.infer<typeof upsertCategoryBudgetSchema>
) {
  try {
    const validation = upsertCategoryBudgetSchema.safeParse(rawInput);
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

    const cat = await db.query.categories.findFirst({
      where: and(eq(categories.id, input.categoryId), eq(categories.userId, userId)),
    });
    if (!cat) return { success: false, error: "Kategori tidak ditemukan" };

    const monthKey = input.monthKey || getJakartaDateKey().slice(0, 7);
    const monthDate = `${monthKey}-01`;

    let budget = await db.query.budgets.findFirst({
      where: and(eq(budgets.userId, userId), eq(budgets.month, monthDate)),
    });

    if (!budget) {
      if (input.limitAmount <= 0) {
        return { success: true };
      }
      const [created] = await db
        .insert(budgets)
        .values({
          userId,
          month: monthDate,
          totalLimit: BigInt(input.limitAmount),
        })
        .returning();
      budget = created;
    }

    const existing = await db.query.categoryBudgets.findFirst({
      where: and(
        eq(categoryBudgets.budgetId, budget.id),
        eq(categoryBudgets.categoryId, input.categoryId)
      ),
    });

    if (input.limitAmount <= 0) {
      if (existing) {
        await db.delete(categoryBudgets).where(eq(categoryBudgets.id, existing.id));
      }
    } else if (existing) {
      await db
        .update(categoryBudgets)
        .set({ limitAmount: BigInt(input.limitAmount), updatedAt: new Date() })
        .where(eq(categoryBudgets.id, existing.id));
    } else {
      await db.insert(categoryBudgets).values({
        budgetId: budget.id,
        categoryId: input.categoryId,
        limitAmount: BigInt(input.limitAmount),
      });
    }

    revalidatePath("/statistics");
    revalidatePath("/dashboard");
    revalidatePath("/record");

    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan batas kategori:", error);
    return { success: false, error: "Gagal menyimpan batas pengeluaran kategori" };
  }
}
