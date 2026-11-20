"use client";

import React, { useState, useEffect, useTransition } from "react";
import { formatRupiah } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Target,
  Flame,
  Tag,
  Sparkles,
  Receipt,
  Layers,
  HelpCircle,
  Lightbulb,
  ShieldCheck,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  getStatisticsDataAction,
  StatisticsData,
  MonthlyComp,
} from "@/app/actions/statistics";

export default function StatisticsPage() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [type, setType] = useState<"expense" | "income" | "savings">("expense");
  const [trendType, setTrendType] = useState<"expense" | "income">("expense");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [statsData, setStatsData] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  // Load statistics data
  const loadData = (p: "month" | "year", mKey: string, y: number, t: "expense" | "income" | "savings") => {
    startTransition(async () => {
      try {
        const res = await getStatisticsDataAction({
          period: p,
          monthKey: mKey || undefined,
          year: y || undefined,
          type: t,
        });
        if (res.success && res.data) {
          setStatsData(res.data);
          if (!selectedMonthKey) {
            setSelectedMonthKey(res.data.selectedMonthKey);
          }
        }
      } catch (err) {
        console.error("Gagal memuat statistik:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    setIsMounted(true);
    const today = new Date();
    const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonthKey(curMonthKey);
    loadData("month", curMonthKey, today.getFullYear(), "expense");
  }, []);

  const handlePeriodChange = (newPeriod: "month" | "year") => {
    setPeriod(newPeriod);
    loadData(newPeriod, selectedMonthKey, selectedYear, type);
  };

  const handleTypeChange = (newType: "expense" | "income" | "savings") => {
    setType(newType);
    loadData(period, selectedMonthKey, selectedYear, newType);
  };

  const handlePrevPeriod = () => {
    if (period === "month") {
      const [yStr, mStr] = selectedMonthKey.split("-");
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10) - 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      const newKey = `${y}-${String(m).padStart(2, "0")}`;
      setSelectedMonthKey(newKey);
      loadData(period, newKey, y, type);
    } else {
      const newY = selectedYear - 1;
      setSelectedYear(newY);
      loadData(period, selectedMonthKey, newY, type);
    }
  };

  const handleNextPeriod = () => {
    if (!statsData?.canGoNext) return;
    if (period === "month") {
      const [yStr, mStr] = selectedMonthKey.split("-");
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10) + 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      const newKey = `${y}-${String(m).padStart(2, "0")}`;
      setSelectedMonthKey(newKey);
      loadData(period, newKey, y, type);
    } else {
      const newY = selectedYear + 1;
      setSelectedYear(newY);
      loadData(period, selectedMonthKey, newY, type);
    }
  };

  const handleResetToCurrent = () => {
    const today = new Date();
    const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const curYear = today.getFullYear();
    setSelectedMonthKey(curMonthKey);
    setSelectedYear(curYear);
    loadData(period, curMonthKey, curYear, type);
  };

  const categories = statsData?.statsCategories || [];
  const topCategory = statsData?.topCategory;
  const comp = statsData?.monthlyComposition;
  const trend8Months = statsData?.trend8Months || [];
  const topCategoriesRanking = statsData?.topCategoriesRanking || [];
  const otherNeeds = statsData?.otherNeedsBreakdown || [];
  const topTransactions = statsData?.topTransactions || [];
  const smartInsights = statsData?.smartInsights || [];

  const displayTotal =
    type === "expense"
      ? statsData?.totalExpense || 0
      : type === "income"
      ? statsData?.totalIncome || 0
      : statsData?.totalSavings || 0;

  // Active month trend point
  const activeTrendPoint = trend8Months.find((t) => t.isCurrent);

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-4">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Statistik Keuangan
        </h1>
        <p className="text-xs text-muted-foreground">
          Analisis alokasi, tren 8 bulan, dan evaluasi uang sakumu
        </p>
      </div>

      {/* 2. Global Period Navigation & Segmented Toggle (MonthPicker 7.3 & PRD G3) */}
      <section className="bg-card border border-border rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Previous / Label / Next */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevPeriod}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Periode Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>

            <div className="flex items-center gap-2 px-1">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span className="text-sm font-extrabold text-foreground">
                {statsData?.displayPeriodLabel || "Memuat..."}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextPeriod}
              disabled={!statsData?.canGoNext}
              className={`p-1.5 rounded-lg transition-colors ${
                statsData?.canGoNext
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  : "text-muted-foreground/30 cursor-not-allowed"
              }`}
              aria-label="Periode Berikutnya"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Right: Bulan | Tahun Segmented Toggle */}
          <div className="inline-flex p-0.5 bg-muted rounded-full text-xs font-semibold">
            <button
              type="button"
              onClick={() => handlePeriodChange("month")}
              className={`px-3 py-1 rounded-full transition-all text-xs font-bold ${
                period === "month"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bulan
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("year")}
              className={`px-3 py-1 rounded-full transition-all text-xs font-bold ${
                period === "year"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tahun
            </button>
          </div>
        </div>

        {/* Quick jump to current month if navigated away */}
        {statsData && statsData.canGoNext && (
          <div className="pt-2 border-t border-border/40 flex justify-end">
            <button
              type="button"
              onClick={handleResetToCurrent}
              className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
            >
              Kembali ke Bulan Sekarang
            </button>
          </div>
        )}
      </section>

      {/* 3. Transaction Type Selector Tabs (PRD G3: Pengeluaran / Pemasukan / Tabungan) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleTypeChange("expense")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
            type === "expense"
              ? "bg-expense/10 border-expense text-foreground"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-expense shrink-0" />
          <span>Pengeluaran</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("income")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
            type === "income"
              ? "bg-accent/10 border-accent text-foreground"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
          <span>Pemasukan</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("savings")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
            type === "savings"
              ? "bg-[#FFB04A]/10 border-[#FFB04A] text-foreground"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFB04A] shrink-0" />
          <span>Tabungan</span>
        </button>
      </div>

      {/* 4. Donut Chart Card with Central Metric & Legenda (PRD G2, G3 & DESIGN 8.1) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Total {type === "expense" ? "Pengeluaran" : type === "income" ? "Pemasukan" : "Tabungan Terkumpul"}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-0.5 tracking-tight">
              {isLoading || isPending ? "..." : formatRupiah(displayTotal)}
            </div>
          </div>

          <div
            className={`p-2.5 rounded-xl ${
              type === "expense"
                ? "bg-expense/15 text-expense"
                : type === "income"
                ? "bg-accent/15 text-accent"
                : "bg-[#FFB04A]/15 text-[#FFB04A]"
            }`}
          >
            {type === "expense" ? (
              <TrendingDown className="w-5 h-5 stroke-[2.5]" />
            ) : type === "income" ? (
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <Target className="w-5 h-5 stroke-[2.5]" />
            )}
          </div>
        </div>

        {/* Donut Chart with Dynamic Central Label */}
        <div className="relative w-full h-52 flex items-center justify-center">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-3">
              <span className="text-4xl font-black text-muted-foreground/30">0%</span>
              <p className="text-xs font-bold text-muted-foreground mt-2">
                Belum ada data {type === "expense" ? "pengeluaran" : type === "income" ? "pemasukan" : "tabungan"}
              </p>
              <p className="text-[11px] text-muted-foreground/70 max-w-[200px]">
                {type === "expense"
                  ? "Catat pengeluaran harianmu untuk melihat sebaran porsi"
                  : type === "income"
                  ? "Atur uang kiriman atau catat pemasukan baru"
                  : "Mulai sisihkan uang ke target tabungan impianmu"}
              </p>
            </div>
          ) : (
            <>
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="value"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={4}
                      cornerRadius={6}
                      stroke="none"
                    >
                      {categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border px-3 py-2 rounded-xl shadow-xl text-xs font-bold text-foreground">
                              <p className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: data.color }}
                                />
                                {data.name}
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                {formatRupiah(data.amount)} ({data.value}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {/* Central Metric in Donut Ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black tracking-tight text-foreground">
                  {topCategory?.percentage || 0}%
                </span>
                <span className="text-[11px] font-bold text-muted-foreground truncate max-w-[100px] text-center">
                  {topCategory?.name || "-"}
                </span>
                <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider font-semibold">
                  Terbesar
                </span>
              </div>
            </>
          )}
        </div>

        {/* Legend Grid with Category, Percentage, and Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-border/60">
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center col-span-2 py-2">
              Tidak ada data kategori di periode ini
            </p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/40 text-xs font-semibold"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="truncate">
                    <span className="text-foreground font-bold block truncate">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {cat.count} transaksi • {formatRupiah(cat.amount)}
                    </span>
                  </div>
                </div>
                <span className="text-foreground font-black shrink-0 text-sm">{cat.value}%</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 5. Smart Insights Otomatis (PRD G9) */}
      {smartInsights.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 shadow-md space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-extrabold text-foreground tracking-tight">
              Insight Cerdas Keuangan
            </h2>
          </div>

          <div className="space-y-2.5">
            {smartInsights.map((insight) => (
              <div
                key={insight.id}
                className="p-3 rounded-lg border bg-background/60 border-border/60 flex items-start gap-3"
              >
                <div
                  className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                    insight.type === "positive"
                      ? "bg-accent/15 text-accent"
                      : insight.type === "warning"
                      ? "bg-expense/15 text-expense"
                      : "bg-blue-500/15 text-blue-400"
                  }`}
                >
                  {insight.type === "positive" ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : insight.type === "warning" ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <Lightbulb className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{insight.title}</span>
                    {insight.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {insight.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Grafik Komposisi Bulan (PRD G4: Pemasukan vs Pengeluaran vs Tabungan) */}
      {comp && (
        <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
                Komposisi Alokasi Uang
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Proporsi pengeluaran dan tabungan terhadap pemasukan
              </p>
            </div>
            <Layers className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Stacked Composition Progress Bar */}
          <div className="w-full h-4 bg-muted rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${comp.expensePct}%` }}
              className="h-full bg-expense transition-all duration-500"
              title={`Pengeluaran ${comp.expensePct}%`}
            />
            <div
              style={{ width: `${comp.savingsPct}%` }}
              className="h-full bg-[#FFB04A] transition-all duration-500"
              title={`Tabungan ${comp.savingsPct}%`}
            />
            <div
              style={{ width: `${comp.remainingPct}%` }}
              className="h-full bg-accent transition-all duration-500"
              title={`Sisa Saldo ${comp.remainingPct}%`}
            />
          </div>

          {/* 3 Metric Summary Boxes */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
              <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                <span className="w-2 h-2 rounded-full bg-expense shrink-0" />
                Pengeluaran
              </span>
              <p className="text-xs sm:text-sm font-extrabold text-foreground mt-1">
                {comp.expensePct}%
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold truncate">
                {formatRupiah(comp.totalExpense)}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
              <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                <span className="w-2 h-2 rounded-full bg-[#FFB04A] shrink-0" />
                Tabungan
              </span>
              <p className="text-xs sm:text-sm font-extrabold text-foreground mt-1">
                {comp.savingsPct}%
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold truncate">
                {formatRupiah(comp.totalSavings)}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
              <span className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                Sisa Saldo
              </span>
              <p className="text-xs sm:text-sm font-extrabold text-foreground mt-1">
                {comp.remainingPct}%
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold truncate">
                {formatRupiah(comp.remainingBalance)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 7. Tren 8 Bulan Terakhir dengan Gelembung Nilai (PRD G5 & DESIGN 8.2) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
                Tren 8 Bulan Terakhir
              </h2>
              {statsData?.highestExpenseMonth && trendType === "expense" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-expense/15 text-expense flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  <span>{statsData.highestExpenseMonth.month} Terboros</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Riwayat fluktuasi finansial dari waktu ke waktu
            </p>
          </div>

          {/* Sub-toggle: Pengeluaran vs Pemasukan */}
          <div className="inline-flex p-0.5 bg-muted rounded-lg self-start sm:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTrendType("expense")}
              className={`px-3 py-1 rounded-md transition-all text-xs font-bold ${
                trendType === "expense"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setTrendType("income")}
              className={`px-3 py-1 rounded-md transition-all text-xs font-bold ${
                trendType === "income"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pemasukan
            </button>
          </div>
        </div>

        {/* Current Active Month Value Bubble */}
        {activeTrendPoint && (
          <div className="p-3 rounded-lg bg-background/50 border border-border/40 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">
              {trendType === "expense" ? "Pengeluaran" : "Pemasukan"} Bulan Ini ({activeTrendPoint.month})
            </span>
            <span className="text-sm font-black text-accent">
              {formatRupiah(trendType === "expense" ? activeTrendPoint.expense : activeTrendPoint.income)}
            </span>
          </div>
        )}

        {/* Area / Wave Chart with Monotone Bezier Curve (DESIGN 8.2) */}
        <div className="h-48 w-full pt-2">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend8Months}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={trendType === "expense" ? "#FF7B7B" : "#D4FF5A"}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={trendType === "expense" ? "#FF7B7B" : "#D4FF5A"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(255, 255, 255, 0.1)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as MonthlyComp;
                      const val = trendType === "expense" ? data.expense : data.income;
                      return (
                        <div className="bg-popover border border-border rounded-xl p-2.5 shadow-xl text-xs font-bold text-foreground">
                          <p className="text-[11px] text-muted-foreground">{data.month} {data.year}</p>
                          <p className="text-sm font-black mt-0.5">{formatRupiah(val)}</p>
                          {trendType === "expense" && data.isHighestExpense && val > 0 && (
                            <span className="text-[10px] font-bold text-expense flex items-center gap-1 mt-1">
                              <Flame className="w-3 h-3" /> Bulan Terboros
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={trendType}
                  stroke={trendType === "expense" ? "#FF7B7B" : "#D4FF5A"}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#trendGradient)"
                  dot={(props: { cx?: number; cy?: number; payload?: MonthlyComp; index?: number }) => {
                    const isCur = props.payload?.isCurrent;
                    const isHigh = trendType === "expense" ? props.payload?.isHighestExpense : props.payload?.isHighestIncome;
                    if (isCur || isHigh) {
                      return (
                        <circle
                          key={`dot-${props.index}`}
                          cx={props.cx || 0}
                          cy={props.cy || 0}
                          r={5}
                          fill={isHigh ? "#FF7B7B" : "#D4FF5A"}
                          stroke="#1E1E1E"
                          strokeWidth={2}
                        />
                      );
                    }
                    return <circle key={`dot-${props.index}`} cx={props.cx || 0} cy={props.cy || 0} r={2} fill="#8A8A8A" />;
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 8. Peringkat 5 Kategori Pengeluaran Teratas (PRD G6 & DESIGN 8.3) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <h2 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
          Peringkat Pengeluaran Terbanyak
        </h2>

        {topCategoriesRanking.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Belum ada transaksi pengeluaran di periode ini.
          </p>
        ) : (
          <div className="space-y-3.5">
            {topCategoriesRanking.map((cat, idx) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2 text-foreground font-bold">
                    <span className="w-5 text-muted-foreground font-extrabold text-[11px]">
                      #{idx + 1}
                    </span>
                    <Tag className="w-3.5 h-3.5" style={{ color: cat.color }} />
                    <span className="truncate max-w-[140px] sm:max-w-xs">{cat.name}</span>
                  </span>
                  <span className="text-foreground font-black">
                    {formatRupiah(cat.amount)}{" "}
                    <span className="text-muted-foreground font-normal">({cat.value}%)</span>
                  </span>
                </div>

                {/* Horizontal Progress Bar */}
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${cat.value}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 9. Breakdown Kebutuhan Lain (PRD G7: 5 Keterangan Teratas) */}
      {otherNeeds.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
                Rincian Kebutuhan Lain
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                5 keterangan kustom teratas yang kamu catat
              </p>
            </div>
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="space-y-2.5">
            {otherNeeds.map((item, idx) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/40 text-xs font-semibold"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="w-4 text-center font-bold text-muted-foreground text-[11px]">
                    {idx + 1}.
                  </span>
                  <div>
                    <span className="text-foreground font-bold block truncate">{item.name}</span>
                    <span className="text-[10px] text-muted-foreground">{item.count}x transaksi</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-foreground font-black block">{formatRupiah(item.amount)}</span>
                  <span className="text-[10px] text-muted-foreground">{item.percentage}% dari pos lain</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 10. Daftar 5 Transaksi Pengeluaran Terbesar (PRD G8) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
              5 Transaksi Terbesar
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transaksi tunggal paling memakan saldo di periode ini
            </p>
          </div>
          <Receipt className="w-4 h-4 text-muted-foreground" />
        </div>

        {topTransactions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Belum ada data transaksi di periode ini.
          </p>
        ) : (
          <div className="space-y-2">
            {topTransactions.map((tx, idx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/40 text-xs font-semibold"
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <span className="w-5 text-center font-black text-muted-foreground text-xs shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <p className="text-foreground font-bold truncate text-xs sm:text-sm">
                      {tx.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span
                        className="px-1.5 py-0.2 rounded font-bold"
                        style={{ backgroundColor: `${tx.categoryColor}22`, color: tx.categoryColor }}
                      >
                        {tx.categoryName}
                      </span>
                      <span>•</span>
                      <span>{tx.occurredOn}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-expense font-black text-xs sm:text-sm">
                    -{formatRupiah(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
