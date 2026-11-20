"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Quote,
  X,
  RotateCw,
  Plus,
  Flame,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Utensils,
  Coffee,
  Smartphone,
  Shirt,
  Zap,
  Tag,
  Wallet,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  Tooltip,
} from "recharts";
import { formatRupiah } from "@/lib/utils";
import { getDashboardDataAction, getNextMotivationAction } from "@/app/actions/dashboard";
import { BrandText } from "@/components/ui/brand-logo";
import { getRandomOfflineQuote } from "@/lib/offline-quotes";

interface MonthHistoryItem {
  month: string;
  amount: number;
  isHighest?: boolean;
  isCurrent?: boolean;
}

interface CategoryItem {
  name: string;
  value: number;
  color: string;
  amount: number;
}

interface TopExpenseItem {
  name: string;
  amount: number;
  percentage: number;
}

interface DashboardData {
  dateInfo: {
    full: string;
    short: string;
    dayName: string;
    dayNumber: number;
    monthName: string;
    monthShort: string;
    monthNumber: number;
    year: number;
  };
  userName: string;
  allowance: number;
  totalExpense: number;
  totalSavedMonth: number;
  budgetUsedPercent: number;
  paydayDay: number;
  remainingDays: number;
  remainingBalance: number;
  dailyLimit: number;
  status: {
    status: "safe" | "warning" | "danger";
    label: string;
    color: string;
  };
  motivation: {
    text: string;
    category: string;
  };
  donutCategories: CategoryItem[];
  topExpenses: TopExpenseItem[];
  compositionData: CategoryItem[];
  monthlyHistory: MonthHistoryItem[];
  recentTransactions: Array<{
    id: string;
    title: string;
    category: string;
    type: string;
    amount: number;
    date: string;
  }>;
}

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("makan")) return Utensils;
  if (lower.includes("nongkrong") || lower.includes("kopi")) return Coffee;
  if (lower.includes("rokok")) return Flame;
  if (lower.includes("listrik")) return Zap;
  if (lower.includes("kuota") || lower.includes("pulsa")) return Smartphone;
  if (lower.includes("laundry") || lower.includes("baju")) return Shirt;
  if (lower.includes("kiriman") || lower.includes("uang")) return Wallet;
  if (lower.includes("gaji") || lower.includes("upah") || lower.includes("kerja")) return Briefcase;
  if (lower.includes("beasiswa")) return GraduationCap;
  return Tag;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [selectedType, setSelectedType] = useState<"expense" | "income" | "savings">("expense");
  const [trendType, setTrendType] = useState<"expense" | "income">("expense");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeMonthData, setActiveMonthData] = useState<MonthHistoryItem | null>(null);
  const [showMotivation, setShowMotivation] = useState(true);
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const loadData = async () => {
    try {
      const res = await getDashboardDataAction();
      if (res.success && res.data) {
        setDashboardData(res.data);
        if (res.data.monthlyHistory && res.data.monthlyHistory.length > 0) {
          setActiveMonthData(res.data.monthlyHistory[res.data.monthlyHistory.length - 1]);
        }
      }
    } catch (e) {
      console.error("Gagal load dashboard data:", e);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();

    const handleFocus = () => {
      loadData();
    };

    const handleSync = () => {
      loadData();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("sakuin:sync-complete", handleSync);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("sakuin:sync-complete", handleSync);
    };
  }, []);

  const handleRefreshQuote = async () => {
    setIsRefreshingQuote(true);

    if (typeof window !== "undefined" && !navigator.onLine) {
      const offlineQ = getRandomOfflineQuote();
      setDashboardData((prev) =>
        prev
          ? {
              ...prev,
              motivation: {
                text: offlineQ.text,
                category: offlineQ.category,
              },
            }
          : null
      );
      setTimeout(() => setIsRefreshingQuote(false), 350);
      return;
    }

    try {
      const res = await getNextMotivationAction();
      if (res.success && res.data) {
        setDashboardData((prev) =>
          prev
            ? {
                ...prev,
                motivation: res.data,
              }
            : null
        );
      } else {
        const offlineQ = getRandomOfflineQuote();
        setDashboardData((prev) =>
          prev
            ? {
                ...prev,
                motivation: {
                  text: offlineQ.text,
                  category: offlineQ.category,
                },
              }
            : null
        );
      }
    } catch (_err) {
      const offlineQ = getRandomOfflineQuote();
      setDashboardData((prev) =>
        prev
          ? {
              ...prev,
              motivation: {
                text: offlineQ.text,
                category: offlineQ.category,
              },
            }
          : null
      );
    } finally {
      setTimeout(() => setIsRefreshingQuote(false), 350);
    }
  };

  const monthlyHistory = dashboardData?.monthlyHistory || [];
  const donutData = dashboardData?.donutCategories || [];
  const compositionData = dashboardData?.compositionData || [];
  const topExpenses = dashboardData?.topExpenses || [];
  const recentTransactions = dashboardData?.recentTransactions || [];
  const dateInfo = dashboardData?.dateInfo;

  // Deteksi Bulan Terboros (PRD G5)
  const highestMonth =
    monthlyHistory.length > 0
      ? monthlyHistory.reduce(
          (prev: MonthHistoryItem, curr: MonthHistoryItem) =>
            curr.amount > prev.amount ? curr : prev,
          monthlyHistory[0]
        )
      : null;

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-2">
      {/* 0. Header Tanggal Dinamis & Sapaan */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-1.5 text-accent text-[11px] font-black uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateInfo?.full || "Rabu, 18 November 2026"}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
            Halo, {dashboardData?.userName || "Mahasiswa"}
          </h1>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground">
            Bulan {dateInfo?.monthName || "November"}
          </span>
        </div>
      </div>

      {/* 1. Kartu Motivasi Harian (PRD 7.7, 8.7 & Bagian 17) */}
      {showMotivation && (
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-accent/20 text-accent shrink-0 mt-0.5">
              <Quote className="w-3.5 h-3.5 fill-accent" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
                <span>Motivasi SakuIN</span>
                <Sparkles className="w-3 h-3 text-accent" />
              </p>
              <p className="text-xs font-semibold text-foreground leading-snug mt-0.5">
                &ldquo;
                {dashboardData?.motivation?.text ||
                  "Menabung Rp5.000 hari ini lebih baik daripada menyesal di akhir bulan."}
                &rdquo;
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleRefreshQuote}
              title="Ganti kutipan motivasi"
              className={`p-1.5 text-muted-foreground hover:text-foreground transition-transform rounded-md hover:bg-muted ${
                isRefreshingQuote ? "animate-spin" : ""
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowMotivation(false)}
              title="Tutup kartu motivasi"
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* 2. Kartu Saldo SakuIN & Batas Harian (PRD B1-B4, G1) */}
      <section className="relative overflow-hidden bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        {/* Card Header & Sisa Uang Kiriman */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BrandText height={20} />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent uppercase tracking-widest">
                Debit
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Sisa Uang Kiriman
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {dashboardData ? formatRupiah(dashboardData.remainingBalance) : "Rp ..."}
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Tersedia Bulan Ini
            </span>
          </div>
        </div>

        {/* Progress Bar Pemakaian Anggaran Bulanan (PRD B1, B3) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>
              Pemakaian Anggaran ({dashboardData?.budgetUsedPercent || 0}%)
            </span>
            <span>
              {formatRupiah(dashboardData?.totalExpense || 0)} / {formatRupiah(dashboardData?.allowance || 0)}
            </span>
          </div>
          <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (dashboardData?.budgetUsedPercent || 0) >= 100
                  ? "bg-expense"
                  : (dashboardData?.budgetUsedPercent || 0) >= 80
                  ? "bg-[#FFB04A]"
                  : "bg-accent"
              }`}
              style={{ width: `${Math.min(100, dashboardData?.budgetUsedPercent || 0)}%` }}
            />
          </div>
          {(dashboardData?.budgetUsedPercent || 0) >= 80 && (
            <p className="text-[10px] font-bold text-[#FFB04A] flex items-center gap-1">
              <span>⚠️ Pemakaian sudah {(dashboardData?.budgetUsedPercent || 0) >= 100 ? "mencapai 100%" : "di atas 80%"}, kendalikan pengeluaranmu!</span>
            </p>
          )}
        </div>

        {/* Card Footer: Batas Per Hari & Siklus Kiriman */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
              Batas per Hari
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-extrabold text-accent text-sm sm:text-base">
                {dashboardData ? formatRupiah(dashboardData.dailyLimit) : "Rp ..."}
              </span>
              <span
                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                  dashboardData?.status?.status === "safe"
                    ? "bg-accent/20 text-accent"
                    : dashboardData?.status?.status === "warning"
                    ? "bg-[#FFB04A]/20 text-[#FFB04A]"
                    : "bg-expense/20 text-expense"
                }`}
              >
                {dashboardData?.status?.label || "Aman"}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
              Siklus Bulanan
            </span>
            <span className="font-bold text-foreground text-xs mt-0.5 block">
              Sisa {dashboardData?.remainingDays ?? "..."} Hari (Kiriman Tgl {dashboardData?.paydayDay ?? 1})
            </span>
          </div>
        </div>
      </section>

      {/* 3. Filter Controls: Dropdown Pill on Left & Month/Year Segmented Toggle on Right */}
      <div className="flex items-center justify-between px-1">
        {/* Left Pill Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setSelectedType((prev) =>
                prev === "expense" ? "income" : prev === "income" ? "savings" : "expense"
              )
            }
            className="flex items-center gap-2 bg-card hover:bg-muted border border-border px-4 py-2 rounded-full text-xs font-bold text-foreground shadow-sm transition-all"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                selectedType === "expense"
                  ? "bg-expense"
                  : selectedType === "income"
                  ? "bg-accent"
                  : "bg-savings"
              }`}
            />
            <span className="capitalize">
              {selectedType === "expense"
                ? "Pengeluaran"
                : selectedType === "income"
                ? "Pemasukan"
                : "Tabungan"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Right Segmented Toggle: Month | Year */}
        <div className="inline-flex p-1 bg-card border border-border rounded-full text-xs font-semibold shadow-sm">
          <button
            type="button"
            onClick={() => setPeriod("month")}
            className={`px-3.5 py-1.5 rounded-full transition-all ${
              period === "month"
                ? "bg-foreground text-background font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bulan
          </button>
          <button
            type="button"
            onClick={() => setPeriod("year")}
            className={`px-3.5 py-1.5 rounded-full transition-all ${
              period === "year"
                ? "bg-foreground text-background font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tahun
          </button>
        </div>
      </div>

      {/* 4. Bagian Grafik Donut & Komposisi */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Card: Donut Chart with Large Percentage in Center */}
        <section className="bg-card border border-border rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div className="relative w-full h-36 flex items-center justify-center">
            {donutData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-2">
                <span className="text-2xl font-black text-muted-foreground/30">0%</span>
                <p className="text-[11px] font-bold text-muted-foreground mt-1">Belum ada pengeluaran</p>
                <p className="text-[9px] text-muted-foreground/70">Bulan {dateInfo?.monthName || "ini"}</p>
              </div>
            ) : (
              <>
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        innerRadius={44}
                        outerRadius={58}
                        paddingAngle={4}
                        cornerRadius={6}
                        stroke="none"
                      >
                        {donutData.map((entry: CategoryItem, index: number) => (
                          <Cell key={`donut-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
                )}

                {/* Large Bold Percentage in Center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black tracking-tight text-foreground">
                    {donutData[0]?.value || 0}%
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground -mt-0.5 truncate max-w-[80px]">
                    {donutData[0]?.name || "-"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Donut Legend Items */}
          <div className="space-y-1.5 pt-3 border-t border-border/60">
            {donutData.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-1">
                Kategori akan muncul setelah mencatat transaksi
              </p>
            ) : (
              donutData.slice(0, 4).map((cat: CategoryItem) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between text-[11px] font-semibold"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[75%]">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-muted-foreground truncate">{cat.name}</span>
                  </div>
                  <span className="text-foreground font-bold">{cat.value}%</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Card: Monthly Composition Pie Chart */}
        <section className="bg-card border border-border rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div className="text-center pb-1">
            <h3 className="text-sm font-bold text-foreground">
              {dateInfo?.monthName || "November"}
            </h3>
          </div>

          <div className="relative w-full h-28 flex items-center justify-center">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={compositionData}
                    dataKey="value"
                    innerRadius={0}
                    outerRadius={50}
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {compositionData.map((entry: CategoryItem, index: number) => (
                      <Cell key={`comp-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RePieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-1.5 pt-3 border-t border-border/60">
            {compositionData.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-1">
                Data komposisi akan muncul setelah ada uang kiriman/transaksi
              </p>
            ) : (
              compositionData.map((item: CategoryItem) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-[11px] font-semibold"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-foreground font-bold">{item.value}%</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 5. Pengeluaran Terbanyak Bulan Ini (PRD G1 & G6) */}
      {topExpenses.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 shadow-md space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-expense" />
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Pengeluaran Terbanyak Bulan Ini
              </h2>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">
              Top {topExpenses.length} Kategori
            </span>
          </div>

          <div className="space-y-3">
            {topExpenses.map((exp, idx) => (
              <div key={exp.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-foreground">{exp.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-expense">{formatRupiah(exp.amount)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">({exp.percentage}%)</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border/60">
                  <div
                    className="h-full bg-expense rounded-full transition-all duration-500"
                    style={{ width: `${exp.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Riwayat Pengeluaran Tiap Bulan & Deteksi Bulan Terboros (PRD G5) */}
      <section className="bg-card border border-border rounded-xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setTrendType((prev) => (prev === "expense" ? "income" : "expense"))}
            className="flex items-center gap-2 bg-background hover:bg-muted border border-border px-3.5 py-1.5 rounded-full text-xs font-bold text-foreground transition-all"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                trendType === "expense" ? "bg-expense" : "bg-accent"
              }`}
            />
            <span>{trendType === "expense" ? "Pengeluaran" : "Pemasukan"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">
              {activeMonthData?.month || dateInfo?.monthShort || "Bulan Ini"}
            </span>
            <div
              className={`px-3 py-1 rounded-full font-black text-xs shadow-md ${
                activeMonthData?.isHighest && (activeMonthData.amount || 0) > 0
                  ? "bg-expense text-white"
                  : "bg-accent text-[#1F1F1F]"
              }`}
            >
              {formatRupiah(activeMonthData?.amount || 0)}
            </div>
          </div>
        </div>

        {/* Insight: Bulan Terboros Highlight */}
        <div className="p-3 bg-background/80 rounded-lg border border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-expense shrink-0" />
            <span className="text-muted-foreground">
              {highestMonth && highestMonth.amount > 0 ? (
                <>
                  Bulan Terboros:{" "}
                  <strong className="text-expense font-black">
                    {highestMonth.month} ({formatRupiah(highestMonth.amount)})
                  </strong>
                </>
              ) : (
                "Belum ada riwayat pengeluaran yang tercatat"
              )}
            </span>
          </div>
          <span className="text-[11px] font-bold text-accent bg-accent/15 px-2.5 py-0.5 rounded-full">
            {highestMonth && highestMonth.amount > 0 ? "Terkontrol" : "Bersih"}
          </span>
        </div>

        {/* Interactive Smooth Trend Wave */}
        <div className="w-full h-32 pt-2">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyHistory}
                margin={{ top: 10, right: 12, left: 12, bottom: 5 }}
                onClick={(nextState) => {
                  const state = nextState as unknown as {
                    activePayload?: Array<{ payload: MonthHistoryItem }>;
                  };
                  if (state?.activePayload?.[0]?.payload) {
                    setActiveMonthData(state.activePayload[0].payload);
                  }
                }}
              >
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={({ x, y, payload }) => {
                    const isSelected = activeMonthData?.month === payload.value;
                    const isMax = payload.value === highestMonth?.month;
                    return (
                      <text
                        x={x}
                        y={Number(y) + 12}
                        textAnchor="middle"
                        className={`text-[11px] cursor-pointer font-bold ${
                          isSelected
                            ? "fill-accent font-black"
                            : isMax
                            ? "fill-expense font-black"
                            : "fill-muted-foreground"
                        }`}
                      >
                        {payload.value}
                      </text>
                    );
                  }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-xl px-2.5 py-1.5 shadow-xl text-[11px] font-bold text-foreground">
                          {data.month}: {formatRupiah(data.amount)}
                          {data.isHighest && " (Terboros)"}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#D4FF5A"
                  strokeWidth={3.5}
                  dot={({ cx, cy, payload }) => {
                    const isSelected = activeMonthData?.month === payload.month;
                    const isMax = payload.isHighest;
                    return (
                      <circle
                        key={payload.month}
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 6 : isMax ? 5 : 3.5}
                        fill={isMax ? "#FF7B7B" : "#D4FF5A"}
                        stroke="#1F1F1F"
                        strokeWidth={2}
                        className="cursor-pointer transition-all"
                        onClick={() => setActiveMonthData(payload)}
                      />
                    );
                  }}
                  activeDot={{ r: 7, fill: "#D4FF5A", stroke: "#1F1F1F", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 7. Transaksi Terbaru (PRD G1) */}
      {recentTransactions.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Transaksi Terbaru
            </h2>
            <Link
              href="/transactions"
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>Lihat Semua di Riwayat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {recentTransactions.map((tx) => {
              const Icon = getCategoryIcon(tx.category);
              return (
                <Link
                  key={tx.id}
                  href="/transactions"
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-accent/40 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        tx.type === "expense"
                          ? "bg-expense/15 text-expense"
                          : "bg-accent/20 text-accent"
                      }`}
                    >
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{tx.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {tx.category} • {tx.date}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-black shrink-0 ${
                      tx.type === "expense" ? "text-expense" : "text-accent"
                    }`}
                  >
                    {tx.type === "expense" ? "-" : "+"}
                    {formatRupiah(tx.amount)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Action Button to Add Transaction */}
      <div className="pt-1 text-center">
        <Link
          href="/record"
          className="inline-flex items-center gap-2 bg-accent hover:brightness-110 text-[#1F1F1F] font-black text-xs px-6 py-3 rounded-full shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tambah Transaksi Baru</span>
          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
        </Link>
      </div>
    </div>
  );
}
