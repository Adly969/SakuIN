"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  getTransactionsAction,
  updateTransactionAction,
  deleteTransactionAction,
  restoreTransactionAction,
  getUserCategoriesAction,
} from "@/app/actions/transactions";
import { getAccountsAction } from "@/app/actions/accounts";
import { notifyDailyLimitAlert } from "@/lib/native-notifications";
import { getJakartaCalendarParts, getJakartaDateString, INDONESIAN_MONTHS } from "@/lib/finance";
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
  ChevronDown,
  Check,
  Undo2,
  CheckCircle2,
  Trash2,
  SlidersHorizontal,
  Download,
  Banknote,
  Landmark,
  AlertCircle,
  Bike,
  Cookie,
  Wifi,
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
  accountId?: string;
  accountName?: string;
}

interface AccountItem {
  id: string;
  name: string;
  type: "bank" | "ewallet" | "cash";
  balance: number;
}

interface CategoryObj {
  name: string;
  type: "expense" | "income";
}

const DEFAULT_EXPENSE_CATEGORIES = [
  "Makan",
  "Transport / Bensin",
  "Kuota & Internet",
  "Jajan & Nongkrong",
  "Kuliah",
  "Lainnya",
];

const DEFAULT_INCOME_CATEGORIES = [
  "Uang Kiriman",
  "Kerja Sambilan",
  "Beasiswa",
  "Gaji / Upah",
];

const QUICK_AMOUNTS = [
  { label: "+10rb", value: 10000 },
  { label: "+20rb", value: 20000 },
  { label: "+50rb", value: 50000 },
  { label: "+100rb", value: 100000 },
];

// Helper icon resolver (konsisten dengan halaman Catat)
function getCategoryIcon(name: string) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("makan")) return Utensils;
  if (lower.includes("nongkrong") || lower.includes("kopi")) return Coffee;
  if (lower.includes("bensin") || lower.includes("transport")) return Bike;
  if (lower.includes("jajan") || lower.includes("cemilan")) return Cookie;
  if (lower.includes("rokok")) return Flame;
  if (lower.includes("listrik")) return Zap;
  if (lower.includes("kuota") || lower.includes("internet")) return Wifi;
  if (lower.includes("pulsa")) return Smartphone;
  if (lower.includes("laundry") || lower.includes("baju")) return Shirt;
  if (lower.includes("kiriman") || lower.includes("uang")) return Wallet;
  if (lower.includes("gaji") || lower.includes("upah") || lower.includes("kerja") || lower.includes("sambilan")) return Briefcase;
  if (lower.includes("beasiswa")) return GraduationCap;
  return Tag;
}

