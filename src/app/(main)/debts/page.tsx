"use client";

import React, { useState, useEffect } from "react";
import {
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  X,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  getDebtsAction,
  createDebtAction,
  recordDebtPaymentAction,
  deleteDebtAction,
} from "@/app/actions/debts";
import { getAccountsAction } from "@/app/actions/accounts";

interface DebtItem {
  id: string;
  type: "payable" | "receivable";
  personName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  status: "unpaid" | "partial" | "paid";
  note: string;
  accountName: string | null;
  createdAt: Date;
  payments: Array<{
    id: string;
    amount: number;
    occurredOn: string;
    note: string;
  }>;
}

interface AccountSimple {
  id: string;
  name: string;
  balance: number;
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [totalReceivable, setTotalReceivable] = useState<number>(0);
  const [totalPayable, setTotalPayable] = useState<number>(0);
  const [accounts, setAccounts] = useState<AccountSimple[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"all" | "receivable" | "payable" | "paid">("all");

  // Modal States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);

  // Form States - Add Debt
  const [newType, setNewType] = useState<"receivable" | "payable">("receivable");
  const [newPersonName, setNewPersonName] = useState("");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newAccountId, setNewAccountId] = useState("");

  // Form States - Payment
  const [payAmount, setPayAmount] = useState<string>("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payNote, setPayNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [debtRes, accRes] = await Promise.all([
        getDebtsAction(),
        getAccountsAction(),
      ]);

      if (debtRes.success && debtRes.data) {
        setDebts(debtRes.data.debts);
        setTotalReceivable(debtRes.data.totalReceivable);
        setTotalPayable(debtRes.data.totalPayable);
        try {
          localStorage.setItem("sakuin_cached_debts", JSON.stringify(debtRes.data));
        } catch {}
      }

      if (accRes.success && accRes.data) {
        setAccounts(accRes.data.accounts);
        if (accRes.data.accounts.length > 0) {
          setNewAccountId(accRes.data.accounts[0].id);
          setPayAccountId(accRes.data.accounts[0].id);
        }
        try {
          localStorage.setItem("sakuin_cached_accounts", JSON.stringify(accRes.data));
        } catch {}
      }
    } catch (e) {
      console.error("Gagal load utang piutang:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let hasCache = false;
    try {
      const cached = localStorage.getItem("sakuin_cached_debts");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.debts)) {
          setDebts(parsed.debts);
          setTotalReceivable(parsed.totalReceivable || 0);
          setTotalPayable(parsed.totalPayable || 0);
          setIsLoading(false);
          hasCache = true;
        }
      }
    } catch {}

    loadData(hasCache);
  }, []);

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(newAmount || "0", 10);
    if (!newPersonName.trim() || amt <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await createDebtAction({
        type: newType,
        personName: newPersonName.trim(),
        amount: amt,
        dueDate: newDueDate || undefined,
        note: newNote.trim() || undefined,
        accountId: newAccountId || undefined,
      });

      if (res.success) {
        setShowAddModal(false);
        setNewPersonName("");
        setNewAmount("");
        setNewDueDate("");
        setNewNote("");
        await loadData();
      } else {
        alert(res.error || "Gagal mencatat utang piutang");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || isSubmitting) return;
    const amt = parseInt(payAmount || "0", 10);
    if (amt <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await recordDebtPaymentAction({
        debtId: selectedDebt.id,
        amount: amt,
        note: payNote.trim() || undefined,
        accountId: payAccountId || undefined,
      });

      if (res.success) {
        setShowPayModal(false);
        setSelectedDebt(null);
        setPayAmount("");
        setPayNote("");
        await loadData();
      } else {
        alert(res.error || "Gagal memproses pembayaran");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, person: string) => {
    if (!confirm(`Hapus catatan utang dengan "${person}"?`)) return;
    const res = await deleteDebtAction(id);
    if (res.success) {
      await loadData();
    } else {
      alert(res.error || "Gagal menghapus");
    }
  };

  const filteredDebts = debts.filter((d) => {
    if (activeTab === "receivable") return d.type === "receivable" && d.status !== "paid";
    if (activeTab === "payable") return d.type === "payable" && d.status !== "paid";
    if (activeTab === "paid") return d.status === "paid";
    return true; // "all"
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Catatan Utang Piutang
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pantau uang yang dipinjam teman (piutang) dan utang yang wajib kamu bayar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-accent hover:bg-accent-hover text-[#1F1F1F] shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Catat Utang Baru</span>
        </button>
      </div>

      {/* 2. Ringkasan Piutang & Utang */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card Piutang (Teman Ngutang ke Kita) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Teman Ngutang ke Saya (Piutang)
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-400 tracking-tight">
            {isLoading ? "Rp . . ." : formatRupiah(totalReceivable)}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Uang kamu yang sedang dipinjam teman dan belum lunas
          </p>
        </div>

        {/* Card Utang (Saya Berutang ke Orang) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Saya Berutang ke Teman (Kewajiban)
            </span>
            <div className="w-7 h-7 rounded-lg bg-expense/15 text-expense flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-expense tracking-tight">
            {isLoading ? "Rp . . ." : formatRupiah(totalPayable)}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Total utang yang harus kamu kembalikan
          </p>
        </div>
      </div>

      {/* 3. Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl text-xs font-bold overflow-x-auto">
        {[
          { id: "all", label: "Semua" },
          { id: "receivable", label: "Teman Ngutang" },
          { id: "payable", label: "Saya Berutang" },
          { id: "paid", label: "Sudah Lunas" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 ${
              activeTab === tab.id
                ? "bg-accent text-[#1F1F1F] font-black shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Daftar Catatan Utang Piutang */}
      {filteredDebts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <HandCoins className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-foreground">Tidak ada catatan utang piutang</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {activeTab === "all"
              ? "Kamu belum memiliki catatan utang atau piutang. Klik tombol di atas untuk mencatat."
              : "Tidak ada catatan pada filter ini."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredDebts.map((item) => {
            const isReceivable = item.type === "receivable";
            const isPaid = item.status === "paid";
            const progress = Math.min(100, Math.round((item.paidAmount / item.amount) * 100));

            return (
              <div
                key={item.id}
                className={`bg-card border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                  isPaid ? "border-border opacity-70" : "border-border hover:border-accent/40"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Nama & Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isReceivable
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-expense/15 text-expense"
                        }`}
                      >
                        {isReceivable ? (
                          <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-foreground truncate">
                          {item.personName}
                        </h4>
                        <p className="text-[11px] font-semibold text-muted-foreground truncate">
                          {isReceivable ? "Teman Ngutang" : "Saya Berutang"}
                          {item.accountName ? ` • ${item.accountName}` : ""}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        isPaid
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : item.status === "partial"
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {isPaid ? "Lunas" : item.status === "partial" ? "Dicicil" : "Belum Lunas"}
                    </span>
                  </div>

                  {/* Nominal & Progress */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        {isPaid ? "Total Lunas" : "Sisa Belum Bayar"}
                      </span>
                      <span className="text-base font-black text-foreground">
                        {formatRupiah(isPaid ? item.amount : item.remainingAmount)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isPaid ? "bg-emerald-400" : "bg-accent"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                      <span>Total: {formatRupiah(item.amount)}</span>
                      <span>Terbayar: {formatRupiah(item.paidAmount)} ({progress}%)</span>
                    </div>
                  </div>

                  {/* Catatan & Jatuh Tempo */}
                  {(item.note || item.dueDate) && (
                    <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                      {item.note && (
                        <p className="bg-background p-2 rounded-lg border border-border/60">
                          {item.note}
                        </p>
                      )}
                      {item.dueDate && (
                        <div className="flex items-center gap-1.5 text-accent font-bold pt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Jatuh tempo: {item.dueDate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  {!isPaid ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDebt(item);
                        setPayAmount(item.remainingAmount.toString());
                        setShowPayModal(true);
                      }}
                      className="flex-1 py-1.5 px-3 rounded-lg text-xs font-black bg-accent text-[#1F1F1F] hover:brightness-105 transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isReceivable ? "Catat Terima Bayar" : "Catat Bayar / Cicil"}</span>
                    </button>
                  ) : (
                    <div className="flex-1 text-center py-1 text-xs font-bold text-emerald-400">
                      ✓ Sudah Selesai
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.personName)}
                    className="p-1.5 text-muted-foreground hover:text-expense rounded-lg transition-colors"
                    title="Hapus Catatan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL: Catat Utang Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">Catat Utang / Piutang Baru</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDebt} className="space-y-4">
              {/* Jenis: Teman Ngutang vs Saya Berutang */}
              <div className="grid grid-cols-2 p-1 bg-background rounded-xl border border-border text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setNewType("receivable")}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    newType === "receivable"
                      ? "bg-card text-emerald-400 shadow-sm border border-border font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Teman Ngutang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewType("payable")}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    newType === "payable"
                      ? "bg-card text-expense shadow-sm border border-border font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Saya Berutang</span>
                </button>
              </div>

              {/* Nama Orang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Nama {newType === "receivable" ? "Teman yang Meminjam" : "Orang yang Kita Hutangi"}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Budi, Siti, Kos Ibu Ani"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Nominal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Nominal</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={parseInt(newAmount || "0", 10) > 0 ? parseInt(newAmount || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setNewAmount(raw);
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-black focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Rekening Terkait (Opsional) */}
              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Sumber / Rekening Masuk</span>
                    <span className="text-[10px] text-muted-foreground">Opsional</span>
                  </label>
                  <select
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Jangan ubah saldo rekening</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Saldo: {formatRupiah(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tanggal Jatuh Tempo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Tanggal Janji Bayar / Jatuh Tempo</span>
                  <span className="text-[10px] text-muted-foreground">Opsional</span>
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Catatan / Keterangan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Catatan</span>
                  <span className="text-[10px] text-muted-foreground">Opsional</span>
                </label>
                <input
                  type="text"
                  placeholder="Misal: Talangan Nasi Goreng, Minjam beli paket data"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                />
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
                  disabled={isSubmitting || !newPersonName.trim() || !newAmount}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Catat Pembayaran / Cicilan */}
      {showPayModal && selectedDebt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-foreground">
                {selectedDebt.type === "receivable" ? "Terima Pembayaran" : "Bayar Utang"}
              </h3>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-background rounded-xl border border-border space-y-1 text-xs">
              <p className="font-bold text-foreground">{selectedDebt.personName}</p>
              <p className="text-muted-foreground">
                Sisa belum dibayar: <strong className="text-accent">{formatRupiah(selectedDebt.remainingAmount)}</strong>
              </p>
            </div>

            <form onSubmit={handlePayment} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Nominal Pembayaran</label>
                  <button
                    type="button"
                    onClick={() => setPayAmount(selectedDebt.remainingAmount.toString())}
                    className="text-[11px] font-bold text-accent hover:underline"
                  >
                    Bayar Lunas Semua
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-muted-foreground">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={parseInt(payAmount || "0", 10) > 0 ? parseInt(payAmount || "0", 10).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setPayAmount(raw);
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-black focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>{selectedDebt.type === "receivable" ? "Masuk ke Rekening" : "Dibayar dari Rekening"}</span>
                    <span className="text-[10px] text-muted-foreground">Opsional</span>
                  </label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Jangan ubah saldo rekening</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Saldo: {formatRupiah(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Catatan Cicilan</span>
                  <span className="text-[10px] text-muted-foreground">Opsional</span>
                </label>
                <input
                  type="text"
                  placeholder="Misal: Cicilan ke-1, Transfer via QRIS"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !payAmount || parseInt(payAmount, 10) <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Pembayaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
