"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Target,
  X,
  Calendar,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit3,
  TrendingUp,
  Coins,
  Check,
  ChevronRight,
  AlertCircle,
  Landmark,
  Smartphone,
  Banknote,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { getJakartaDateString, calculateTargetDeadlineCountdown } from "@/lib/finance";
import {
  getSavingsDataAction,
  createSavingsGoalAction,
  updateSavingsGoalAction,
  deleteSavingsGoalAction,
  depositToGoalAction,
  withdrawFromGoalAction,
  updateAutoCarryoverGoalAction,
} from "@/app/actions/savings";
import { getAccountsAction } from "@/app/actions/accounts";

interface GoalEntry {
  id: string;
  type: "deposit" | "withdraw";
  amount: number;
  date: string;
  note: string;
  source?: string;
  accountId?: string | null;
  accountName?: string | null;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  isDefault: boolean;
}

interface GoalItem {
  id: string;
  name: string;
  target: number;
  collected: number;
  percentage: number;
  color: string;
  icon: string;
  targetDate: string;
  rawTargetDate: string | null;
  remainingDays: number;
  weeklySuggestion: number;
  monthlySuggestion: number;
  status: string;
  entries: GoalEntry[];
}

const QUICK_AMOUNTS = [
  { label: "+10rb", value: 10000 },
  { label: "+20rb", value: 20000 },
  { label: "+50rb", value: 50000 },
  { label: "+100rb", value: 100000 },
];

