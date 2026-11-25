"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  profiles,
  transactions,
  savingsEntries,
  savingsGoals,
  motivations,
  accounts,
  lockedFunds,
} from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  formatIndonesianDate,
  calculateRemainingDays,
  calculateAdaptiveDailyLimit,
  getSpendingStatus,
  type AllowanceCycle,
  type ReserveMode,
} from "@/lib/finance";
import { getJakartaDateKey, getJakartaDayAndWeekday } from "@/lib/daily-limit-server";

export async function getDashboardDataAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;

    // 1. Tanggal Hari Ini (Real Dynamic Indonesian Date)
    const today = new Date();
    const dateInfo = formatIndonesianDate(today);

    // 2. Profil Pengguna Riil dari Database
    let userProfile = null;
    if (userId) {
      userProfile = await db.query.profiles.findFirst({
        where: eq(profiles.id, userId),
      });
    }

    const allowance = Number(userProfile?.monthlyAllowance || 0);
    const paydayDay = userProfile?.paydayDay || 1;
    const allowanceCycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
    const paydayWeekday = userProfile?.paydayWeekday ?? 1;
    const reserveMode = (userProfile?.reserveMode as ReserveMode) || "none";
    const reserveValue = Number(userProfile?.reserveValue || 0);

    // 3. Sisa Hari Hingga Gajian / Reset Berikutnya
    const remainingDays = calculateRemainingDays(today, paydayDay, allowanceCycle, paydayWeekday);

    // 4. Ambil Transaksi Riil Pengguna dari Database
    type TransactionItem = typeof transactions.$inferSelect & {
      category?: { name: string } | null;
    };
    let userTransactions: TransactionItem[] = [];
    if (userId) {
      userTransactions = await db.query.transactions.findMany({
        where: and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
        orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
        with: {
          category: true,
        },
        limit: 100,
      });
    }

    // Filter transaksi bulan ini (YYYY-MM) & hari ini / kemarin (YYYY-MM-DD WIB)
    const todayKey = getJakartaDateKey(today);
    const yesterdayDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = getJakartaDateKey(yesterdayDate);
    const currentMonthKey = todayKey.slice(0, 7);

    let totalExpense = 0;
    let totalIncome = 0;
    let todayExpense = 0;
    let yesterdayExpense = 0;
    const categoryTotals: Record<string, { amount: number; count: number }> = {};
    const monthlyExpenseMap: Record<string, number> = {};

    userTransactions.forEach((tx) => {
      const amt = Number(tx.amount);
      const txMonthKey = tx.occurredOn ? tx.occurredOn.slice(0, 7) : currentMonthKey;

      if (tx.type === "expense") {
        monthlyExpenseMap[txMonthKey] = (monthlyExpenseMap[txMonthKey] || 0) + amt;
        if (tx.occurredOn === todayKey) {
          todayExpense += amt;
        }
        if (tx.occurredOn === yesterdayKey) {
          yesterdayExpense += amt;
        }

        if (txMonthKey === currentMonthKey) {
          totalExpense += amt;
          let catName = tx.category?.name || "Lainnya";
          // Jika kategori adalah Kebutuhan Lain / Lainnya dan terdapat customLabel, gunakan customLabel
          if ((catName === "Kebutuhan Lain" || catName === "Lainnya") && tx.customLabel?.trim()) {
            catName = tx.customLabel.trim();
          }
          if (!categoryTotals[catName]) {
            categoryTotals[catName] = { amount: 0, count: 0 };
          }
          categoryTotals[catName].amount += amt;
          categoryTotals[catName].count += 1;
        }
      } else if (tx.type === "income") {
        if (txMonthKey === currentMonthKey) {
          totalIncome += amt;
        }
      }
    });

    // 5. Cek Mutasi Tabungan, Target Tabungan & Dana Terkunci (PRD S5, S9)
    let totalSavedMonth = 0;
    let userSavings: Array<typeof savingsEntries.$inferSelect> = [];
    let userGoals: Array<typeof savingsGoals.$inferSelect> = [];
    let lockedTotal = 0;
    let lockedFundsCount = 0;

    if (userId) {
      const [fetchedSavings, fetchedGoals, activeLockedFunds] = await Promise.all([
        db.query.savingsEntries.findMany({ where: eq(savingsEntries.userId, userId) }),
        db.query.savingsGoals.findMany({
          where: eq(savingsGoals.userId, userId),
          orderBy: [desc(savingsGoals.createdAt)],
        }),
        db.query.lockedFunds.findMany({
          where: and(eq(lockedFunds.userId, userId), eq(lockedFunds.isPaid, false)),
        }),
      ]);

      userSavings = fetchedSavings;
      userGoals = fetchedGoals;
      lockedFundsCount = activeLockedFunds.length;
      lockedTotal = activeLockedFunds.reduce((sum, f) => sum + Number(f.amount || 0), 0);

      userSavings.forEach((s) => {
        const sMonthKey = s.occurredOn ? s.occurredOn.slice(0, 7) : currentMonthKey;
        if (sMonthKey === currentMonthKey) {
          if (s.type === "deposit") totalSavedMonth += Number(s.amount);
          if (s.type === "withdraw") totalSavedMonth -= Number(s.amount);
        }
      });
    }

    // 6. Hitung Total Saldo Riil dari Semua Rekening, E-Wallet, dan Dompet Fisik
    let totalAccountsBalance = 0;
    let bankBalance = 0;
    let ewalletBalance = 0;
    let cashBalance = 0;
    let hasAccountsData = false;

    if (userId) {
      const userAccounts = await db.query.accounts.findMany({
        where: eq(accounts.userId, userId),
      });

      userAccounts.forEach((acc) => {
        const bal = Number(acc.balance || 0);
        totalAccountsBalance += bal;
        if (acc.type === "bank") bankBalance += bal;
        else if (acc.type === "ewallet") ewalletBalance += bal;
        else cashBalance += bal;
      });

      hasAccountsData =
        userAccounts.some((a) => Number(a.balance || 0) !== 0) ||
        userTransactions.some((t) => Boolean(t.accountId));
    }

    // Sisa anggaran bulanan (Uang Kiriman + Pemasukan - Pengeluaran - Setoran Tabungan)
    const remainingBudget = Math.max(
      0,
      allowance + totalIncome - totalExpense - Math.max(0, totalSavedMonth)
    );

    // Saldo Utama: jika user menggunakan Multi-Rekening, gunakan total seluruh saldo rekening/e-wallet/dompet fisik
    const remainingBalance = hasAccountsData ? Math.max(0, totalAccountsBalance) : remainingBudget;
    const adaptive = calculateAdaptiveDailyLimit(
      remainingBalance,
      remainingDays,
      reserveMode,
      reserveValue,
      lockedTotal
    );
    const dailyLimit = adaptive.dailyLimit;
    const reservedTotal = adaptive.reservedTotal;
    const spendableBalance = adaptive.spendableBalance;
    const freeBalance = adaptive.freeBalance;
    const appliedLockedTotal = adaptive.lockedTotal;
    const status = getSpendingStatus(dailyLimit);

    // Evaluasi status batas harian hari ini (untuk peringatan mendekati/mencapai limit)
    const todayStartBalance = remainingBalance + todayExpense;
    const todayAdaptive = calculateAdaptiveDailyLimit(
      todayStartBalance,
      remainingDays,
      reserveMode,
      reserveValue,
      lockedTotal
    );
    const todayBudget = todayAdaptive.dailyLimit;

    // Evaluasi Penawaran Auto-Carryover Sisa Hemat Kemarin -> Tabungan (PRD S9)
    const carryoverKey = `daily:${yesterdayKey}`;
    const alreadyClaimedYesterday = userSavings.some((s) => s.carryoverKey === carryoverKey);
    const profileCreatedKey = userProfile?.createdAt
      ? getJakartaDateKey(new Date(userProfile.createdAt))
      : todayKey;
    const yesterdayStartBalance = remainingBalance + todayExpense + yesterdayExpense;
    const yesterdayAdaptive = calculateAdaptiveDailyLimit(
      yesterdayStartBalance,
      remainingDays + 1,
      reserveMode,
      reserveValue,
      lockedTotal
    );
    const yesterdaySavedAmount = Math.max(0, yesterdayAdaptive.dailyLimit - yesterdayExpense);
    const canOfferCarryover =
      Boolean(userId) &&
      profileCreatedKey < todayKey &&
      !alreadyClaimedYesterday &&
      yesterdayAdaptive.dailyLimit > 0 &&
      yesterdaySavedAmount >= 1000 &&
      remainingBalance >= yesterdaySavedAmount;

    const carryoverOffer = canOfferCarryover
      ? {
          carryoverKey,
          dateKey: yesterdayKey,
          dateLabel: formatIndonesianDate(yesterdayDate).short,
          amount: yesterdaySavedAmount,
          yesterdayBudget: yesterdayAdaptive.dailyLimit,
          yesterdayExpense,
          preferredGoalId: userProfile?.autoCarryoverGoalId || userGoals[0]?.id || null,
          goals: userGoals.map((g) => ({ id: g.id, name: g.name })),
        }
      : null;
    const todayRemaining = Math.max(0, todayBudget - todayExpense);
    const overLimitAmount = Math.max(0, todayExpense - todayBudget);
    const todayUsagePercent =
      todayBudget > 0
        ? Math.round((todayExpense / todayBudget) * 100)
        : todayExpense > 0
        ? 100
        : 0;
    let todayAlertLevel: "ok" | "warning" | "reached" | "exceeded" = "ok";
    if (todayBudget <= 0) {
      todayAlertLevel = todayExpense > 0 ? "exceeded" : "ok";
    } else if (todayExpense > todayBudget) {
      todayAlertLevel = "exceeded";
    } else if (todayExpense === todayBudget || todayUsagePercent >= 100) {
      todayAlertLevel = "reached";
    } else if (todayUsagePercent >= 80) {
      todayAlertLevel = "warning";
    }

    // Persentase Anggaran Terpakai (PRD B3)
    const budgetUsedPercent = allowance > 0 ? Math.min(100, Math.round((totalExpense / allowance) * 100)) : 0;

    // 7. Ambil Kutipan Motivasi dengan Aturan Rotasi 15 Sesi & Variabel (PRD M1-M5)
    const allMotivations = await db.query.motivations.findMany({
      limit: 120,
    });

    let recentIds: string[] = [];
    if (userProfile?.recentMotivationIds && Array.isArray(userProfile.recentMotivationIds)) {
      recentIds = userProfile.recentMotivationIds as string[];
    }

    const { day: jakartaDay, weekday: jakartaWeekday } = getJakartaDayAndWeekday(today);
    const isPayday =
      allowanceCycle === "weekly"
        ? jakartaWeekday === paydayWeekday
        : allowanceCycle === "monthly"
        ? jakartaDay === paydayDay || jakartaDay === 1
        : false;

    const isExactScheduledPayday =
      allowanceCycle === "weekly"
        ? jakartaWeekday === paydayWeekday
        : allowanceCycle === "monthly"
        ? jakartaDay === paydayDay
        : false;
    const hasIncomeToday = userTransactions.some(
      (tx) => tx.type === "income" && tx.occurredOn === todayKey
    );
    const paydayPrompt =
      Boolean(userId) &&
      allowance > 0 &&
      isExactScheduledPayday &&
      !hasIncomeToday &&
      profileCreatedKey < todayKey
        ? {
            dateKey: todayKey,
            dateLabel: dateInfo.short,
            cycle: allowanceCycle,
            suggestedAmount: allowance,
          }
        : null;

    let eligible = allMotivations.filter((m) => !recentIds.includes(m.id));
    if (eligible.length === 0) {
      eligible = allMotivations;
    }

    if (isPayday) {
      const parentQuotes = eligible.filter((m) => m.category === "orang_tua");
      if (parentQuotes.length > 0) {
        eligible = parentQuotes;
      }
    }

    const picked = eligible[Math.floor(Math.random() * eligible.length)] || allMotivations[0];
    let selectedMotivation = picked?.text || "Uang kiriman adalah amanah. Kelola dengan bijak sampai akhir bulan.";
    const motivationCategory = picked?.category || "umum";

    // Interpolasi {nama} dan {uang_kiriman} (PRD M4)
    const displayName = userProfile?.name || "Kawan";
    const displayAllowance = allowance > 0 ? allowance.toLocaleString("id-ID") : "2.500.000";
    selectedMotivation = selectedMotivation
      .replace(/{nama}/g, displayName)
      .replace(/{uang_kiriman}/g, displayAllowance);

    // Simpan riwayat kutipan
    if (userId && picked?.id) {
      const updatedRecent = [picked.id, ...recentIds.filter((id) => id !== picked.id)].slice(0, 15);
      await db
        .update(profiles)
        .set({ recentMotivationIds: updatedRecent })
        .where(eq(profiles.id, userId));
    }

    // 8. Data Kategori Riil untuk Donut Chart (Diurutkan dari pengeluaran terbesar)
    const categoryPalette = [
      "#D4FF5A", // Brand lime untuk kategori #1 terbesar
      "#8CCBFF", // Biru muda
      "#FFB04A", // Oranye
      "#FF7B7B", // Merah koral
      "#6B72FF", // Indigo
      "#5BAA6B", // Hijau
      "#A78BFA", // Ungu
      "#8A8A8A", // Abu-abu
    ];

    const sortedEntries = Object.entries(categoryTotals)
      .map(([name, val]) => {
        const rawPercent = totalExpense > 0 ? (val.amount / totalExpense) * 100 : 0;
        const rounded = Math.round(rawPercent);
        // Pastikan kategori dengan nominal > 0 tidak tertulis 0% jika dibulatkan
        const displayValue = val.amount > 0 && rounded === 0 ? 1 : rounded;
        return {
          name,
          amount: val.amount,
          value: displayValue,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    let donutCategories: { name: string; amount: number; value: number; color: string }[] = [];
    if (sortedEntries.length <= 5) {
      donutCategories = sortedEntries.map((item, idx) => ({
        ...item,
        color: categoryPalette[idx % categoryPalette.length],
      }));
    } else {
      const top4 = sortedEntries.slice(0, 4);
      const remaining = sortedEntries.slice(4);
      const remainingAmount = remaining.reduce((sum, item) => sum + item.amount, 0);
      const remainingValue = totalExpense > 0 ? Math.max(1, Math.round((remainingAmount / totalExpense) * 100)) : 0;

      donutCategories = [
        ...top4.map((item, idx) => ({
          ...item,
          color: categoryPalette[idx % categoryPalette.length],
        })),
        {
          name: "Lainnya",
          amount: remainingAmount,
          value: remainingValue,
          color: "#8A8A8A",
        },
      ];
    }

    // Top 3 Pengeluaran Terbesar Periode Ini (PRD G1 & G6)
    const topExpenses = sortedEntries.slice(0, 3).map((item) => ({
      name: item.name,
      amount: item.amount,
      percentage: item.value,
    }));

    // 9. Komposisi Bulan Ini Riil (Uang Masuk vs Pengeluaran Aktual vs Tabungan)
    const effectiveIncome = allowance + totalIncome;
    const totalComposition = effectiveIncome + totalExpense + Math.max(0, totalSavedMonth);

    const compositionData = [];
    if (effectiveIncome > 0) {
      compositionData.push({
        name: "Pemasukan",
        value: totalComposition > 0 ? Math.max(1, Math.round((effectiveIncome / totalComposition) * 100)) : 100,
        color: "#D4FF5A",
        amount: effectiveIncome,
      });
    }
    if (totalExpense > 0) {
      compositionData.push({
        name: "Pengeluaran",
        value: totalComposition > 0 ? Math.max(1, Math.round((totalExpense / totalComposition) * 100)) : 0,
        color: "#FF7B7B",
        amount: totalExpense,
      });
    }
    if (totalSavedMonth > 0) {
      compositionData.push({
        name: "Tabungan",
        value: totalComposition > 0 ? Math.max(1, Math.round((totalSavedMonth / totalComposition) * 100)) : 0,
        color: "#FFB04A",
        amount: totalSavedMonth,
      });
    }

    // 10. Riwayat Pengeluaran 6 Bulan Terakhir Riil dari Database
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const currentYear = today.getFullYear();
    const currentMonthIdx = today.getMonth();

    const last6Months: Array<{ year: number; monthIdx: number; key: string; label: string }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonthIdx - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      last6Months.push({ year: y, monthIdx: m, key, label: monthNames[m] });
    }

    let maxExpense = 0;
    last6Months.forEach((m) => {
      const amt = monthlyExpenseMap[m.key] || 0;
      if (amt > maxExpense) maxExpense = amt;
    });

    const monthlyHistory = last6Months.map((m) => {
      const amt = monthlyExpenseMap[m.key] || 0;
      const isCurrent = m.monthIdx === currentMonthIdx && m.year === currentYear;
      const isHighest = maxExpense > 0 && amt === maxExpense;
      return {
        month: m.label,
        amount: amt,
        isHighest,
        isCurrent,
      };
    });

    return {
      success: true,
      data: {
        dateInfo,
        userName: displayName,
        allowance,
        totalExpense,
        totalSavedMonth,
        budgetUsedPercent,
        paydayDay,
        allowanceCycle,
        paydayWeekday,
        reserveMode,
        reserveValue,
        reservedTotal,
        spendableBalance,
        lockedTotal: appliedLockedTotal,
        rawLockedTotal: lockedTotal,
        lockedFundsCount,
        freeBalance,
        carryoverOffer,
        paydayPrompt,
        remainingDays,
        remainingBalance,
        remainingBudget,
        totalAccountsBalance,
        hasAccountsData,
        accountBreakdown: {
          bank: bankBalance,
          ewallet: ewalletBalance,
          cash: cashBalance,
        },
        dailyLimit,
        todayExpense,
        todayBudget,
        todayRemaining,
        overLimitAmount,
        todayUsagePercent,
        todayAlertLevel,
        status,
        motivation: {
          text: selectedMotivation,
          category: motivationCategory,
        },
        donutCategories,
        topExpenses,
        compositionData,
        monthlyHistory,
        recentTransactions: userTransactions.slice(0, 5).map((t) => ({
          id: t.id,
          title: t.customLabel || t.category?.name || "Transaksi",
          category: t.category?.name || "Umum",
          type: t.type,
          amount: Number(t.amount),
          date: t.occurredOn,
        })),
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data dashboard:", error);
    return {
      success: false,
      error: "Gagal memuat data dashboard",
    };
  }
}

/**
 * Endpoint / Server Action untuk mengambil kutipan baru secara instan (PRD 11 & M2)
 */
export async function getNextMotivationAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    let userProfile = null;
    if (userId) {
      userProfile = await db.query.profiles.findFirst({
        where: eq(profiles.id, userId),
      });
    }

    const allMotivations = await db.query.motivations.findMany({ limit: 120 });
    if (allMotivations.length === 0) {
      return { success: true, data: { text: "Menabung hari ini adalah ketenangan esok hari.", category: "tabungan" } };
    }

    let recentIds: string[] = [];
    if (userProfile?.recentMotivationIds && Array.isArray(userProfile.recentMotivationIds)) {
      recentIds = userProfile.recentMotivationIds as string[];
    }

    let eligible = allMotivations.filter((m) => !recentIds.includes(m.id));
    if (eligible.length === 0) {
      eligible = allMotivations;
    }

    const picked = eligible[Math.floor(Math.random() * eligible.length)] || allMotivations[0];
    let motivationText = picked.text;

    const displayName = userProfile?.name || "Kawan";
    const allowance = Number(userProfile?.monthlyAllowance || 0);
    const displayAllowance = allowance > 0 ? allowance.toLocaleString("id-ID") : "2.500.000";

    motivationText = motivationText
      .replace(/{nama}/g, displayName)
      .replace(/{uang_kiriman}/g, displayAllowance);

    if (userId && picked?.id) {
      const updatedRecent = [picked.id, ...recentIds.filter((id) => id !== picked.id)].slice(0, 15);
      await db
        .update(profiles)
        .set({ recentMotivationIds: updatedRecent })
        .where(eq(profiles.id, userId));
    }

    return {
      success: true,
      data: {
        text: motivationText,
        category: picked.category,
      },
    };
  } catch (err) {
    console.error("Gagal mengambil motivasi berikutnya:", err);
    return {
      success: false,
      error: "Gagal memuat kutipan motivasi",
    };
  }
}
