import test from "node:test";
import assert from "node:assert/strict";
import {
  formatStatRupiah,
  formatCompactStatRupiah,
  formatAxisRupiah,
  normalizeRpInText,
  formatStatShortDate,
  isSameTitleAndCategory,
  shouldShowTrendChart,
  prepareInsightsForDisplay,
  evaluateCompositionDisplay,
} from "./_lib/stat-guards";
import type { MonthlyComp, SmartInsight } from "@/app/actions/statistics";

function makeTrend(expenses: number[], incomes?: number[]): MonthlyComp[] {
  return expenses.map((expense, i) => ({
    key: `2026-${String(i + 4).padStart(2, "0")}`,
    month: `B${i + 4}`,
    year: 2026,
    expense,
    income: incomes ? incomes[i] || 0 : 0,
    savings: 0,
    isCurrent: i === expenses.length - 1,
    isHighestExpense: expense > 0 && expense === Math.max(...expenses),
    isHighestIncome: false,
  }));
}

test("BUG 1 & BUG 3 & BUG 7: Guard insight 0%, pemasukan 0, Puncak Pengeluaran < 2 bulan, dan format Rp", () => {
  const singleMonthTrend = makeTrend([0, 0, 0, 0, 0, 0, 0, 2_217_650]);
  assert.equal(shouldShowTrendChart(singleMonthTrend, "expense"), false);

  const twoMonthsTrend = makeTrend([0, 0, 0, 0, 0, 0, 500_000, 2_217_650]);
  assert.equal(shouldShowTrendChart(twoMonthsTrend, "expense"), true);

  const rawInsights: SmartInsight[] = [
    {
      id: "savings-habit-good",
      type: "positive",
      title: "Alokasi Tabungan Sehat",
      description: "Bagus! Kamu berhasil menyisihkan 0% dari total pemasukan ke pos tabungan impianmu.",
      badge: "0% Disisihkan",
    },
    {
      id: "peak-expense-month",
      type: "neutral",
      title: "Puncak Pengeluaran",
      description: "Pengeluaran tertinggi dalam 8 bulan terakhir tercatat pada Nov 2026 sebesar Rp 2.217.650.",
      badge: "Riwayat 8 Bulan",
    },
  ];

  // Kasus pemasukan 0 + hanya 1 bulan ada data pengeluaran
  const guardedNoIncome = prepareInsightsForDisplay(
    rawInsights,
    {
      totalIncome: 0,
      totalExpense: 2_217_650,
      totalSavings: 17_208,
      remainingBalance: 0,
      expensePct: 100,
      savingsPct: 0,
      remainingPct: 0,
    },
    singleMonthTrend
  );

  assert.equal(guardedNoIncome.length, 1); // peak-expense-month disembunyikan
  assert.equal(guardedNoIncome[0].type, "info");
  assert.ok(!guardedNoIncome[0].description.includes("Bagus!"));
  assert.ok(guardedNoIncome[0].description.includes("Belum ada pemasukan"));

  // Kasus pemasukan > 0 tapi savingsPct 0%, dan ada 2 bulan data
  const guardedZeroPct = prepareInsightsForDisplay(
    rawInsights,
    {
      totalIncome: 2_000_000,
      totalExpense: 2_217_650,
      totalSavings: 17_208,
      remainingBalance: 0,
      expensePct: 100,
      savingsPct: 0,
      remainingPct: 0,
    },
    twoMonthsTrend
  );

  assert.equal(guardedZeroPct.length, 2);
  assert.equal(guardedZeroPct[0].type, "info");
  assert.ok(!guardedZeroPct[0].description.includes("Bagus!"));
  assert.ok(guardedZeroPct[1].description.includes("Rp2.217.650"));
  assert.ok(!guardedZeroPct[1].description.includes("Rp 2.217.650"));
});

test("BUG 2: Guard komposisi saat pemasukan nol dan saat pengeluaran melebihi pemasukan", () => {
  const noIncome = evaluateCompositionDisplay({
    totalIncome: 0,
    totalExpense: 2_217_650,
    totalSavings: 17_208,
    remainingBalance: 0,
    expensePct: 100,
    savingsPct: 0,
    remainingPct: 0,
  });
  assert.equal(noIncome.mode, "no_income");
  assert.equal(noIncome.showPercentages, false);
  assert.equal(noIncome.isOverspent, false);

  const overspent = evaluateCompositionDisplay({
    totalIncome: 2_000_000,
    totalExpense: 2_217_650,
    totalSavings: 100_000,
    remainingBalance: 0,
    expensePct: 100,
    savingsPct: 0,
    remainingPct: 0,
  });
  assert.equal(overspent.mode, "overspent");
  assert.equal(overspent.showPercentages, false);
  assert.equal(overspent.isOverspent, true);

  const normal = evaluateCompositionDisplay({
    totalIncome: 3_000_000,
    totalExpense: 1_500_000,
    totalSavings: 500_000,
    remainingBalance: 1_000_000,
    expensePct: 50,
    savingsPct: 17,
    remainingPct: 33,
  });
  assert.equal(normal.mode, "normal");
  assert.equal(normal.showPercentages, true);
  assert.equal(normal.isOverspent, false);
  assert.equal(normal.barWidths.expense, 50);
});

test("BUG 4, BUG 5, & BUG 7: Format tanggal pendek, deteksi judul=kategori, dan format Rp", () => {
  assert.equal(formatStatShortDate("2026-11-19", 2026), "19 Nov");
  assert.equal(formatStatShortDate("2025-12-31", 2026), "31 Des 2025");

  assert.equal(isSameTitleAndCategory("Listrik", "Listrik"), true);
  assert.equal(isSameTitleAndCategory("kuota & internet", "Kuota & Internet"), true);
  assert.equal(isSameTitleAndCategory("Warteg Bahari", "Makan"), false);

  assert.equal(formatAxisRupiah(0), "Rp0");
  assert.equal(formatAxisRupiah(600_000), "Rp600rb");
  assert.equal(formatAxisRupiah(1_200_000), "Rp1,2jt");
  assert.equal(formatAxisRupiah(2_400_000), "Rp2,4jt");

  assert.equal(formatStatRupiah(2_217_650), "Rp2.217.650");
  assert.equal(formatStatRupiah(200_000, "minus"), "-Rp200.000");
  assert.equal(formatCompactStatRupiah(540_000), "Rp540rb");
  assert.equal(normalizeRpInText("Sebesar Rp 2.217.650"), "Sebesar Rp2.217.650");
});