export default function SavingsPage() {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [totalSaved, setTotalSaved] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals States
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<GoalItem | null>(null);

  const [detailGoal, setDetailGoal] = useState<GoalItem | null>(null);

  // Form State: Goal (Create / Edit)
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [targetDate, setTargetDate] = useState("");
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);

  // Form State: Deposit / Withdraw
  const [actionAmount, setActionAmount] = useState<number>(0);
  const [actionDate, setActionDate] = useState(() => getJakartaDateString());
  const [actionNote, setActionNote] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Multi-Rekening State
  const [accountsList, setAccountsList] = useState<AccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [autoCarryoverGoalId, setAutoCarryoverGoalId] = useState<string>("");
  const [isSavingCarryoverPref, setIsSavingCarryoverPref] = useState(false);

  // Toast Motivasi Tabungan (PRD M7)
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastQuote, setToastQuote] = useState("");

  const syncDefaultAccount = (list: AccountItem[]) => {
    setSelectedAccountId((prev) => {
      if (prev === "") {
        const def = list.find((a) => a.isDefault) || list[0];
        return def?.id || "";
      }
      if (list.some((a) => a.id === prev)) return prev;
      const def = list.find((a) => a.isDefault) || list[0];
      return def?.id || "";
    });
  };

  const loadSavings = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [res, accRes] = await Promise.all([getSavingsDataAction(), getAccountsAction()]);
      if (res.success && res.data) {
        setGoals(res.data.goals);
        setTotalSaved(res.data.totalSaved);
        setAutoCarryoverGoalId(res.data.autoCarryoverGoalId || "");
        try {
          localStorage.setItem("sakuin_cached_savings", JSON.stringify(res.data));
        } catch {}

        // Update detail goal if open
        if (detailGoal) {
          const updated = res.data.goals.find((g: GoalItem) => g.id === detailGoal.id);
          if (updated) setDetailGoal(updated);
        }
      }

      if (accRes.success && accRes.data && accRes.data.accounts.length > 0) {
        setAccountsList(accRes.data.accounts);
        syncDefaultAccount(accRes.data.accounts);
        try {
          localStorage.setItem("sakuin_cached_accounts", JSON.stringify(accRes.data));
        } catch {}
      }
    } catch (err) {
      console.error("Gagal memuat tabungan:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let hasCache = false;
    try {
      const cached = localStorage.getItem("sakuin_cached_savings");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.goals)) {
          setGoals(parsed.goals);
          setTotalSaved(parsed.totalSaved || 0);
          setIsLoading(false);
          hasCache = true;
        }
      }

      const cachedAcc = localStorage.getItem("sakuin_cached_accounts");
      if (cachedAcc) {
        const parsedAcc = JSON.parse(cachedAcc);
        const list = Array.isArray(parsedAcc) ? parsedAcc : parsedAcc?.accounts || [];
        if (list.length > 0) {
          setAccountsList(list);
          syncDefaultAccount(list);
        }
      }
    } catch {}

    loadSavings(hasCache);

    const handleRefresh = () => {
      loadSavings(true);
    };
    window.addEventListener("sakuin:data-invalidated", handleRefresh);
    window.addEventListener("sakuin:sync-complete", handleRefresh);
    return () => {
      window.removeEventListener("sakuin:data-invalidated", handleRefresh);
      window.removeEventListener("sakuin:sync-complete", handleRefresh);
    };
  }, []);

  // Open Create Goal Modal
  const openCreateGoalModal = () => {
    setEditingGoal(null);
    setGoalName("");
    setTargetAmount(0);
    setTargetDate("");
    setIsGoalModalOpen(true);
  };

  // Open Edit Goal Modal
  const openEditGoalModal = (goal: GoalItem) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setTargetAmount(goal.target);
    setTargetDate(goal.rawTargetDate || "");
    setIsGoalModalOpen(true);
  };

  // Submit Goal (Create / Update)
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim() || targetAmount <= 0 || isSubmittingGoal) return;

    setIsSubmittingGoal(true);
    try {
      if (editingGoal) {
        const res = await updateSavingsGoalAction(editingGoal.id, {
          name: goalName.trim(),
          targetAmount,
          targetDate: targetDate || undefined,
          icon: editingGoal.icon,
          color: editingGoal.color,
        });

        if (res.success) {
          setIsGoalModalOpen(false);
          await loadSavings();
        } else {
          alert(res.error || "Gagal mengubah target");
        }
      } else {
        const res = await createSavingsGoalAction({
          name: goalName.trim(),
          targetAmount,
          targetDate: targetDate || undefined,
          icon: "target",
          color: "#D4FF5A",
        });

        if (res.success) {
          setIsGoalModalOpen(false);
          await loadSavings();
        } else {
          alert(res.error || "Gagal membuat target");
        }
      }
    } catch (err) {
      console.error("Gagal simpan target tabungan:", err);
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (goal: GoalItem) => {
    const confirmText =
      goal.collected > 0
        ? `Target "${goal.name}" masih memiliki tabungan sebesar ${formatRupiah(goal.collected)}. Hapus target ini?`
        : `Hapus target impian "${goal.name}"?`;

    const ok = window.confirm(confirmText);
    if (!ok) return;

    try {
      const res = await deleteSavingsGoalAction(goal.id);
      if (res.success) {
        setDetailGoal(null);
        await loadSavings();
      } else {
        alert(res.error || "Gagal menghapus target");
      }
    } catch (err) {
      console.error("Gagal hapus target:", err);
    }
  };

  const ensureSelectedAccount = () => {
    if (!selectedAccountId && accountsList.length > 0) {
      const def = accountsList.find((a) => a.isDefault) || accountsList[0];
      if (def) setSelectedAccountId(def.id);
    }
  };

  const applyLocalAccountDelta = (accountId: string, delta: number) => {
    if (!accountId) return;
    setAccountsList((prev) => {
      const updated = prev.map((acc) =>
        acc.id === accountId ? { ...acc, balance: acc.balance + delta } : acc
      );
      try {
        const totalBalance = updated.reduce((s, a) => s + Number(a.balance || 0), 0);
        localStorage.setItem("sakuin_cached_accounts", JSON.stringify({ totalBalance, accounts: updated }));
      } catch {}
      return updated;
    });
  };

  const selectedAccount = accountsList.find((a) => a.id === selectedAccountId);
  const isDepositInsufficient =
    Boolean(selectedAccount) && actionAmount > 0 && (selectedAccount?.balance ?? 0) < actionAmount;

  // Open Deposit Modal
  const openDepositModal = (goal?: GoalItem) => {
    const target = goal || goals[0] || null;
    setSelectedGoalForAction(target);
    setActionAmount(0);
    setActionDate(getJakartaDateString());
    setActionNote("");
    ensureSelectedAccount();
    setIsDepositModalOpen(true);
  };

  // Open Withdraw Modal
  const openWithdrawModal = (goal?: GoalItem) => {
    const target = goal || goals.find((g) => g.collected > 0) || goals[0] || null;
    setSelectedGoalForAction(target);
    setActionAmount(0);
    setActionDate(getJakartaDateString());
    setActionNote("");
    ensureSelectedAccount();
    setIsWithdrawModalOpen(true);
  };

  // Submit Deposit (PRD S2, S5, M7)
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForAction || actionAmount <= 0 || isSubmittingAction) return;

    if (isDepositInsufficient && selectedAccount) {
      alert(`Saldo ${selectedAccount.name} tidak mencukupi untuk setoran ini.`);
      return;
    }

    setIsSubmittingAction(true);
    try {
      const res = await depositToGoalAction({
        goalId: selectedGoalForAction.id,
        amount: actionAmount,
        date: actionDate,
        note: actionNote.trim() || undefined,
        accountId: selectedAccountId || undefined,
      });

      if (res.success) {
        if (selectedAccountId) {
          applyLocalAccountDelta(selectedAccountId, -actionAmount);
        }
        window.dispatchEvent(new Event("sakuin:data-invalidated"));

        const accLabel = res.data?.accountName ? ` dari ${res.data.accountName}` : "";
        setIsDepositModalOpen(false);
        setToastMessage(`Berhasil menyetor ${formatRupiah(actionAmount)} ke ${selectedGoalForAction.name}${accLabel}!`);
        setToastQuote(res.data?.motivationQuote || "Setiap rupiah yang ditabung adalah ketenangan di masa depan.");
        setShowToast(true);

        await loadSavings(true);
        setTimeout(() => setShowToast(false), 6000);
      } else {
        alert(res.error || "Gagal menyetor dana");
      }
    } catch (err) {
      console.error("Gagal setor dana:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Submit Withdraw (PRD S2, S5)
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForAction || actionAmount <= 0 || isSubmittingAction) return;

    if (actionAmount > selectedGoalForAction.collected) {
      alert(`Maksimal penarikan adalah saldo yang tersedia (${formatRupiah(selectedGoalForAction.collected)})`);
      return;
    }

    setIsSubmittingAction(true);
    try {
      const res = await withdrawFromGoalAction({
        goalId: selectedGoalForAction.id,
        amount: actionAmount,
        date: actionDate,
        note: actionNote.trim() || undefined,
        accountId: selectedAccountId || undefined,
      });

      if (res.success) {
        if (selectedAccountId) {
          applyLocalAccountDelta(selectedAccountId, actionAmount);
        }
        window.dispatchEvent(new Event("sakuin:data-invalidated"));

        const accLabel = res.data?.accountName ? ` ke ${res.data.accountName}` : "";
        setIsWithdrawModalOpen(false);
        setToastMessage(`Berhasil menarik ${formatRupiah(actionAmount)} dari ${selectedGoalForAction.name}${accLabel}.`);
        setToastQuote(
          res.data?.accountName
            ? `Dana telah ditambahkan kembali ke saldo ${res.data.accountName}.`
            : "Dana telah dialihkan kembali ke saldo aktifmu."
        );
        setShowToast(true);

        await loadSavings(true);
        setTimeout(() => setShowToast(false), 5000);
      } else {
        alert(res.error || "Gagal menarik dana");
      }
    } catch (err) {
      console.error("Gagal tarik dana:", err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const renderAccountPicker = (mode: "deposit" | "withdraw") => {
    if (accountsList.length === 0) return null;
    const isDeposit = mode === "deposit";

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground">
            {isDeposit ? "Ambil dari Rekening" : "Masukkan ke Rekening"}
          </label>
          <span className="text-xs text-muted-foreground">Saldo otomatis terupdate</span>
        </div>

        <div
          className={`grid gap-2 ${
            accountsList.length === 1
              ? "grid-cols-1"
              : accountsList.length === 2
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3"
          }`}
        >
          {accountsList.map((acc) => {
            const isSelected = selectedAccountId === acc.id;
            const isInsufficient = isDeposit && actionAmount > 0 && acc.balance < actionAmount;
            const AccIcon =
              acc.type === "bank" ? Landmark : acc.type === "ewallet" ? Smartphone : Banknote;

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedAccountId(acc.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 ${
                  isSelected
                    ? isInsufficient
                      ? "border-expense bg-expense/10 text-expense ring-1 ring-expense"
                      : "border-accent bg-accent/15 text-foreground ring-1 ring-accent"
                    : isInsufficient
                    ? "border-border/60 bg-background/50 text-muted-foreground opacity-60 hover:opacity-100"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/60">
                    <AccIcon className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-bold truncate text-foreground">{acc.name}</span>
                </div>
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-xs font-semibold text-muted-foreground truncate">
                    {formatRupiah(acc.balance)}
                  </span>
                  {isInsufficient && (
                    <span className="text-xs font-bold text-expense bg-expense/15 px-1 py-0.5 rounded shrink-0">
                      Kurang
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSelectedAccountId("")}
          className={`w-full py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all text-center ${
            selectedAccountId === ""
              ? "border-accent bg-accent/10 text-foreground"
              : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          Catat saja (tanpa ubah saldo rekening)
        </button>

        {isDeposit && isDepositInsufficient && selectedAccount && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-expense/10 border border-expense/30 text-expense text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Saldo <strong>{selectedAccount.name}</strong> ({formatRupiah(selectedAccount.balance)}) tidak cukup. Pilih rekening lain atau kurangi nominal.
            </span>
          </div>
        )}
      </div>
    );
  };

  const handleChangeCarryoverGoal = async (nextGoalId: string) => {
    setAutoCarryoverGoalId(nextGoalId);
    setIsSavingCarryoverPref(true);
    try {
      const res = await updateAutoCarryoverGoalAction(nextGoalId || null);
      if (res.success) {
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      } else {
        alert(res.error || "Gagal menyimpan target sisa hemat");
      }
    } catch (err) {
      console.error("Gagal ubah target carryover:", err);
    } finally {
      setIsSavingCarryoverPref(false);
    }
  };

  const avgProgress =
    goals.length > 0
      ? Math.round(
          goals.reduce((acc, curr) => acc + (curr.target > 0 ? (curr.collected / curr.target) * 100 : 0), 0) /
            goals.length
        )
      : 0;

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-2">
      {/* Header Halaman Tabungan */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Target Tabungan
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola celengan virtual dan capai impianmu
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateGoalModal}
          className="inline-flex items-center gap-1.5 bg-accent hover:brightness-110 text-[#1F1F1F] font-black text-xs px-4 py-2 rounded-full shadow-md transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Target Baru</span>
        </button>
      </div>

      {/* Toast Notifikasi Motivasi Tabungan (PRD M7) */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="p-3.5 rounded-xl bg-card border border-accent/40 shadow-xl space-y-1"
          >
            <div className="flex items-center gap-2 text-accent font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            {toastQuote && (
              <p className="text-xs text-muted-foreground italic pl-6">
                &ldquo;{toastQuote}&rdquo;
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Ringkasan Tabungan Card (PRD S3) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-accent" />
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent uppercase tracking-widest">
                Tabungan
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Total Dana Terkumpul
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {isLoading ? "..." : formatRupiah(totalSaved)}
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              dari {goals.length} Target Impian
            </span>
          </div>
        </div>

        {/* Action Buttons: Setor & Tarik Langsung */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/60">
          <button
            type="button"
            disabled={goals.length === 0}
            onClick={() => openDepositModal()}
            className="py-2.5 px-3 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#1F1F1F] text-xs font-black rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
            <span>+ Setor Tabungan</span>
          </button>
          <button
            type="button"
            disabled={goals.length === 0 || totalSaved <= 0}
            onClick={() => openWithdrawModal()}
            className="py-2.5 px-3 bg-background hover:bg-muted border border-border disabled:opacity-40 disabled:cursor-not-allowed text-foreground text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4 text-expense stroke-[2.5]" />
            <span>- Tarik Dana</span>
          </button>
        </div>
      </section>

      {/* 1.5 Pengaturan Target Default Sisa Hemat (Carryover - PRD S9) */}
      {goals.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs font-extrabold text-foreground">
                Target Default Sisa Hemat
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sisa jatah harian yang tidak terpakai ditawarkan masuk ke target ini.
            </p>
          </div>
          <select
            value={autoCarryoverGoalId}
            disabled={isSavingCarryoverPref}
            onChange={(e) => handleChangeCarryoverGoal(e.target.value)}
            className="sm:w-52 px-3 py-2 min-h-[44px] bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer disabled:opacity-60"
          >
            <option value="">Pilih otomatis / tanya tiap kali</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* 2. Daftar Target Impian (PRD S1, S3, S4, S6) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
            Daftar Impian ({goals.length})
          </span>
          <span className="text-xs text-muted-foreground">
            Rata-rata progres: <strong className="text-accent">{avgProgress}%</strong>
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center bg-card rounded-xl border border-border">
            <p className="text-xs text-muted-foreground animate-pulse">Memuat data tabungan...</p>
          </div>
        ) : goals.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-xl border border-border space-y-3">
            <Target className="w-10 h-10 text-accent mx-auto opacity-70" />
            <div>
              <p className="text-sm font-bold text-foreground">Belum ada target tabungan</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-0.5">
                Mulai buat target impianmu seperti Dana Darurat, Laptop Baru, atau Pulang Kampung.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateGoalModal}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-accent text-[#1F1F1F] font-black text-xs rounded-full shadow-md hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Buat Target Sekarang</span>
            </button>
          </div>
        ) : (
          goals.map((goal) => {
            const isCompleted = goal.status === "completed" || goal.percentage >= 100;

            return (
              <div
                key={goal.id}
                className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3.5 hover:border-accent/40 transition-colors"
              >
                {/* Header Kartu Target */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="cursor-pointer space-y-0.5 flex-1 min-w-0"
                    onClick={() => setDetailGoal(goal)}
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-foreground truncate hover:text-accent transition-colors">
                        {goal.name}
                      </h2>
                      {isCompleted ? (
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-accent/20 text-accent shrink-0">
                          Tercapai
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground shrink-0">
                          Aktif
                        </span>
                      )}
                    </div>
                    {(() => {
                      const dl = calculateTargetDeadlineCountdown(goal.rawTargetDate);
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                          <span>Tenggat: {dl.hasDeadline ? dl.formattedDate : goal.targetDate}</span>
                          {dl.hasDeadline && dl.shortLabel && (
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-xs ${
                                isCompleted
                                  ? "bg-muted text-muted-foreground"
                                  : dl.urgency === "overdue"
                                  ? "bg-expense/15 text-[var(--expense-text)]"
                                  : dl.urgency === "today" || dl.urgency === "soon"
                                  ? "bg-amber-500/15 text-[var(--warning-text)]"
                                  : "bg-accent/15 text-[var(--accent-text)]"
                              }`}
                            >
                              {dl.shortLabel}
                              {!isCompleted && dl.diffDays === 0
                                ? " (Hari ini)"
                                : !isCompleted && dl.diffDays !== null && dl.diffDays < 0
                                ? " (Terlewat)"
                                : ""}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-foreground">
                      {goal.percentage}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailGoal(goal)}
                      className="text-xs text-muted-foreground hover:text-accent flex items-center justify-end gap-0.5 mt-0.5"
                    >
                      <span>Detail</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Nominal */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-accent font-black">
                      {formatRupiah(goal.collected)}
                    </span>
                    <span className="text-muted-foreground">
                      Target: {formatRupiah(goal.target)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted ? "bg-accent" : "bg-accent/80"
                      }`}
                      style={{ width: `${goal.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Saran Setoran Otomatis (PRD S4) */}
                {!isCompleted && goal.weeklySuggestion > 0 && (
                  <div className="p-2.5 rounded-lg bg-background border border-border flex items-center gap-2 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-muted-foreground">
                      Saran: Sisihkan{" "}
                      <strong className="text-foreground">
                        {formatRupiah(goal.weeklySuggestion)}/minggu
                      </strong>{" "}
                      agar selesai tepat waktu.
                    </span>
                  </div>
                )}

                {/* Tombol Aksi Cepat: Setor & Tarik */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openDepositModal(goal)}
                    className="py-2 px-3 bg-accent/15 hover:bg-accent/25 text-foreground text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                    <span>Setor</span>
                  </button>
                  <button
                    type="button"
                    disabled={goal.collected <= 0}
                    onClick={() => openWithdrawModal(goal)}
                    className="py-2 px-3 bg-background hover:bg-muted border border-border disabled:opacity-40 text-foreground text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-expense stroke-[2.5]" />
                    <span>Tarik</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Modal Setor Tabungan (Deposit) (PRD S2, S5) */}
      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-t-2xl sm:rounded-xl p-5 sm:p-6 pb-8 sm:pb-6 w-full max-w-md shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto scrollbar-none pb-safe"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Setor Dana Tabungan
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Menyisihkan uang dari sisa kiriman bulan ini
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDeposit} className="space-y-4">
                {/* Pilih Target Tujuan */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Pilih Target Impian
                  </label>
                  <select
                    value={selectedGoalForAction?.id || ""}
                    onChange={(e) => {
                      const g = goals.find((item) => item.id === e.target.value);
                      if (g) setSelectedGoalForAction(g);
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer"
                  >
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Terkumpul: {formatRupiah(g.collected)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Input Nominal Setoran */}
                <div className="bg-background rounded-xl border border-border p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Nominal Setoran
                  </span>
                  <div className="relative flex items-center bg-card border border-border rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent">
                    <span className="text-xl font-black text-muted-foreground mr-2 select-none shrink-0">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={actionAmount > 0 ? actionAmount.toLocaleString("id-ID") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const val = raw ? parseInt(raw, 10) : 0;
                        if (val <= 999999999) setActionAmount(val);
                      }}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-transparent text-2xl sm:text-3xl font-black text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                    />
                    {actionAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActionAmount(0)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/60 transition-colors shrink-0 ml-1.5"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Quick Helper Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-xs font-semibold text-muted-foreground mr-0.5">
                      Tambah:
                    </span>
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setActionAmount((prev) => Math.min(999999999, prev + q.value))}
                        className="px-2 py-0.5 rounded-full text-xs font-bold bg-card border border-border text-foreground hover:border-accent hover:text-accent active:scale-95 transition-all"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pilih Sumber Rekening */}
                {renderAccountPicker("deposit")}

                {/* Catatan / Keterangan */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Contoh: Sisa uang makan minggu ini, rezeki kerja sambilan..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Tanggal */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Tanggal Setoran</span>
                  </label>
                  <input
                    type="date"
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={actionAmount <= 0 || isDepositInsufficient || isSubmittingAction}
                    className="w-full py-3.5 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#1F1F1F] font-black rounded-full text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{isSubmittingAction ? "Menyimpan..." : "Setor ke Tabungan"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Modal Tarik Dana (Withdraw) (PRD S2, S5) */}
      <AnimatePresence>
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-t-2xl sm:rounded-xl p-5 sm:p-6 pb-8 sm:pb-6 w-full max-w-md shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto scrollbar-none pb-safe"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Tarik Dana Tabungan
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Dana akan dikembalikan ke saldo aktif bulan ini
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                {/* Pilih Target Sumber */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Pilih Target Sumber
                  </label>
                  <select
                    value={selectedGoalForAction?.id || ""}
                    onChange={(e) => {
                      const g = goals.find((item) => item.id === e.target.value);
                      if (g) setSelectedGoalForAction(g);
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer"
                  >
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Saldo: {formatRupiah(g.collected)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Input Nominal Penarikan */}
                <div className="bg-background rounded-xl border border-border p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Nominal Penarikan
                    </span>
                    <button
                      type="button"
                      onClick={() => setActionAmount(selectedGoalForAction?.collected || 0)}
                      className="text-xs font-extrabold text-accent hover:underline"
                    >
                      Tarik Semua ({formatRupiah(selectedGoalForAction?.collected || 0)})
                    </button>
                  </div>

                  <div className="relative flex items-center bg-card border border-border rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent">
                    <span className="text-xl font-black text-muted-foreground mr-2 select-none shrink-0">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={actionAmount > 0 ? actionAmount.toLocaleString("id-ID") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const val = raw ? parseInt(raw, 10) : 0;
                        if (val <= (selectedGoalForAction?.collected || 999999999)) {
                          setActionAmount(val);
                        }
                      }}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-transparent text-2xl sm:text-3xl font-black text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                    />
                    {actionAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActionAmount(0)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/60 transition-colors shrink-0 ml-1.5"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Pilih Rekening Tujuan */}
                {renderAccountPicker("withdraw")}

                {/* Catatan / Alasan Tarik */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Alasan / Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Contoh: Kebutuhan mendesak, servis laptop..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={
                      actionAmount <= 0 ||
                      actionAmount > (selectedGoalForAction?.collected || 0) ||
                      isSubmittingAction
                    }
                    className="w-full py-3.5 bg-expense hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-full text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                    <span>{isSubmittingAction ? "Memproses..." : "Tarik ke Saldo Aktif"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Modal Buat / Ubah Target (PRD S1, S7) */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-t-2xl sm:rounded-xl p-5 sm:p-6 pb-8 sm:pb-6 w-full max-w-md shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto scrollbar-none pb-safe"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  {editingGoal ? "Ubah Target Impian" : "Buat Target Impian Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveGoal} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Nama Target Impian
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="Contoh: Dana Darurat, Laptop Baru, Liburan..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Nominal Target */}
                <div className="bg-background rounded-xl border border-border p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Target Nominal
                  </span>
                  <div className="relative flex items-center bg-card border border-border rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent">
                    <span className="text-xl font-black text-muted-foreground mr-2 select-none shrink-0">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={targetAmount > 0 ? targetAmount.toLocaleString("id-ID") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const val = raw ? parseInt(raw, 10) : 0;
                        if (val <= 999999999) setTargetAmount(val);
                      }}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-transparent text-2xl sm:text-3xl font-black text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tenggat Waktu (Opsional) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Tenggat Waktu</span>
                    <span className="text-xs text-muted-foreground">Opsional</span>
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!goalName.trim() || targetAmount <= 0 || isSubmittingGoal}
                    className="w-full py-3.5 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#1F1F1F] font-black rounded-full text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{isSubmittingGoal ? "Menyimpan..." : "Simpan Target"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Modal Detail & Riwayat Mutasi Target (PRD S3, S7) */}
      <AnimatePresence>
        {detailGoal && (
          <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-t-2xl sm:rounded-xl p-5 sm:p-6 pb-8 sm:pb-6 w-full max-w-md shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto scrollbar-none pb-safe"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-foreground">
                    {detailGoal.name}
                  </h3>
                  {detailGoal.status === "completed" && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                      Tercapai
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailGoal(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Box */}
              <div className="bg-background rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Dana Terkumpul</span>
                  <span className="font-black text-accent text-sm">
                    {formatRupiah(detailGoal.collected)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Target Nominal</span>
                  <span className="font-bold text-foreground">
                    {formatRupiah(detailGoal.target)}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${detailGoal.percentage}%` }}
                  />
                </div>
                {(() => {
                  const dl = calculateTargetDeadlineCountdown(detailGoal.rawTargetDate);
                  const detailCompleted = detailGoal.status === "completed" || detailGoal.percentage >= 100;
                  return (
                    <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5 flex-wrap">
                      <span>
                        Tenggat:{" "}
                        <strong className="text-foreground">
                          {dl.hasDeadline ? dl.formattedDate : detailGoal.targetDate}
                        </strong>
                      </span>
                      {dl.hasDeadline && dl.displayText && (
                        <span
                          className={`font-bold ${
                            detailCompleted
                              ? "text-muted-foreground"
                              : dl.urgency === "overdue"
                              ? "text-[var(--expense-text)]"
                              : dl.urgency === "today" || dl.urgency === "soon"
                              ? "text-[var(--warning-text)]"
                              : "text-[var(--accent-text)]"
                          }`}
                        >
                          • {detailCompleted ? dl.shortLabel : dl.displayText}
                        </span>
                      )}
                    </p>
                  );
                })()}
              </div>

              {/* Saran Setoran (PRD S4) */}
              {detailGoal.weeklySuggestion > 0 && detailGoal.status !== "completed" && (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-accent font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Saran Alokasi Setoran</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sisihkan{" "}
                    <strong className="text-foreground">
                      {formatRupiah(detailGoal.weeklySuggestion)} per minggu
                    </strong>{" "}
                    atau{" "}
                    <strong className="text-foreground">
                      {formatRupiah(detailGoal.monthlySuggestion)} per bulan
                    </strong>{" "}
                    agar target selesai tepat waktu.
                  </p>
                </div>
              )}

              {/* Riwayat Mutasi Target Ini */}
              <div className="space-y-2">
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block">
                  Riwayat Mutasi Tabungan
                </span>

                {detailGoal.entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 bg-background rounded-lg border border-border">
                    Belum ada riwayat setor atau tarik pada target ini.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {detailGoal.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                              entry.type === "deposit"
                                ? "bg-accent/20 text-accent"
                                : "bg-expense/20 text-expense"
                            }`}
                          >
                            {entry.type === "deposit" ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-foreground">{entry.note}</p>
                              {entry.source === "carryover" && (
                                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                                  Sisa Hemat
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {entry.date}
                              {entry.accountName ? ` • ${entry.accountName}` : ""}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`font-black ${
                            entry.type === "deposit" ? "text-accent" : "text-expense"
                          }`}
                        >
                          {entry.type === "deposit" ? "+" : "-"}
                          {formatRupiah(entry.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons: Setor / Tarik / Edit / Delete */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailGoal(null);
                      openDepositModal(detailGoal);
                    }}
                    className="py-2.5 bg-accent hover:brightness-110 text-[#1F1F1F] font-bold text-xs rounded-full transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Setor Dana</span>
                  </button>
                  <button
                    type="button"
                    disabled={detailGoal.collected <= 0}
                    onClick={() => {
                      setDetailGoal(null);
                      openWithdrawModal(detailGoal);
                    }}
                    className="py-2.5 bg-background hover:bg-muted border border-border disabled:opacity-40 text-foreground font-bold text-xs rounded-full transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-expense" />
                    <span>Tarik Dana</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const g = detailGoal;
                      setDetailGoal(null);
                      openEditGoalModal(g);
                    }}
                    className="py-2 bg-background hover:bg-muted border border-border text-foreground text-xs font-semibold rounded-full transition-all flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3 h-3 text-muted-foreground" />
                    <span>Ubah Target</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(detailGoal)}
                    className="py-2 border border-expense/30 hover:bg-expense/10 text-expense text-xs font-semibold rounded-full transition-all flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Target</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
