"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, transactions, savingsEntries } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { INDONESIAN_MONTHS, INDONESIAN_MONTHS_SHORT } from "@/lib/finance";

export interface StatCategory {
  name: string;
  value: number; // percentage (0-100)
  color: string;
  amount: number;
  count: number;
}

export interface MonthlyComp {
  key: string;
  month: string;
  year: number;
  expense: number;
  income: number;
  savings: number;
  isHighestExpense?: boolean;
  isHighestIncome?: boolean;
  isCurrent?: boolean;
}

export interface OtherNeedItem {
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface TopExpenseTransaction {
  id: string;
  title: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  occurredOn: string;
  note?: string;
}

export interface SmartInsight {
  id: string;
  type: "positive" | "warning" | "info" | "neutral";
  title: string;
  description: string;
  badge?: string;
}

export interface StatisticsData {
  period: "month" | "year";
  selectedMonthKey: string; // e.g. "2026-11"
  selectedYear: number;
  displayPeriodLabel: string; // e.g. "November 2026" or "Tahun 2026"
  canGoNext: boolean;

  // Totals
  totalExpense: number;
  totalIncome: number;
  totalSavings: number;
  netSavings: number;
  remainingBalance: number;

  // G2 & G3: Donut & Category Breakdown for selected type
  currentType: "expense" | "income" | "savings";
  statsCategories: StatCategory[];
  topCategory: { name: string; percentage: number; amount: number } | null;

  // G4: Monthly Composition
  monthlyComposition: {
    totalIncome: number;
    totalExpense: number;
    totalSavings: number;
    remainingBalance: number;
    expensePct: number;
    savingsPct: number;
    remainingPct: number;
  };

  // G5: 8-Month Trend
  trend8Months: MonthlyComp[];
  highestExpenseMonth: { month: string; amount: number } | null;
  highestIncomeMonth: { month: string; amount: number } | null;

  // G6: Top 5 Expense Categories Ranking
  topCategoriesRanking: StatCategory[];

  // G7: Breakdown for Kebutuhan Lain
  otherNeedsBreakdown: OtherNeedItem[];
  otherNeedsTotal: number;

  // G8: Top 5 Largest Transactions in Period
  topTransactions: TopExpenseTransaction[];

