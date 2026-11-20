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
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  getAccountsAction,
  createAccountAction,
  adjustBalanceAction,
  transferBalanceAction,
  deleteAccountAction,
} from "@/app/actions/accounts";

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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getAccountsAction();
      if (res.success && res.data) {
        setAccounts(res.data.accounts);
        setTotalBalance(res.data.totalBalance);
        if (res.data.accounts.length >= 2) {
          setFromAccountId(res.data.accounts[0].id);
          setToAccountId(res.data.accounts[1].id);
        }
      }
    } catch (e) {
      console.error("Gagal load rekening:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
    } else {
      alert(res.error || "Gagal menghapus rekening");
    }
  };

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
        return { label: "Bank", bg: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
      case "ewallet":
        return { label: "E-Wallet", bg: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
      default:
        return { label: "Tunai", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
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
      <div className="bg-card border border-border rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Saldo Seluruh Rekening
            </p>
            <h2 className="text-3xl font-black text-foreground tracking-tight mt-1 text-accent">
              {isLoading ? "Rp . . ." : formatRupiah(totalBalance)}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Tersebar di {accounts.length} rekening & dompet aktif
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

      {/* 4. MODAL: Tambah Rekening */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                  placeholder="Misal: BCA, Mandiri, GoPay, Dompet Fisik"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                />
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
    </div>
  );
}
