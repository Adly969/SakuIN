import { db } from "@/db";
import {
  profiles,
  transactions,
  accounts,
  savingsEntries,
  lockedFunds,
  budgets,
  categoryBudgets,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  calculateRemainingDays,
  calculateAdaptiveDailyLimit,
  type AllowanceCycle,
  type ReserveMode,
} from "@/lib/finance";

export interface DailyLimitSnapshot {
  todayBudget: number;
  todayExpense: number;
  todayRemaining: number;
  overLimitAmount: number;
  usagePercent: number;
  level: "ok" | "warning" | "reached" | "exceeded";
}

export function getJakartaDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const SHORT_WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getJakartaDayAndWeekday(date: Date = new Date()): {
  day: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const dayPart = parts.find((p) => p.type === "day")?.value || "1";
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value || "Mon";
  return {
    day: parseInt(dayPart, 10) || 1,
    weekday: SHORT_WEEKDAY_MAP[weekdayPart] ?? 1,
  };
}

export interface CategoryLimitAlertPayload {
  categoryName: string;
  spent: number;
  limit: number;
  remaining: number;
  overAmount: number;
  usagePercent: number;
  level: "ok" | "warning" | "reached" | "exceeded";
}

export async function evaluateCategoryBudgetForUser(
  userId: string,
  categoryId: string,
  categoryName: string,
  monthKey: string
): Promise<CategoryLimitAlertPayload | null> {
  const monthDate = `${monthKey}-01`;
  const monthBudget = await db.query.budgets.findFirst({
    where: and(eq(budgets.userId, userId), eq(budgets.month, monthDate)),
  });
  if (!monthBudget) return null;

  const catBudget = await db.query.categoryBudgets.findFirst({
    where: and(
      eq(categoryBudgets.budgetId, monthBudget.id),
      eq(categoryBudgets.categoryId, categoryId)
    ),
  });
  if (!catBudget) return null;

  const limit = Number(catBudget.limitAmount || 0);
  if (limit <= 0) return null;

  const userCatTx = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.categoryId, categoryId),
      eq(transactions.type, "expense"),
      isNull(transactions.deletedAt)
    ),
  });

  const spent = userCatTx
    .filter((t) => (t.occurredOn ? t.occurredOn.slice(0, 7) === monthKey : false))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const usagePercent = Math.round((spent / limit) * 100);
  const remaining = Math.max(0, limit - spent);
  const overAmount = Math.max(0, spent - limit);

  let level: CategoryLimitAlertPayload["level"] = "ok";
  if (spent > limit) level = "exceeded";
  else if (spent === limit || usagePercent >= 100) level = "reached";
  else if (usagePercent >= 80) level = "warning";

  if (level === "ok") return null;

  return {
    categoryName,
    spent,
    limit,
    remaining,
    overAmount,
    usagePercent,
    level,
  };
}

/**
 * Menghitung status pemakaian batas harian hari ini untuk user tertentu
 */
export async function evaluateDailyLimitForUser(userId: string): Promise<DailyLimitSnapshot> {
  const today = new Date();
  const todayKey = getJakartaDateKey(today);
  const currentMonthKey = todayKey.slice(0, 7);

  const [userProfile, userAccounts, userTransactions, userSavings, activeLockedFunds] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
    db.query.accounts.findMany({ where: eq(accounts.userId, userId) }),
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
    }),
    db.query.savingsEntries.findMany({ where: eq(savingsEntries.userId, userId) }),
    db.query.lockedFunds.findMany({
      where: and(eq(lockedFunds.userId, userId), eq(lockedFunds.isPaid, false)),
    }),
  ]);

  const lockedTotal = activeLockedFunds.reduce((sum, f) => sum + Number(f.amount || 0), 0);

  const allowance = Number(userProfile?.monthlyAllowance || 0);
  const paydayDay = userProfile?.paydayDay || 1;
  const allowanceCycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
  const paydayWeekday = userProfile?.paydayWeekday ?? 1;
  const reserveMode = (userProfile?.reserveMode as ReserveMode) || "none";
  const reserveValue = Number(userProfile?.reserveValue || 0);

  let totalExpenseMonth = 0;
  let totalIncomeMonth = 0;
  let todayExpense = 0;

  for (const tx of userTransactions) {
    const amt = Number(tx.amount || 0);
    const txMonthKey = tx.occurredOn ? tx.occurredOn.slice(0, 7) : currentMonthKey;
    if (tx.type === "expense") {
      if (txMonthKey === currentMonthKey) totalExpenseMonth += amt;
      if (tx.occurredOn === todayKey) todayExpense += amt;
    } else if (tx.type === "income") {
      if (txMonthKey === currentMonthKey) totalIncomeMonth += amt;
    }
  }

  let totalSavedMonth = 0;
  for (const s of userSavings) {
    const sMonthKey = s.occurredOn ? s.occurredOn.slice(0, 7) : currentMonthKey;
    if (sMonthKey === currentMonthKey) {
      if (s.type === "deposit") totalSavedMonth += Number(s.amount || 0);
      if (s.type === "withdraw") totalSavedMonth -= Number(s.amount || 0);
    }
  }

  const totalAccountsBalance = userAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const hasAccountsData =
    userAccounts.some((a) => Number(a.balance || 0) !== 0) ||
    userTransactions.some((t) => Boolean(t.accountId));

  const remainingBudget = Math.max(
    0,
    allowance + totalIncomeMonth - totalExpenseMonth - Math.max(0, totalSavedMonth)
  );
  const currentAvailableBalance = hasAccountsData
    ? Math.max(0, totalAccountsBalance)
    : remainingBudget;

  const remainingDays = calculateRemainingDays(today, paydayDay, allowanceCycle, paydayWeekday);
  // Saldo awal hari ini = saldo saat ini + pengeluaran yang sudah terjadi hari ini
  const todayStartBalance = currentAvailableBalance + todayExpense;
  const todayAdaptive = calculateAdaptiveDailyLimit(
    todayStartBalance,
    remainingDays,
    reserveMode,
    reserveValue,
    lockedTotal
  );

  const todayBudget = todayAdaptive.dailyLimit;
  const todayRemaining = Math.max(0, todayBudget - todayExpense);
  const overLimitAmount = Math.max(0, todayExpense - todayBudget);
  const usagePercent =
    todayBudget > 0
      ? Math.round((todayExpense / todayBudget) * 100)
      : todayExpense > 0
      ? 100
      : 0;

  let level: DailyLimitSnapshot["level"] = "ok";
  if (todayBudget <= 0) {
    level = todayExpense > 0 ? "exceeded" : "ok";
  } else if (todayExpense > todayBudget) {
    level = "exceeded";
  } else if (todayExpense === todayBudget || usagePercent >= 100) {
    level = "reached";
  } else if (usagePercent >= 80) {
    level = "warning";
  }

  return {
    todayBudget,
    todayExpense,
    todayRemaining,
    overLimitAmount,
    usagePercent,
    level,
  };
}
