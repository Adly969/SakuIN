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
  Bike,
  Cookie,
  Wifi,
  ShoppingBag,
  Banknote,
  Landmark,
  AlertCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  createTransactionAction,
  getTransactionsAction,
  getCategoriesAction,
} from "@/app/actions/transactions";
import { getAccountsAction } from "@/app/actions/accounts";
import { enqueueOfflineTransaction } from "@/lib/offline-queue";
import { notifyDailyLimitAlert } from "@/lib/native-notifications";

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

interface CategoryItem {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  requiresLabel: boolean;
  isDefault?: boolean;
}

interface AccountItem {
  id: string;
  name: string;
  type: "bank" | "ewallet" | "cash";
  balance: number;
  isDefault: boolean;
}

export default function RecordPage() {
  const router = useRouter();
  const [recordType, setRecordType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState<number>(0);

  // Kategori states
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Makan");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  // Rekening states
  const [accountsList, setAccountsList] = useState<AccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Catatan terpisah
  const [note, setNote] = useState("");

  const [txDate, setTxDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [todayTransactions, setTodayTransactions] = useState<RecentTx[]>([]);

  // Load Categories & Accounts from Cache & DB
  useEffect(() => {
    // Helper untuk mendeteksi kategori pemasukan secara andal
    const isKnownIncome = (name: string) => {
      const n = (name || "").toLowerCase().trim();
      return (
        n.includes("uang kiriman") ||
        n.includes("gaji") ||
        n.includes("upah") ||
        n.includes("beasiswa") ||
        n.includes("sambilan") ||
        n.includes("part time") ||
        n.includes("hadiah") ||
        n.includes("pemasukan") ||
        n.includes("kiriman")
      );
    };

    // 1. Instant Cache Hydration from localStorage (0ms Frame 0)
    try {
      const cachedAcc = localStorage.getItem("sakuin_cached_accounts");
      if (cachedAcc) {
        const parsedAcc = JSON.parse(cachedAcc);
        const list = Array.isArray(parsedAcc) ? parsedAcc : parsedAcc?.accounts || [];
        if (list.length > 0) {
          setAccountsList(list);
          const def = list.find((a: any) => a.isDefault) || list[0];
          if (def?.id) setSelectedAccountId(def.id);
        }
      }

      const cachedCat = localStorage.getItem("sakuin_cached_categories");
      if (cachedCat) {
        const parsedCat = JSON.parse(cachedCat);
        if (Array.isArray(parsedCat) && parsedCat.length > 0) {
          const normalizedList: CategoryItem[] = parsedCat.map((item: any, idx: number) => {
            if (typeof item === "string") {
              const income = isKnownIncome(item);
              return {
                id: `cat-${idx}`,
                name: item,
                type: income ? "income" : "expense",
                icon: income ? "Wallet" : "Tag",
                color: income ? "#D4FF5A" : "#8CCBFF",
                requiresLabel: false,
              };
            }
            return {
              ...item,
              type: isKnownIncome(item.name) ? "income" : (item.type || "expense"),
            };
          });

          const cleanCached = normalizedList.filter(
            (c) =>
              c.isDefault ||
              [
                "makan", "nongkrong", "bensin", "bensin & transport", "rokok",
                "listrik", "kuota", "kuota & internet", "laundry", "jajan & cemilan",
                "kebutuhan lain", "uang kiriman", "kerja sambilan", "beasiswa", "gaji / upah", "lainnya"
              ].includes(c.name.toLowerCase().trim())
          );

          setCategoriesList(cleanCached);

          const firstExp = cleanCached.find((c) => c.type === "expense" && c.name !== "Kebutuhan Lain");
          if (firstExp) {
            setSelectedCategory(firstExp.name);
          }
        }
      }
    } catch (err) {
      console.warn("Gagal membaca cache lokal:", err);
    }

    // 2. Fresh Network Sync in background
    async function initData() {
      try {
        const [catRes, accRes] = await Promise.all([
          getCategoriesAction(),
          getAccountsAction(),
        ]);

        if (catRes.success && catRes.data && catRes.data.length > 0) {
          const normalizedData: CategoryItem[] = catRes.data.map((c) => ({
            ...c,
            type: isKnownIncome(c.name) ? "income" : (c.type || "expense"),
          }));

          const cleanData = normalizedData.filter(
            (c) =>
              c.isDefault ||
              [
                "makan", "nongkrong", "bensin", "bensin & transport", "rokok",
                "listrik", "kuota", "kuota & internet", "laundry", "jajan & cemilan",
                "kebutuhan lain", "uang kiriman", "kerja sambilan", "beasiswa", "gaji / upah", "lainnya"
              ].includes(c.name.toLowerCase().trim())
          );

          setCategoriesList(cleanData);
          try {
            localStorage.setItem("sakuin_cached_categories", JSON.stringify(cleanData));
          } catch {}
          const firstExp = cleanData.find((c) => c.type === "expense" && c.name !== "Kebutuhan Lain");
          if (firstExp) setSelectedCategory(firstExp.name);
        }

        if (accRes.success && accRes.data && accRes.data.accounts.length > 0) {
          setAccountsList(accRes.data.accounts);
          try {
            localStorage.setItem("sakuin_cached_accounts", JSON.stringify(accRes.data));
          } catch {}
          const def = accRes.data.accounts.find((a) => a.isDefault) || accRes.data.accounts[0];
          if (def?.id) setSelectedAccountId(def.id);
        }
      } catch (err) {
        console.error("Gagal inisialisasi data:", err);
      }
    }
    initData();
  }, []);

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

  const getCategoryIconComponent = (name: string, iconStr?: string) => {
    const key = `${name || ""} ${iconStr || ""}`.toLowerCase();
    if (key.includes("makan") || key.includes("utensils")) return Utensils;
    if (key.includes("nongkrong") || key.includes("kopi") || key.includes("coffee")) return Coffee;
    if (key.includes("bensin") || key.includes("transport") || key.includes("bike")) return Bike;
    if (key.includes("jajan") || key.includes("cemilan") || key.includes("cookie")) return Cookie;
    if (key.includes("kuota") || key.includes("internet") || key.includes("wifi")) return Wifi;
    if (key.includes("kos") || key.includes("shoppingbag")) return ShoppingBag;
    if (key.includes("laundry") || key.includes("shirt")) return Shirt;
    if (key.includes("listrik") || key.includes("zap")) return Zap;
    if (key.includes("kuliah") || key.includes("fotokopi") || key.includes("beasiswa") || key.includes("graduationcap"))
      return GraduationCap;
    if (key.includes("rokok") || key.includes("vape") || key.includes("flame") || key.includes("cigarette")) return Flame;
    if (key.includes("kiriman") || key.includes("wallet")) return Wallet;
    if (key.includes("gaji") || key.includes("kerja") || key.includes("upah") || key.includes("briefcase")) return Briefcase;
    return Tag;
  };

  const OFFICIAL_CATEGORY_NAMES = [
    "makan", "nongkrong", "bensin", "bensin & transport", "rokok",
    "listrik", "kuota", "kuota & internet", "laundry", "jajan & cemilan",
    "uang kiriman", "kerja sambilan", "beasiswa", "gaji / upah"
  ];

  const currentCategories = categoriesList.filter(
    (c) =>
      c.type === recordType &&
      c.name !== "Kebutuhan Lain" &&
      c.name !== "Lainnya" &&
      OFFICIAL_CATEGORY_NAMES.includes(c.name.toLowerCase().trim())
  );

  // Fallback if dbCategories empty yet
  const displayCategories =
    currentCategories.length > 0
      ? currentCategories
      : recordType === "expense"
      ? [
          { id: "1", name: "Makan", type: "expense", icon: "Utensils", color: "#8CCBFF", requiresLabel: false },
          { id: "2", name: "Nongkrong", type: "expense", icon: "Coffee", color: "#6B72FF", requiresLabel: false },
          { id: "3", name: "Bensin & Transport", type: "expense", icon: "Bike", color: "#5BAA6B", requiresLabel: false },
          { id: "4", name: "Jajan & Cemilan", type: "expense", icon: "Cookie", color: "#FFB04A", requiresLabel: false },
          { id: "5", name: "Kuota & Internet", type: "expense", icon: "Wifi", color: "#38BDF8", requiresLabel: false },
          { id: "6", name: "Laundry", type: "expense", icon: "Shirt", color: "#A78BFA", requiresLabel: false },
        ]
      : [
          { id: "7", name: "Uang Kiriman", type: "income", icon: "Wallet", color: "#D4FF5A", requiresLabel: false },
          { id: "8", name: "Kerja Sambilan", type: "income", icon: "Briefcase", color: "#8CCBFF", requiresLabel: false },
          { id: "9", name: "Beasiswa", type: "income", icon: "GraduationCap", color: "#5BAA6B", requiresLabel: false },
        ];

  const selectedAccount = accountsList.find((a) => a.id === selectedAccountId);
  const isInsufficientBalance =
    recordType === "expense" &&
    selectedAccount !== undefined &&
    amount > 0 &&
    selectedAccount.balance < amount;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (amount <= 0 || isSaving) return;

    if (isInsufficientBalance) {
      alert(`Saldo ${selectedAccount?.name || "rekening"} tidak mencukupi untuk pengeluaran ini.`);
      return;
    }

    // Validasi kategori
    if (isCustomCategory && !customCategory.trim()) return;
    if (!isCustomCategory && !selectedCategory) return;

    setIsSaving(true);
    // Kategori kustom diarahkan ke Kebutuhan Lain / Lainnya sesuai PRD (tidak membuat kategori permanen baru)
    const finalCategory = isCustomCategory
      ? (recordType === "expense" ? "Kebutuhan Lain" : "Lainnya")
      : selectedCategory;
    const itemTitle = isCustomCategory
      ? customCategory.trim()
      : (note.trim() || selectedCategory);

    // Offline Queue
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

      setAmount(0);
      setIsCustomCategory(false);
      setCustomCategory("");
      setNote("");
      setIsSaving(false);

      setTimeout(() => setShowToast(false), 4000);
      return;
    }

    try {
      const res = await createTransactionAction({
        amount,
        type: recordType,
        categoryName: finalCategory,
        note: note.trim() || undefined,
        customLabel: isCustomCategory ? customCategory.trim() : (note.trim() || undefined),
        accountId: selectedAccountId || undefined,
        occurredOn: txDate,
      });

      if (res.success) {
        setToastMessage(`${itemTitle} (${formatRupiah(amount)}) berhasil dicatat!`);
        setShowToast(true);

        // Optimistically update account balance in local state & localStorage
        if (selectedAccountId) {
          setAccountsList((prev) => {
            const updated = prev.map((acc) => {
              if (acc.id === selectedAccountId) {
                const diff = recordType === "expense" ? -amount : amount;
                return { ...acc, balance: acc.balance + diff };
              }
              return acc;
            });
            try {
              const totalBalance = updated.reduce((s, a) => s + Number(a.balance || 0), 0);
              localStorage.setItem("sakuin_cached_accounts", JSON.stringify({ totalBalance, accounts: updated }));
            } catch {}
            return updated;
          });
        }
        window.dispatchEvent(new Event("sakuin:data-invalidated"));

        // Kirim notifikasi pengingat jika mendekati atau mencapai batas harian
        if (res.dailyLimitAlert && res.dailyLimitAlert.level !== "ok") {
          notifyDailyLimitAlert(res.dailyLimitAlert, true);
        }

        setAmount(0);
        setIsCustomCategory(false);
        setCustomCategory("");
        setNote("");

        setTimeout(() => setShowToast(false), 4000);
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
      setToastMessage(`${itemTitle} disimpan ke antrean offline!`);
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
    <div className="space-y-5 max-w-[480px] mx-auto pb-32 md:pb-12">
      {/* 1. Header Halaman */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Catat Transaksi
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Catat pengeluaran atau pemasukanmu secara instan dalam hitungan detik.
        </p>
      </div>

      {/* Floating Success Notification */}
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
              const firstExp = categoriesList.find((c) => c.type === "expense" && c.name !== "Kebutuhan Lain");
              setSelectedCategory(firstExp?.name || "Makan");
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
              const firstInc = categoriesList.find((c) => c.type === "income" && c.name !== "Lainnya");
              setSelectedCategory(firstInc?.name || "Uang Kiriman");
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

        {/* Input Nominal Langsung */}
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
                amount >= 10000000 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
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
                className="px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold bg-card border border-border text-foreground hover:border-accent hover:text-accent active:scale-95 transition-all flex items-center justify-center"
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
            {displayCategories.map((cat) => {
              const Icon = getCategoryIconComponent(cat.name, cat.icon);
              const isSelected = !isCustomCategory && selectedCategory === cat.name;

              return (
                <button
                  key={cat.id || cat.name}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setIsCustomCategory(false);
                    setCustomCategory("");
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-bold border transition-all text-left min-h-[44px] ${
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
            className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 min-h-[44px] ${
              isCustomCategory
                ? "bg-accent/15 border-accent text-accent-text ring-1 ring-accent"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Kategori Lainnya</span>
          </button>

          {/* Kolom Input Kategori Lain */}
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
                  placeholder="Ketik nama kategori (contoh: Servis Motor, Skincare, Obat...)"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-accent text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pilih Sumber Rekening / Dompet (Multi Rekening) */}
        {accountsList.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>{recordType === "expense" ? "Dibayar Pakai Rekening" : "Masuk ke Rekening"}</span>
              <span className="text-[10px] text-muted-foreground">Saldo otomatis terupdate</span>
            </label>
            <div
              className={`grid gap-2 ${
                accountsList.length === 1
                  ? "grid-cols-1"
                  : accountsList.length === 2
                  ? "grid-cols-2"
                  : accountsList.length === 3
                  ? "grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {accountsList.map((acc) => {
                const isSelected = selectedAccountId === acc.id;
                const isAccInsufficient = recordType === "expense" && amount > 0 && acc.balance < amount;
                const AccIcon =
                  acc.type === "bank" ? Landmark : acc.type === "ewallet" ? Smartphone : Banknote;

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 min-h-[56px] ${
                      isSelected
                        ? isAccInsufficient
                          ? "border-expense bg-expense/10 text-expense ring-1 ring-expense"
                          : "border-accent bg-accent/15 text-foreground ring-1 ring-accent"
                        : isAccInsufficient
                        ? "border-border/60 bg-background/50 text-muted-foreground opacity-60 hover:opacity-100"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/60">
                        <AccIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold truncate text-foreground">{acc.name}</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-semibold text-muted-foreground truncate pl-0.5">
                        {formatRupiah(acc.balance)}
                      </span>
                      {isAccInsufficient && (
                        <span className="text-[9px] font-bold text-expense bg-expense/15 px-1.5 py-0.5 rounded shrink-0">
                          Kurang
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Peringatan Saldo Tidak Cukup */}
            {isInsufficientBalance && selectedAccount && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-expense/10 border border-expense/30 text-expense text-xs font-semibold mt-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Saldo <strong>{selectedAccount.name}</strong> ({formatRupiah(selectedAccount.balance)}) tidak cukup untuk pengeluaran {formatRupiah(amount)}. Silakan pilih rekening lain.
                </span>
              </div>
            )}
          </div>
        )}

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
            className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-base sm:text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px]"
          />
        </div>

        {/* Tanggal Transaksi */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Tanggal Transaksi</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent text-left [&::-webkit-date-and-time-value]:text-left cursor-pointer min-h-[44px]"
            />
          </div>
        </div>

        {/* Tombol Simpan Transaksi */}
        <button
          type="submit"
          disabled={
            amount <= 0 ||
            isSaving ||
            (isCustomCategory && !customCategory.trim()) ||
            isInsufficientBalance
          }
          className={`w-full py-3.5 rounded-pill text-sm font-black transition-all flex items-center justify-center gap-2 shadow-md ${
            isInsufficientBalance
              ? "bg-expense/15 border border-expense/40 text-expense cursor-not-allowed"
              : amount > 0 && (!isCustomCategory || customCategory.trim())
              ? "bg-accent hover:bg-accent-hover text-[#1F1F1F] active:scale-[0.98] shadow-accent/20 cursor-pointer"
              : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
          }`}
        >
          {isSaving ? (
            <span>Menyimpan transaksi...</span>
          ) : isInsufficientBalance ? (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>Saldo {selectedAccount?.name} Tidak Mencukupi</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                Simpan {recordType === "expense" ? "Pengeluaran" : "Pemasukan"}
                {amount > 0 ? ` (${formatRupiah(amount)})` : ""}
              </span>
            </>
          )}
        </button>
      </form>

      {/* 3 Transaksi Terakhir Hari Ini */}
      {todayTransactions.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
              Transaksi Terakhir Hari Ini
            </h2>
            <button
              type="button"
              onClick={() => router.push("/transactions")}
              className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>Semua Riwayat</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {todayTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border text-xs"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                      tx.type === "expense" ? "bg-expense/15 text-expense" : "bg-accent/20 text-accent"
                    }`}
                  >
                    {tx.type === "expense" ? (
                      <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                    ) : (
                      <ArrowDownLeft className="w-3 h-3 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="truncate">
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
