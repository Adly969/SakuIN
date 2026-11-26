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
  HandCoins,
  Briefcase,
  GraduationCap,
  Lock,
  PiggyBank,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useOfflineSync } from "@/components/pwa/offline-sync-provider";
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
import {
  calculateAdaptiveDailyLimit,
  INDONESIAN_DAYS,
  type AllowanceCycle,
  type ReserveMode,
} from "@/lib/finance";
import { getDashboardDataAction, getNextMotivationAction } from "@/app/actions/dashboard";
import { getAccountsAction } from "@/app/actions/accounts";
import { claimCarryoverSavingsAction } from "@/app/actions/savings";
import { createTransactionAction } from "@/app/actions/transactions";
import { BrandText } from "@/components/ui/brand-logo";
import { getRandomOfflineQuote } from "@/lib/offline-quotes";
import { Landmark, Smartphone as PhoneIcon, Banknote } from "lucide-react";

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
  allowanceCycle?: AllowanceCycle;
  paydayWeekday?: number;
  reserveMode?: ReserveMode;
  reserveValue?: number;
  reservedTotal?: number;
  spendableBalance?: number;
  lockedTotal?: number;
  rawLockedTotal?: number;
  lockedFundsCount?: number;
  freeBalance?: number;
  carryoverOffer?: {
    carryoverKey: string;
    dateKey: string;
    dateLabel: string;
    amount: number;
    yesterdayBudget: number;
    yesterdayExpense: number;
    preferredGoalId: string | null;
    goals: Array<{ id: string; name: string }>;
  } | null;
  paydayPrompt?: {
    dateKey: string;
    dateLabel: string;
    cycle: AllowanceCycle;
    suggestedAmount: number;
  } | null;
  remainingDays: number;
  remainingBalance: number;
  remainingBudget?: number;
  totalAccountsBalance?: number;
  hasAccountsData?: boolean;
  accountBreakdown?: {
    bank: number;
    ewallet: number;
    cash: number;
  };
  dailyLimit: number;
  todayExpense?: number;
  todayBudget?: number;
  todayRemaining?: number;
  overLimitAmount?: number;
  todayUsagePercent?: number;
  todayAlertLevel?: "ok" | "warning" | "reached" | "exceeded";
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
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [activeMonthData, setActiveMonthData] = useState<MonthHistoryItem | null>(null);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(0);
  const [showMotivation, setShowMotivation] = useState(true);
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [carryoverGoalId, setCarryoverGoalId] = useState<string>("");
  const [carryoverAccountId, setCarryoverAccountId] = useState<string>("");
  const [isClaimingCarryover, setIsClaimingCarryover] = useState(false);
  const [dismissedCarryoverKey, setDismissedCarryoverKey] = useState<string | null>(null);
  const [carryoverSuccessToast, setCarryoverSuccessToast] = useState<{
    message: string;
    quote: string;
  } | null>(null);
  const [paydayAmount, setPaydayAmount] = useState<string>("");
  const [paydayAccountId, setPaydayAccountId] = useState<string>("");
  const [isSubmittingPayday, setIsSubmittingPayday] = useState(false);
  const [dismissedPaydayKey, setDismissedPaydayKey] = useState<string | null>(null);
  const [paydaySuccessMsg, setPaydaySuccessMsg] = useState<string | null>(null);
  const { isOnline, queueCount, isSyncing, manualSync } = useOfflineSync();
  const shouldReduceMotion = useReducedMotion();

  const loadData = async () => {
    try {
      const [dashRes, accRes] = await Promise.allSettled([
        getDashboardDataAction(),
        getAccountsAction(),
      ]);

      if (dashRes.status === "fulfilled" && dashRes.value.success && dashRes.value.data) {
        setDashboardData(dashRes.value.data);
        try {
          localStorage.setItem("sakuin_cached_dashboard", JSON.stringify(dashRes.value.data));
        } catch { }
        if (dashRes.value.data.monthlyHistory && dashRes.value.data.monthlyHistory.length > 0) {
          setActiveMonthData(dashRes.value.data.monthlyHistory[dashRes.value.data.monthlyHistory.length - 1]);
        }
      }

      if (accRes.status === "fulfilled" && accRes.value.success && accRes.value.data) {
        setAccountsList(accRes.value.data.accounts || []);
        try {
          localStorage.setItem("sakuin_cached_accounts", JSON.stringify(accRes.value.data));
        } catch { }
      }
    } catch (e) {
      console.error("Gagal load dashboard data:", e);
    }
  };

  useEffect(() => {
    setIsMounted(true);

    // Instant Cache Hydration from localStorage (0ms Frame 0)
    try {
      const cached = localStorage.getItem("sakuin_cached_dashboard");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          setDashboardData(parsed);
          if (parsed.monthlyHistory && parsed.monthlyHistory.length > 0) {
            setActiveMonthData(parsed.monthlyHistory[parsed.monthlyHistory.length - 1]);
          }
        }
      }

      const cachedAcc = localStorage.getItem("sakuin_cached_accounts");
      if (cachedAcc) {
        const parsedAcc = JSON.parse(cachedAcc);
        const accList = Array.isArray(parsedAcc) ? parsedAcc : parsedAcc?.accounts;
        if (Array.isArray(accList)) {
          setAccountsList(accList);
        }
      }
    } catch (err) {
      console.warn("Gagal membaca cache dashboard:", err);
    }

    loadData();

    const handleFocus = () => {
      loadData();
    };

    const handleSync = () => {
      loadData();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("sakuin:sync-complete", handleSync);
    window.addEventListener("sakuin:data-invalidated", handleSync);
    window.addEventListener("sakuin:transaction-added", handleSync);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("sakuin:sync-complete", handleSync);
      window.removeEventListener("sakuin:data-invalidated", handleSync);
      window.removeEventListener("sakuin:transaction-added", handleSync);
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

  // Hitung Total Saldo Riil (Rekening Bank + E-Wallet + Dompet Fisik) secara langsung & sinkron
  const liveAccountsTotal =
    accountsList.length > 0
      ? accountsList.reduce((sum, acc) => sum + Number(acc.balance || 0), 0)
      : (dashboardData?.totalAccountsBalance ?? 0);
  const isUsingAccounts =
    Boolean(dashboardData?.hasAccountsData) ||
    accountsList.some((acc) => Number(acc.balance || 0) !== 0);
  const heroMainBalance = isUsingAccounts
    ? Math.max(0, liveAccountsTotal)
    : (dashboardData?.remainingBalance ?? 0);
  const heroAdaptive = calculateAdaptiveDailyLimit(
    heroMainBalance,
    dashboardData?.remainingDays ?? 1,
    dashboardData?.reserveMode ?? "none",
    dashboardData?.reserveValue ?? 0,
    dashboardData?.rawLockedTotal ?? dashboardData?.lockedTotal ?? 0
  );
  const heroDailyLimit = dashboardData ? heroAdaptive.dailyLimit : 0;
  const heroReservedTotal = dashboardData ? heroAdaptive.reservedTotal : 0;
  const heroLockedTotal = dashboardData ? heroAdaptive.lockedTotal : 0;
  const heroFreeBalance = dashboardData ? heroAdaptive.freeBalance : heroMainBalance;

  const liveTodayExpense = dashboardData?.todayExpense ?? 0;
  const liveTodayAdaptive = calculateAdaptiveDailyLimit(
    heroMainBalance + liveTodayExpense,
    dashboardData?.remainingDays ?? 1,
    dashboardData?.reserveMode ?? "none",
    dashboardData?.reserveValue ?? 0,
    dashboardData?.rawLockedTotal ?? dashboardData?.lockedTotal ?? 0
  );
  const heroTodayBudget = dashboardData
    ? accountsList.length > 0
      ? liveTodayAdaptive.dailyLimit
      : (dashboardData.todayBudget ?? heroDailyLimit)
    : 0;
  const heroTodayRemaining = Math.max(0, heroTodayBudget - liveTodayExpense);
  const heroOverLimit = Math.max(0, liveTodayExpense - heroTodayBudget);
  const heroTodayUsagePercent =
    heroTodayBudget > 0
      ? Math.round((liveTodayExpense / heroTodayBudget) * 100)
      : liveTodayExpense > 0
      ? 100
      : 0;
  let heroTodayAlertLevel: "ok" | "warning" | "reached" | "exceeded" = "ok";
  if (heroTodayBudget <= 0) {
    heroTodayAlertLevel = liveTodayExpense > 0 ? "exceeded" : "ok";
  } else if (liveTodayExpense > heroTodayBudget) {
    heroTodayAlertLevel = "exceeded";
  } else if (liveTodayExpense === heroTodayBudget || heroTodayUsagePercent >= 100) {
    heroTodayAlertLevel = "reached";
  } else if (heroTodayUsagePercent >= 80) {
    heroTodayAlertLevel = "warning";
  }

  const heroStatus =
    heroDailyLimit >= 65000
      ? { status: "safe" as const, label: "Aman" }
      : heroDailyLimit >= 30000
      ? { status: "warning" as const, label: "Waspada" }
      : { status: "danger" as const, label: "Kritis" };

  const carryoverOffer = dashboardData?.carryoverOffer || null;
  const paydayPrompt = dashboardData?.paydayPrompt || null;

  useEffect(() => {
    if (!carryoverOffer) return;
    if (!carryoverGoalId && carryoverOffer.preferredGoalId) {
      setCarryoverGoalId(carryoverOffer.preferredGoalId);
    }
    try {
      const dismissed = localStorage.getItem(`sakuin_dismissed_carryover_${carryoverOffer.carryoverKey}`);
      if (dismissed) setDismissedCarryoverKey(carryoverOffer.carryoverKey);
    } catch {}
  }, [carryoverOffer?.carryoverKey, carryoverOffer?.preferredGoalId]);

  useEffect(() => {
    if (!paydayPrompt) return;
    if (!paydayAmount && paydayPrompt.suggestedAmount > 0) {
      setPaydayAmount(String(paydayPrompt.suggestedAmount));
    }
    try {
      const dismissed = localStorage.getItem(`sakuin_dismissed_payday_${paydayPrompt.dateKey}`);
      if (dismissed) setDismissedPaydayKey(paydayPrompt.dateKey);
    } catch {}
  }, [paydayPrompt?.dateKey, paydayPrompt?.suggestedAmount]);

  useEffect(() => {
    if (accountsList.length === 0) return;
    const def = accountsList.find((a) => a.isDefault) || accountsList[0];
    if (carryoverAccountId === "" && def?.id) setCarryoverAccountId(def.id);
    if (paydayAccountId === "" && def?.id) setPaydayAccountId(def.id);
  }, [accountsList, carryoverAccountId, paydayAccountId]);

  const handleConfirmPayday = async () => {
    if (!paydayPrompt || isSubmittingPayday) return;
    const amt = parseInt(paydayAmount.replace(/[^0-9]/g, "") || "0", 10);
    if (amt <= 0) return;

    setIsSubmittingPayday(true);
    try {
      const res = await createTransactionAction({
        type: "income",
        amount: amt,
        categoryName: "Uang Kiriman",
        note: `Uang kiriman ${paydayPrompt.cycle === "weekly" ? "mingguan" : "bulanan"} (${paydayPrompt.dateLabel})`,
        accountId: paydayAccountId || undefined,
        occurredOn: paydayPrompt.dateKey,
      });

      if (res.success) {
        if (paydayAccountId) {
          setAccountsList((prev) => {
            const updated = prev.map((acc) =>
              acc.id === paydayAccountId
                ? { ...acc, balance: Number(acc.balance || 0) + amt }
                : acc
            );
            try {
              const totalBalance = updated.reduce((s, a) => s + Number(a.balance || 0), 0);
              localStorage.setItem("sakuin_cached_accounts", JSON.stringify({ totalBalance, accounts: updated }));
            } catch {}
            return updated;
          });
        }
        setDismissedPaydayKey(paydayPrompt.dateKey);
        setPaydaySuccessMsg(`Uang kiriman ${formatRupiah(amt)} berhasil dicatat masuk!`);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
        await loadData();
        setTimeout(() => setPaydaySuccessMsg(null), 6000);
      } else {
        alert(res.error || "Gagal mencatat uang kiriman");
      }
    } catch (err) {
      console.error("Gagal catat kiriman:", err);
    } finally {
      setIsSubmittingPayday(false);
    }
  };

  const handleDismissPayday = () => {
    if (!paydayPrompt) return;
    setDismissedPaydayKey(paydayPrompt.dateKey);
    try {
      localStorage.setItem(`sakuin_dismissed_payday_${paydayPrompt.dateKey}`, "1");
    } catch {}
  };

  const handleClaimCarryover = async () => {
    if (!carryoverOffer || isClaimingCarryover) return;
    const targetGoalId = carryoverGoalId || carryoverOffer.preferredGoalId || carryoverOffer.goals[0]?.id;
    if (!targetGoalId) return;

    setIsClaimingCarryover(true);
    try {
      const res = await claimCarryoverSavingsAction({
        goalId: targetGoalId,
        amount: carryoverOffer.amount,
        carryoverKey: carryoverOffer.carryoverKey,
        accountId: carryoverAccountId || undefined,
        note: `Sisa hemat harian (${carryoverOffer.dateLabel})`,
      });

      if (res.success) {
        if (carryoverAccountId) {
          setAccountsList((prev) => {
            const updated = prev.map((acc) =>
              acc.id === carryoverAccountId
                ? { ...acc, balance: Number(acc.balance || 0) - carryoverOffer.amount }
                : acc
            );
            try {
              const totalBalance = updated.reduce((s, a) => s + Number(a.balance || 0), 0);
              localStorage.setItem("sakuin_cached_accounts", JSON.stringify({ totalBalance, accounts: updated }));
            } catch {}
            return updated;
          });
        }
        setDismissedCarryoverKey(carryoverOffer.carryoverKey);
        setCarryoverSuccessToast({
          message: `Sisa hemat ${formatRupiah(carryoverOffer.amount)} dipindahkan ke ${res.data?.goalName || "Tabungan"}!`,
          quote: res.data?.motivationQuote || "Uang hemat hari kemarin kini jadi tabungan masa depanmu.",
        });
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
        await loadData();
        setTimeout(() => setCarryoverSuccessToast(null), 7000);
      } else {
        alert(res.error || "Gagal memindahkan sisa hemat ke tabungan");
      }
    } catch (err) {
      console.error("Gagal claim carryover:", err);
    } finally {
      setIsClaimingCarryover(false);
    }
  };

  const handleDismissCarryover = () => {
    if (!carryoverOffer) return;
    setDismissedCarryoverKey(carryoverOffer.carryoverKey);
    try {
      localStorage.setItem(`sakuin_dismissed_carryover_${carryoverOffer.carryoverKey}`, "1");
    } catch {}
  };

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
    <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-6">
      {/* 0 & 1: Top Hero Section (Full width on all screens) */}
      <div className="space-y-4">
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
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground">
              Bulan {dateInfo?.monthName || "November"}
            </span>
          </div>
        </div>

        {/* 1. Kartu Motivasi Harian (Disembunyikan di HP sesuai PRD Tahap 1) */}
        {showMotivation && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:flex bg-card border border-border rounded-xl p-3.5 shadow-sm items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-accent/20 text-accent shrink-0 mt-0.5">
                <Quote className="w-3.5 h-3.5 fill-accent" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
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
                className={`w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-transform rounded-md hover:bg-muted ${isRefreshingQuote ? "animate-spin" : ""
                  }`}
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowMotivation(false)}
                title="Tutup kartu motivasi"
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Responsive Grid: 1 col on mobile, 2 cols on lg (>=1024px) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-6 space-y-5) */}
        <div className="lg:col-span-6 space-y-5">
          {/* 2. Hero Card Ramping: Fokus Sisa Batas Hari Ini */}
          <section className="relative overflow-hidden bg-card border border-border rounded-xl p-5 shadow-md space-y-3.5">
            {/* Baris 1: Brand + Status + Angka Utama Sisa Batas Hari Ini */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BrandText height={18} />
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${heroStatus.status === "safe"
                      ? "bg-accent/20 text-accent"
                      : heroStatus.status === "warning"
                        ? "bg-[#FFB04A]/20 text-[#FFB04A]"
                        : "bg-expense/20 text-expense"
                      }`}
                  >
                    {heroStatus.label}
                  </span>
                </div>
                <p className="text-ui-label text-muted-foreground pt-0.5">
                  Sisa Batas Hari Ini
                </p>
              </div>

              <div className="text-right">
                <div
                  className={`text-3xl font-black tracking-tight ${
                    heroTodayAlertLevel === "exceeded" || heroTodayAlertLevel === "reached"
                      ? "text-expense"
                      : heroTodayAlertLevel === "warning"
                      ? "text-[#FFB04A]"
                      : "text-accent"
                  }`}
                >
                  {dashboardData || accountsList.length > 0 ? formatRupiah(heroTodayRemaining) : "Rp ..."}
                </div>
                <span className="text-xs font-semibold text-muted-foreground block">
                  {heroOverLimit > 0
                    ? `Over limit ${formatRupiah(heroOverLimit)}`
                    : `Jatah hari ini ${dashboardData || accountsList.length > 0 ? formatRupiah(heroTodayBudget) : "Rp ..."}`}
                </span>
              </div>
            </div>

            {/* Baris 2: 1 Progress Bar Pemakaian Hari Ini */}
            {dashboardData && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">
                    Terpakai hari ini ({heroTodayUsagePercent}%)
                  </span>
                  <span className="font-bold text-foreground">
                    {formatRupiah(liveTodayExpense)} / {formatRupiah(heroTodayBudget)}
                  </span>
                </div>
                <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/70">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      heroTodayAlertLevel === "exceeded" || heroTodayAlertLevel === "reached"
                        ? "bg-expense"
                        : heroTodayAlertLevel === "warning"
                        ? "bg-[#FFB04A]"
                        : "bg-accent"
                    }`}
                    style={{ width: `${Math.min(100, heroTodayUsagePercent)}%` }}
                  />
                </div>
                {(heroTodayAlertLevel === "warning" ||
                  heroTodayAlertLevel === "reached" ||
                  heroTodayAlertLevel === "exceeded") && (
                  <p
                    className={`text-xs font-bold ${
                      heroTodayAlertLevel === "warning" ? "text-[#FFB04A]" : "text-expense"
                    }`}
                  >
                    {heroTodayAlertLevel === "warning"
                      ? `Batas hari ini hampir habis, tersisa ${formatRupiah(heroTodayRemaining)}.`
                      : heroTodayAlertLevel === "reached"
                      ? "Batas pengeluaran hari ini sudah tercapai (Sisa Rp 0)."
                      : `Melewati batas hari ini sebesar ${formatRupiah(heroOverLimit)}.`}
                  </p>
                )}
              </div>
            )}

            {/* Baris 3: Penanda Antrean Offline jika ada transaksi belum sinkron */}
            {queueCount > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#FFB04A]/15 border border-[#FFB04A]/35 text-xs font-bold text-foreground">
                <div className="flex items-center gap-2 min-w-0">
                  <RefreshCw className={`w-3.5 h-3.5 text-[#FFB04A] shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
                  <span className="truncate">
                    {isSyncing
                      ? `Menyinkronkan ${queueCount} transaksi...`
                      : `${queueCount} transaksi menunggu sinyal`}
                  </span>
                </div>
                {isOnline && !isSyncing && (
                  <button
                    type="button"
                    onClick={() => void manualSync()}
                    className="text-xs font-black text-accent hover:underline shrink-0"
                  >
                    Kirim
                  </button>
                )}
              </div>
            )}

            {/* Baris 4: Chip Dana Terkunci + Ringkasan Saldo & Siklus */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/60 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {heroLockedTotal > 0 && (
                  <Link
                    href="/accounts#dana-terkunci"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFB04A]/15 border border-[#FFB04A]/30 text-[#FFB04A] font-bold hover:brightness-110 transition-all"
                  >
                    <Lock className="w-3 h-3 shrink-0" />
                    <span>Terkunci {formatRupiah(heroLockedTotal)}</span>
                  </Link>
                )}
                <span className="text-muted-foreground font-semibold">
                  Saldo{" "}
                  <strong className="text-foreground">
                    {dashboardData || accountsList.length > 0 ? formatRupiah(heroMainBalance) : "Rp ..."}
                  </strong>
                </span>
                {dashboardData?.reserveMode && dashboardData.reserveMode !== "none" && heroReservedTotal > 0 && (
                  <span className="text-muted-foreground">
                    • Sisih {formatRupiah(heroReservedTotal)}
                  </span>
                )}
              </div>

              <div className="text-right text-muted-foreground font-semibold">
                <span>
                  {dashboardData?.allowanceCycle === "weekly"
                    ? `Sisa ${dashboardData?.remainingDays ?? "..."} hari (${INDONESIAN_DAYS[dashboardData?.paydayWeekday ?? 1]})`
                    : dashboardData?.allowanceCycle === "flexible"
                    ? `Sisa ${dashboardData?.remainingDays ?? "..."} hari`
                    : `Sisa ${dashboardData?.remainingDays ?? "..."} hari (Tgl ${dashboardData?.paydayDay ?? 1})`}
                </span>
                <span className="ml-2">• Bulan ini {dashboardData?.budgetUsedPercent || 0}%</span>
              </div>
            </div>
          </section>

          {/* 2.05 Kartu Konfirmasi Hari Kiriman (Payday Prompt) */}
          {paydaySuccessMsg && (
            <div className="p-3.5 rounded-xl bg-accent/15 border border-accent/40 shadow-sm flex items-center gap-2 text-xs font-black text-accent">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{paydaySuccessMsg}</span>
            </div>
          )}

          {paydayPrompt && dismissedPaydayKey !== paydayPrompt.dateKey && (
            <section className="bg-card border border-accent/40 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground">
                      Hari ini jadwal kirimanmu ({paydayPrompt.dateLabel})!
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sudah masuk? Konfirmasi 1 ketuk untuk langsung update saldo &amp; riwayat pemasukan.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDismissPayday}
                  title="Tutup pengingat hari kiriman"
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative flex items-center bg-background border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-accent">
                  <span className="text-xs font-black text-muted-foreground mr-1.5">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={parseInt(paydayAmount || "0", 10) > 0 ? parseInt(paydayAmount || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => setPaydayAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Nominal kiriman"
                    className="flex-1 min-w-0 bg-transparent text-xs font-black text-foreground focus:outline-none"
                  />
                </div>
                <select
                  value={paydayAccountId}
                  onChange={(e) => setPaydayAccountId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Catat tanpa pilih rekening</option>
                  {accountsList.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      Masuk ke: {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmittingPayday || parseInt(paydayAmount || "0", 10) <= 0}
                  onClick={handleConfirmPayday}
                  className="flex-1 py-2 px-3 rounded-full bg-accent hover:brightness-110 disabled:opacity-50 text-[#1F1F1F] text-xs font-black transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingPayday ? "Mencatat..." : "Catat Kiriman Masuk"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissPayday}
                  className="px-3 py-2 rounded-full border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  Nanti
                </button>
              </div>
            </section>
          )}

          {/* 2.1 Toast Konfirmasi / Kartu Penawaran Carryover Sisa Hemat Kemarin (PRD S9) */}
          {carryoverSuccessToast && (
            <div className="p-3.5 rounded-xl bg-accent/15 border border-accent/40 shadow-sm space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-accent">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{carryoverSuccessToast.message}</span>
              </div>
              <p className="text-xs text-muted-foreground italic pl-6">
                &ldquo;{carryoverSuccessToast.quote}&rdquo;
              </p>
            </div>
          )}

          {!(paydayPrompt && dismissedPaydayKey !== paydayPrompt.dateKey) &&
            carryoverOffer &&
            dismissedCarryoverKey !== carryoverOffer.carryoverKey && (
            <section className="bg-card border border-accent/35 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground">
                      Hemat {formatRupiah(carryoverOffer.amount)} kemarin ({carryoverOffer.dateLabel})!
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Jatah harian {formatRupiah(carryoverOffer.yesterdayBudget)}, terpakai{" "}
                      {formatRupiah(carryoverOffer.yesterdayExpense)}. Mau pindahkan sisa ini ke tabungan?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDismissCarryover}
                  title="Lewati hari ini"
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {carryoverOffer.goals.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={carryoverGoalId || carryoverOffer.preferredGoalId || ""}
                      onChange={(e) => setCarryoverGoalId(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {carryoverOffer.goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          Target: {g.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={carryoverAccountId}
                      onChange={(e) => setCarryoverAccountId(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">Catat saja (tanpa potong rekening)</option>
                      {accountsList.map((acc) => (
                        <option key={acc.id} value={acc.id} disabled={Number(acc.balance || 0) < carryoverOffer.amount}>
                          Dari {acc.name} ({formatRupiah(acc.balance || 0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isClaimingCarryover}
                      onClick={handleClaimCarryover}
                      className="flex-1 py-2 px-3 rounded-full bg-accent hover:brightness-110 disabled:opacity-50 text-[#1F1F1F] text-xs font-black transition-all flex items-center justify-center gap-1.5"
                    >
                      <PiggyBank className="w-3.5 h-3.5" />
                      <span>
                        {isClaimingCarryover
                          ? "Memindahkan..."
                          : `Pindahkan ${formatRupiah(carryoverOffer.amount)}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissCarryover}
                      className="px-3 py-2 rounded-full border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    >
                      Lewati
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/savings"
                    className="flex-1 py-2 px-3 rounded-full bg-accent hover:brightness-110 text-[#1F1F1F] text-xs font-black text-center transition-all"
                  >
                    Buat Target Tabungan Dulu
                  </Link>
                  <button
                    type="button"
                    onClick={handleDismissCarryover}
                    className="px-3 py-2 rounded-full border border-border text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    Lewati
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 2.2 Kartu Rekening (HP: horizontal snap, md ke atas: grid 2-3 kolom) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className="w-4 h-4 text-accent shrink-0" />
                <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground truncate">
                  Rekening & Dompet
                </h2>
                {accountsList.length > 0 && (
                  <span className="text-xs font-black text-accent bg-accent/15 px-2 py-0.5 rounded-full border border-accent/25 shrink-0">
                    Total {formatRupiah(liveAccountsTotal)}
                  </span>
                )}
              </div>
              <Link
                href="/accounts"
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1 min-h-[44px] px-2 shrink-0"
              >
                <span>Kelola</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {accountsList.length === 0 ? (
              <div className="p-4 rounded-xl bg-card border border-border text-center text-xs text-muted-foreground">
                Belum ada rekening aktif.{" "}
                <Link href="/accounts" className="text-accent font-bold underline">
                  Tambah Rekening
                </Link>
              </div>
            ) : (
              <div
                className={`grid gap-2.5 sm:gap-3 ${accountsList.length === 1
                  ? "grid-cols-1"
                  : accountsList.length === 2
                    ? "grid-cols-2"
                    : accountsList.length === 3
                      ? "grid-cols-2 sm:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}
              >
                {accountsList.map((acc: any) => {
                  const AccIcon =
                    acc.type === "bank"
                      ? Landmark
                      : acc.type === "ewallet"
                        ? PhoneIcon
                        : Banknote;
                  return (
                    <Link
                      key={acc.id}
                      href="/accounts"
                      className="w-full bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-accent/40 transition-all flex flex-col justify-between group min-h-[88px]"
                    >
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/60">
                            <AccIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground truncate">
                            {acc.name}
                          </span>
                        </div>
                        <span className="text-[11px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 border border-border/40">
                          {acc.type === "bank" ? "Bank" : acc.type === "ewallet" ? "E-Wallet" : "Tunai"}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <p className="text-xs text-muted-foreground font-medium">Saldo</p>
                        <p className="text-xs sm:text-sm font-black text-foreground group-hover:text-accent transition-colors truncate">
                          {formatRupiah(acc.balance || 0)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2.5 Akses Cepat: Utang Piutang */}
          <div>
            <Link
              href="/debts"
              className="bg-card hover:bg-muted/50 border border-border rounded-xl p-3.5 min-h-[44px] shadow-xs transition-all flex items-center justify-between gap-2.5 group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-muted border border-border/70 text-foreground flex items-center justify-center shrink-0 group-hover:border-accent/50 transition-all">
                  <HandCoins className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground truncate">Utang Piutang</p>
                  <p className="text-xs text-muted-foreground truncate">Catat & pantau utang piutang teman</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent shrink-0" />
            </Link>
          </div>
        </div>

        {/* Right Column (lg:col-span-6 space-y-5) */}
        <div className="lg:col-span-6 space-y-5">
          {/* 3. Filter Controls (Desktop saja; di HP semua grafik ada di Statistik) */}
          <div className="hidden lg:flex items-center justify-between px-1">
            {/* Left Pill Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setSelectedType((prev) =>
                    prev === "expense" ? "income" : prev === "income" ? "savings" : "expense"
                  )
                }
                className="flex items-center gap-2 bg-card hover:bg-muted border border-border px-4 py-2.5 min-h-[44px] rounded-full text-xs font-bold text-foreground shadow-sm transition-all"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${selectedType === "expense"
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
            <div className="inline-flex p-1 bg-card border border-border rounded-full text-xs font-semibold shadow-sm min-h-[44px] items-center">
              <button
                type="button"
                onClick={() => setPeriod("month")}
                className={`px-3.5 py-2 min-h-[36px] rounded-full transition-all flex items-center justify-center ${period === "month"
                  ? "bg-foreground text-background font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Bulan
              </button>
              <button
                type="button"
                onClick={() => setPeriod("year")}
                className={`px-3.5 py-2 min-h-[36px] rounded-full transition-all flex items-center justify-center ${period === "year"
                  ? "bg-foreground text-background font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Tahun
              </button>
            </div>
          </div>

          {/* 4. Bagian Grafik Donut & Komposisi (Desktop saja; di HP dipindah ke Statistik) */}
          <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left Card: Donut Chart with Large Percentage in Center */}
            <section className="bg-card border border-border rounded-xl p-5 shadow-md flex flex-col justify-between">
              <div className="relative w-full h-36 flex items-center justify-center">
                {donutData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <span className="text-2xl font-black text-muted-foreground/30">0%</span>
                    <p className="text-xs font-bold text-muted-foreground mt-1">Belum ada pengeluaran</p>
                    <p className="text-xs text-muted-foreground/70">Bulan {dateInfo?.monthName || "ini"}</p>
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
                            onClick={(_, idx) => setActiveCategoryIndex(idx)}
                            className="cursor-pointer"
                          >
                            {donutData.map((entry: CategoryItem, index: number) => (
                              <Cell
                                key={`donut-${index}`}
                                fill={entry.color}
                                opacity={activeCategoryIndex === index ? 1 : 0.85}
                              />
                            ))}
                          </Pie>
                        </RePieChart>
                      </ResponsiveContainer>
                    )}

                    {/* Large Bold Percentage in Center (Interactive) */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black tracking-tight text-foreground">
                        {(donutData[activeCategoryIndex] || donutData[0])?.value || 0}%
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground -mt-0.5 truncate max-w-[80px]">
                        {(donutData[activeCategoryIndex] || donutData[0])?.name || "-"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Donut Legend Items */}
              <div className="space-y-1 pt-3 border-t border-border/60">
                {donutData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    Kategori akan muncul setelah mencatat transaksi
                  </p>
                ) : (
                  donutData.map((cat: CategoryItem, idx: number) => {
                    const isSelected = activeCategoryIndex === idx;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setActiveCategoryIndex(idx)}
                        className={`w-full flex items-center justify-between text-xs font-semibold px-2 py-1.5 rounded-md transition-all text-left ${isSelected
                          ? "bg-muted text-foreground"
                          : "hover:bg-muted/40 text-muted-foreground"
                          }`}
                      >
                        <div className="flex items-center gap-1.5 truncate max-w-[75%]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <span className="text-foreground font-bold shrink-0">{cat.value}%</span>
                      </button>
                    );
                  })
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
                  <p className="text-xs text-muted-foreground text-center py-1">
                    Data komposisi akan muncul setelah ada uang kiriman/transaksi
                  </p>
                ) : (
                  compositionData.map((item: CategoryItem) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-xs font-semibold"
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

          {/* 5. Pengeluaran Terbanyak Bulan Ini (Desktop saja) */}
          {topExpenses.length > 0 && (
            <section className="hidden lg:block bg-card border border-border rounded-xl p-5 shadow-md space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-expense" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Pengeluaran Terbanyak Bulan Ini
                  </h2>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  Top {topExpenses.length} Kategori
                </span>
              </div>

              <div className="space-y-3">
                {topExpenses.map((exp, idx) => (
                  <div key={exp.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-xs font-black text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-foreground">{exp.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-expense">{formatRupiah(exp.amount)}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">({exp.percentage}%)</span>
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

          {/* 6. Riwayat Pengeluaran Tiap Bulan & Deteksi Bulan Terboros (Desktop saja) */}
          <section className="hidden lg:block bg-card border border-border rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setTrendType((prev) => (prev === "expense" ? "income" : "expense"))}
                className="flex items-center gap-2 bg-background hover:bg-muted border border-border px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold text-foreground transition-all"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${trendType === "expense" ? "bg-expense" : "bg-accent"
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
                  className={`px-3 py-1.5 rounded-full font-black text-xs shadow-md ${activeMonthData?.isHighest && (activeMonthData.amount || 0) > 0
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
              <span className="text-xs font-bold text-accent bg-accent/15 px-2.5 py-0.5 rounded-full">
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
                            className={`text-xs cursor-pointer font-bold ${isSelected
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
                            <div className="bg-card border border-border rounded-xl px-2.5 py-1.5 shadow-xl text-xs font-bold text-foreground">
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
                      stroke="var(--accent-text)"
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
                            fill={isMax ? "#FF7B7B" : "var(--accent-text)"}
                            stroke="#1F1F1F"
                            strokeWidth={2}
                            className="cursor-pointer transition-all"
                            onClick={() => setActiveMonthData(payload)}
                          />
                        );
                      }}
                      activeDot={{ r: 7, fill: "var(--accent-text)", stroke: "#1F1F1F", strokeWidth: 2 }}
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
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1 min-h-[44px] px-1"
                >
                  <span>Lihat Semua di Riwayat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2">
                {recentTransactions.slice(0, 3).map((tx) => {
                  const Icon = getCategoryIcon(tx.category);
                  return (
                    <Link
                      key={tx.id}
                      href="/transactions"
                      className="flex items-center justify-between p-3 min-h-[44px] rounded-lg bg-background border border-border hover:border-accent/40 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "expense"
                            ? "bg-expense/15 text-expense"
                            : "bg-accent/20 text-accent"
                            }`}
                        >
                          <Icon className="w-4 h-4 stroke-[2.2]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{tx.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {tx.category} • {tx.date}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`font-black shrink-0 ${tx.type === "expense" ? "text-expense" : "text-accent"
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
              className="inline-flex items-center gap-2 bg-accent hover:brightness-110 text-[#1F1F1F] font-black text-xs px-6 py-3.5 min-h-[44px] rounded-full shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Transaksi Baru</span>
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
