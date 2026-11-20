"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils,
  Coffee,
  Flame,
  Zap,
  Smartphone,
  Shirt,
  Tag,
  Wallet,
  Briefcase,
  GraduationCap,
  Calendar,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  createTransactionAction,
  getTransactionsAction,
} from "@/app/actions/transactions";
import { enqueueOfflineTransaction } from "@/lib/offline-queue";

interface CategoryOption {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EXPENSE_CATEGORIES: CategoryOption[] = [
  { name: "Makan", icon: Utensils },
  { name: "Nongkrong", icon: Coffee },
  { name: "Rokok", icon: Flame },
  { name: "Listrik", icon: Zap },
  { name: "Kuota", icon: Smartphone },
  { name: "Laundry", icon: Shirt },
];

const INCOME_CATEGORIES: CategoryOption[] = [
  { name: "Uang Kiriman", icon: Wallet },
  { name: "Gaji / Upah", icon: Briefcase },
  { name: "Beasiswa", icon: GraduationCap },
];

const QUICK_AMOUNTS = [
  { label: "+10rb", value: 10000 },
  { label: "+20rb", value: 20000 },
  { label: "+50rb", value: 50000 },
  { label: "+100rb", value: 100000 },
];

interface RecentTx {
  id: string;
  title: string;
  category: string;
  type: "expense" | "income";
  amount: number;
  date: string;
  note?: string;
}

export default function RecordPage() {
  const router = useRouter();
  const [recordType, setRecordType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState<number>(0);

  // Kategori states
  const [selectedCategory, setSelectedCategory] = useState("Makan");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  // Catatan terpisah
  const [note, setNote] = useState("");

  const [txDate, setTxDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [todayTransactions, setTodayTransactions] = useState<RecentTx[]>([]);

  // Load today's recorded transactions for context
  useEffect(() => {
    async function loadRecent() {
      try {
        const res = await getTransactionsAction();
        if (res.success && res.data) {
          const todayStr = new Date().toISOString().split("T")[0];
          const todayItems = res.data
            .filter((t: any) => t.date?.includes("Hari ini") || t.date === todayStr)
            .slice(0, 3);
          setTodayTransactions(todayItems);
        }
      } catch (err) {
        console.error("Gagal load transaksi hari ini:", err);
      }
    }
    loadRecent();
  }, [showToast]);

  const activeCategories = recordType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (amount <= 0 || isSaving) return;

    // Validasi kategori
    if (isCustomCategory && !customCategory.trim()) return;
    if (!isCustomCategory && !selectedCategory) return;

    setIsSaving(true);
    const finalCategory = isCustomCategory
      ? customCategory.trim()
      : selectedCategory;

    const itemTitle = note.trim() || finalCategory;

    // PRD T6: Antrean offline bila koneksi terputus
    if (typeof window !== "undefined" && !navigator.onLine) {
      enqueueOfflineTransaction({
        amount,
        type: recordType,
        categoryName: finalCategory,
        note: note.trim() || undefined,
        customLabel: isCustomCategory ? customCategory.trim() : (note.trim() || undefined),
        occurredOn: txDate,
      });

      setToastMessage(`${itemTitle} (${formatRupiah(amount)}) disimpan ke antrean offline!`);
      setShowToast(true);

      // Reset form
      setAmount(0);
      setIsCustomCategory(false);
      setCustomCategory("");
      setNote("");
      setSelectedCategory(recordType === "expense" ? "Makan" : "Uang Kiriman");
      setTxDate(new Date().toISOString().split("T")[0]);
      setIsSaving(false);

      setTimeout(() => {
        setShowToast(false);
      }, 4000);
      return;
    }

    try {
      const res = await createTransactionAction({
        amount,
        type: recordType,
        categoryName: finalCategory,
        note: note.trim() || undefined,
        customLabel: isCustomCategory ? customCategory.trim() : (note.trim() || undefined),
        occurredOn: txDate,
      });

      if (res.success) {
        setToastMessage(`${itemTitle} (${formatRupiah(amount)}) berhasil dicatat!`);
        setShowToast(true);

        // Reset form
        setAmount(0);
        setIsCustomCategory(false);
        setCustomCategory("");
        setNote("");
        setSelectedCategory(recordType === "expense" ? "Makan" : "Uang Kiriman");
        setTxDate(new Date().toISOString().split("T")[0]);

        setTimeout(() => {
          setShowToast(false);
        }, 4000);
      } else {
        alert(res.error || "Gagal menyimpan transaksi");
      }
    } catch (err) {
      console.error("Gagal simpan transaksi, dialihkan ke offline queue:", err);
      enqueueOfflineTransaction({
        amount,
        type: recordType,
        categoryName: finalCategory,
        note: note.trim() || undefined,
        customLabel: isCustomCategory ? customCategory.trim() : (note.trim() || undefined),
        occurredOn: txDate,
      });
      setToastMessage(`${itemTitle} disimpan ke antrean offline (koneksi tidak stabil)!`);
      setShowToast(true);
      setAmount(0);
      setIsCustomCategory(false);
      setCustomCategory("");
      setNote("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-2">
      {/* Header Halaman Catat */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Catat Transaksi
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pencatatan cepat pengeluaran dan pemasukan
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/transactions")}
          className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
        >
          <span>Lihat Riwayat</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-accent/20 border border-accent/40 text-foreground flex items-center justify-between gap-3 shadow-md"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
              <span className="text-xs font-bold truncate">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => router.push("/transactions")}
              className="text-xs font-extrabold text-accent hover:underline shrink-0"
            >
              Lihat di Riwayat
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form Container */}
      <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 shadow-md space-y-5">
        {/* Toggle Tipe: Pengeluaran vs Pemasukan */}
        <div className="grid grid-cols-2 p-1 bg-background rounded-full border border-border text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setRecordType("expense");
              setSelectedCategory("Makan");
              setIsCustomCategory(false);
              setCustomCategory("");
            }}
            className={`py-2.5 rounded-full transition-all flex items-center justify-center gap-2 ${
              recordType === "expense"
                ? "bg-card text-foreground shadow-sm border border-border font-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-expense" />
            <span>Pengeluaran</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRecordType("income");
              setSelectedCategory("Uang Kiriman");
              setIsCustomCategory(false);
              setCustomCategory("");
            }}
            className={`py-2.5 rounded-full transition-all flex items-center justify-center gap-2 ${
              recordType === "income"
                ? "bg-card text-foreground shadow-sm border border-border font-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span>Pemasukan</span>
          </button>
        </div>

        {/* Input Nominal Langsung (Ketik Sendiri Angkanya) */}
        <div className="bg-background rounded-xl border border-border p-4 space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Nominal {recordType === "expense" ? "Pengeluaran" : "Pemasukan"}
          </label>

          <div className="relative flex items-center bg-card border border-border rounded-lg px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-all">
            <span className="text-xl sm:text-2xl font-black text-muted-foreground mr-2 select-none shrink-0">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={amount > 0 ? amount.toLocaleString("id-ID") : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                const val = raw ? parseInt(raw, 10) : 0;
                if (val <= 999999999) {
                  setAmount(val);
                }
              }}
              placeholder="0"
              className={`flex-1 min-w-0 bg-transparent font-black text-foreground placeholder:text-muted-foreground/30 focus:outline-none tracking-tight ${
                amount >= 10000000
                  ? "text-xl sm:text-2xl"
                  : "text-2xl sm:text-3xl"
              }`}
            />
            {amount > 0 && (
              <button
                type="button"
                onClick={() => setAmount(0)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/60 transition-colors shrink-0 ml-1.5"
              >
                Reset
              </button>
            )}
          </div>

          {/* Quick Helper Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-semibold text-muted-foreground mr-1">
              Tambah cepat:
            </span>
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setAmount((prev) => Math.min(999999999, prev + q.value))}
                className="px-3 py-1 rounded-full text-xs font-bold bg-card border border-border text-foreground hover:border-accent hover:text-accent active:scale-95 transition-all"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pilih Kategori */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-foreground block">
            Pilih Kategori
          </label>
          <div className="grid grid-cols-3 gap-2">
            {activeCategories.map((cat) => {
              const Icon = cat.icon;
              // Kategori bawaan hanya terpilih jika TIDAK sedang memilih kategori lain
              const isSelected = !isCustomCategory && selectedCategory === cat.name;

              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setIsCustomCategory(false);
                    setCustomCategory("");
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-bold border transition-all text-left ${
                    isSelected
                      ? "bg-accent/15 border-accent text-accent-text ring-1 ring-accent scale-[1.02]"
                      : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span className="truncate">{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Tombol Opsi Kategori Lain */}
          <button
            type="button"
            onClick={() => {
              setIsCustomCategory(true);
              setSelectedCategory("");
            }}
            className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
              isCustomCategory
                ? "bg-accent/15 border-accent text-accent-text ring-1 ring-accent"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Kategori Lainnya</span>
          </button>

          {/* Kolom Input Kategori Lain (Muncul jika Kategori Lain dipilih) */}
          <AnimatePresence>
            {isCustomCategory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1 pt-1"
              >
                <label className="text-[11px] font-bold text-accent-text flex items-center justify-between">
                  <span>Nama Kategori Lain</span>
                  <span className="text-[10px] text-expense font-semibold">Wajib diisi</span>
                </label>
                <input
                  type="text"
                  maxLength={40}
                  autoFocus
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Ketik nama kategori (contoh: Bensin, Skincare, Obat...)"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-accent text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Kolom Catatan Terpisah */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>Catatan</span>
            <span className="text-[10px] text-muted-foreground">Opsional</span>
          </label>
          <input
            type="text"
            maxLength={100}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Warteg bu joko, bensin shell, beli di minimarket..."
            className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Tanggal Transaksi */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Tanggal Transaksi</span>
          </label>
          <input
            type="date"
            value={txDate}
            onChange={(e) => setTxDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Tombol Simpan CTA with breathing room */}
        <div className="pt-2 pb-2">
          <button
            type="submit"
            disabled={
              amount <= 0 ||
              isSaving ||
              (isCustomCategory ? !customCategory.trim() : !selectedCategory)
            }
            className="w-full py-4 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#1F1F1F] font-black rounded-full text-sm shadow-lg shadow-accent/20 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>{isSaving ? "Menyimpan..." : "Simpan Catatan"}</span>
          </button>
        </div>
      </form>

      {/* Riwayat Ringkas Hari Ini (Supaya pengguna langsung tahu apa yang sudah dicatat hari ini) */}
      {todayTransactions.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Dicatat Hari Ini ({todayTransactions.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => router.push("/transactions")}
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>Semua Riwayat</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {todayTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-border text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                      tx.type === "expense"
                        ? "bg-expense/15 text-expense"
                        : "bg-accent/20 text-accent"
                    }`}
                  >
                    {tx.type === "expense" ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{tx.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{tx.category}</p>
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
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
