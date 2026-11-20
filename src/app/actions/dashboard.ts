"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, transactions, savingsEntries, motivations } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  formatIndonesianDate,
  calculateRemainingDays,
  calculateDailyLimit,
  getSpendingStatus,
} from "@/lib/finance";

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

    // 3. Sisa Hari Hingga Gajian
    const remainingDays = calculateRemainingDays(today, paydayDay);

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

    // Filter transaksi bulan ini (YYYY-MM)
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    let totalExpense = 0;
    let totalIncome = 0;
    const categoryTotals: Record<string, { amount: number; count: number }> = {};
    const monthlyExpenseMap: Record<string, number> = {};

    userTransactions.forEach((tx) => {
      const amt = Number(tx.amount);
      const txMonthKey = tx.occurredOn ? tx.occurredOn.slice(0, 7) : currentMonthKey;

      if (tx.type === "expense") {
        monthlyExpenseMap[txMonthKey] = (monthlyExpenseMap[txMonthKey] || 0) + amt;

        if (txMonthKey === currentMonthKey) {
          totalExpense += amt;
          const catName = tx.category?.name || "Lainnya";
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

    // 5. Cek Mutasi Tabungan Bulan Ini (PRD S5)
    let totalSavedMonth = 0;
    if (userId) {
      const userSavings = await db.query.savingsEntries.findMany({
        where: eq(savingsEntries.userId, userId),
      });

      userSavings.forEach((s) => {
        const sMonthKey = s.occurredOn ? s.occurredOn.slice(0, 7) : currentMonthKey;
        if (sMonthKey === currentMonthKey) {
          if (s.type === "deposit") totalSavedMonth += Number(s.amount);
          if (s.type === "withdraw") totalSavedMonth -= Number(s.amount);
        }
      });
    }

    // 6. Kalkulasi Sisa Uang & Batas Per Hari Riil (PRD B4 & 6)
    // Sisa = Uang Kiriman - Total Pengeluaran Bulan Ini - Total Setoran Tabungan
    const remainingBalance = Math.max(0, allowance - totalExpense - Math.max(0, totalSavedMonth));
    const dailyLimit = calculateDailyLimit(remainingBalance, remainingDays);
    const status = getSpendingStatus(dailyLimit);

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

    const isPayday = today.getDate() === paydayDay || today.getDate() === 1;

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

    // 8. Data Kategori Riil untuk Donut Chart
    const categoryPalette = ["#8CCBFF", "#6B72FF", "#5BAA6B", "#FFB04A", "#FF7B7B", "#D4FF5A", "#A78BFA", "#8A8A8A"];
    const donutCategories = Object.entries(categoryTotals).map(([name, val], idx) => ({
      name,
      amount: val.amount,
      value: totalExpense > 0 ? Math.round((val.amount / totalExpense) * 100) : 0,
      color: categoryPalette[idx % categoryPalette.length],
    }));

    // Top 3 Pengeluaran Terbesar Periode Ini (PRD G1 & G6)
    const topExpenses = Object.entries(categoryTotals)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        percentage: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

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
        remainingDays,
        remainingBalance,
        dailyLimit,
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
