"use client";

import React, { useState, useEffect } from "react";
import {
  Landmark,
  Smartphone,
  Banknote,
  Plus,
  ArrowRightLeft,
  SlidersHorizontal,
  Trash2,
  X,
  Lock,
  CheckCircle2,
  RotateCcw,
  Edit3,
  AlertCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  getAccountsAction,
  createAccountAction,
  adjustBalanceAction,
  transferBalanceAction,
  deleteAccountAction,
} from "@/app/actions/accounts";
import {
  getLockedFundsAction,
  createLockedFundAction,
  updateLockedFundAction,
  payLockedFundAction,
  reopenLockedFundAction,
  deleteLockedFundAction,
} from "@/app/actions/locked-funds";

interface AccountItem {
  id: string;
  name: string;
  type: "bank" | "ewallet" | "cash";
  accountNumber: string;
  balance: number;
  color: string;
  icon: string;
  isDefault: boolean;
}

interface LockedFundItem {
  id: string;
  name: string;
  amount: number;
  dueDay: number | null;
  isPaid: boolean;
  paidAt: string | null;
  paidAccountName: string | null;
  note: string;
}

const LOCKED_PRESETS = ["Uang Kos", "WiFi / Internet", "Token Listrik", "Cicilan / SPP"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountItem | null>(null);

  // Form States - Add Account
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"bank" | "ewallet" | "cash">("bank");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newBalance, setNewBalance] = useState<string>("0");
  const [newColor, setNewColor] = useState("#8CCBFF");

  // Form States - Transfer
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [adminFee, setAdminFee] = useState<string>("0");
  const [transferNote, setTransferNote] = useState("");

  // Form States - Adjust
  const [adjustBalance, setAdjustBalance] = useState<string>("");

  // Locked Funds (Dana Terkunci / Tagihan Wajib) States
  const [lockedFundsList, setLockedFundsList] = useState<LockedFundItem[]>([]);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [editingLockedFund, setEditingLockedFund] = useState<LockedFundItem | null>(null);
  const [lockedName, setLockedName] = useState("");
  const [lockedAmount, setLockedAmount] = useState("");
  const [lockedDueDay, setLockedDueDay] = useState("");
  const [lockedNote, setLockedNote] = useState("");

  const [payTargetFund, setPayTargetFund] = useState<LockedFundItem | null>(null);
  const [payAccountId, setPayAccountId] = useState("");
  const [payRecordExpense, setPayRecordExpense] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [res, lockedRes] = await Promise.all([
        getAccountsAction(),
        getLockedFundsAction(),
      ]);

      if (res.success && res.data) {
        const list = res.data.accounts || [];
        const computedSum = list.reduce((sum, a) => sum + Number(a.balance || 0), 0);
        setAccounts(list);
        if (list.length >= 2) {
          setFromAccountId((prev) => prev || list[0].id);
          setToAccountId((prev) => prev || list[1].id);
        }
        if (list.length > 0) {
          const def = list.find((a) => a.isDefault) || list[0];
          setPayAccountId((prev) => (prev && list.some((a) => a.id === prev) ? prev : def.id));
        }
        try {
          localStorage.setItem(
            "sakuin_cached_accounts",
            JSON.stringify({ totalBalance: computedSum, accounts: list })
          );
        } catch {}
      }

      if (lockedRes.success && lockedRes.data) {
        setLockedFundsList(lockedRes.data.funds || []);
        try {
          localStorage.setItem("sakuin_cached_locked_funds", JSON.stringify(lockedRes.data));
        } catch {}
      }
    } catch (e) {
      console.error("Gagal load rekening:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let hasCache = false;
    try {
      const cached = localStorage.getItem("sakuin_cached_accounts");
      if (cached) {
        const parsed = JSON.parse(cached);
        const list = Array.isArray(parsed) ? parsed : parsed?.accounts;
        if (Array.isArray(list)) {
          setAccounts(list);
          if (list.length >= 2) {
            setFromAccountId(list[0].id);
            setToAccountId(list[1].id);
          }
          if (list.length > 0) {
            const def = list.find((a: any) => a.isDefault) || list[0];
            setPayAccountId(def.id);
          }
          setIsLoading(false);
          hasCache = true;
        }
      }

      const cachedLocked = localStorage.getItem("sakuin_cached_locked_funds");
      if (cachedLocked) {
        const parsedLocked = JSON.parse(cachedLocked);
        if (parsedLocked && Array.isArray(parsedLocked.funds)) {
          setLockedFundsList(parsedLocked.funds);
        }
      }
    } catch {}

    loadData(hasCache);

    const handleRefresh = () => {
      loadData(true);
    };
    window.addEventListener("sakuin:data-invalidated", handleRefresh);
    window.addEventListener("sakuin:sync-complete", handleRefresh);
    return () => {
      window.removeEventListener("sakuin:data-invalidated", handleRefresh);
      window.removeEventListener("sakuin:sync-complete", handleRefresh);
    };
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await createAccountAction({
        name: newName.trim(),
        type: newType,
        accountNumber: newAccountNumber.trim() || undefined,
        initialBalance: parseInt(newBalance || "0", 10),
        color: newColor,
        icon: newType === "bank" ? "Landmark" : newType === "ewallet" ? "Smartphone" : "Banknote",
      });

      if (res.success) {
        setShowAddModal(false);
        setNewName("");
        setNewAccountNumber("");
        setNewBalance("0");
        await loadData();
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      } else {
        alert(res.error || "Gagal membuat rekening");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(transferAmount || "0", 10);
    const fee = parseInt(adminFee || "0", 10);
    if (amt <= 0 || !fromAccountId || !toAccountId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await transferBalanceAction({
        fromAccountId,
        toAccountId,
        amount: amt,
        adminFee: fee,
        note: transferNote.trim() || undefined,
      });

      if (res.success) {
        setShowTransferModal(false);
        setTransferAmount("");
        setAdminFee("0");
        setTransferNote("");
        await loadData();
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      } else {
        alert(res.error || "Gagal melakukan transfer");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await adjustBalanceAction({
        id: selectedAccount.id,
        newBalance: parseInt(adjustBalance || "0", 10),
      });

      if (res.success) {
        setShowAdjustModal(false);
        setSelectedAccount(null);
        await loadData();
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      } else {
        alert(res.error || "Gagal menyesuaikan saldo");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus rekening "${name}"? Seluruh riwayat tetap tersimpan.`)) return;
    const res = await deleteAccountAction(id);
    if (res.success) {
      await loadData();
      window.dispatchEvent(new Event("sakuin:data-invalidated"));
    } else {
      alert(res.error || "Gagal menghapus rekening");
    }
  };

  const computedTotalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const activeLockedFunds = lockedFundsList.filter((f) => !f.isPaid);
  const paidLockedFunds = lockedFundsList.filter((f) => f.isPaid);
  const activeLockedTotal = activeLockedFunds.reduce((sum, f) => sum + f.amount, 0);
  const freeSpendableTotal = Math.max(0, computedTotalBalance - activeLockedTotal);

  const openCreateLockedModal = () => {
    setEditingLockedFund(null);
    setLockedName("");
    setLockedAmount("");
    setLockedDueDay("");
    setLockedNote("");
    setShowLockedModal(true);
  };

  const openEditLockedModal = (fund: LockedFundItem) => {
    setEditingLockedFund(fund);
    setLockedName(fund.name);
    setLockedAmount(String(fund.amount));
    setLockedDueDay(fund.dueDay ? String(fund.dueDay) : "");
    setLockedNote(fund.note || "");
    setShowLockedModal(true);
  };

  const handleSaveLockedFund = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(lockedAmount || "0", 10);
    const dueNum = lockedDueDay ? Math.min(31, Math.max(1, parseInt(lockedDueDay, 10))) : null;
    if (!lockedName.trim() || amt <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = editingLockedFund
        ? await updateLockedFundAction(editingLockedFund.id, {
            name: lockedName.trim(),
            amount: amt,
            dueDay: dueNum,
            note: lockedNote.trim() || null,
          })
        : await createLockedFundAction({
            name: lockedName.trim(),
            amount: amt,
            dueDay: dueNum,
            note: lockedNote.trim() || null,
          });

      if (res.success) {
        setShowLockedModal(false);
        await loadData(true);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      } else {
        alert(res.error || "Gagal menyimpan tagihan wajib");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayLockedFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTargetFund || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await payLockedFundAction({
        id: payTargetFund.id,
        accountId: payAccountId || undefined,
        recordExpense: Boolean(payAccountId && payRecordExpense),
      });

      if (res.success) {
        setPayTargetFund(null);
        await loadData(true);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      } else {
        alert(res.error || "Gagal memproses pelunasan");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenLockedFund = async (id: string) => {
    const res = await reopenLockedFundAction(id);
    if (res.success) {
      await loadData(true);
      window.dispatchEvent(new Event("sakuin:data-invalidated"));
    } else {
      alert(res.error || "Gagal mengaktifkan tagihan");
    }
  };

  const handleDeleteLockedFund = async (id: string, name: string) => {
    if (!confirm(`Hapus pos dana terkunci "${name}"?`)) return;
    const res = await deleteLockedFundAction(id);
    if (res.success) {
      await loadData(true);
      window.dispatchEvent(new Event("sakuin:data-invalidated"));
    } else {
      alert(res.error || "Gagal menghapus pos tagihan");
    }
  };
  const bankTotal = accounts
    .filter((a) => a.type === "bank")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const ewalletTotal = accounts
    .filter((a) => a.type === "ewallet")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const cashTotal = accounts
    .filter((a) => a.type === "cash")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bank":
        return Landmark;
      case "ewallet":
        return Smartphone;
      default:
        return Banknote;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "bank":
        return { label: "Bank", bg: "bg-muted text-foreground border-border" };
      case "ewallet":
        return { label: "E-Wallet", bg: "bg-muted text-foreground border-border" };
      default:
        return { label: "Tunai", bg: "bg-muted text-foreground border-border" };
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Multi Rekening & Dompet
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pantau dan kelola saldo rekening bank, e-wallet, dan uang tunaimu di satu tempat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-all"
          >
            <ArrowRightLeft className="w-4 h-4 text-accent" />
            <span>Pindah Saldo</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-accent hover:bg-accent-hover text-[#1F1F1F] shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Rekening</span>
          </button>
        </div>
      </div>

      {/* 2. Total Saldo Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-md relative overflow-hidden space-y-4">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Saldo Seluruh Rekening
            </p>
            <h2 className="text-3xl font-black tracking-tight mt-1 text-accent">
              {isLoading ? "Rp . . ." : formatRupiah(computedTotalBalance)}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Gabungan dari {accounts.length} rekening bank, e-wallet &amp; dompet fisik
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-bold">
              {accounts.filter((a) => a.type === "bank").length} Bank •{" "}
              {accounts.filter((a) => a.type === "ewallet").length} E-Wallet •{" "}
              {accounts.filter((a) => a.type === "cash").length} Tunai
            </span>
          </div>
        </div>

        {/* Rincian Per Kategori Rekening */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60 text-xs">
          <div className="bg-background/70 border border-border/60 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Bank</p>
            <p className="font-black text-foreground truncate mt-0.5">{formatRupiah(bankTotal)}</p>
          </div>
          <div className="bg-background/70 border border-border/60 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">E-Wallet</p>
            <p className="font-black text-foreground truncate mt-0.5">{formatRupiah(ewalletTotal)}</p>
          </div>
          <div className="bg-background/70 border border-border/60 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Dompet Fisik</p>
            <p className="font-black text-foreground truncate mt-0.5">{formatRupiah(cashTotal)}</p>
          </div>
        </div>

        {activeLockedTotal > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60 text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#FFB04A]" />
              <span className="text-muted-foreground">
                Dana Terkunci ({activeLockedFunds.length} tagihan):{" "}
                <strong className="text-[#FFB04A]">{formatRupiah(activeLockedTotal)}</strong>
              </span>
            </div>
            <span className="text-muted-foreground">
              Saldo Bebas Pakai:{" "}
              <strong className="text-accent">{formatRupiah(freeSpendableTotal)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* 3. Daftar Kartu Rekening */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const Icon = getTypeIcon(acc.type);
          const badge = getTypeBadge(acc.type);

          return (
            <div
              key={acc.id}
              className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-accent/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: `${acc.color}25`, color: acc.color }}
                  >
                    <Icon className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-foreground truncate">{acc.name}</h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {acc.accountNumber || (acc.type === "cash" ? "Dompet Fisik" : "Tanpa No. Rekening")}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}
                >
                  {badge.label}
                </span>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Saldo Saat Ini
                </p>
                <p className="text-xl font-black text-foreground tracking-tight">
                  {formatRupiah(acc.balance)}
                </p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccount(acc);
                    setAdjustBalance(acc.balance.toString());
                    setShowAdjustModal(true);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Sesuaikan Saldo</span>
                </button>

                {accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDelete(acc.id, acc.name)}
                    className="p-1.5 text-muted-foreground hover:text-expense rounded-lg transition-colors"
                    title="Hapus Rekening"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3.5 POS DANA TERKUNCI / TAGIHAN WAJIB (Kos, WiFi, Token, Cicilan) */}
      <section id="dana-terkunci" className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFB04A]/15 text-[#FFB04A] flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">
                Pos Dana Terkunci / Tagihan Wajib
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pisahkan uang Kos, WiFi, atau cicilan agar tidak ikut terbagi ke batas jajan harian.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateLockedModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-accent hover:brightness-105 text-[#1F1F1F] shadow-xs transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Kunci Dana Tagihan</span>
          </button>
        </div>

        {activeLockedFunds.length === 0 && paidLockedFunds.length === 0 ? (
          <div className="p-5 rounded-xl bg-background/70 border border-dashed border-border text-center space-y-2">
            <p className="text-xs font-bold text-foreground">Belum ada pos dana terkunci</p>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
              Contoh: masih memegang uang Kos Rp 800.000 di rekening? Kunci di sini supaya jatah harianmu dihitung dari sisa uang bebasnya saja.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeLockedFunds.length > 0 && (
              <div className="space-y-2">
                {activeLockedFunds.map((fund) => (
                  <div
                    key={fund.id}
                    className="p-3.5 rounded-xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-foreground">
                          {fund.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFB04A]/15 text-[#FFB04A]">
                          Terkunci
                        </span>
                        {fund.dueDay && (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Jatuh tempo tgl {fund.dueDay}
                          </span>
                        )}
                      </div>
                      {fund.note && (
                        <p className="text-[11px] text-muted-foreground truncate">{fund.note}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                      <span className="text-sm font-black text-[#FFB04A]">
                        {formatRupiah(fund.amount)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPayTargetFund(fund);
                            setPayRecordExpense(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 transition-all"
                        >
                          Bayar / Lunasi
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditLockedModal(fund)}
                          title="Ubah tagihan"
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLockedFund(fund.id, fund.name)}
                          title="Hapus tagihan"
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-expense hover:bg-expense/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {paidLockedFunds.length > 0 && (
              <div className="pt-2 border-t border-border/60 space-y-2">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  Sudah Lunas Periode Ini ({paidLockedFunds.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {paidLockedFunds.map((fund) => (
                    <div
                      key={fund.id}
                      className="p-3 rounded-xl bg-background/60 border border-border/70 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="font-bold text-foreground truncate">{fund.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground pl-5 truncate">
                          {formatRupiah(fund.amount)}
                          {fund.paidAccountName ? ` • ${fund.paidAccountName}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReopenLockedFund(fund.id)}
                          title="Kunci lagi untuk bulan depan"
                          className="px-2 py-1 rounded-md border border-border text-[10px] font-bold text-foreground hover:bg-muted flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Aktifkan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLockedFund(fund.id, fund.name)}
                          title="Hapus"
                          className="p-1 text-muted-foreground hover:text-expense rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. MODAL: Tambah Rekening */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Tambah Rekening Baru</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              {/* Tipe Rekening */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Jenis Rekening</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "bank", label: "Bank", icon: Landmark },
                    { id: "ewallet", label: "E-Wallet", icon: Smartphone },
                    { id: "cash", label: "Tunai", icon: Banknote },
                  ].map((t) => {
                    const TIcon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setNewType(t.id as any);
                          if (t.id === "bank") setNewColor("#8CCBFF");
                          if (t.id === "ewallet") setNewColor("#FFB04A");
                          if (t.id === "cash") setNewColor("#5BAA6B");
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                          newType === t.id
                            ? "border-accent bg-accent/15 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <TIcon className="w-4 h-4 stroke-[2.5]" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nama Rekening */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Nama Rekening / Dompet</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: GoPay, DANA, BCA, Dompet Fisik"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-base sm:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                />

                {/* Preset Cepat Nama Rekening / E-Wallet */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(newType === "ewallet"
                    ? ["GoPay", "DANA", "ShopeePay", "OVO"]
                    : newType === "bank"
                    ? ["BCA", "BRI", "Mandiri", "BNI", "BSI"]
                    : ["Dompet Fisik", "Uang Kos", "Amplop"]
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewName(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        newName === preset
                          ? "bg-accent/20 border-accent text-foreground"
                          : "bg-muted/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nomor Rekening (Optional) */}
              {newType !== "cash" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Nomor Rekening / HP E-Wallet</span>
                    <span className="text-[10px] text-muted-foreground">Opsional</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: 1234567890 / 08123456789"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}

              {/* Saldo Awal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Saldo Awal</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={parseInt(newBalance || "0", 10) > 0 ? parseInt(newBalance || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setNewBalance(raw || "0");
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-black focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Rekening"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Pindah Saldo (Transfer Antar Rekening) */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Pindah Saldo Antar Rekening</h3>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              {/* Rekening Asal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Dari Rekening (Asal)</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === toAccountId}>
                      {a.name} (Saldo: {formatRupiah(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rekening Tujuan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Ke Rekening (Tujuan)</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>
                      {a.name} (Saldo: {formatRupiah(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Nominal Transfer */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Nominal yang Dipindahkan</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={parseInt(transferAmount || "0", 10) > 0 ? parseInt(transferAmount || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setTransferAmount(raw);
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-black focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Biaya Admin (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Biaya Admin (Jika Ada)</span>
                  <span className="text-[10px] text-muted-foreground">Misal top up / beda bank</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={parseInt(adminFee || "0", 10) > 0 ? parseInt(adminFee || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setAdminFee(raw || "0");
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Catatan Transfer */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Catatan / Keterangan</span>
                  <span className="text-[10px] text-muted-foreground">Opsional</span>
                </label>
                <input
                  type="text"
                  placeholder="Misal: Tarik tunai dari ATM, Topup GoPay"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !transferAmount || parseInt(transferAmount, 10) <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Memproses..." : "Pindahkan Saldo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Sesuaikan Saldo */}
      {showAdjustModal && selectedAccount && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Sesuaikan Saldo</h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Ubah saldo <strong>{selectedAccount.name}</strong> agar sesuai dengan nominal riil saat ini.
            </p>

            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Saldo Riil Sekarang</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={parseInt(adjustBalance || "0", 10) > 0 ? parseInt(adjustBalance || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setAdjustBalance(raw || "0");
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-black focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Perbarui Saldo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: Tambah / Ubah Dana Terkunci (Tagihan Wajib) */}
      {showLockedModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">
                {editingLockedFund ? "Ubah Tagihan Wajib" : "Kunci Dana Tagihan Wajib"}
              </h3>
              <button
                type="button"
                onClick={() => setShowLockedModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editingLockedFund && (
              <div className="flex flex-wrap gap-1.5">
                {LOCKED_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLockedName(preset)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                      lockedName === preset
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveLockedFund} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Nama Tagihan / Pos</label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={lockedName}
                  onChange={(e) => setLockedName(e.target.value)}
                  placeholder="Contoh: Uang Kos, WiFi, Token Listrik..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Nominal Dikunci</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={parseInt(lockedAmount || "0", 10) > 0 ? parseInt(lockedAmount || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setLockedAmount(raw);
                    }}
                    placeholder="0"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-black focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Tgl Jatuh Tempo</span>
                    <span className="text-[10px] text-muted-foreground">Opsional</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={lockedDueDay}
                    onChange={(e) => setLockedDueDay(e.target.value)}
                    placeholder="Misal: 5"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Catatan</span>
                    <span className="text-[10px] text-muted-foreground">Opsional</span>
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={lockedNote}
                    onChange={(e) => setLockedNote(e.target.value)}
                    placeholder="Misal: Transfer ke ibu kos"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLockedModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !lockedName.trim() || parseInt(lockedAmount || "0", 10) <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : editingLockedFund ? "Simpan Perubahan" : "Kunci Dana"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: Bayar / Lunasi Tagihan Wajib */}
      {payTargetFund && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">
                  Bayar {payTargetFund.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Nominal tagihan: <strong className="text-foreground">{formatRupiah(payTargetFund.amount)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayTargetFund(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayLockedFund} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Sumber Pembayaran</label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Tandai lunas saja (tanpa ubah saldo rekening)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      Potong {acc.name} (Saldo: {formatRupiah(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {payAccountId && (
                <label className="flex items-center gap-2 text-xs text-foreground font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payRecordExpense}
                    onChange={(e) => setPayRecordExpense(e.target.checked)}
                    className="rounded border-border accent-accent"
                  />
                  <span>Catat juga ke Riwayat Pengeluaran</span>
                </label>
              )}

              {payAccountId && (() => {
                const selectedPayAcc = accounts.find((a) => a.id === payAccountId);
                if (selectedPayAcc && selectedPayAcc.balance < payTargetFund.amount) {
                  return (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-expense/10 border border-expense/30 text-expense text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Saldo {selectedPayAcc.name} ({formatRupiah(selectedPayAcc.balance)}) kurang dari nominal tagihan.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPayTargetFund(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    Boolean(
                      payAccountId &&
                        (accounts.find((a) => a.id === payAccountId)?.balance ?? 0) < payTargetFund.amount
                    )
                  }
                  className="flex-1 py-2.5 rounded-xl bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Memproses..." : "Konfirmasi Lunas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