function formatShortDate(dateStr: string) {
  if (!dateStr || dateStr.includes("Hari ini")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function TransactionsContent() {
  // Filter States (selalu WIB Asia/Jakarta)
  const currentMonthStr = getJakartaCalendarParts().monthKey;
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthStr);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<string>("all");

  // Data States
  const [transactionsList, setTransactionsList] = useState<Transaction[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [fullCategoriesList, setFullCategoriesList] = useState<CategoryObj[]>([]);
  const [accountsList, setAccountsList] = useState<AccountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Instant Cache Hydration on initial mount (0ms delay)
  useEffect(() => {
    try {
      const cachedTx = localStorage.getItem("sakuin_cached_transactions");
      const cachedCats = localStorage.getItem("sakuin_cached_categories");
      const cachedAcc = localStorage.getItem("sakuin_cached_accounts");
      let hasCache = false;

      if (cachedTx) {
        const parsedTx = JSON.parse(cachedTx);
        if (Array.isArray(parsedTx) && parsedTx.length > 0) {
          setTransactionsList(parsedTx);
          hasCache = true;
        }
      }
      if (cachedCats) {
        const parsedCats = JSON.parse(cachedCats);
        if (Array.isArray(parsedCats) && parsedCats.length > 0) {
          const names = typeof parsedCats[0] === "string" ? parsedCats : parsedCats.map((c: any) => c.name);
          setCategoriesList(names);
          if (typeof parsedCats[0] === "object") {
            setFullCategoriesList(
              parsedCats.map((c: any) => ({
                name: c.name,
                type: c.type === "income" ? "income" : "expense",
              }))
            );
          }
        }
      }
      if (cachedAcc) {
        const parsedAcc = JSON.parse(cachedAcc);
        const list = Array.isArray(parsedAcc) ? parsedAcc : parsedAcc?.accounts || [];
        if (list.length > 0) {
          setAccountsList(list);
        }
      }
      if (hasCache) {
        setIsLoading(false);
      }
    } catch {}
  }, []);

  // Edit / Detail Modal State (PRD T4)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editType, setEditType] = useState<"expense" | "income">("expense");
  const [editCategory, setEditCategory] = useState("");
  const [isCustomEditCategory, setIsCustomEditCategory] = useState(false);
  const [customEditCategory, setCustomEditCategory] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Delete Toast State (PRD T4)
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastDeletedTx, setLastDeletedTx] = useState<Transaction | null>(null);

  // Load Transactions, Categories & Accounts
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [txRes, catRes, accRes] = await Promise.all([
        getTransactionsAction({
          month: filterMonth === "all" ? undefined : filterMonth,
          type: filterType === "all" ? undefined : filterType,
          category: filterCategory === "all" ? undefined : filterCategory,
          query: searchQuery.trim() || undefined,
        }),
        getUserCategoriesAction(),
        getAccountsAction(),
      ]);

      if (txRes.success && txRes.data) {
        setTransactionsList(txRes.data);
        if (filterMonth === currentMonthStr && filterType === "all" && filterCategory === "all" && !searchQuery.trim()) {
          try {
            localStorage.setItem("sakuin_cached_transactions", JSON.stringify(txRes.data));
          } catch {}
        }
      }

      if (catRes.success && catRes.data) {
        const catNames = Array.from(new Set(catRes.data.map((c) => c.name)));
        setCategoriesList(catNames);
        setFullCategoriesList(
          catRes.data.map((c) => ({
            name: c.name,
            type: c.type === "income" ? "income" : "expense",
          }))
        );
        try {
          localStorage.setItem("sakuin_cached_categories", JSON.stringify(catRes.data));
        } catch {}
      }

      if (accRes.success && accRes.data) {
        const accs = accRes.data.accounts || [];
        setAccountsList(accs);
        try {
          localStorage.setItem("sakuin_cached_accounts", JSON.stringify(accRes.data));
        } catch {}
      }
    } catch (err) {
      console.error("Gagal memuat riwayat transaksi:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Jika filter default dan sudah ada cache, load silently di latar belakang
    const isDefaultFilter =
      filterMonth === currentMonthStr &&
      filterType === "all" &&
      filterCategory === "all" &&
      !searchQuery.trim();

    const hasData = transactionsList.length > 0;
    loadData(isDefaultFilter && hasData);

    const handleSyncComplete = () => {
      loadData(true);
    };
    window.addEventListener("sakuin:sync-complete", handleSyncComplete);
    return () => {
      window.removeEventListener("sakuin:sync-complete", handleSyncComplete);
    };
  }, [filterMonth, filterType, filterCategory, searchQuery]);

  // Generate 6 months dropdown list
  const monthOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const { year: curY, monthIndex: curM } = getJakartaCalendarParts();
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(curY, curM - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const val = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = `${INDONESIAN_MONTHS[m]} ${y}`;
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

  // Pengelompokan transaksi berdasarkan tanggal (mempertahankan urutan dari server)
  const groupedTransactions = useMemo(() => {
    const todayKey = getJakartaDateString();
    const { year, monthNumber, day } = getJakartaCalendarParts();
    const yDate = new Date(Date.UTC(year, monthNumber - 1, day - 1));
    const yesterdayKey = `${yDate.getUTCFullYear()}-${String(yDate.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(yDate.getUTCDate()).padStart(2, "0")}`;

    const groups: { dateKey: string; label: string; items: Transaction[] }[] = [];
    const indexByDate = new Map<string, number>();

    for (const tx of transactionsList) {
      const rawKey = tx.date || todayKey;
      const existingIdx = indexByDate.get(rawKey);
      if (existingIdx !== undefined) {
        groups[existingIdx].items.push(tx);
      } else {
        const label =
          rawKey === todayKey || rawKey.includes("Hari ini")
            ? "Hari ini"
            : rawKey === yesterdayKey
            ? "Kemarin"
            : formatShortDate(rawKey);
        indexByDate.set(rawKey, groups.length);
        groups.push({ dateKey: rawKey, label, items: [tx] });
      }
    }
    return groups;
  }, [transactionsList]);

  const getCategoriesForType = (t: "expense" | "income") => {
    const dbFiltered = fullCategoriesList
      .filter((c) => c.type === t && c.name !== "Kebutuhan Lain" && c.name !== "Lainnya")
      .map((c) => c.name);
    const names =
      dbFiltered.length > 0
        ? Array.from(new Set(dbFiltered))
        : t === "expense"
        ? DEFAULT_EXPENSE_CATEGORIES
        : DEFAULT_INCOME_CATEGORIES;
    return names.map((name) => ({
      name,
      icon: getCategoryIcon(name),
    }));
  };

  // Open Edit Modal
  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditAmount(tx.amount);
    setEditType(tx.type);
    setEditAccountId(tx.accountId || (accountsList[0]?.id || ""));

    const presetList = getCategoriesForType(tx.type);
    const isPreset =
      tx.category !== "Kebutuhan Lain" &&
      tx.category !== "Lainnya" &&
      presetList.some((c) => c.name === tx.category);

    if (isPreset) {
      setIsCustomEditCategory(false);
      setEditCategory(tx.category);
      setCustomEditCategory("");
    } else {
      setIsCustomEditCategory(true);
      setEditCategory("");
      setCustomEditCategory(
        tx.customLabel?.trim() ||
          (tx.category !== "Kebutuhan Lain" && tx.category !== "Lainnya" ? tx.category : tx.title)
      );
    }

    setEditNote(tx.note || "");
    setEditDate(tx.date.includes("Hari ini") ? getJakartaDateString() : tx.date);
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditingTx(null);
    setIsUpdating(false);
    setIsDeleting(false);
  };

  const selectedEditAccount = accountsList.find((a) => a.id === editAccountId);
  const effectiveEditBalance = useMemo(() => {
    if (!selectedEditAccount) return 0;
    if (!editingTx) return selectedEditAccount.balance;
    if (editingTx.accountId === selectedEditAccount.id) {
      return (
        selectedEditAccount.balance +
        (editingTx.type === "expense" ? editingTx.amount : -editingTx.amount)
      );
    }
    return selectedEditAccount.balance;
  }, [selectedEditAccount, editingTx]);

  const isEditInsufficient =
    editType === "expense" &&
    selectedEditAccount !== undefined &&
    editAmount > 0 &&
    effectiveEditBalance < editAmount;

  // Handle Update Transaction
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || editAmount <= 0 || isUpdating || isEditInsufficient) return;

    if (isCustomEditCategory && !customEditCategory.trim()) return;
    if (!isCustomEditCategory && !editCategory) return;

    setIsUpdating(true);
    const finalCategory = isCustomEditCategory ? "Lainnya" : editCategory;

    try {
      const res = await updateTransactionAction(editingTx.id, {
        amount: editAmount,
        type: editType,
        categoryName: finalCategory,
        note: editNote.trim() || undefined,
        customLabel: isCustomEditCategory
          ? customEditCategory.trim()
          : editNote.trim() || undefined,
        accountId: editAccountId || undefined,
        occurredOn: editDate,
      });

      if (res.success) {
        closeEditModal();
        await loadData(true);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
        if (res.dailyLimitAlert && res.dailyLimitAlert.level !== "ok") {
          notifyDailyLimitAlert(res.dailyLimitAlert, true);
        }
      } else {
        alert(res.error || "Gagal memperbarui transaksi");
      }
    } catch (err) {
      console.error("Gagal update transaksi:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Langsung hapus lembut + tampilkan Snackbar "Urungkan" (PRD UI/UX Tahap 2)
  const handleDeleteDirect = async (targetTx: Transaction) => {
    if (isDeleting) return;

    setIsDeleting(true);
    setTransactionsList((prev) => prev.filter((t) => t.id !== targetTx.id));
    setLastDeletedTx(targetTx);
    setShowUndoToast(true);
    if (editingTx?.id === targetTx.id) {
      closeEditModal();
    }

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
    }, 6000);

    try {
      const res = await deleteTransactionAction(targetTx.id);
      if (res.success) {
        await loadData(true);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      } else {
        setTransactionsList((prev) => [targetTx, ...prev]);
        setShowUndoToast(false);
        alert(res.error || "Gagal menghapus transaksi");
      }
    } catch (err) {
      console.error("Gagal hapus transaksi:", err);
      setTransactionsList((prev) => [targetTx, ...prev]);
      setShowUndoToast(false);
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
        await loadData(true);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
      }
    } catch (err) {
      console.error("Gagal memulihkan transaksi:", err);
    }
  };

  const activeCategories = getCategoriesForType(editType);
  const selectedMonthLabel =
    monthOptions.find((m) => m.value === filterMonth)?.label || filterMonth;
  const activeFilterCount = filterCategory !== "all" ? 1 : 0;
  const hasAnyActiveFilter =
    filterCategory !== "all" || filterType !== "all" || searchQuery.trim() !== "";

  return (
    <div className="space-y-3.5 max-w-xl mx-auto pb-[calc(72px+env(safe-area-inset-bottom,16px)+16px)] md:pb-8">
      {/* 1. Header Riwayat */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Riwayat
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/export/transactions?month=${filterMonth}&type=${filterType}`}
            download
            aria-label="Unduh riwayat"
            title="Unduh riwayat CSV"
            className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] bg-card hover:bg-muted border border-border text-foreground rounded-full shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-[color:var(--accent-text)]" />
          </a>

          <Link
            href="/record"
            className="hidden md:inline-flex items-center gap-1.5 bg-accent hover:brightness-105 text-[#1F1F1F] font-black text-xs px-4 min-h-[44px] rounded-full shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Catat Baru</span>
          </Link>
        </div>
      </div>

      {/* 2. Pemilih Periode Ringkas (1 baris, nama periode di tengah, 44px) */}
      <div className="relative bg-card border border-border rounded-xl min-h-[44px] px-3.5 flex items-center justify-between gap-2 shadow-xs focus-within:ring-2 focus-within:ring-accent">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0 pointer-events-none" />
        <span className="text-xs font-extrabold text-foreground text-center truncate pointer-events-none flex-1">
          {selectedMonthLabel}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 pointer-events-none" />
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          aria-label="Pilih periode"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Pencarian, Tombol Filter, Segmented Jenis, & Chip Aktif */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari transaksi..."
              aria-label="Cari transaksi"
              className="w-full min-h-[44px] pl-9 pr-10 py-2 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Hapus pencarian"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile: Tombol Filter buka bottom sheet */}
          <button
            type="button"
            onClick={() => {
              setDraftCategory(filterCategory);
              setIsFilterSheetOpen(true);
            }}
            aria-label="Buka filter kategori"
            className={`md:hidden inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] rounded-xl border text-xs font-bold transition-colors shrink-0 whitespace-nowrap ${
              activeFilterCount > 0
                ? "bg-accent/15 border-[var(--accent-border)] text-[color:var(--accent-text)]"
                : "bg-card border-border text-foreground hover:bg-muted"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>{activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}</span>
          </button>

          {/* Desktop/Tablet (>= 768px): Select kategori sebaris */}
          <div className="hidden md:block shrink-0 w-44">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="Filter kategori"
              className="w-full min-h-[44px] px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
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

        {/* Segmented Control: Semua | Keluar | Masuk (1 baris di 360px) */}
        <div
          role="group"
          aria-label="Filter jenis transaksi"
          className="grid grid-cols-3 p-1 bg-card border border-border rounded-xl gap-1"
        >
          <button
            type="button"
            onClick={() => setFilterType("all")}
            aria-pressed={filterType === "all"}
            aria-label="Semua jenis transaksi"
            className={`min-h-[44px] px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center whitespace-nowrap ${
              filterType === "all"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setFilterType("expense")}
            aria-pressed={filterType === "expense"}
            aria-label="Filter pengeluaran"
            className={`min-h-[44px] px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              filterType === "expense"
                ? "bg-expense text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            <span>Keluar</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("income")}
            aria-pressed={filterType === "income"}
            aria-label="Filter pemasukan"
            className={`min-h-[44px] px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              filterType === "income"
                ? "bg-accent text-[#1F1F1F] shadow-xs font-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            <span>Masuk</span>
          </button>
        </div>

        {/* Chip Filter Aktif (hanya muncul jika kategori/cari aktif) */}
        {(filterCategory !== "all" || searchQuery.trim() !== "") && (
          <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterCategory !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilterCategory("all")}
                  aria-label={`Hapus filter kategori ${filterCategory}`}
                  className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-full bg-card border border-border text-xs font-semibold text-foreground hover:border-[var(--accent-border)]"
                >
                  <span>Kategori: {filterCategory}</span>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
              {searchQuery.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Hapus kata kunci pencarian"
                  className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-full bg-card border border-border text-xs font-semibold text-foreground hover:border-[var(--accent-border)]"
                >
                  <span className="max-w-[160px] truncate">Cari: {searchQuery.trim()}</span>
                  <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setFilterCategory("all");
                setFilterType("all");
                setSearchQuery("");
              }}
              className="text-xs font-bold text-[color:var(--accent-text)] hover:underline px-2 min-h-[36px]"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* 4. Strip Ringkasan Periode (1 baris ringkas, teks +/- & ikon + warna kontras) */}
      <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground">Keluar</span>
          <span className="inline-flex items-center gap-0.5 text-sm font-black text-[color:var(--expense-text)] tabular-nums">
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>-{formatRupiah(summary.expense)}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground">Masuk</span>
          <span className="inline-flex items-center gap-0.5 text-sm font-black text-[color:var(--accent-text)] tabular-nums">
            <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>+{formatRupiah(summary.income)}</span>
          </span>
        </div>
      </div>

      {/* 5. Daftar Transaksi */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-xs font-extrabold text-foreground uppercase tracking-wider">
            Transaksi ({summary.count})
          </h2>
          <span className="text-xs text-muted-foreground">Ketuk untuk edit</span>
        </div>

        {isLoading ? (
          <div
            className="bg-card border border-border rounded-2xl divide-y divide-border/70 animate-pulse"
            aria-busy="true"
            aria-label="Memuat daftar transaksi"
          >
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="px-3.5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-32 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                </div>
                <div className="h-4 w-20 rounded bg-muted shrink-0" />
              </div>
            ))}
          </div>
        ) : transactionsList.length === 0 ? (
          <div className="p-6 text-center bg-card rounded-2xl border border-border space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-accent/15 text-[color:var(--accent-text)] flex items-center justify-center mx-auto">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Belum ada transaksi di sini
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {hasAnyActiveFilter
                  ? "Coba ubah periode, kategori, atau kata kunci pencarianmu."
                  : "Catat pengeluaran atau pemasukan pertamamu supaya riwayat langsung tersusun rapi."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {hasAnyActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterCategory("all");
                    setFilterType("all");
                  }}
                  className="inline-flex items-center justify-center px-4 min-h-[44px] rounded-full border border-border bg-background text-xs font-bold text-foreground hover:bg-muted transition-colors"
                >
                  Reset filter
                </button>
              )}
              <Link
                href="/record"
                className="inline-flex items-center justify-center gap-1.5 bg-accent hover:brightness-105 text-[#1F1F1F] font-black text-xs px-5 min-h-[44px] rounded-full shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Catat transaksi</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedTransactions.map((group) => (
              <div key={group.dateKey} className="space-y-1.5">
                {/* Header Tanggal */}
                <div className="px-0.5 pt-0.5">
                  <span className="text-xs font-extrabold text-muted-foreground">
                    {group.label}
                  </span>
                </div>

                {/* Baris Transaksi Kompak */}
                <div className="bg-card border border-border rounded-2xl divide-y divide-border/70">
                  {group.items.map((item) => {
                    const Icon = getCategoryIcon(item.category);
                    const sublineText = item.accountName
                      ? `${item.category} - ${item.accountName}`
                      : item.category;

                    return (
                      <div
                        key={item.id}
                        className="min-h-[56px] pl-3 pr-1 py-2 flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 text-left rounded-xl px-1 py-0.5 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                              item.type === "expense"
                                ? "bg-expense/10 border-expense/25 text-[color:var(--expense-text)]"
                                : "bg-accent/15 border-[var(--accent-border)]/30 text-[color:var(--accent-text)]"
                            }`}
                          >
                            <Icon className="w-4 h-4 stroke-[2.2]" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-bold text-foreground truncate">
                                {item.title}
                              </span>
                              <span
                                className={`text-sm font-black shrink-0 tabular-nums ${
                                  item.type === "expense"
                                    ? "text-[color:var(--expense-text)]"
                                    : "text-[color:var(--accent-text)]"
                                }`}
                              >
                                {item.type === "expense" ? "-" : "+"}
                                {formatRupiah(item.amount)}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug break-words">
                              {sublineText}
                              {item.note && item.note !== item.title ? ` · ${item.note}` : ""}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDirect(item)}
                          aria-label="Hapus transaksi"
                          title="Hapus transaksi"
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[color:var(--expense-text)] hover:bg-expense/15 transition-colors active:scale-95 shrink-0"
                        >
                          <Trash2 className="w-4 h-4 stroke-[2]" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Sheet Filter Kategori (Mobile < 768px) */}
      <AnimatePresence>
        {isFilterSheetOpen && (
          <div
            className="fixed inset-0 z-[100] md:hidden flex items-end justify-center bg-black/70 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFilterSheetOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 28, stiffness: 340 }}
              role="dialog"
              aria-modal="true"
              aria-label="Filter kategori"
              className="bg-card border-t border-border rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[82dvh] flex flex-col overflow-hidden"
            >
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
                <h2 className="text-base font-black text-foreground">Filter Kategori</h2>
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  aria-label="Tutup filter"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Pilih kategori untuk menyaring riwayat transaksi pada periode ini.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block" htmlFor="mobile-category-select">
                    Kategori
                  </label>
                  <select
                    id="mobile-category-select"
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="all">Semua Kategori</option>
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDraftCategory("all")}
                    className={`px-3.5 min-h-[44px] rounded-full text-xs font-bold border transition-colors ${
                      draftCategory === "all"
                        ? "bg-accent text-[#1F1F1F] border-[var(--accent-border)] font-black"
                        : "bg-background text-foreground border-border"
                    }`}
                  >
                    Semua Kategori
                  </button>
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDraftCategory(cat)}
                      className={`px-3.5 min-h-[44px] rounded-full text-xs font-bold border transition-colors ${
                        draftCategory === cat
                          ? "bg-accent text-[#1F1F1F] border-[var(--accent-border)] font-black"
                          : "bg-background text-foreground border-border"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-card px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDraftCategory("all");
                    setFilterCategory("all");
                    setIsFilterSheetOpen(false);
                  }}
                  className="px-4 min-h-[44px] rounded-full border border-border bg-background text-foreground text-xs font-bold hover:bg-muted transition-colors"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory(draftCategory);
                    setIsFilterSheetOpen(false);
                  }}
                  className="flex-1 min-h-[44px] rounded-full bg-accent hover:brightness-105 text-[#1F1F1F] text-xs font-black shadow-sm transition-all"
                >
                  Terapkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Redesigned Edit Log Activity Sheet / Modal (PRD T4) */}
      <AnimatePresence>
        {editingTx && (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditModal();
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.98 }}
              transition={{ type: "spring", damping: 28, stiffness: 340 }}
              className="bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
            >
              {/* Mobile Drag Handle */}
              <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Sticky Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      editType === "expense"
                        ? "bg-expense/15 border-expense/25 text-expense"
                        : "bg-accent/15 border-accent/25 text-accent"
                    }`}
                  >
                    {React.createElement(getCategoryIcon(editCategory || customEditCategory || editingTx.category), {
                      className: "w-4 h-4 stroke-[2.2]",
                    })}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-black text-foreground truncate">
                        Ubah Transaksi
                      </h2>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          editType === "expense"
                            ? "bg-expense/15 text-[color:var(--expense-text)]"
                            : "bg-accent/15 text-[color:var(--accent-text)]"
                        }`}
                      >
                        {editType === "expense" ? "Pengeluaran" : "Pemasukan"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {editingTx.title} • {formatShortDate(editingTx.date)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeEditModal}
                  aria-label="Tutup modal edit"
                  className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form
                id="edit-tx-form"
                onSubmit={handleUpdate}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin"
              >
                {/* Segmented Tipe Toggle: Pengeluaran vs Pemasukan */}
                <div className="grid grid-cols-2 p-1 bg-background rounded-xl border border-border text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setEditType("expense");
                      const expCats = getCategoriesForType("expense");
                      setEditCategory(expCats[0]?.name || "Makan");
                      setIsCustomEditCategory(false);
                      setCustomEditCategory("");
                    }}
                    className={`py-2.5 min-h-[40px] rounded-lg transition-all flex items-center justify-center gap-1.5 ${
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
                      const incCats = getCategoriesForType("income");
                      setEditCategory(incCats[0]?.name || "Uang Kiriman");
                      setIsCustomEditCategory(false);
                      setCustomEditCategory("");
                    }}
                    className={`py-2.5 min-h-[40px] rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      editType === "income"
                        ? "bg-card text-foreground shadow-sm border border-border font-black"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span>Pemasukan</span>
                  </button>
                </div>

                {/* Nominal Hero Card */}
                <div className="bg-background rounded-2xl border border-border p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                      Nominal {editType === "expense" ? "Pengeluaran" : "Pemasukan"}
                    </span>
                    {editAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditAmount(0)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-muted/70 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="relative flex items-center bg-card border border-border rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-all">
                    <span className="text-lg font-black text-muted-foreground mr-2 select-none shrink-0">
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
                  </div>

                  {/* Quick Helper Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground mr-0.5">
                      Tambah:
                    </span>
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setEditAmount((prev) => Math.min(999999999, prev + q.value))}
                        className="px-2.5 py-1 min-h-[32px] rounded-full text-xs font-bold bg-card border border-border text-foreground hover:border-accent hover:text-accent active:scale-95 transition-all"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pilih Kategori */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">Kategori</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeCategories.map((cat) => {
                      const Icon = cat.icon;
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
                          className={`flex items-center gap-2 p-2.5 min-h-[44px] rounded-xl text-xs font-bold border transition-all text-left ${
                            isSelected
                              ? "bg-accent/15 border-accent text-foreground ring-1 ring-accent"
                              : "bg-background border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0 stroke-[2]" />
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
                    className={`w-full py-2.5 min-h-[44px] px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                      isCustomEditCategory
                        ? "bg-accent/15 border-accent text-foreground ring-1 ring-accent"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Kategori Lainnya</span>
                  </button>

                  <AnimatePresence>
                    {isCustomEditCategory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1 pt-1"
                      >
                        <label className="text-xs font-bold text-accent flex items-center justify-between">
                          <span>Keterangan Kategori Lain</span>
                          <span className="text-xs text-expense font-semibold">Wajib diisi</span>
                        </label>
                        <input
                          type="text"
                          maxLength={40}
                          autoFocus
                          value={customEditCategory}
                          onChange={(e) => setCustomEditCategory(e.target.value)}
                          placeholder="Misal: Skincare, Fotokopi, Obat..."
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-background border border-accent text-foreground text-base sm:text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pilih Rekening Pembayaran / Sumber Dana */}
                {accountsList.length > 0 && (
                  <div className="space-y-2 pt-0.5">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>{editType === "expense" ? "Dibayar Pakai Rekening" : "Masuk ke Rekening"}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        Saldo otomatis disesuaikan
                      </span>
                    </label>
                    <div
                      className={`grid gap-2 ${
                        accountsList.length === 1
                          ? "grid-cols-1"
                          : accountsList.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-2"
                      }`}
                    >
                      {accountsList.map((acc) => {
                        const isSelected = editAccountId === acc.id;
                        const isOriginal = editingTx?.accountId === acc.id;
                        const effectiveBal = isOriginal
                          ? acc.balance + (editingTx.type === "expense" ? editingTx.amount : -editingTx.amount)
                          : acc.balance;
                        const isInsufficient = editType === "expense" && editAmount > 0 && effectiveBal < editAmount;
                        const AccIcon =
                          acc.type === "bank" ? Landmark : acc.type === "ewallet" ? Smartphone : Banknote;

                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setEditAccountId(acc.id)}
                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 min-h-[60px] ${
                              isSelected
                                ? isInsufficient
                                  ? "border-expense bg-expense/10 text-expense ring-1 ring-expense"
                                  : "border-accent bg-accent/15 text-foreground ring-1 ring-accent"
                                : isInsufficient
                                ? "border-border/60 bg-background/50 text-muted-foreground opacity-60 hover:opacity-100"
                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-5 h-5 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/50">
                                  <AccIcon className="w-3 h-3" />
                                </div>
                                <span className="text-xs font-bold truncate text-foreground">{acc.name}</span>
                              </div>
                              {isOriginal && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                  Asal
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-semibold text-muted-foreground truncate">
                                {formatRupiah(effectiveBal)}
                              </span>
                              {isInsufficient && (
                                <span className="text-xs font-bold text-expense bg-expense/15 px-1.5 py-0.5 rounded shrink-0">
                                  Kurang
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {isEditInsufficient && selectedEditAccount && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-expense/10 border border-expense/30 text-expense text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                          Saldo <strong>{selectedEditAccount.name}</strong> ({formatRupiah(effectiveEditBalance)}) tidak cukup untuk nominal baru ({formatRupiah(editAmount)}).
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Catatan & Tanggal (Grid 2 Kolom di sm+) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>Catatan</span>
                      <span className="text-xs text-muted-foreground font-normal">Opsional</span>
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Contoh: Warteg bu joko..."
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-background border border-border text-foreground text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Tanggal Transaksi</span>
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-background border border-border text-foreground text-base sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-date-and-time-value]:text-left cursor-pointer"
                    />
                  </div>
                </div>
              </form>

              {/* Sticky Bottom Action Bar: Selalu Terlihat, Tidak Tertutup Bottom Bar */}
              <div className="shrink-0 border-t border-border bg-card px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDeleteDirect(editingTx)}
                  disabled={isDeleting || isUpdating}
                  className="px-4 min-h-[48px] rounded-2xl border border-expense/40 bg-expense/10 hover:bg-expense text-expense hover:text-white font-bold text-xs sm:text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-4 h-4 stroke-[2.2]" />
                  <span>Hapus</span>
                </button>

                <button
                  type="submit"
                  form="edit-tx-form"
                  disabled={
                    editAmount <= 0 ||
                    isUpdating ||
                    isEditInsufficient ||
                    (isCustomEditCategory ? !customEditCategory.trim() : !editCategory)
                  }
                  className="flex-1 min-h-[48px] bg-accent hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-[#1F1F1F] font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {isUpdating
                      ? "Menyimpan..."
                      : isEditInsufficient
                      ? `Saldo ${selectedEditAccount?.name || "Rekening"} Kurang`
                      : "Simpan Perubahan"}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Snackbar Notification (PRD UI/UX Tahap 2) */}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#2E2E2E] text-[#D4FF5A] text-xs font-black shrink-0 transition-colors shadow-sm"
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