  // G9: Smart Insights
  smartInsights: SmartInsight[];
}

export interface StatisticsFilterInput {
  period?: "month" | "year";
  monthKey?: string; // YYYY-MM
  year?: number;
  type?: "expense" | "income" | "savings";
}

const CATEGORY_COLOR_MAP: Record<string, string> = {
  makan: "#5BAA6B",
  nongkrong: "#6B72FF",
  kafe: "#6B72FF",
  rokok: "#FF7B7B",
  listrik: "#FFB04A",
  kos: "#FFB04A",
  kuota: "#8CCBFF",
  pulsa: "#8CCBFF",
  laundry: "#A78BFA",
  transport: "#38BDF8",
  bensin: "#38BDF8",
  belanja: "#EC4899",
  "kebutuhan lain": "#8A8A8A",
  lainnya: "#8A8A8A",
  "uang kiriman": "#D4FF5A",
  gaji: "#10B981",
  freelance: "#34D399",
  beasiswa: "#60A5FA",
  hadiah: "#F472B6",
};

const COLOR_PALETTE = [
  "#5BAA6B",
  "#6B72FF",
  "#FFB04A",
  "#8CCBFF",
  "#A78BFA",
  "#FF7B7B",
  "#38BDF8",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#8A8A8A",
];

function getCategoryColor(name: string, fallbackIdx: number = 0): string {
  const lower = name.toLowerCase().trim();
  for (const [key, color] of Object.entries(CATEGORY_COLOR_MAP)) {
    if (lower.includes(key)) return color;
  }
  return COLOR_PALETTE[fallbackIdx % COLOR_PALETTE.length];
}

export async function getStatisticsDataAction(
  filter?: StatisticsFilterInput
): Promise<{ success: boolean; data?: StatisticsData; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIdx = today.getMonth();
    const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;

    const period: "month" | "year" = filter?.period === "year" ? "year" : "month";
    const selectedMonthKey: string = filter?.monthKey || currentMonthKey;
    const selectedYear: number = filter?.year || (period === "year" ? currentYear : parseInt(selectedMonthKey.split("-")[0], 10));
    const currentType: "expense" | "income" | "savings" = filter?.type || "expense";

    // Validate canGoNext (cannot navigate to future months)
    const canGoNext = period === "month" ? selectedMonthKey < currentMonthKey : selectedYear < currentYear;

    // Fetch user profile
    const userProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, userId),
    });
    const monthlyAllowance = Number(userProfile?.monthlyAllowance || 0);

    // Fetch transactions
    const userTransactions = await db.query.transactions.findMany({
      where: and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
      orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
      with: {
        category: true,
      },
      limit: 1000,
    });

    // Fetch savings entries
    const userSavings = await db.query.savingsEntries.findMany({
      where: eq(savingsEntries.userId, userId),
      orderBy: [desc(savingsEntries.occurredOn), desc(savingsEntries.createdAt)],
      with: {
        goal: true,
      },
      limit: 500,
    });

    // Determine period label
    let displayPeriodLabel = "";
    if (period === "month") {
      const [yStr, mStr] = selectedMonthKey.split("-");
      const mIdx = parseInt(mStr, 10) - 1;
      displayPeriodLabel = `${INDONESIAN_MONTHS[mIdx] || "Bulan"} ${yStr}`;
    } else {
      displayPeriodLabel = `Tahun ${selectedYear}`;
    }

    // 1. Calculate 8-Month Trend (G5)
    // We calculate 8 consecutive months leading up to today (or selected month)
    const trendMonths: MonthlyComp[] = [];
    const baseDate = new Date(today.getFullYear(), today.getMonth(), 1);

    for (let i = 7; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = INDONESIAN_MONTHS_SHORT[m];

      trendMonths.push({
        key,
        month: label,
        year: y,
        expense: 0,
        income: 0,
        savings: 0,
        isCurrent: key === (period === "month" ? selectedMonthKey : currentMonthKey),
      });
    }

    // Map monthly amounts into trendMonths
    const trendMap: Record<string, MonthlyComp> = {};
    trendMonths.forEach((m) => {
      trendMap[m.key] = m;
    });

    userTransactions.forEach((tx) => {
      const txKey = tx.occurredOn ? tx.occurredOn.slice(0, 7) : currentMonthKey;
      const amt = Number(tx.amount);
      if (trendMap[txKey]) {
        if (tx.type === "expense") {
          trendMap[txKey].expense += amt;
        } else if (tx.type === "income") {
          trendMap[txKey].income += amt;
        }
      }
    });

    userSavings.forEach((sv) => {
      const svKey = sv.occurredOn ? sv.occurredOn.slice(0, 7) : currentMonthKey;
      const amt = Number(sv.amount);
      if (trendMap[svKey]) {
        if (sv.type === "deposit") {
          trendMap[svKey].savings += amt;
        }
      }
    });

    // In current active month, if no income transaction exists yet but monthlyAllowance > 0, include allowance
    trendMonths.forEach((tm) => {
      if (tm.income === 0 && monthlyAllowance > 0 && tm.key === currentMonthKey) {
        tm.income += monthlyAllowance;
      }
    });

    // Find highest expense & income month in 8 months
    let maxExpense = 0;
    let maxIncome = 0;
    let highestExpenseMonth: { month: string; amount: number } | null = null;
    let highestIncomeMonth: { month: string; amount: number } | null = null;

    for (const tm of trendMonths) {
      if (tm.expense > maxExpense) {
        maxExpense = tm.expense;
        highestExpenseMonth = { month: `${tm.month} ${tm.year}`, amount: tm.expense };
      }
      if (tm.income > maxIncome) {
        maxIncome = tm.income;
        highestIncomeMonth = { month: `${tm.month} ${tm.year}`, amount: tm.income };
      }
    }

    trendMonths.forEach((tm) => {
      tm.isHighestExpense = maxExpense > 0 && tm.expense === maxExpense;
      tm.isHighestIncome = maxIncome > 0 && tm.income === maxIncome;
    });

    // 2. Filter data for the Selected Period
    const isDateInPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      if (period === "month") {
        return dateStr.startsWith(selectedMonthKey);
      } else {
        return dateStr.startsWith(String(selectedYear));
      }
    };

    const periodTransactions = userTransactions.filter((tx) => isDateInPeriod(tx.occurredOn));
    const periodSavings = userSavings.filter((sv) => isDateInPeriod(sv.occurredOn));

    // Totals in selected period
    let totalExpense = 0;
    let totalIncome = 0;
    const expenseCategoryMap: Record<string, { amount: number; count: number; color?: string }> = {};
    const incomeCategoryMap: Record<string, { amount: number; count: number; color?: string }> = {};

    periodTransactions.forEach((tx) => {
      const amt = Number(tx.amount);
      if (tx.type === "expense") {
        totalExpense += amt;
        const catName = tx.category?.name || "Lainnya";
        if (!expenseCategoryMap[catName]) {
          expenseCategoryMap[catName] = {
            amount: 0,
            count: 0,
            color: tx.category?.color || getCategoryColor(catName),
          };
        }
        expenseCategoryMap[catName].amount += amt;
        expenseCategoryMap[catName].count += 1;
      } else if (tx.type === "income") {
        totalIncome += amt;
        const catName = tx.category?.name || "Pemasukan";
        if (!incomeCategoryMap[catName]) {
          incomeCategoryMap[catName] = {
            amount: 0,
            count: 0,
            color: tx.category?.color || getCategoryColor(catName),
          };
        }
        incomeCategoryMap[catName].amount += amt;
        incomeCategoryMap[catName].count += 1;
      }
    });

    // Add monthly allowance to income if not present
    if (period === "month" && selectedMonthKey === currentMonthKey && totalIncome === 0 && monthlyAllowance > 0) {
      totalIncome += monthlyAllowance;
      incomeCategoryMap["Uang Kiriman"] = {
        amount: monthlyAllowance,
        count: 1,
        color: "#D4FF5A",
      };
    } else if (period === "year" && totalIncome === 0 && monthlyAllowance > 0) {
      const yearlyAllowance = monthlyAllowance * 12;
      totalIncome += yearlyAllowance;
      incomeCategoryMap["Uang Kiriman Bulanan"] = {
        amount: yearlyAllowance,
        count: 12,
        color: "#D4FF5A",
      };
    }

    // Savings in selected period
    let totalSavings = 0;
    let totalWithdrawals = 0;
    const savingsGoalMap: Record<string, { amount: number; count: number; color?: string }> = {};

    periodSavings.forEach((sv) => {
      const amt = Number(sv.amount);
      if (sv.type === "deposit") {
        totalSavings += amt;
        const goalName = sv.goal?.name || "Tabungan Impian";
        if (!savingsGoalMap[goalName]) {
          savingsGoalMap[goalName] = {
            amount: 0,
            count: 0,
            color: sv.goal?.color || getCategoryColor(goalName),
          };
        }
        savingsGoalMap[goalName].amount += amt;
        savingsGoalMap[goalName].count += 1;
      } else if (sv.type === "withdraw") {
        totalWithdrawals += amt;
      }
    });

    const netSavings = Math.max(0, totalSavings - totalWithdrawals);
    const remainingBalance = Math.max(0, totalIncome - totalExpense - netSavings);

    // 3. Category Breakdown for current selected type (G2 & G3)
    let statsCategories: StatCategory[] = [];

    if (currentType === "expense") {
      statsCategories = Object.entries(expenseCategoryMap)
        .map(([name, data], idx) => ({
          name,
          amount: data.amount,
          count: data.count,
          value: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0,
          color: data.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
        }))
        .sort((a, b) => b.amount - a.amount);
    } else if (currentType === "income") {
      statsCategories = Object.entries(incomeCategoryMap)
        .map(([name, data], idx) => ({
          name,
          amount: data.amount,
          count: data.count,
          value: totalIncome > 0 ? Math.round((data.amount / totalIncome) * 100) : 0,
          color: data.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
        }))
        .sort((a, b) => b.amount - a.amount);
    } else if (currentType === "savings") {
      statsCategories = Object.entries(savingsGoalMap)
        .map(([name, data], idx) => ({
          name,
          amount: data.amount,
          count: data.count,
          value: totalSavings > 0 ? Math.round((data.amount / totalSavings) * 100) : 0,
          color: data.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
        }))
        .sort((a, b) => b.amount - a.amount);
    }

    // Top Category in Donut Center
    const topCategory =
      statsCategories.length > 0
        ? {
            name: statsCategories[0].name,
            percentage: statsCategories[0].value,
            amount: statsCategories[0].amount,
          }
        : null;

    // 4. Monthly Composition (G4)
    let expensePct = 0;
    let savingsPct = 0;
    let remainingPct = 0;

    if (totalIncome > 0) {
      expensePct = Math.min(100, Math.round((totalExpense / totalIncome) * 100));
      savingsPct = Math.min(100 - expensePct, Math.round((netSavings / totalIncome) * 100));
      remainingPct = Math.max(0, 100 - expensePct - savingsPct);
    } else if (totalExpense > 0) {
      expensePct = 100;
    }

    const monthlyComposition = {
      totalIncome,
      totalExpense,
      totalSavings: netSavings,
      remainingBalance,
      expensePct,
      savingsPct,
      remainingPct,
    };

    // 5. Top 5 Expense Categories Ranking (G6)
    const allExpenseCategories = Object.entries(expenseCategoryMap)
      .map(([name, data], idx) => ({
        name,
        amount: data.amount,
        count: data.count,
        value: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0,
        color: data.color || getCategoryColor(name, idx),
      }))
      .sort((a, b) => b.amount - a.amount);

    const topCategoriesRanking = allExpenseCategories.slice(0, 5);

    // 6. Breakdown for Kebutuhan Lain / Custom Label (G7)
    // Filter transactions in selected period where category is Kebutuhan Lain / Lainnya OR customLabel is provided
    const otherTransactions = periodTransactions.filter(
      (tx) =>
        tx.type === "expense" &&
        (tx.category?.name === "Kebutuhan Lain" ||
          tx.category?.name === "Lainnya" ||
          tx.category?.requiresLabel ||
          Boolean(tx.customLabel))
    );

    const otherGroupMap: Record<string, { amount: number; count: number }> = {};
    let otherNeedsTotal = 0;

    otherTransactions.forEach((tx) => {
      const amt = Number(tx.amount);
      otherNeedsTotal += amt;
      const label = tx.customLabel?.trim() || tx.note?.trim() || "Kebutuhan Lain";
      // Capitalize first letter
      const cleanLabel = label.charAt(0).toUpperCase() + label.slice(1);
      if (!otherGroupMap[cleanLabel]) {
        otherGroupMap[cleanLabel] = { amount: 0, count: 0 };
      }
      otherGroupMap[cleanLabel].amount += amt;
      otherGroupMap[cleanLabel].count += 1;
    });

    const otherNeedsBreakdown: OtherNeedItem[] = Object.entries(otherGroupMap)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        percentage: otherNeedsTotal > 0 ? Math.round((data.amount / otherNeedsTotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // 7. Top 5 Largest Transactions in Period (G8)
    const topTransactions: TopExpenseTransaction[] = periodTransactions
      .filter((tx) => tx.type === "expense")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map((tx) => {
        const catName = tx.category?.name || "Lainnya";
        return {
          id: tx.id,
          title: tx.customLabel || tx.note || catName,
          categoryName: catName,
          categoryColor: tx.category?.color || getCategoryColor(catName),
          amount: Number(tx.amount),
          occurredOn: tx.occurredOn || "",
          note: tx.note || undefined,
        };
      });

    // 8. Smart Insights (G9)
    const smartInsights: SmartInsight[] = [];

    // Comparison with previous period
    if (period === "month") {
      const [selYearStr, selMonthStr] = selectedMonthKey.split("-");
      const selY = parseInt(selYearStr, 10);
      const selM = parseInt(selMonthStr, 10);

      const prevD = new Date(selY, selM - 2, 1);
      const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;

      let prevMonthExpense = 0;
      userTransactions.forEach((tx) => {
        if (tx.occurredOn?.startsWith(prevKey) && tx.type === "expense") {
          prevMonthExpense += Number(tx.amount);
        }
      });

      if (prevMonthExpense > 0 && totalExpense > 0) {
        const diff = Math.round(((totalExpense - prevMonthExpense) / prevMonthExpense) * 100);
        if (diff < 0) {
          smartInsights.push({
            id: "expense-trend-positive",
            type: "positive",
            title: "Pengeluaran Lebih Hemat",
            description: `Bulan ini kamu berhasil lebih hemat ${Math.abs(diff)}% dibandingkan bulan ${INDONESIAN_MONTHS[prevD.getMonth()]}. Pertahankan disiplin ini!`,
            badge: `${Math.abs(diff)}% Lebih Hemat`,
          });
        } else if (diff > 0) {
          smartInsights.push({
            id: "expense-trend-warning",
            type: "warning",
            title: "Pengeluaran Meningkat",
            description: `Pengeluaran bulan ini naik ${diff}% dibanding bulan lalu. Pantau batas harianmu agar uang saku bertahan hingga akhir bulan.`,
            badge: `+${diff}% Pengeluaran`,
          });
        }
      }
    }

    // Dominant Category Insight
    if (topCategoriesRanking.length > 0 && topCategoriesRanking[0].value >= 30) {
      const topCat = topCategoriesRanking[0];
      smartInsights.push({
        id: "dominant-category",
        type: "warning",
        title: `Kategori Terboros: ${topCat.name}`,
        description: `Sebesar ${topCat.value}% dari total pengeluaranmu dialokasikan untuk ${topCat.name} (${topCat.count} transaksi). Pertimbangkan untuk mengevaluasi pos ini.`,
        badge: `${topCat.value}% Total`,
      });
    }

    // Savings Habit Insight
    if (netSavings > 0 && totalIncome > 0) {
      smartInsights.push({
        id: "savings-habit-good",
        type: "positive",
        title: "Alokasi Tabungan Sehat",
        description: `Bagus! Kamu berhasil menyisihkan ${savingsPct}% dari total pemasukan ke pos tabungan impianmu.`,
        badge: `${savingsPct}% Disisihkan`,
      });
    } else if (netSavings === 0 && totalExpense > 0) {
      smartInsights.push({
        id: "savings-habit-alert",
        type: "info",
        title: "Yuk Mulai Menyisihkan",
        description: `Belum ada alokasi tabungan tercatat di periode ini. Sisihkan minimal 10% di awal kiriman untuk dana darurat.`,
        badge: "Rekomendasi 10%",
      });
    }

    // 8-Month Peak Spending Month Insight
    if (highestExpenseMonth && maxExpense > 0) {
      smartInsights.push({
        id: "peak-expense-month",
        type: "neutral",
        title: `Puncak Pengeluaran`,
        description: `Pengeluaran tertinggi dalam 8 bulan terakhir tercatat pada ${highestExpenseMonth.month} sebesar Rp ${maxExpense.toLocaleString("id-ID")}.`,
        badge: "Riwayat 8 Bulan",
      });
    }

    return {
      success: true,
      data: {
        period,
        selectedMonthKey,
        selectedYear,
        displayPeriodLabel,
        canGoNext,
        totalExpense,
        totalIncome,
        totalSavings: netSavings,
        netSavings,
        remainingBalance,
        currentType,
        statsCategories,
        topCategory,
        monthlyComposition,
        trend8Months: trendMonths,
        highestExpenseMonth,
        highestIncomeMonth,
        topCategoriesRanking,
        otherNeedsBreakdown,
        otherNeedsTotal,
        topTransactions,
        smartInsights,
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data statistik:", error);
    return {
      success: false,
      error: "Gagal memuat data statistik",
    };
  }
}
