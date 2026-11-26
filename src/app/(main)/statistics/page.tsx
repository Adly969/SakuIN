"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Flame,
  Sparkles,
  Lightbulb,
  ShieldCheck,
  AlertTriangle,
  SlidersHorizontal,
  Plus,
  Lock,
  ArrowRightLeft,
  Wallet,
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
import {
  getCategoryBudgetsAction,
  type CategoryBudgetItem,
  type CategoryPotsSummaryMeta,
} from "@/app/actions/category-budgets";
import type { PotTransferLogItem } from "@/app/actions/category-pots";
import { ShiftPotModal } from "@/components/budgets/shift-pot-modal";
import { getOfflineQueue } from "@/lib/offline-queue";
import {
  aggregatePendingOfflineSpentByCategory,
  evaluatePotUsage,
  resolvePotCategoryKey,
} from "@/lib/category-pots";
import { getJakartaCalendarParts, getJakartaDateString } from "@/lib/finance";
import {
  formatStatRupiah,
  formatCompactStatRupiah,
  formatAxisRupiah,
  formatStatShortDate,
  isSameTitleAndCategory,
  shouldShowTrendChart,
  prepareInsightsForDisplay,
  evaluateCompositionDisplay,
} from "./_lib/stat-guards";

export default function StatisticsPage() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [type, setType] = useState<"expense" | "income" | "savings">("expense");
  const [trendType, setTrendType] = useState<"expense" | "income">("expense");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(() => getJakartaCalendarParts().year);

  const [statsData, setStatsData] = useState<StatisticsData | null>(null);
  const [catBudgets, setCatBudgets] = useState<CategoryBudgetItem[]>([]);
  const [catSummary, setCatSummary] = useState<CategoryPotsSummaryMeta | null>(null);
  const [recentTransfers, setRecentTransfers] = useState<PotTransferLogItem[]>([]);
  const [pendingOfflineByCat, setPendingOfflineByCat] = useState<Record<string, number>>({});
  const [highlightedPos, setHighlightedPos] = useState<string>("");
  const [pendingAutoShift, setPendingAutoShift] = useState<boolean>(false);
  const [shiftModalOpen, setShiftModalOpen] = useState<boolean>(false);
  const [shiftTargetCategoryId, setShiftTargetCategoryId] = useState<string | undefined>(undefined);
  const [shiftToast, setShiftToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  // Pure UI disclosure states
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [showAllPots, setShowAllPots] = useState(false);
  const [isOtherExpanded, setIsOtherExpanded] = useState(false);

  // Instant Cache Hydration on initial mount (0ms delay)
  useEffect(() => {
    setIsMounted(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const posParam = params.get("pos");
      const shiftParam = params.get("shift");
      if (posParam) {
        setHighlightedPos(resolvePotCategoryKey(posParam));
      }
      if (shiftParam === "1") {
        setPendingAutoShift(true);
      }
    } catch {}

    const { year: curYear, monthKey: curMonthKey } = getJakartaCalendarParts();
    setSelectedMonthKey(curMonthKey);

    let hasCache = false;
    try {
      const cached = localStorage.getItem("sakuin_cached_statistics");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          setStatsData(parsed);
          setIsLoading(false);
          hasCache = true;
        }
      }
    } catch {}

    loadData("month", curMonthKey, curYear, "expense", hasCache);

    const handleRefreshStats = () => {
      const latest = getJakartaCalendarParts();
      loadData("month", latest.monthKey, latest.year, "expense", true);
    };
    const handleVisibilityStats = () => {
      if (document.visibilityState === "visible") handleRefreshStats();
    };
    window.addEventListener("sakuin:sync-complete", handleRefreshStats);
    window.addEventListener("sakuin:data-invalidated", handleRefreshStats);
    document.addEventListener("visibilitychange", handleVisibilityStats);
    return () => {
      window.removeEventListener("sakuin:sync-complete", handleRefreshStats);
      window.removeEventListener("sakuin:data-invalidated", handleRefreshStats);
      document.removeEventListener("visibilitychange", handleVisibilityStats);
    };
  }, []);

  useEffect(() => {
    const syncPendingQueue = () => {
      if (!catSummary?.isCurrentView) {
        setPendingOfflineByCat({});
        return;
      }
      const todayStr = getJakartaDateString();
      setPendingOfflineByCat(
        aggregatePendingOfflineSpentByCategory(
          getOfflineQueue(),
          catSummary.periodStart,
          catSummary.periodEnd,
          todayStr
        )
      );
    };
    syncPendingQueue();
    window.addEventListener("sakuin:offline-queue-changed", syncPendingQueue);
    window.addEventListener("sakuin:sync-complete", syncPendingQueue);
    return () => {
      window.removeEventListener("sakuin:offline-queue-changed", syncPendingQueue);
      window.removeEventListener("sakuin:sync-complete", syncPendingQueue);
    };
  }, [catSummary?.isCurrentView, catSummary?.periodStart, catSummary?.periodEnd]);

  useEffect(() => {
    if (!highlightedPos || catBudgets.length === 0) return;
    setShowAllPots(true);
    const timer = setTimeout(() => {
      const target =
        document.getElementById(`pos-${highlightedPos.replace(/\s+/g, "-")}`) ||
        document.getElementById("ringkasan-pos");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });

      if (pendingAutoShift) {
        const matched = catBudgets.find(
          (b) => resolvePotCategoryKey(b.categoryName) === highlightedPos
        );
        if (matched) {
          setShiftTargetCategoryId(matched.categoryId);
          setShiftModalOpen(true);
        }
        setPendingAutoShift(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [highlightedPos, pendingAutoShift, catBudgets]);

  // Load statistics data
  const loadData = (
    p: "month" | "year",
    mKey: string,
    y: number,
    t: "expense" | "income" | "savings",
    silent = false
  ) => {
    if (!silent) setIsLoading(true);
    startTransition(async () => {
      try {
        const [res, catBudgetRes] = await Promise.all([
          getStatisticsDataAction({
            period: p,
            monthKey: mKey || undefined,
            year: y || undefined,
            type: t,
          }),
          getCategoryBudgetsAction(mKey || undefined),
        ]);
        if (res.success && res.data) {
          setStatsData(res.data);
          if (!selectedMonthKey) {
            setSelectedMonthKey(res.data.selectedMonthKey);
          }
          if (p === "month" && t === "expense") {
            try {
              localStorage.setItem("sakuin_cached_statistics", JSON.stringify(res.data));
            } catch {}
          }
        }
        if (catBudgetRes.success && catBudgetRes.data) {
          setCatBudgets(catBudgetRes.data.items);
          setCatSummary(catBudgetRes.data.summary ?? null);
          setRecentTransfers(catBudgetRes.data.recentTransfers ?? []);
        }
      } catch (err) {
        console.error("Gagal memuat statistik:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handlePeriodChange = (newPeriod: "month" | "year") => {
    setPeriod(newPeriod);
    setShowAllCategories(false);
    loadData(newPeriod, selectedMonthKey, selectedYear, type);
  };

  const handleTypeChange = (newType: "expense" | "income" | "savings") => {
    setType(newType);
    setShowAllCategories(false);
    loadData(period, selectedMonthKey, selectedYear, newType);
  };

  const handlePrevPeriod = () => {
    setShowAllCategories(false);
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
    setShowAllCategories(false);
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
    const { year: curYear, monthKey: curMonthKey } = getJakartaCalendarParts();
    setSelectedMonthKey(curMonthKey);
    setSelectedYear(curYear);
    setShowAllCategories(false);
    loadData(period, curMonthKey, curYear, type);
  };

  const categories = statsData?.statsCategories || [];
  const topCategory = statsData?.topCategory;
  const comp = statsData?.monthlyComposition;
  const trend8Months = statsData?.trend8Months || [];
  const otherNeeds = statsData?.otherNeedsBreakdown || [];
  const topTransactions = statsData?.topTransactions || [];
  const smartInsights = statsData?.smartInsights || [];

  const displayTotal =
    type === "expense"
      ? statsData?.totalExpense || 0
      : type === "income"
      ? statsData?.totalIncome || 0
      : statsData?.totalSavings || 0;

  const activeTrendPoint = trend8Months.find((t) => t.isCurrent);
  const referenceYear = statsData?.selectedYear || selectedYear;

  const displayedInsights = prepareInsightsForDisplay(smartInsights, comp, trend8Months);
  const visibleInsights = showAllInsights ? displayedInsights : displayedInsights.slice(0, 3);
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 5);
  const visiblePots = showAllPots ? catBudgets : catBudgets.slice(0, 3);
  const showTrendGraph = shouldShowTrendChart(trend8Months, trendType);
  const compState = evaluateCompositionDisplay(comp);

  const isPeriodCompletelyEmpty =
    !isLoading &&
    !isPending &&
    statsData !== null &&
    statsData.totalExpense === 0 &&
    statsData.totalIncome === 0 &&
    statsData.totalSavings === 0 &&
    categories.length === 0;

  const totalTypeLabel =
    type === "expense"
      ? "Total pengeluaran"
      : type === "income"
      ? "Total pemasukan"
      : "Total tabungan";

  const controlSection = (
    <section className="bg-card border border-border rounded-2xl p-3 shadow-sm space-y-2">
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handlePrevPeriod}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center shrink-0"
            aria-label="Periode Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <span className="text-sm font-extrabold text-foreground whitespace-nowrap px-1">
            {statsData?.displayPeriodLabel || "Memuat..."}
          </span>

          <button
            type="button"
            onClick={handleNextPeriod}
            disabled={!statsData?.canGoNext}
            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl transition-colors flex items-center justify-center shrink-0 ${
              statsData?.canGoNext
                ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                : "text-muted-foreground/30 cursor-not-allowed"
            }`}
            aria-label="Periode Berikutnya"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        <div
          role="group"
          aria-label="Pilih rentang periode"
          className="inline-flex p-0.5 bg-muted rounded-xl shrink-0 ml-auto"
        >
          <button
            type="button"
            onClick={() => handlePeriodChange("month")}
            aria-pressed={period === "month"}
            className={`px-3 min-h-[44px] rounded-lg transition-all text-xs font-bold whitespace-nowrap ${
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
            aria-pressed={period === "year"}
            className={`px-3 min-h-[44px] rounded-lg transition-all text-xs font-bold whitespace-nowrap ${
              period === "year"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tahun
          </button>
        </div>
      </div>

      {/* Pilihan Jenis: Pengeluaran | Pemasukan | Tabungan */}
      <div
        role="group"
        aria-label="Pilih jenis transaksi"
        className="grid grid-cols-3 p-1 bg-muted rounded-xl gap-1"
      >
        <button
          type="button"
          onClick={() => handleTypeChange("expense")}
          aria-pressed={type === "expense"}
          className={`flex items-center justify-center gap-1.5 px-1.5 min-h-[44px] rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            type === "expense"
              ? "bg-card text-foreground shadow-xs font-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-expense shrink-0" />
          <span>Pengeluaran</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("income")}
          aria-pressed={type === "income"}
          className={`flex items-center justify-center gap-1.5 px-1.5 min-h-[44px] rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            type === "income"
              ? "bg-card text-foreground shadow-xs font-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[var(--accent-border)] dark:bg-accent shrink-0" />
          <span>Pemasukan</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("savings")}
          aria-pressed={type === "savings"}
          className={`flex items-center justify-center gap-1.5 px-1.5 min-h-[44px] rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            type === "savings"
              ? "bg-card text-foreground shadow-xs font-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#FFB04A] shrink-0" />
          <span>Tabungan</span>
        </button>
      </div>

      {statsData && statsData.canGoNext && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleResetToCurrent}
            className="text-xs font-bold text-[color:var(--accent-text)] hover:underline px-2 min-h-[44px] inline-flex items-center"
          >
            Kembali ke periode sekarang
          </button>
        </div>
      )}
    </section>
  );

  const summarySection = (
    <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
      <div>
        <span className="text-xs font-semibold text-muted-foreground block">
          {totalTypeLabel}
        </span>
        <div className="text-[28px] sm:text-[32px] leading-tight font-black text-foreground mt-0.5 tracking-tight tabular-nums whitespace-nowrap">
          {isLoading || isPending ? "..." : formatStatRupiah(displayTotal)}
        </div>
      </div>

      {/* Donut 160-180px dengan label tengah 2 baris */}
      <div className="relative w-full h-[176px] flex items-center justify-center">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-2 space-y-2">
            <span className="text-3xl font-black text-muted-foreground/30 tabular-nums">0%</span>
            <p className="text-xs font-bold text-muted-foreground">
              Belum ada data {type === "expense" ? "pengeluaran" : type === "income" ? "pemasukan" : "tabungan"}
            </p>
            <Link
              href={type === "savings" ? "/savings" : "/record"}
              className="inline-flex items-center gap-1.5 bg-accent text-[#1F1F1F] font-black text-xs px-4 min-h-[44px] rounded-full shadow-xs hover:brightness-105 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>
                {type === "expense"
                  ? "Catat pengeluaran"
                  : type === "income"
                  ? "Catat pemasukan"
                  : "Buat target tabungan"}
              </span>
            </Link>
          </div>
        ) : (
          <>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={78}
                    paddingAngle={3}
                    cornerRadius={5}
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
                              <span>{data.name}</span>
                            </p>
                            <p className="text-muted-foreground mt-0.5 tabular-nums">
                              {formatStatRupiah(data.amount)} ({data.value}%)
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

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
              <span className="text-2xl font-black tracking-tight text-foreground tabular-nums leading-none">
                {topCategory?.percentage || 0}%
              </span>
              <span className="text-xs font-bold text-muted-foreground max-w-[96px] text-center line-clamp-2 leading-tight mt-1">
                {topCategory?.name || "-"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Daftar Kategori Terpadu (5 baris default + Lihat semua) */}
      {categories.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/60">
          {visibleCategories.map((cat) => {
            const barWidth = cat.value > 0 ? Math.min(100, Math.max(cat.value, 3)) : 0;
            return (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-foreground block truncate">
                        {cat.name}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        {cat.count} transaksi
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2.5 shrink-0 text-right">
                    <span className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
                      {formatStatRupiah(cat.amount)}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground tabular-nums w-9 text-right">
                      {cat.value}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            );
          })}

          {categories.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllCategories((prev) => !prev)}
              className="w-full min-h-[44px] rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-colors"
            >
              {showAllCategories
                ? "Tampilkan 5 teratas"
                : `Lihat semua (${categories.length} kategori)`}
            </button>
          )}
        </div>
      )}
    </section>
  );

  const insightsSection = displayedInsights.length > 0 && (
    <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[color:var(--accent-text)] shrink-0" />
        <h2 className="text-base font-semibold text-foreground tracking-tight">Sorotan</h2>
      </div>

      <div className="space-y-2.5">
        {visibleInsights.map((insight) => (
          <div
            key={insight.id}
            className="p-3 rounded-xl border border-border/70 bg-background/60 flex items-start gap-2.5"
          >
            <div
              className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                insight.type === "positive"
                  ? "bg-accent/15 text-[color:var(--accent-text)]"
                  : insight.type === "warning"
                  ? "bg-expense/15 text-[color:var(--expense-text)]"
                  : "bg-muted text-foreground border border-border/60"
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

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-bold text-foreground">{insight.title}</span>
                {insight.badge && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-foreground/85 shrink-0 whitespace-nowrap">
                    {insight.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
                {insight.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {displayedInsights.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAllInsights((prev) => !prev)}
          className="w-full min-h-[44px] rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-colors"
        >
          {showAllInsights
            ? "Tampilkan lebih sedikit"
            : `Lihat semua (${displayedInsights.length})`}
        </button>
      )}
    </section>
  );

  const potsSection = (
    <section
      id="ringkasan-pos"
      className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Jatah per pos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pengeluaran di kategori tanpa jatah dihitung ke Sisa Bebas.
          </p>
        </div>

        <Link
          href="/budgets"
          className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-full bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 transition-all shrink-0 whitespace-nowrap"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Atur jatah</span>
        </Link>
      </div>

      {shiftToast && (
        <div className="p-3 rounded-xl bg-accent/15 border border-[var(--accent-border)]/40 text-xs font-bold text-[color:var(--accent-text)]">
          {shiftToast}
        </div>
      )}

      {catSummary &&
        catBudgets.length > 0 &&
        (() => {
          const allocatedKeySet = new Set(
            catBudgets.map((b) => resolvePotCategoryKey(b.categoryName))
          );
          const pendingUnallocated = Object.entries(pendingOfflineByCat).reduce(
            (sum, [k, amt]) => (allocatedKeySet.has(k) ? sum : sum + amt),
            0
          );
          const totalUnallocatedSpent = catSummary.unallocatedSpent + pendingUnallocated;
          const liveFreeRemaining =
            Math.max(0, catSummary.freeRemainingBeforeUnallocated) - totalUnallocatedSpent;

          return (
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-background/70 border border-border/70 text-xs">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">
                  Total jatah
                </span>
                <span className="font-black text-foreground tabular-nums whitespace-nowrap">
                  {formatStatRupiah(catSummary.totalAllocated)}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">
                  Tanpa jatah
                </span>
                <span className="font-black text-foreground tabular-nums whitespace-nowrap">
                  {formatStatRupiah(totalUnallocatedSpent)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-muted-foreground block">
                  Sisa bebas
                </span>
                <span
                  className={`font-black tabular-nums whitespace-nowrap ${
                    catSummary.isOverAllocated || liveFreeRemaining < 0
                      ? "text-[color:var(--expense-text)]"
                      : "text-[color:var(--accent-text)]"
                  }`}
                >
                  {formatStatRupiah(liveFreeRemaining)}
                </span>
              </div>
            </div>
          );
        })()}

      {catBudgets.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-snug">
          Belum ada jatah bulan ini. Bagi uangmu ke beberapa pos supaya pengeluaran lebih terkontrol.
        </p>
      ) : (
        <div className="space-y-2.5">
          {visiblePots.map((item) => {
            const itemKey = resolvePotCategoryKey(item.categoryName);
            const pendingSpent = catSummary?.isCurrentView
              ? pendingOfflineByCat[itemKey] || 0
              : 0;
            const liveUsage = evaluatePotUsage(item.limitAmount, item.spent + pendingSpent);
            const isOver = liveUsage.status === "exceeded" || liveUsage.status === "reached";
            const isWarn = liveUsage.status === "warning";
            const isHighlighted = highlightedPos === itemKey;
            const statusText =
              liveUsage.status === "exceeded"
                ? "Melebihi"
                : liveUsage.status === "reached"
                ? "Habis"
                : isWarn
                ? "Waspada"
                : "Aman";

            return (
              <div
                key={item.categoryId}
                id={`pos-${itemKey.replace(/\s+/g, "-")}`}
                className={`p-3 rounded-xl bg-background/70 border space-y-2 transition-all ${
                  isHighlighted
                    ? "border-[var(--accent-border)] ring-2 ring-accent/60"
                    : "border-border/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-bold text-foreground truncate">
                      {item.categoryName}
                    </span>
                    {item.isLockedFromDaily && (
                      <Lock
                        className="w-3.5 h-3.5 text-[color:var(--warning-text)] shrink-0"
                        aria-label="Terkunci"
                      />
                    )}
                  </div>

                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                      isOver
                        ? "bg-expense/15 text-[color:var(--expense-text)]"
                        : isWarn
                        ? "bg-[#FFB04A]/20 text-[color:var(--warning-text)]"
                        : "bg-accent/15 text-[color:var(--accent-text)]"
                    }`}
                  >
                    {statusText}
                  </span>
                </div>

                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOver
                        ? "bg-expense"
                        : isWarn
                        ? "bg-[#FFB04A]"
                        : "bg-[var(--accent-border)] dark:bg-accent"
                    }`}
                    style={{ width: `${Math.min(100, liveUsage.usagePercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatCompactStatRupiah(liveUsage.spent)} dari{" "}
                    {formatCompactStatRupiah(liveUsage.allocatedAmount)}
                  </span>
                  <span
                    className={`font-bold tabular-nums whitespace-nowrap ${
                      liveUsage.overAmount > 0 || liveUsage.remaining === 0
                        ? "text-[color:var(--expense-text)]"
                        : isWarn
                        ? "text-[color:var(--warning-text)]"
                        : "text-[color:var(--accent-text)]"
                    }`}
                  >
                    {liveUsage.overAmount > 0
                      ? `Melebihi ${formatCompactStatRupiah(liveUsage.overAmount)}`
                      : `Sisa ${formatCompactStatRupiah(liveUsage.remaining)}`}
                  </span>
                </div>

                {catSummary?.isCurrentView && catBudgets.length >= 2 && (
                  <div className="pt-1 border-t border-border/50 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShiftTargetCategoryId(item.categoryId);
                        setShiftModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-full text-xs font-bold border transition-all ${
                        isOver
                          ? "bg-accent text-[#1F1F1F] border-[var(--accent-border)] font-black hover:brightness-105"
                          : "bg-card border-border text-foreground hover:border-[var(--accent-border)]"
                      }`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{isOver ? "Geser dari pos lain" : "Geser jatah"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {catBudgets.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllPots((prev) => !prev)}
              className="w-full min-h-[44px] rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-colors"
            >
              {showAllPots
                ? "Tampilkan 3 pos"
                : `Lihat semua (${catBudgets.length} pos)`}
            </button>
          )}
        </div>
      )}

      {recentTransfers.length > 0 && (
        <div className="pt-2 border-t border-border/60 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Riwayat geser jatah periode ini
          </p>
          <div className="space-y-1.5">
            {recentTransfers.slice(0, 5).map((tr) => (
              <div
                key={tr.id}
                className="flex items-center justify-between gap-2 text-xs px-2.5 py-2 rounded-lg bg-background/60 border border-border/60"
              >
                <span className="text-muted-foreground truncate">
                  <strong className="text-foreground">{tr.fromName}</strong>
                  {" → "}
                  <strong className="text-foreground">{tr.toName}</strong>
                </span>
                <span className="font-black text-[color:var(--accent-text)] tabular-nums whitespace-nowrap shrink-0">
                  {formatStatRupiah(tr.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  const compositionSection = comp && (
    <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3.5">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Pengeluaran vs pemasukan
          </h2>
          {compState.isOverspent && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-expense/15 text-[color:var(--expense-text)] text-xs font-bold shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Pengeluaran melebihi pemasukan</span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Porsi pengeluaran dan tabungan dari pemasukanmu
        </p>
      </div>

      {compState.mode === "no_income" ? (
        <div className="space-y-3">
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden" />
          <p className="text-xs font-semibold text-muted-foreground">
            Belum ada pemasukan tercatat bulan ini
          </p>
          <div className="divide-y divide-border/60 border-t border-border/60">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-expense shrink-0" />
                <span>Pengeluaran</span>
              </span>
              <span className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
                {formatStatRupiah(comp.totalExpense)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFB04A] shrink-0" />
                <span>Tabungan</span>
              </span>
              <span className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
                {formatStatRupiah(comp.totalSavings)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Bar bertumpuk dengan lebar minimum visual agar segmen kecil tetap terlihat */}
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex gap-px">
            {compState.barWidths.expense > 0 && (
              <div
                style={{ width: `${compState.barWidths.expense}%` }}
                className="h-full min-w-[6px] bg-expense transition-all duration-500"
              />
            )}
            {compState.barWidths.savings > 0 && (
              <div
                style={{ width: `${compState.barWidths.savings}%` }}
                className="h-full min-w-[6px] bg-[#FFB04A] transition-all duration-500"
              />
            )}
            {compState.barWidths.remaining > 0 && (
              <div
                style={{ width: `${compState.barWidths.remaining}%` }}
                className="h-full min-w-[6px] bg-[var(--accent-border)] dark:bg-accent transition-all duration-500"
              />
            )}
          </div>

          {/* 3 baris rapi (BUG 10: tidak memakai 3 kotak, tidak ada label terpotong) */}
          <div className="divide-y divide-border/60">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-expense shrink-0" />
                <span>Pengeluaran</span>
              </span>
              <div className="flex items-baseline gap-2.5 shrink-0 text-right">
                <span className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
                  {formatStatRupiah(comp.totalExpense)}
                </span>
                {compState.showPercentages && (
                  <span className="text-xs font-bold text-muted-foreground tabular-nums w-9 text-right">
                    {comp.expensePct}%
                  </span>
                )}
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFB04A] shrink-0" />
                <span>Tabungan</span>
              </span>
              <div className="flex items-baseline gap-2.5 shrink-0 text-right">
                <span className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
                  {formatStatRupiah(comp.totalSavings)}
                </span>
                {compState.showPercentages && (
                  <span className="text-xs font-bold text-muted-foreground tabular-nums w-9 text-right">
                    {comp.savingsPct}%
                  </span>
                )}
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-border)] dark:bg-accent shrink-0" />
                <span>Sisa saldo</span>
              </span>
              <div className="flex items-baseline gap-2.5 shrink-0 text-right">
                <span className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
                  {formatStatRupiah(comp.remainingBalance)}
                </span>
                {compState.showPercentages && (
                  <span className="text-xs font-bold text-muted-foreground tabular-nums w-9 text-right">
                    {comp.remainingPct}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  const topTransactionsSection = (
    <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          5 transaksi terbesar
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Transaksi tunggal paling memakan saldo di periode ini
        </p>
      </div>

      {topTransactions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Belum ada data transaksi di periode ini.
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {topTransactions.map((tx, idx) => {
            const sameTitleCat = isSameTitleAndCategory(tx.title, tx.categoryName);
            const shortDate = formatStatShortDate(tx.occurredOn, referenceYear);

            return (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-5 text-xs font-extrabold text-muted-foreground shrink-0 tabular-nums">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{tx.title}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 min-w-0">
                      {!sameTitleCat && (
                        <>
                          <span className="truncate font-medium">{tx.categoryName}</span>
                          <span aria-hidden="true">-</span>
                        </>
                      )}
                      <span className="shrink-0 whitespace-nowrap">{shortDate}</span>
                    </div>
                  </div>
                </div>

                <span className="text-sm font-black text-[color:var(--expense-text)] tabular-nums whitespace-nowrap shrink-0 text-right">
                  {formatStatRupiah(tx.amount, "minus")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const trendSection = (
    <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          Tren 8 bulan terakhir
        </h2>
        {showTrendGraph && statsData?.highestExpenseMonth && trendType === "expense" && (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-expense/15 text-[color:var(--expense-text)] whitespace-nowrap">
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span>{statsData.highestExpenseMonth.month} Terboros</span>
          </span>
        )}
      </div>

      {/* Pilihan Pengeluaran | Pemasukan 44px */}
      <div
        role="group"
        aria-label="Pilih jenis grafik tren"
        className="grid grid-cols-2 p-1 bg-muted rounded-xl gap-1"
      >
        <button
          type="button"
          onClick={() => setTrendType("expense")}
          aria-pressed={trendType === "expense"}
          className={`min-h-[44px] px-3 rounded-lg text-xs font-bold transition-all ${
            trendType === "expense"
              ? "bg-card text-foreground shadow-xs font-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pengeluaran
        </button>
        <button
          type="button"
          onClick={() => setTrendType("income")}
          aria-pressed={trendType === "income"}
          className={`min-h-[44px] px-3 rounded-lg text-xs font-bold transition-all ${
            trendType === "income"
              ? "bg-card text-foreground shadow-xs font-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pemasukan
        </button>
      </div>

      {/* Ringkasan bulan ini dalam warna netral (BUG 8) */}
      {activeTrendPoint && (
        <div className="px-3 py-2.5 rounded-xl bg-background/70 border border-border/70 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Bulan ini ({activeTrendPoint.month})
          </span>
          <span className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
            {formatStatRupiah(
              trendType === "expense" ? activeTrendPoint.expense : activeTrendPoint.income
            )}
          </span>
        </div>
      )}

      {/* Grafik 160-180px atau keadaan kosong jika < 2 bulan data (BUG 3 & BUG 5) */}
      {!showTrendGraph ? (
        <div className="h-[164px] rounded-xl bg-background/50 border border-border/60 flex flex-col items-center justify-center text-center px-4 gap-2">
          <TrendingUp className="w-6 h-6 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground max-w-[230px]">
            Tren muncul setelah ada data dari 2 bulan atau lebih
          </p>
        </div>
      ) : (
        <div className="h-[172px] w-full pt-1">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend8Months}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={trendType === "expense" ? "#FF7B7B" : "var(--accent-text)"}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={trendType === "expense" ? "#FF7B7B" : "var(--accent-text)"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  width={54}
                  tickCount={3}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={formatAxisRupiah}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as MonthlyComp;
                      const val = trendType === "expense" ? data.expense : data.income;
                      return (
                        <div className="bg-popover border border-border rounded-xl p-2.5 shadow-xl text-xs font-bold text-foreground">
                          <p className="text-xs text-muted-foreground">
                            {data.month} {data.year}
                          </p>
                          <p className="text-sm font-black mt-0.5 tabular-nums">
                            {formatStatRupiah(val)}
                          </p>
                          {trendType === "expense" && data.isHighestExpense && val > 0 && (
                            <span className="text-xs font-bold text-[color:var(--expense-text)] flex items-center gap-1 mt-1">
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
                  stroke={trendType === "expense" ? "#FF7B7B" : "var(--accent-text)"}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#trendGradient)"
                  dot={(props: { cx?: number; cy?: number; payload?: MonthlyComp; index?: number }) => {
                    const isCur = props.payload?.isCurrent;
                    const isHigh =
                      trendType === "expense"
                        ? props.payload?.isHighestExpense
                        : props.payload?.isHighestIncome;
                    if (isCur || isHigh) {
                      return (
                        <circle
                          key={`dot-${props.index}`}
                          cx={props.cx || 0}
                          cy={props.cy || 0}
                          r={4.5}
                          fill={isHigh ? "#FF7B7B" : "var(--accent-text)"}
                          stroke="var(--card)"
                          strokeWidth={2}
                        />
                      );
                    }
                    return (
                      <circle
                        key={`dot-${props.index}`}
                        cx={props.cx || 0}
                        cy={props.cy || 0}
                        r={2}
                        fill="#8A8A8A"
                      />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </section>
  );

  const otherNeedsSection = otherNeeds.length > 0 && (
    <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOtherExpanded((prev) => !prev)}
        aria-expanded={isOtherExpanded}
        className="w-full min-h-[44px] p-4 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Apa saja isi &ldquo;Lainnya&rdquo;?
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Terbesar: {otherNeeds[0].name}{" "}
            <strong className="text-foreground tabular-nums">
              {formatStatRupiah(otherNeeds[0].amount)}
            </strong>
          </p>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
            isOtherExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOtherExpanded && (
        <div className="px-4 pb-4 pt-3 border-t border-border/60 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed bg-background/60 border border-border/60 rounded-xl p-3">
            Menampilkan 5 keterangan terbanyak dari kategori{" "}
            <strong className="text-foreground">Lainnya / Kebutuhan Lain</strong> maupun transaksi kategori lain yang memiliki{" "}
            <strong className="text-foreground">keterangan kustom</strong> (total{" "}
            <strong className="text-foreground tabular-nums">
              {formatStatRupiah(statsData?.otherNeedsTotal || 0)}
            </strong>
            ).
          </p>

          <div className="divide-y divide-border/60">
            {otherNeeds.map((item, idx) => (
              <div key={item.name} className="py-2.5 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-4 text-xs font-bold text-muted-foreground shrink-0 tabular-nums">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-foreground block truncate">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      {item.count}x transaksi
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-foreground block tabular-nums whitespace-nowrap">
                    {formatStatRupiah(item.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    {item.percentage}% dari pos berketerangan
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-4 max-w-[1100px] mx-auto pb-[calc(72px+env(safe-area-inset-bottom,16px)+24px)] md:pb-10">
      {/* Header Halaman */}
      <div className="px-0.5">
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Statistik
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Lihat ke mana uangmu pergi
        </p>
      </div>

      {isLoading ? (
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-pulse"
          aria-busy="true"
          aria-label="Memuat statistik"
        >
          <div className="lg:col-span-6 space-y-4">
            <div className="h-[112px] bg-card border border-border rounded-2xl" />
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-8 w-40 rounded-lg bg-muted" />
              </div>
              <div className="w-40 h-40 rounded-full bg-muted mx-auto" />
              <div className="space-y-2.5 pt-2">
                <div className="h-10 rounded-lg bg-muted" />
                <div className="h-10 rounded-lg bg-muted" />
                <div className="h-10 rounded-lg bg-muted" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-6 space-y-4">
            <div className="h-36 bg-card border border-border rounded-2xl" />
            <div className="h-44 bg-card border border-border rounded-2xl" />
          </div>
        </div>
      ) : isPeriodCompletelyEmpty ? (
        <div className="space-y-4 max-w-xl">
          {controlSection}
          <section className="bg-card border border-border rounded-2xl p-6 text-center space-y-3 shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-accent/15 text-[color:var(--accent-text)] flex items-center justify-center mx-auto">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-foreground">
                Belum ada transaksi di periode ini
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Mulai catat pengeluaran atau pemasukan pertamamu untuk melihat ringkasan di sini.
              </p>
            </div>
            <Link
              href="/record"
              className="inline-flex items-center justify-center gap-1.5 px-5 min-h-[44px] bg-accent text-[#1F1F1F] font-black text-xs rounded-full shadow-xs hover:brightness-105 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Catat transaksi</span>
            </Link>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Kolom Kiri (lg+): [1] Kontrol, [2] Ringkasan, [3] Sorotan */}
          <div className="lg:col-span-6 space-y-4">
            {controlSection}
            {summarySection}
            {insightsSection}
          </div>

          {/* Kolom Kanan (lg+): [4] Jatah per pos, [5] Pengeluaran vs pemasukan, [6] 5 Transaksi Terbesar, [7] Tren 8 Bulan, [8] Isi Lainnya */}
          <div className="lg:col-span-6 space-y-4">
            {potsSection}
            {compositionSection}
            {topTransactionsSection}
            {trendSection}
            {otherNeedsSection}
          </div>
        </div>
      )}

      <ShiftPotModal
        open={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        initialToCategoryId={shiftTargetCategoryId}
        pots={catBudgets.map((b) => ({
          categoryId: b.categoryId,
          name: b.categoryName,
          allocatedAmount: b.limitAmount,
          spent:
            b.spent +
            (catSummary?.isCurrentView
              ? pendingOfflineByCat[resolvePotCategoryKey(b.categoryName)] || 0
              : 0),
        }))}
        onShifted={(res) => {
          setShiftToast(
            `Berhasil menggeser ${formatStatRupiah(res.shiftedAmount)} dari ${res.fromName} ke ${res.toName}.`
          );
          const { monthKey: curKey } = getJakartaCalendarParts();
          loadData(period, selectedMonthKey || curKey, selectedYear, type, true);
          setTimeout(() => setShiftToast(null), 6000);
        }}
      />
    </div>
  );
}
