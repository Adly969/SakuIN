"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Lock,
  Plus,
  Calculator,
  AlertTriangle,
  Wallet,
  Utensils,
  Bike,
  Wifi,
  Coffee,
  GraduationCap,
  Shirt,
  Flame,
  Tag,
  ArrowRight,
  RefreshCw,
  Layers,
  Sun,
  CalendarRange,
  Calendar,
  ShieldCheck,
  PieChart,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  calculatePotPeriodAllocation,
  calculateAllocationSummary,
  calculateDailyLimitWithLockedPots,
  type PotCadence,
} from "@/lib/category-pots";
import {
  getBudgetsWorkspaceAction,
  saveCategoryPotsBatchAction,
  createCustomCategoryPotAction,
  type BudgetPotWorkspaceItem,
  type BudgetsWorkspaceData,
} from "@/app/actions/category-pots";

const MAX_ACTIVE_POTS = 8;

const CADENCE_META: Record<
  PotCadence,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  daily: { label: "Harian", icon: Sun },
  weekly: { label: "Mingguan", icon: CalendarRange },
  monthly: { label: "Bulanan", icon: Calendar },
};

const PLACEHOLDER_BY_NAME: Record<string, string> = {
  makan: "Contoh: 750.000",
  "transport / bensin": "Contoh: 200.000",
  "kuota & internet": "Contoh: 100.000",
  "jajan & nongkrong": "Contoh: 300.000",
  kuliah: "Contoh: 150.000",
  laundry: "Contoh: 80.000",
  rokok: "Contoh: 200.000",
};

function getPotIcon(name: string, iconName?: string) {
  const key = `${name || ""} ${iconName || ""}`.toLowerCase();
  if (key.includes("makan") || key.includes("utensils")) return Utensils;
  if (key.includes("bensin") || key.includes("transport") || key.includes("bike")) return Bike;
  if (key.includes("kuota") || key.includes("internet") || key.includes("wifi")) return Wifi;
  if (key.includes("nongkrong") || key.includes("jajan") || key.includes("coffee")) return Coffee;
  if (key.includes("kuliah") || key.includes("graduation")) return GraduationCap;
  if (key.includes("laundry") || key.includes("shirt")) return Shirt;
  if (key.includes("rokok") || key.includes("flame")) return Flame;
  if (key.includes("lainnya") || key.includes("more")) return Layers;
  return Tag;
}

