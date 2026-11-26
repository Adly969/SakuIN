import type { MonthlyComp, SmartInsight, StatisticsData } from "@/app/actions/statistics";
import { INDONESIAN_MONTHS_SHORT } from "@/lib/finance";

export function formatStatRupiah(
  amount: number | bigint,
  sign?: "minus" | "plus"
): string {
  const num = typeof amount === "bigint" ? Number(amount) : Number(amount || 0);
  const abs = Math.abs(Math.round(num));
  const formatted = abs.toLocaleString("id-ID");
  const prefix =
    sign === "minus" || num < 0
      ? "-"
      : sign === "plus" && num > 0
      ? "+"
      : "";
  return `${prefix}Rp${formatted}`;
}

export function formatCompactStatRupiah(amount: number): string {
  const abs = Math.abs(Math.round(amount || 0));
  if (abs === 0) return "Rp0";
  if (abs < 1000) return `Rp${abs}`;
  if (abs < 1_000_000) {
    return `Rp${Math.round(abs / 1000).toLocaleString("id-ID")}rb`;
  }
  const jt = abs / 1_000_000;
  const rounded = Math.round(jt * 10) / 10;
  const str = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
  return `Rp${str}jt`;
}

/**
 * BUG 5: Formatter konsisten untuk sumbu Y grafik tren ("Rp0", "Rp600rb", "Rp1,2jt", "Rp2,4jt").
 */
export function formatAxisRupiah(value: number): string {
  const num = Number(value || 0);
  if (num <= 0) return "Rp0";
  return formatCompactStatRupiah(num);
}

/**
 * BUG 7: Menormalkan "Rp 2.217.650" menjadi "Rp2.217.650" agar tidak putus baris di tengah.
 */
export function normalizeRpInText(text: string): string {
  if (!text) return "";
  return text.replace(/\bRp\s+(\d)/g, "Rp$1");
}

/**
 * BUG 4: Format tanggal ISO ("2026-11-19") menjadi "19 Nov",
 * menambahkan tahun hanya jika berbeda dari tahun periode yang dipilih.
 */
export function formatStatShortDate(isoDate: string, referenceYear: number): string {
  if (!isoDate) return "";
  const match = isoDate.trim().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthShort = INDONESIAN_MONTHS_SHORT[monthIdx] || match[2];
  return year !== referenceYear
    ? `${day} ${monthShort} ${year}`
    : `${day} ${monthShort}`;
}

/**
 * BUG 4: Deteksi judul sama persis dengan nama kategori agar tidak tampil dobel.
 */
export function isSameTitleAndCategory(title: string, categoryName: string): boolean {
  return (title || "").trim().toLowerCase() === (categoryName || "").trim().toLowerCase();
}

/**
 * BUG 3: Hitung berapa bulan yang benar-benar memiliki nilai > 0 pada tren 8 bulan.
 */
export function countMonthsWithData(
  trend: MonthlyComp[],
  trendType: "expense" | "income"
): number {
  return trend.filter((m) => (trendType === "expense" ? m.expense : m.income) > 0).length;
}

export function shouldShowTrendChart(
  trend: MonthlyComp[],
  trendType: "expense" | "income"
): boolean {
  return countMonthsWithData(trend, trendType) >= 2;
}

/**
 * BUG 1, 3, 7: Guard tampilan SmartInsight tanpa mengubah fungsi sumber di server.
 */
export function prepareInsightsForDisplay(
  insights: SmartInsight[],
  comp: StatisticsData["monthlyComposition"] | undefined,
  trend8Months: MonthlyComp[]
): SmartInsight[] {
  const hasMultipleExpenseMonths = shouldShowTrendChart(trend8Months, "expense");

  return insights
    .filter((ins) => {
      // BUG 3: Sembunyikan "Puncak Pengeluaran" bila data pengeluaran < 2 bulan
      if (ins.id === "peak-expense-month" && !hasMultipleExpenseMonths) {
        return false;
      }
      return true;
    })
    .map((ins) => {
      let updated = ins;

      // BUG 1: Jangan tampilkan pujian positif 0% atau saat pemasukan periode = 0
      if (ins.id === "savings-habit-good") {
        if (!comp || comp.totalIncome <= 0) {
          updated = {
            ...ins,
            type: "info",
            title: "Porsi tabungan belum dihitung",
            description:
              "Belum ada pemasukan tercatat bulan ini, jadi porsi tabungan belum bisa dihitung.",
            badge: undefined,
          };
        } else if (
          comp.savingsPct <= 0 ||
          comp.totalSavings <= 0 ||
          /\b0%/.test(ins.description)
        ) {
          updated = {
            ...ins,
            type: "info",
            title: "Alokasi tabungan",
            description:
              comp.totalSavings > 0
                ? "Kamu sudah menyisihkan tabungan bulan ini, tetapi porsinya masih di bawah 1% atau terpakai pengeluaran."
                : "Belum ada yang disisihkan bulan ini.",
            badge: comp.totalSavings > 0 ? "<1%" : undefined,
          };
        }
      }

      return {
        ...updated,
        title: normalizeRpInText(updated.title),
        description: normalizeRpInText(updated.description),
        badge: updated.badge ? normalizeRpInText(updated.badge) : undefined,
      };
    });
}

export interface CompositionDisplayState {
  mode: "no_income" | "overspent" | "normal";
  showPercentages: boolean;
  isOverspent: boolean;
  barWidths: {
    expense: number;
    savings: number;
    remaining: number;
  };
}

/**
 * BUG 2 & 10: Guard tampilan komposisi Pengeluaran vs Pemasukan saat pemasukan = 0
 * atau ketika pengeluaran + tabungan melebihi pemasukan.
 */
export function evaluateCompositionDisplay(
  comp: StatisticsData["monthlyComposition"] | undefined
): CompositionDisplayState {
  if (!comp || comp.totalIncome <= 0) {
    return {
      mode: "no_income",
      showPercentages: false,
      isOverspent: false,
      barWidths: { expense: 0, savings: 0, remaining: 0 },
    };
  }

  const totalOutflow = comp.totalExpense + comp.totalSavings;
  if (totalOutflow > comp.totalIncome) {
    const expW = totalOutflow > 0 ? Math.round((comp.totalExpense / totalOutflow) * 100) : 0;
    const savW = Math.max(0, 100 - expW);
    return {
      mode: "overspent",
      showPercentages: false,
      isOverspent: true,
      barWidths: {
        expense: expW,
        savings: savW,
        remaining: 0,
      },
    };
  }

  return {
    mode: "normal",
    showPercentages: true,
    isOverspent: false,
    barWidths: {
      expense: comp.expensePct,
      savings: comp.savingsPct,
      remaining: comp.remainingPct,
    },
  };
}
