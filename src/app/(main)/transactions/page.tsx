"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  getTransactionsAction,
  updateTransactionAction,
  deleteTransactionAction,
  restoreTransactionAction,
  getUserCategoriesAction,
} from "@/app/actions/transactions";
import {
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  X,
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
  Undo2,
  CheckCircle2,
  Trash2,
  ChevronRight,
  Filter,
  Download,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";

interface Transaction {
  id: string;
  title: string;
  category: string;
  type: "expense" | "income";
  amount: number;
  date: string;
  note: string;
  customLabel?: string;
}

const EXPENSE_CATEGORIES = [
  { name: "Makan", icon: Utensils },
  { name: "Nongkrong", icon: Coffee },
  { name: "Rokok", icon: Flame },
  { name: "Listrik", icon: Zap },
  { name: "Kuota", icon: Smartphone },
  { name: "Laundry", icon: Shirt },
];

const INCOME_CATEGORIES = [
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

// Helper icon resolver
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

function TransactionsContent() {
  const searchParams = useSearchParams();

  // Filter States
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthStr);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data States
  const [transactionsList, setTransactionsList] = useState<Transaction[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit / Detail Modal State (PRD T4)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editType, setEditType] = useState<"expense" | "income">("expense");
  const [editCategory, setEditCategory] = useState("");
  const [isCustomEditCategory, setIsCustomEditCategory] = useState(false);
  const [customEditCategory, setCustomEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Delete Toast State (PRD T4)
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastDeletedTx, setLastDeletedTx] = useState<Transaction | null>(null);

  // Load Transactions & Categories
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txRes, catRes] = await Promise.all([
        getTransactionsAction({
          month: filterMonth === "all" ? undefined : filterMonth,
          type: filterType === "all" ? undefined : filterType,
          category: filterCategory === "all" ? undefined : filterCategory,
          query: searchQuery.trim() || undefined,
        }),
        getUserCategoriesAction(),
      ]);

      if (txRes.success && txRes.data) {
        setTransactionsList(txRes.data);
      }

      if (catRes.success && catRes.data) {
        const catNames = Array.from(new Set(catRes.data.map((c) => c.name)));
        setCategoriesList(catNames);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat transaksi:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleSyncComplete = () => {
      loadData();
    };
    window.addEventListener("sakuin:sync-complete", handleSyncComplete);
    return () => {
      window.removeEventListener("sakuin:sync-complete", handleSyncComplete);
    };
  }, [filterMonth, filterType, filterCategory, searchQuery]);

  // Generate 6 months dropdown list
  const monthOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const base = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      list.push({
        label: i === 0 ? `Bulan Ini (${label})` : label,
        value: val,
      });
    }
    list.push({ label: "Semua Waktu", value: "all" });
    return list;
  }, []);

  // Summary for current view
  const summary = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const t of transactionsList) {
      if (t.type === "expense") expense += t.amount;
      if (t.type === "income") income += t.amount;
    }
    return { expense, income, count: transactionsList.length };
  }, [transactionsList]);

  // Open Edit Modal
  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditAmount(tx.amount);
    setEditType(tx.type);

    const presetList = tx.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const isPreset = presetList.some((c) => c.name === tx.category);

    if (isPreset) {
      setIsCustomEditCategory(false);
      setEditCategory(tx.category);
      setCustomEditCategory("");
    } else {
      setIsCustomEditCategory(true);
      setEditCategory("");
      setCustomEditCategory(tx.category);
    }

    setEditNote(tx.note || "");
    setEditDate(tx.date.includes("Hari ini") ? new Date().toISOString().split("T")[0] : tx.date);
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditingTx(null);
    setIsUpdating(false);
    setIsDeleting(false);
  };

  // Handle Update Transaction
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || editAmount <= 0 || isUpdating) return;

    if (isCustomEditCategory && !customEditCategory.trim()) return;
    if (!isCustomEditCategory && !editCategory) return;

    setIsUpdating(true);
    const finalCategory = isCustomEditCategory
      ? customEditCategory.trim()
      : editCategory;

    try {
      const res = await updateTransactionAction(editingTx.id, {
        amount: editAmount,
        type: editType,
        categoryName: finalCategory,
        note: editNote.trim() || undefined,
        customLabel: isCustomEditCategory ? customEditCategory.trim() : (editNote.trim() || undefined),
        occurredOn: editDate,
      });

      if (res.success) {
        closeEditModal();
        await loadData();
      } else {
        alert(res.error || "Gagal memperbarui transaksi");
      }
    } catch (err) {
      console.error("Gagal update transaksi:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Delete with Undo Toast (PRD T4)
  const handleDelete = async () => {
    if (!editingTx || isDeleting) return;

    const confirmed = window.confirm(`Hapus catatan "${editingTx.title}"?`);
    if (!confirmed) return;

    setIsDeleting(true);
    const targetTx = editingTx;

    try {
      const res = await deleteTransactionAction(targetTx.id);
      if (res.success) {
        // Optimistic remove
        setTransactionsList((prev) => prev.filter((t) => t.id !== targetTx.id));
        setLastDeletedTx(targetTx);
        setShowUndoToast(true);
        closeEditModal();

        // Auto hide toast after 6 seconds
        setTimeout(() => {
          setShowUndoToast(false);
        }, 6000);
      } else {
        alert(res.error || "Gagal menghapus transaksi");
      }
    } catch (err) {
      console.error("Gagal hapus transaksi:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Undo Restore (PRD T4)
  const handleUndo = async () => {
    if (!lastDeletedTx) return;

    const txToRestore = lastDeletedTx;
    setShowUndoToast(false);
    setLastDeletedTx(null);

    try {
      const res = await restoreTransactionAction(txToRestore.id);
      if (res.success) {
        setTransactionsList((prev) => [txToRestore, ...prev]);
        await loadData();
      }
    } catch (err) {
      console.error("Gagal memulihkan transaksi:", err);
    }
  };

  const activeCategories = editType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Riwayat Transaksi
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola, filter, dan ubah catatan keuanganmu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/export/transactions?month=${filterMonth}&type=${filterType}`}
            download
            className="inline-flex items-center gap-1.5 bg-card hover:bg-muted border border-border text-foreground font-bold text-xs px-3.5 py-2 rounded-full shadow-xs transition-all hover:border-accent/40"
            title="Unduh berkas CSV"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </a>

          <Link
            href="/record"
            className="inline-flex items-center gap-1.5 bg-accent hover:brightness-110 text-[#1F1F1F] font-black text-xs px-4 py-2 rounded-full shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Catat Baru</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar Card */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3.5">
        {/* Month Selector & Category Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Month Selector */}
          <div className="relative">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Periode Bulan
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Kategori
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari transaksi, toko, warteg, atau catatan..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              filterType === "all"
                ? "bg-foreground text-background shadow-sm"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setFilterType("expense")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === "expense"
                ? "bg-expense text-white shadow-sm"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Pengeluaran</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("income")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === "income"
                ? "bg-accent text-[#1F1F1F] shadow-sm"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Pemasukan</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Filter Periode */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Pengeluaran Periode Ini
          </span>
          <p className="text-base sm:text-lg font-black text-expense mt-0.5">
            {formatRupiah(summary.expense)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Pemasukan Periode Ini
          </span>
          <p className="text-base sm:text-lg font-black text-accent mt-0.5">
            {formatRupiah(summary.income)}
          </p>
        </div>
      </div>

      {/* Transactions List */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
            Daftar Catatan ({summary.count})
          </span>
          <span className="text-[10px] text-muted-foreground">
            Ketuk catatan untuk mengubah / menghapus
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center bg-card rounded-xl border border-border">
            <p className="text-xs text-muted-foreground animate-pulse">Memuat riwayat transaksi...</p>
          </div>
        ) : transactionsList.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-xl border border-border space-y-1">
            <p className="text-sm font-bold text-foreground">Tidak ada transaksi ditemukan</p>
            <p className="text-xs text-muted-foreground">
              Coba sesuaikan filter bulan, kategori, atau ketuk tombol Catat Baru.
            </p>
          </div>
        ) : (
          transactionsList.map((item) => {
            const Icon = getCategoryIcon(item.category);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openEditModal(item)}
                className="w-full text-left bg-card border border-border rounded-xl p-3.5 flex items-center justify-between hover:border-accent/50 hover:bg-muted/10 active:scale-[0.99] transition-all group shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      item.type === "expense"
                        ? "bg-expense/15 text-expense"
                        : "bg-accent/20 text-accent"
                    }`}
                  >
                    <Icon className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate group-hover:text-accent transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-medium truncate">
                        {item.category}
                      </span>
                      <span className="text-[11px] text-muted-foreground">•</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{item.date}</span>
                    </div>
                    {item.note && item.note !== item.title && (
                      <p className="text-[10px] text-muted-foreground/80 italic mt-0.5 truncate">
                        &ldquo;{item.note}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3 text-right">
                  <span
                    className={`text-sm font-black ${
                      item.type === "expense" ? "text-expense" : "text-accent"
                    }`}
                  >
                    {item.type === "expense" ? "-" : "+"}
                    {formatRupiah(item.amount)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })
        )}
      </section>

      {/* Detail & Edit Modal (PRD T4) */}
      <AnimatePresence>
        {editingTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto scrollbar-none"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Ubah Catatan Transaksi
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Perbarui nominal, kategori, atau hapus catatan
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Update */}
              <form onSubmit={handleUpdate} className="space-y-4">
                {/* Tipe Toggle: Pengeluaran vs Pemasukan */}
                <div className="grid grid-cols-2 p-1 bg-background rounded-full border border-border text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setEditType("expense");
                      setEditCategory("Makan");
                      setIsCustomEditCategory(false);
                      setCustomEditCategory("");
                    }}
                    className={`py-2 rounded-full transition-all flex items-center justify-center gap-1.5 ${
                      editType === "expense"
                        ? "bg-card text-foreground shadow-sm border border-border font-black"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-expense" />
                    <span>Pengeluaran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditType("income");
                      setEditCategory("Uang Kiriman");
                      setIsCustomEditCategory(false);
                      setCustomEditCategory("");
                    }}
                    className={`py-2 rounded-full transition-all flex items-center justify-center gap-1.5 ${
                      editType === "income"
                        ? "bg-card text-foreground shadow-sm border border-border font-black"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span>Pemasukan</span>
                  </button>
                </div>

                {/* Input Nominal with Auto Rupiah Formatting & No Overflow */}
                <div className="bg-background rounded-xl border border-border p-3.5 space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Nominal {editType === "expense" ? "Pengeluaran" : "Pemasukan"}
                  </span>
                  <div className="relative flex items-center bg-card border border-border rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-all">
                    <span className="text-xl font-black text-muted-foreground mr-2 select-none shrink-0">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editAmount > 0 ? editAmount.toLocaleString("id-ID") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const val = raw ? parseInt(raw, 10) : 0;
                        if (val <= 999999999) {
                          setEditAmount(val);
                        }
                      }}
                      placeholder="0"
                      className={`flex-1 min-w-0 bg-transparent font-black text-foreground placeholder:text-muted-foreground/30 focus:outline-none tracking-tight ${
                        editAmount >= 10000000
                          ? "text-xl sm:text-2xl"
                          : "text-2xl sm:text-3xl"
                      }`}
                    />
                    {editAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditAmount(0)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/60 transition-colors shrink-0 ml-1.5"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Quick Helper Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground mr-0.5">
                      Tambah:
                    </span>
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setEditAmount((prev) => Math.min(999999999, prev + q.value))}
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-card border border-border text-foreground hover:border-accent hover:text-accent active:scale-95 transition-all"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pilih Kategori */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Pilih Kategori</label>
                  <div className="grid grid-cols-3 gap-2">
                    {activeCategories.map((cat) => {
                      const Icon = cat.icon;
                      // Kategori preset hanya terpilih jika TIDAK dalam mode kategori lain
                      const isSelected = !isCustomEditCategory && editCategory === cat.name;

                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            setEditCategory(cat.name);
                            setIsCustomEditCategory(false);
                            setCustomEditCategory("");
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold border transition-all text-left ${
                            isSelected
                              ? "bg-accent/15 border-accent text-accent-text ring-1 ring-accent scale-[1.02]"
                              : "bg-background border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                          <span className="truncate">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tombol Opsi Kategori Lainnya */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomEditCategory(true);
                      setEditCategory("");
                    }}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                      isCustomEditCategory
                        ? "bg-accent/15 border-accent text-accent-text ring-1 ring-accent"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Kategori Lainnya</span>
                  </button>

                  {/* Kolom Input Kategori Lain (Muncul jika Kategori Lain dipilih) */}
                  <AnimatePresence>
                    {isCustomEditCategory && (
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
                          value={customEditCategory}
                          onChange={(e) => setCustomEditCategory(e.target.value)}
                          placeholder="Ketik nama kategori (contoh: Bensin, Skincare, Obat...)"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-accent text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Kolom Catatan Terpisah */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Catatan</span>
                    <span className="text-[10px] text-muted-foreground">Opsional</span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Contoh: Warteg bu joko, servis motor..."
                    className="w-full px-3.5 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Tanggal Transaksi */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Tanggal Transaksi</span>
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Action Buttons: Simpan & Hapus */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={
                      editAmount <= 0 ||
                      isUpdating ||
                      (isCustomEditCategory ? !customEditCategory.trim() : !editCategory)
                    }
                    className="w-full py-3 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#1F1F1F] font-black rounded-full text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{isUpdating ? "Memperbarui..." : "Simpan Catatan"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full py-2.5 border border-expense/30 hover:border-expense hover:bg-expense/10 text-expense font-bold rounded-full text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleting ? "Menghapus..." : "Hapus Transaksi Ini"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Toast Notification (PRD T4) */}
      <AnimatePresence>
        {showUndoToast && lastDeletedTx && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-[80] bg-[#1F1F1F] border border-border text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
              <p className="text-xs font-semibold truncate">
                Catatan &ldquo;{lastDeletedTx.title}&rdquo; dihapus
              </p>
            </div>
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#333333] hover:bg-[#444444] text-accent text-xs font-black shrink-0 transition-colors shadow-sm"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Urungkan</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-muted-foreground">
          Memuat riwayat transaksi...
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
