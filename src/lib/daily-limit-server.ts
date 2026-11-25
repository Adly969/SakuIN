import { db } from "@/db";
import { profiles, transactions, accounts, savingsEntries } from "@/db/schema";
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

/**
 * Menghitung status pemakaian batas harian hari ini untuk user tertentu
 */
export async function evaluateDailyLimitForUser(userId: string): Promise<DailyLimitSnapshot> {
  const today = new Date();
  const todayKey = getJakartaDateKey(today);
  const currentMonthKey = todayKey.slice(0, 7);

  const [userProfile, userAccounts, userTransactions, userSavings] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
    db.query.accounts.findMany({ where: eq(accounts.userId, userId) }),
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
    }),
    db.query.savingsEntries.findMany({ where: eq(savingsEntries.userId, userId) }),
  ]);

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
    reserveValue
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