export default function BudgetsPage() {
  const [workspace, setWorkspace] = useState<BudgetsWorkspaceData | null>(null);
  const [pots, setPots] = useState<BudgetPotWorkspaceItem[]>([]);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  // Sticky top offset synced cleanly to TopHeader actual rendered height (handles iOS Dynamic Island / Notch & Android)
  const [stickyTop, setStickyTop] = useState<number>(8);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  // "+ Tambah pos" inline creator
  const [showAddPos, setShowAddPos] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCadence, setCustomCadence] = useState<PotCadence>("monthly");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddingPos, setIsAddingPos] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Keyboard safe sticky button
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHeaderOffset = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileViewport(mobile);
      if (!mobile) {
        setStickyTop(8);
        return;
      }
      const headerEl = document.querySelector("header.safe-top-header");
      if (headerEl) {
        const h = Math.round(headerEl.getBoundingClientRect().height);
        setStickyTop(h > 0 ? h : 60);
      } else {
        setStickyTop(60);
      }
    };

    updateHeaderOffset();
    window.addEventListener("resize", updateHeaderOffset);

    const headerEl = document.querySelector("header.safe-top-header");
    let observer: ResizeObserver | null = null;
    if (headerEl && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateHeaderOffset);
      observer.observe(headerEl);
    }

    return () => {
      window.removeEventListener("resize", updateHeaderOffset);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateOffset = () => {
      const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const next = diff > 140 ? Math.round(diff) : 0;
      setKeyboardOffset((prev) => (prev === next ? prev : next));
    };
    vv.addEventListener("resize", updateOffset);
    return () => vv.removeEventListener("resize", updateOffset);
  }, []);

  const loadWorkspace = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await getBudgetsWorkspaceAction();
      if (res.success && res.data) {
        setWorkspace(res.data);
        setPots(res.data.pots);
        const firstEditable = res.data.pots.find((p) => p.isSelected && !p.isOther);
        if (firstEditable) {
          setExpandedCatId(firstEditable.categoryId);
        }
      } else {
        setLoadError(res.error || "Gagal memuat pembagian pos kategori");
      }
    } catch {
      setLoadError("Tidak bisa menghubungi server. Periksa koneksimu dan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const cycleDays = workspace?.cycleDays ?? 30;
  const availableFunds = workspace?.dailyLimitContext.availableFunds ?? 0;

  const activeNonOtherPots = useMemo(
    () => pots.filter((p) => p.isSelected && !p.isOther),
    [pots]
  );

  const summary = useMemo(
    () =>
      calculateAllocationSummary(
        availableFunds,
        activeNonOtherPots.map((p) => ({
          cadence: p.cadence,
          unitAmount: p.unitAmount,
          allocatedAmount: p.allocatedAmount,
          isOther: p.isOther,
        })),
        cycleDays
      ),
    [availableFunds, activeNonOtherPots, cycleDays]
  );

  const liveDailyLimit = useMemo(() => {
    if (!workspace) return 0;
    const ctx = workspace.dailyLimitContext;
    const res = calculateDailyLimitWithLockedPots({
      totalBalance: ctx.totalBalance,
      remainingDays: ctx.remainingDays,
      reserveMode: ctx.reserveMode,
      reserveValue: ctx.reserveValue,
      billLockedTotal: ctx.billLockedTotal,
      lockedPots: activeNonOtherPots.map((p) => ({
        allocatedAmount: p.allocatedAmount,
        periodSpent: p.periodSpent,
        isLockedFromDaily: p.isLockedFromDaily,
      })),
    });
    return res.dailyLimit;
  }, [workspace, activeNonOtherPots]);

  const lockedPotsCount = useMemo(
    () => activeNonOtherPots.filter((p) => p.isLockedFromDaily && p.allocatedAmount > 0).length,
    [activeNonOtherPots]
  );

  const handleTogglePot = (categoryId: string) => {
    setLimitNotice(null);
    setSaveError(null);
    const target = pots.find((p) => p.categoryId === categoryId);
    if (!target || target.isOther) return;

    if (!target.isSelected && activeNonOtherPots.length >= MAX_ACTIVE_POTS) {
      setLimitNotice(
        `Maksimal ${MAX_ACTIVE_POTS} pos aktif agar pembagian tetap simpel dan tidak memenuhi layar.`
      );
      return;
    }

    const nextSelected = !target.isSelected;
    setPots((prev) =>
      prev.map((p) =>
        p.categoryId === categoryId
          ? {
              ...p,
              isSelected: nextSelected,
              isLockedFromDaily: nextSelected ? p.isLockedFromDaily : false,
            }
          : p
      )
    );

    if (nextSelected) {
      setExpandedCatId(categoryId);
    } else if (expandedCatId === categoryId) {
      setExpandedCatId(null);
    }
  };

  const handleApplyRateChip = (categoryId: string, rateValue: number) => {
    setPots((prev) =>
      prev.map((p) => {
        if (p.categoryId !== categoryId) return p;
        const nextAllocated = calculatePotPeriodAllocation(rateValue, p.cadence, cycleDays);
        return {
          ...p,
          unitAmount: rateValue,
          allocatedAmount: nextAllocated,
        };
      })
    );
  };

  const handleAddMonthlyChip = (categoryId: string, delta: number) => {
    setPots((prev) =>
      prev.map((p) => {
        if (p.categoryId !== categoryId) return p;
        const nextVal = Math.min(999999999, Math.max(0, p.allocatedAmount + delta));
        return {
          ...p,
          unitAmount: nextVal,
          allocatedAmount: nextVal,
        };
      })
    );
  };

  const handleFillWithFreeRemaining = (categoryId: string) => {
    setPots((prev) =>
      prev.map((p) => {
        if (p.categoryId !== categoryId) return p;
        const nextVal = Math.max(0, p.allocatedAmount + summary.safeFreeRemaining);
        return {
          ...p,
          unitAmount: nextVal,
          allocatedAmount: nextVal,
        };
      })
    );
  };

  const handleDirectPeriodAmountChange = (categoryId: string, rawText: string) => {
    const clean = rawText.replace(/[^0-9]/g, "");
    const nextAllocated = clean ? Math.min(999999999, parseInt(clean, 10)) : 0;
    setPots((prev) =>
      prev.map((p) => {
        if (p.categoryId !== categoryId) return p;
        return {
          ...p,
          allocatedAmount: nextAllocated,
          unitAmount:
            p.cadence === "monthly"
              ? nextAllocated
              : p.cadence === "daily"
              ? Math.round(nextAllocated / Math.max(1, cycleDays))
              : Math.round((nextAllocated * 7) / Math.max(1, cycleDays)),
        };
      })
    );
  };

  const handleToggleLock = (categoryId: string) => {
    setPots((prev) =>
      prev.map((p) =>
        p.categoryId === categoryId
          ? { ...p, isLockedFromDaily: !p.isLockedFromDaily }
          : p
      )
    );
  };

  const handleCreateCustomPot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || isAddingPos) return;
    setAddError(null);
    setLimitNotice(null);

    if (activeNonOtherPots.length >= MAX_ACTIVE_POTS) {
      setAddError(
        `Maksimal ${MAX_ACTIVE_POTS} pos aktif sudah tercapai. Hapus centang salah satu pos dulu sebelum menambah pos baru.`
      );
      return;
    }

    setIsAddingPos(true);
    try {
      const res = await createCustomCategoryPotAction({
        name: customName.trim(),
        cadence: customCadence,
      });
      if (res.success && res.data) {
        const added = res.data;
        setPots((prev) => {
          const exists = prev.some((p) => p.categoryId === added.categoryId);
          if (exists) {
            return prev.map((p) =>
              p.categoryId === added.categoryId
                ? { ...p, isSelected: true, cadence: customCadence }
                : p
            );
          }
          const others = prev.filter((p) => !p.isOther);
          const lainnya = prev.filter((p) => p.isOther);
          return [...others, added, ...lainnya];
        });
        setExpandedCatId(added.categoryId);
        setCustomName("");
        setShowAddPos(false);
      } else {
        setAddError(res.error || "Gagal menambah pos baru");
      }
    } catch {
      setAddError("Gagal menambah pos baru. Coba lagi.");
    } finally {
      setIsAddingPos(false);
    }
  };

  const handleSelectSecondaryPot = (categoryId: string) => {
    setAddError(null);
    setLimitNotice(null);
    if (activeNonOtherPots.length >= MAX_ACTIVE_POTS) {
      setAddError(
        `Maksimal ${MAX_ACTIVE_POTS} pos aktif sudah tercapai. Nonaktifkan salah satu pos dulu.`
      );
      return;
    }
    setPots((prev) =>
      prev.map((p) =>
        p.categoryId === categoryId ? { ...p, isSelected: true } : p
      )
    );
    setExpandedCatId(categoryId);
    setShowAddPos(false);
  };

  const handleSaveAll = async () => {
    if (isSaving || pots.length === 0) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveToast(null);

    try {
      const res = await saveCategoryPotsBatchAction({
        pots: pots
          .filter((p) => !p.isOther)
          .map((p, idx) => ({
            categoryId: p.categoryId,
            isSelected: p.isSelected,
            cadence: p.cadence,
            unitAmount: p.unitAmount,
            allocatedAmount: p.allocatedAmount,
            isLockedFromDaily: p.isLockedFromDaily,
            sortOrder: idx + 1,
          })),
      });

      if (res.success) {
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
        const filledCount = activeNonOtherPots.filter((p) => p.allocatedAmount > 0).length;
        setSaveToast(
          filledCount > 0
            ? `${filledCount} pos jatah berhasil disimpan! Batas Hari Ini jadi ${formatRupiah(liveDailyLimit)}.`
            : "Pengaturan pos kategori berhasil diperbarui."
        );
        setTimeout(() => setSaveToast(null), 6000);
      } else {
        setSaveError(res.error || "Gagal menyimpan pembagian jatah");
      }
    } catch {
      setSaveError("Gagal menyimpan ke server. Periksa koneksi internetmu.");
    } finally {
      setIsSaving(false);
    }
  };

  const checklistChips = pots.filter(
    (p) => p.isDefault || p.isSelected || p.isCustom
  );
  const secondaryUnselected = pots.filter(
    (p) => !p.isDefault && !p.isSelected && !p.isOther && !p.isCustom
  );
  const lainnyaPot = pots.find((p) => p.isOther);

  const usedPercent =
    availableFunds > 0
      ? Math.min(100, Math.round((summary.totalAllocated / availableFunds) * 100))
      : summary.totalAllocated > 0
      ? 100
      : 0;

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-4 pb-24">
        <div className="space-y-1.5">
          <div className="h-7 w-48 bg-card rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-card rounded animate-pulse" />
        </div>
        <div className="h-24 bg-card border border-border rounded-xl animate-pulse" />
        <div className="h-40 bg-card border border-border rounded-xl animate-pulse" />
        <div className="h-36 bg-card border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto p-6 bg-card border border-border rounded-2xl text-center space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-expense/15 text-expense flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-black text-foreground">Atur Jatah Kategori</h1>
          <p className="text-xs text-muted-foreground">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadWorkspace()}
          className="inline-flex items-center gap-1.5 bg-accent text-[#1F1F1F] font-black text-xs px-5 py-2.5 min-h-[44px] rounded-full"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Coba Muat Lagi</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-3.5 mobile-page-dock-pb">
      {/* Judul Layar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Atur Jatah Kategori
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bagi uangmu ke pos yang dipakai saja dalam 1 layar, lalu simpan sekaligus.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-accent" />
          <span>{cycleDays} hari</span>
        </span>
      </div>

      {/* Header Sticky Ringkas: menempel tepat di bawah TopHeader tanpa pernah terpotong */}
      <div
        style={{ top: isMobileViewport ? `${stickyTop}px` : "8px" }}
        className="sticky z-30 -mx-4 px-4 pt-1 pb-2 bg-background md:mx-0 md:px-0"
      >
        <section className="bg-card border border-border rounded-xl p-3 shadow-md space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 truncate">
                <Wallet className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="truncate">Tersedia</span>
              </span>
              <span className="text-xs sm:text-sm font-black text-foreground block truncate mt-0.5">
                {formatRupiah(availableFunds)}
              </span>
            </div>

            <div className="min-w-0">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 truncate">
                <PieChart className="w-3 h-3 text-accent shrink-0" />
                <span className="truncate">Dibagi</span>
              </span>
              <span className="text-xs sm:text-sm font-black text-accent block truncate mt-0.5">
                {formatRupiah(summary.totalAllocated)}
              </span>
            </div>

            <div className="min-w-0 text-right">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block truncate">
                {summary.isOverAllocated ? "Kelebihan" : "Sisa Bebas"}
              </span>
              <span
                className={`text-xs sm:text-sm font-black block truncate mt-0.5 ${
                  summary.isOverAllocated ? "text-expense" : "text-foreground"
                }`}
              >
                {summary.isOverAllocated
                  ? `-${formatRupiah(summary.overAllocatedAmount)}`
                  : formatRupiah(summary.safeFreeRemaining)}
              </span>
            </div>
          </div>

          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border/70">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                summary.isOverAllocated ? "bg-expense" : "bg-accent"
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
              <Wallet className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>
                Batas Hari Ini jadi{" "}
                <strong className="text-foreground font-black">
                  {formatRupiah(liveDailyLimit)}
                </strong>
              </span>
            </div>

            {summary.isOverAllocated ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-expense/15 text-expense">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>Tetap bisa disimpan</span>
              </span>
            ) : lockedPotsCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFB04A]/15 text-[#FFB04A]">
                <Lock className="w-3 h-3 shrink-0" />
                <span>{lockedPotsCount} dikunci</span>
              </span>
            ) : null}
          </div>
        </section>
      </div>

      {/* Feedback Simpan */}
      <AnimatePresence>
        {saveToast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3.5 rounded-xl bg-accent/15 border border-accent/40 text-foreground space-y-2 shadow-sm"
          >
            <div className="flex items-start gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>{saveToast}</span>
            </div>
            <div className="flex items-center gap-3 pl-6 text-xs font-extrabold">
              <Link href="/dashboard" className="text-accent hover:underline flex items-center gap-1">
                <span>Lihat Beranda</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link href="/statistics" className="text-muted-foreground hover:text-foreground">
                Lihat Statistik
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {saveError && (
        <div className="p-3 rounded-xl bg-expense/15 border border-expense/40 text-xs font-bold text-expense flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Langkah 1: Centang Pos yang Dipakai (Grid 2 kolom rapi) */}
      <section className="bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsChecklistOpen((prev) => !prev)}
            className="flex items-center gap-2 min-h-[44px] text-left min-w-0"
          >
            <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
                  1. Pos Dipakai
                </h2>
                <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                  {activeNonOtherPots.length}/{MAX_ACTIVE_POTS}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Kos, WiFi &amp; Listrik via Dana Terkunci
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsChecklistOpen(true);
                setShowAddPos((prev) => !prev);
                setAddError(null);
                setTimeout(() => addInputRef.current?.focus(), 60);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-full bg-background border border-border hover:border-accent text-xs font-bold text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5] text-accent" />
              <span>Tambah pos</span>
            </button>
            <button
              type="button"
              onClick={() => setIsChecklistOpen((prev) => !prev)}
              aria-label={isChecklistOpen ? "Tutup daftar pilihan pos" : "Buka daftar pilihan pos"}
              className="w-10 h-10 min-w-[40px] min-h-[44px] rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isChecklistOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        {isChecklistOpen && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              {checklistChips.map((pot) => {
                const Icon = getPotIcon(pot.name, pot.icon);
                if (pot.isOther) {
                  return (
                    <div
                      key={pot.categoryId}
                      className="flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl bg-background/70 border border-border text-xs font-bold text-muted-foreground"
                      title="Selalu aktif sebagai penampung Sisa Bebas"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0 stroke-[2]" />
                        <span className="truncate">{pot.name}</span>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
                    </div>
                  );
                }

                return (
                  <button
                    key={pot.categoryId}
                    type="button"
                    onClick={() => handleTogglePot(pot.categoryId)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold border transition-all text-left ${
                      pot.isSelected
                        ? "bg-accent/12 border-accent text-foreground"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 stroke-[2] ${
                          pot.isSelected ? "text-accent" : "text-muted-foreground"
                        }`}
                      />
                      <span className="truncate">{pot.name}</span>
                    </div>
                    {pot.isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {limitNotice && (
              <p className="text-xs font-bold text-[#FFB04A] bg-[#FFB04A]/15 border border-[#FFB04A]/30 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{limitNotice}</span>
              </p>
            )}

            {/* Panel "+ Tambah pos" inline */}
            <AnimatePresence>
              {showAddPos && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-2.5 border-t border-border/60 space-y-3"
                >
                  {secondaryUnselected.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Pos Tambahan Siap Pakai
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {secondaryUnselected.map((sec) => {
                          const SecIcon = getPotIcon(sec.name, sec.icon);
                          return (
                            <button
                              key={sec.categoryId}
                              type="button"
                              onClick={() => handleSelectSecondaryPot(sec.categoryId)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-background border border-border hover:border-accent text-xs font-bold text-foreground transition-colors"
                            >
                              <SecIcon className="w-3.5 h-3.5 text-accent" />
                              <span>{sec.name}</span>
                              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleCreateCustomPot} className="space-y-2.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Buat Pos Kustom Baru
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        ref={addInputRef}
                        type="text"
                        maxLength={40}
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Contoh: Skincare, Olahraga, Hobi..."
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button
                        type="submit"
                        disabled={!customName.trim() || isAddingPos}
                        className="px-4 py-2 min-h-[44px] rounded-xl bg-accent text-[#1F1F1F] text-xs font-black disabled:opacity-50 shrink-0"
                      >
                        {isAddingPos ? "Menambah..." : "Tambah"}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground font-semibold mr-1">
                        Sifat pos:
                      </span>
                      {(["daily", "weekly", "monthly"] as const).map((cad) => {
                        const CadIcon = CADENCE_META[cad].icon;
                        return (
                          <button
                            key={cad}
                            type="button"
                            onClick={() => setCustomCadence(cad)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full text-xs font-bold border transition-all ${
                              customCadence === cad
                                ? "bg-foreground text-background border-foreground"
                                : "bg-background text-muted-foreground border-border hover:text-foreground"
                            }`}
                          >
                            <CadIcon className="w-3.5 h-3.5" />
                            <span>{CADENCE_META[cad].label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {addError && (
                      <p className="text-xs font-bold text-expense">{addError}</p>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Langkah 2: Isi Jatah Per Pos (Accordion Ramping) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            2. Isi Jatah Per Pos
          </h2>
          <span className="text-xs text-muted-foreground">
            Ketuk baris untuk atur
          </span>
        </div>

        {activeNonOtherPots.length === 0 ? (
          <div className="p-6 bg-card border border-dashed border-border rounded-xl text-center space-y-1.5">
            <p className="text-xs font-bold text-foreground">Belum ada pos yang dicentang</p>
            <p className="text-xs text-muted-foreground">
              Pilih pos di bagian atas jika ingin memasang jatah, atau biarkan semua dana di{" "}
              <strong>Sisa Bebas (Lainnya)</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeNonOtherPots.map((pot) => {
              const Icon = getPotIcon(pot.name, pot.icon);
              const CadenceIcon = CADENCE_META[pot.cadence].icon;
              const isExpanded = expandedCatId === pot.categoryId;
              const placeholder =
                PLACEHOLDER_BY_NAME[pot.name.toLowerCase().trim()] || "Contoh: 150.000";

              const formulaText =
                pot.allocatedAmount > 0 && pot.unitAmount > 0
                  ? pot.cadence === "daily"
                    ? `${formatRupiah(pot.unitAmount)} × ${cycleDays} hari = ${formatRupiah(pot.allocatedAmount)}`
                    : pot.cadence === "weekly"
                    ? `${formatRupiah(pot.unitAmount)} × ${cycleDays} hari / 7 = ${formatRupiah(pot.allocatedAmount)}`
                    : null
                  : null;

              return (
                <div
                  key={pot.categoryId}
                  className={`bg-card border rounded-xl transition-colors overflow-hidden ${
                    isExpanded ? "border-accent shadow-md" : "border-border shadow-xs"
                  }`}
                >
                  {/* Row Ringkas Pos */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCatId((prev) =>
                        prev === pot.categoryId ? null : pot.categoryId
                      )
                    }
                    className="w-full p-3.5 min-h-[56px] flex items-center justify-between gap-2 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                          isExpanded
                            ? "bg-accent/15 border-accent/40 text-accent"
                            : "bg-background border-border text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-foreground truncate">
                            {pot.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground shrink-0">
                            <CadenceIcon className="w-3 h-3" />
                            <span>{CADENCE_META[pot.cadence].label}</span>
                          </span>
                          {pot.isLockedFromDaily && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFB04A]/15 text-[#FFB04A] shrink-0">
                              <Lock className="w-3 h-3" />
                              <span>Terkunci</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {pot.periodSpent > 0
                            ? `Terpakai siklus ini ${formatRupiah(pot.periodSpent)}`
                            : formulaText || "Ketuk untuk isi jatah & kalkulator"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-black ${
                          pot.allocatedAmount > 0
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {pot.allocatedAmount > 0 ? formatRupiah(pot.allocatedAmount) : "Belum diisi"}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-accent" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Accordion Detail: Kalkulator Bantu + Toggle Kunci */}
                  {isExpanded && (
                    <div className="px-3.5 pb-4 pt-2.5 border-t border-border/60 bg-background/40 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-foreground">
                            Jatah Siklus ({cycleDays} hari)
                          </label>
                          {pot.allocatedAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleDirectPeriodAmountChange(pot.categoryId, "")}
                              className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 min-h-[32px]"
                            >
                              Kosongkan
                            </button>
                          )}
                        </div>

                        <div className="relative flex items-center bg-card border border-border rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent">
                          <span className="text-sm font-black text-muted-foreground mr-2">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              pot.allocatedAmount > 0
                                ? pot.allocatedAmount.toLocaleString("id-ID")
                                : ""
                            }
                            onChange={(e) =>
                              handleDirectPeriodAmountChange(pot.categoryId, e.target.value)
                            }
                            placeholder={placeholder}
                            className="flex-1 min-w-0 bg-transparent text-base sm:text-sm font-black text-foreground placeholder:text-muted-foreground/45 placeholder:font-semibold focus:outline-none"
                          />
                        </div>

                        {formulaText && (
                          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span>
                              {formulaText}
                              {pot.cadence === "weekly" ? " (bulat ribuan)" : ""}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Kalkulator Bantu Sesuai Sifat Pos */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                          {pot.cadence === "daily"
                            ? "Patokan Harian (× hari siklus)"
                            : pot.cadence === "weekly"
                            ? "Patokan Mingguan (× hari siklus / 7)"
                            : "Isi Cepat Bulanan"}
                        </span>

                        {pot.cadence === "daily" && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: "15rb/hari", val: 15000 },
                              { label: "25rb/hari", val: 25000 },
                              { label: "35rb/hari", val: 35000 },
                            ].map((chip) => (
                              <button
                                key={chip.val}
                                type="button"
                                onClick={() => handleApplyRateChip(pot.categoryId, chip.val)}
                                className={`px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold border transition-all ${
                                  pot.unitAmount === chip.val && pot.allocatedAmount > 0
                                    ? "bg-accent text-[#1F1F1F] border-accent font-black"
                                    : "bg-card border-border text-foreground hover:border-accent"
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {pot.cadence === "weekly" && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: "25rb/minggu", val: 25000 },
                              { label: "50rb/minggu", val: 50000 },
                              { label: "100rb/minggu", val: 100000 },
                            ].map((chip) => (
                              <button
                                key={chip.val}
                                type="button"
                                onClick={() => handleApplyRateChip(pot.categoryId, chip.val)}
                                className={`px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold border transition-all ${
                                  pot.unitAmount === chip.val && pot.allocatedAmount > 0
                                    ? "bg-accent text-[#1F1F1F] border-accent font-black"
                                    : "bg-card border-border text-foreground hover:border-accent"
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {pot.cadence === "monthly" && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddMonthlyChip(pot.categoryId, 50000)}
                              className="px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold bg-card border border-border text-foreground hover:border-accent transition-all"
                            >
                              +50rb
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddMonthlyChip(pot.categoryId, 100000)}
                              className="px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold bg-card border border-border text-foreground hover:border-accent transition-all"
                            >
                              +100rb
                            </button>
                            <button
                              type="button"
                              disabled={summary.safeFreeRemaining <= 0}
                              onClick={() => handleFillWithFreeRemaining(pot.categoryId)}
                              className="px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-45 disabled:cursor-not-allowed transition-all"
                            >
                              Isi dengan sisa dana bebas
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Toggle Kunci Dari Batas Harian */}
                      <div className="p-3 rounded-xl bg-card border border-border/80 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-[#FFB04A] shrink-0" />
                              <span>Kunci dari batas harian</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Pisahkan jatah pos ini dari hitungan Batas Hari Ini agar tidak terpakai untuk jajan.
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={pot.isLockedFromDaily}
                            aria-label={`Kunci pos ${pot.name} dari batas harian`}
                            onClick={() => handleToggleLock(pot.categoryId)}
                            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 p-1 flex items-center ${
                              pot.isLockedFromDaily ? "bg-[#FFB04A]" : "bg-muted border border-border"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                pot.isLockedFromDaily ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        <p className="text-xs font-bold text-foreground pt-1 border-t border-border/50">
                          Dampak langsung: Batas Hari Ini jadi{" "}
                          <span className="text-accent font-black">
                            {formatRupiah(liveDailyLimit)}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Baris Info Sisa Bebas (Pos Lainnya — Tidak Bisa Dihapus) */}
        {lainnyaPot && (
          <div className="p-3.5 bg-card/70 border border-border rounded-xl flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground">
                  {lainnyaPot.name}{" "}
                  <span className="text-muted-foreground font-semibold">• Sisa Bebas</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Menampung transaksi tanpa jatah ({formatRupiah(lainnyaPot.periodSpent)} terpakai)
                </p>
              </div>
            </div>
            <span className="font-black text-foreground shrink-0">
              {formatRupiah(summary.safeFreeRemaining)}
            </span>
          </div>
        )}
      </section>

      {/* Langkah 3: Dock Bawah Solid untuk "Simpan Semua Pos" (Menutup celah di bawah Bottom Bar) */}
      <div
        style={{
          bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : "0px",
          transform: "translate3d(0, 0, 0)",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
        className={`fixed left-0 right-0 bg-background border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:static md:bottom-auto md:bg-transparent md:border-0 md:shadow-none md:z-auto md:!transform-none ${
          keyboardOffset > 0 ? "z-[60]" : "z-40"
        }`}
      >
        <div
          className={`max-w-xl mx-auto px-4 pt-2.5 md:p-0 ${
            keyboardOffset > 0 ? "pb-3" : "mobile-dock-spacer"
          }`}
        >
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSaveAll()}
            className="w-full py-3.5 min-h-[48px] rounded-full bg-accent hover:brightness-110 active:scale-[0.98] text-[#1F1F1F] text-sm font-black transition-transform flex items-center justify-center gap-2 shadow-md disabled:opacity-60 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {isSaving
                ? "Menyimpan semua pos..."
                : `Simpan Semua Pos (${activeNonOtherPots.filter((p) => p.allocatedAmount > 0).length} terisi)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
