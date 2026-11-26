"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
import {
  notifyDailyLimitAlert,
  notifyCategoryLimitAlert,
  notifyContextualMotivation,
} from "@/lib/native-notifications";
import { getRandomOfflineQuote } from "@/lib/offline-quotes";

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

  // Catatan terpisah & detail toggle
  const [note, setNote] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categoryFreq, setCategoryFreq] = useState<Record<string, number>>({});

  const [txDate, setTxDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastImpact, setToastImpact] = useState("");
  const [toastQuote, setToastQuote] = useState("");
  const [todayTransactions, setTodayTransactions] = useState<RecentTx[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const amountInputRef = React.useRef<HTMLInputElement>(null);

  // Jaga tombol Simpan sticky tetap terlihat di atas keyboard HP tanpa memicu re-render saat scroll
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateKeyboardOffset = () => {
      const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const next = diff > 140 ? Math.round(diff) : 0;
      setKeyboardOffset((prev) => (prev === next ? prev : next));
    };
    vv.addEventListener("resize", updateKeyboardOffset);
    return () => {
      vv.removeEventListener("resize", updateKeyboardOffset);
    };
  }, []);

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
          let lastAccId = "";
          try {
            lastAccId = localStorage.getItem("sakuin_last_account_id") || "";
          } catch {}
          const preferred =
            list.find((a: any) => a.id === lastAccId) ||
            list.find((a: any) => a.isDefault) ||
            list[0];
          if (preferred?.id) setSelectedAccountId(preferred.id);
        }
      }

      // Muat frekuensi pemakaian kategori untuk pengurutan pintar
      try {
        const freqRaw = localStorage.getItem("sakuin_cat_freq");
        if (freqRaw) {
          setCategoryFreq(JSON.parse(freqRaw));
        } else {
          const cachedTx = localStorage.getItem("sakuin_cached_transactions");
          if (cachedTx) {
            const parsedTx = JSON.parse(cachedTx);
            if (Array.isArray(parsedTx)) {
              const counts: Record<string, number> = {};
              parsedTx.forEach((t: any) => {
                const name = t.category || t.categoryName;
                if (name) counts[name] = (counts[name] || 0) + 1;
              });
              setCategoryFreq(counts);
            }
          }
        }
      } catch {}

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

          const excludedNames = new Set(["listrik", "listrik & token", "kebutuhan kos", "kos", "wifi", "kebutuhan lain", "jajan & cemilan"]);
          const cleanCached = normalizedList.filter(
            (c) => !excludedNames.has((c.name || "").toLowerCase().trim())
          );

          setCategoriesList(cleanCached);

          const firstExp = cleanCached.find((c) => c.type === "expense" && c.name.toLowerCase() !== "lainnya");
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

          const cleanData = normalizedData;

          setCategoriesList(cleanData);
          try {
            localStorage.setItem("sakuin_cached_categories", JSON.stringify(cleanData));
          } catch {}
          const firstExp = cleanData.find((c) => c.type === "expense" && c.name.toLowerCase() !== "lainnya");
          if (firstExp) setSelectedCategory(firstExp.name);
        }

        if (accRes.success && accRes.data && accRes.data.accounts.length > 0) {
          setAccountsList(accRes.data.accounts);
          try {
            localStorage.setItem("sakuin_cached_accounts", JSON.stringify(accRes.data));
          } catch {}
          setSelectedAccountId((prev) => {
            if (prev && accRes.data!.accounts.some((a) => a.id === prev)) return prev;
            let lastAccId = "";
            try {
              lastAccId = localStorage.getItem("sakuin_last_account_id") || "";
            } catch {}
            const preferred =
              accRes.data!.accounts.find((a) => a.id === lastAccId) ||
              accRes.data!.accounts.find((a) => a.isDefault) ||
              accRes.data!.accounts[0];
            return preferred?.id || "";
          });
        }
      } catch (err) {
        console.error("Gagal inisialisasi data:", err);
      }
    }
    initData();

    const refreshAccounts = async () => {
      try {
        const accRes = await getAccountsAction();
        if (accRes.success && accRes.data && accRes.data.accounts.length > 0) {
          setAccountsList(accRes.data.accounts);
          try {
            localStorage.setItem("sakuin_cached_accounts", JSON.stringify(accRes.data));
          } catch {}
        }
      } catch {}
    };

    window.addEventListener("sakuin:sync-complete", refreshAccounts);
    window.addEventListener("sakuin:data-invalidated", refreshAccounts);
    return () => {
      window.removeEventListener("sakuin:sync-complete", refreshAccounts);
      window.removeEventListener("sakuin:data-invalidated", refreshAccounts);
    };
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

  const currentCategories = categoriesList.filter(
    (c) =>
      c.type === recordType &&
      c.name !== "Kebutuhan Lain" &&
      c.name !== "Lainnya"
  );

  // Fallback if dbCategories empty yet
  const baseCategories =
    currentCategories.length > 0
      ? currentCategories
      : recordType === "expense"
      ? [
          { id: "1", name: "Makan", type: "expense", icon: "Utensils", color: "#8CCBFF", requiresLabel: false },
          { id: "2", name: "Transport / Bensin", type: "expense", icon: "Bike", color: "#5BAA6B", requiresLabel: false },
          { id: "3", name: "Kuota & Internet", type: "expense", icon: "Wifi", color: "#38BDF8", requiresLabel: false },
          { id: "4", name: "Jajan & Nongkrong", type: "expense", icon: "Coffee", color: "#6B72FF", requiresLabel: false },
          { id: "5", name: "Kuliah", type: "expense", icon: "GraduationCap", color: "#4ADE80", requiresLabel: false },
        ]
      : [
          { id: "7", name: "Uang Kiriman", type: "income", icon: "Wallet", color: "#D4FF5A", requiresLabel: false },
          { id: "8", name: "Kerja Sambilan", type: "income", icon: "Briefcase", color: "#8CCBFF", requiresLabel: false },
          { id: "9", name: "Beasiswa", type: "income", icon: "GraduationCap", color: "#5BAA6B", requiresLabel: false },
        ];

  const sortedCategories = [...baseCategories].sort(
    (a, b) => (categoryFreq[b.name] || 0) - (categoryFreq[a.name] || 0)
  );
  const displayCategories = showAllCategories ? sortedCategories : sortedCategories.slice(0, 6);
  const hasMoreCategories = sortedCategories.length > 6;

  const selectedAccount = accountsList.find((a) => a.id === selectedAccountId);
  const isInsufficientBalance =
    recordType === "expense" &&
    selectedAccount !== undefined &&
    amount > 0 &&
    selectedAccount.balance < amount;

  const applyLocalAccountBalance = (accountId: string, delta: number) => {
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
    // Kategori kustom diarahkan ke Lainnya sesuai Keputusan Desain #5
    const finalCategory = isCustomCategory ? "Lainnya" : selectedCategory;
    const itemTitle = isCustomCategory
      ? customCategory.trim()
      : (note.trim() || selectedCategory);
    const localDelta = recordType === "expense" ? -amount : amount;

    // Simpan rekening terakhir & tambah frekuensi kategori
    try {
      if (selectedAccountId) {
        localStorage.setItem("sakuin_last_account_id", selectedAccountId);
      }
      setCategoryFreq((prev) => {
        const nextFreq = { ...prev, [finalCategory]: (prev[finalCategory] || 0) + 1 };
        try {
          localStorage.setItem("sakuin_cat_freq", JSON.stringify(nextFreq));
        } catch {}
        return nextFreq;
      });
    } catch {}

    // Offline Queue
    if (typeof window !== "undefined" && !navigator.onLine) {
      enqueueOfflineTransaction({
        amount,
        type: recordType,
        categoryName: finalCategory,
        note: note.trim() || undefined,
        customLabel: isCustomCategory ? customCategory.trim() : (note.trim() || undefined),
        accountId: selectedAccountId || undefined,
        occurredOn: txDate,
      });
      applyLocalAccountBalance(selectedAccountId, localDelta);

      setToastMessage(`${itemTitle} (${formatRupiah(amount)}) disimpan ke antrean offline!`);
      setToastImpact("Menunggu sinyal untuk menyinkronkan ke server.");
      setToastQuote(getRandomOfflineQuote().text);
      setShowToast(true);

      setAmount(0);
      setIsCustomCategory(false);
      setCustomCategory("");
      setNote("");
      setIsSaving(false);

      setTimeout(() => setShowToast(false), 5000);
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
        if (res.dailyLimitAlert) {
          setToastImpact(
            res.dailyLimitAlert.overLimitAmount > 0
              ? `Melewati batas hari ini sebesar ${formatRupiah(res.dailyLimitAlert.overLimitAmount)}.`
              : `Sisa Batas Hari Ini jadi ${formatRupiah(res.dailyLimitAlert.todayRemaining)}.`
          );
        } else {
          setToastImpact("");
        }
        setToastQuote(getRandomOfflineQuote().text);
        setShowToast(true);

        // Optimistically update account balance in local state & localStorage
        applyLocalAccountBalance(selectedAccountId, localDelta);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));

        // Kirim notifikasi pengingat jika mendekati atau mencapai batas harian / batas kategori
        if (res.dailyLimitAlert && res.dailyLimitAlert.level !== "ok") {
          notifyDailyLimitAlert(res.dailyLimitAlert, true);
        }
        if (res.categoryLimitAlert && res.categoryLimitAlert.level !== "ok") {
          notifyCategoryLimitAlert(res.categoryLimitAlert);
        }
        if (
          recordType === "expense" &&
          res.dailyLimitAlert &&
          res.dailyLimitAlert.usagePercent >= 75 &&
          res.dailyLimitAlert.todayRemaining > 0
        ) {
          notifyContextualMotivation({
            remainingPercent: Math.max(0, 100 - res.dailyLimitAlert.usagePercent),
            todayRemaining: res.dailyLimitAlert.todayRemaining,
          });
        }

        setAmount(0);
        setIsCustomCategory(false);
        setCustomCategory("");
        setNote("");

        setTimeout(() => setShowToast(false), 5500);
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
        accountId: selectedAccountId || undefined,
        occurredOn: txDate,
      });
      applyLocalAccountBalance(selectedAccountId, localDelta);
      setToastMessage(`${itemTitle} disimpan ke antrean offline!`);
      setToastImpact("Akan otomatis disinkronkan saat koneksi kembali.");
      setToastQuote("");
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
    <div className="space-y-5 max-w-[480px] mx-auto mobile-page-dock-pb">
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
            className="p-3.5 rounded-xl bg-accent/20 border border-accent/40 text-foreground space-y-1.5 shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                <span className="text-xs font-black truncate">{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => router.push("/transactions")}
                className="text-xs font-extrabold text-accent hover:underline shrink-0"
              >
                Lihat di Riwayat
              </button>
            </div>
            {toastImpact && (
              <p className="text-xs font-extrabold text-foreground pl-7">
                {toastImpact}
              </p>
            )}
            {toastQuote && (
              <p className="text-xs text-muted-foreground italic pl-7">
                &ldquo;{toastQuote}&rdquo;
              </p>
            )}
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
              setShowAllCategories(false);
              amountInputRef.current?.focus();
            }}
            className={`py-2.5 min-h-[44px] rounded-full transition-all flex items-center justify-center gap-2 ${
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
              setShowAllCategories(false);
              amountInputRef.current?.focus();
            }}
            className={`py-2.5 min-h-[44px] rounded-full transition-all flex items-center justify-center gap-2 ${
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
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Nominal {recordType === "expense" ? "Pengeluaran" : "Pemasukan"}
          </label>

          <div className="relative flex items-center bg-card border border-border rounded-lg px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-all">
            <span className="text-xl sm:text-2xl font-black text-muted-foreground mr-2 select-none shrink-0">
              Rp
            </span>
            <input
              ref={amountInputRef}
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
                className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 min-h-[44px] rounded-lg bg-muted/60 transition-colors shrink-0 ml-1.5 flex items-center justify-center"
              >
                Reset
              </button>
            )}
          </div>

          {/* Quick Helper Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              Tambah cepat:
            </span>
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setAmount((prev) => Math.min(999999999, prev + q.value))}
                className="px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold bg-card border border-border text-foreground hover:border-accent hover:text-accent active:scale-95 transition-all flex items-center justify-center"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pilih Kategori */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-foreground">
              Pilih Kategori
            </label>
            {recordType === "expense" && (
              <Link
                href="/budgets"
                className="text-xs font-extrabold text-accent hover:underline py-1 px-1"
              >
                Atur jatah
              </Link>
            )}
          </div>
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
                      ? "bg-accent/15 border-accent text-accent ring-1 ring-accent scale-[1.02]"
                      : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span className="truncate">{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Tombol Opsi Kategori Lain & Lihat Semua */}
          <div className={`grid gap-2 ${hasMoreCategories ? "grid-cols-2" : "grid-cols-1"}`}>
            <button
              type="button"
              onClick={() => {
                setIsCustomCategory(true);
                setSelectedCategory("");
              }}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                isCustomCategory
                  ? "bg-accent/15 border-accent text-accent ring-1 ring-accent"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Kategori Lainnya</span>
            </button>

            {hasMoreCategories && (
              <button
                type="button"
                onClick={() => setShowAllCategories((prev) => !prev)}
                className="w-full py-2.5 px-3 rounded-lg text-xs font-bold border border-border bg-background text-muted-foreground hover:text-foreground transition-all flex items-center justify-center min-h-[44px]"
              >
                {showAllCategories
                  ? "Tampilkan Teratas"
                  : `Lainnya (+${sortedCategories.length - 6})`}
              </button>
            )}
          </div>

          {/* Kolom Input Kategori Lain */}
          <AnimatePresence>
            {isCustomCategory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1 pt-1"
              >
                <label className="text-xs font-bold text-accent flex items-center justify-between">
                  <span>Nama Kategori Lain</span>
                  <span className="text-xs text-expense font-semibold">Wajib diisi</span>
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
              <span className="text-xs text-muted-foreground">Saldo otomatis terupdate</span>
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
                    onClick={() => {
                      setSelectedAccountId(acc.id);
                      try {
                        localStorage.setItem("sakuin_last_account_id", acc.id);
                      } catch {}
                    }}
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
                      <span className="text-xs font-semibold text-muted-foreground truncate pl-0.5">
                        {formatRupiah(acc.balance)}
                      </span>
                      {isAccInsufficient && (
                        <span className="text-xs font-bold text-expense bg-expense/15 px-1.5 py-0.5 rounded shrink-0">
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

        {/* Toggle Ringkas: Tambah detail (Catatan & Tanggal) */}
        <div className="space-y-2.5 pt-1 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="w-full py-2 px-3 rounded-lg border border-border/80 bg-background hover:bg-muted/50 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-between min-h-[44px] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>{showDetails ? "Sembunyikan detail" : "Tambah detail (Catatan & Tanggal)"}</span>
            </span>
            <span className="text-xs text-muted-foreground font-semibold">
              {note.trim() ? "Ada catatan" : txDate}
            </span>
          </button>

          {showDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Catatan (Opsional)</label>
                <input
                  type="text"
                  maxLength={100}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Warteg, bensin..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground text-base sm:text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground text-base sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent text-left [&::-webkit-date-and-time-value]:text-left cursor-pointer min-h-[44px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tombol Simpan Transaksi (Dock bawah solid di atas bottom bar + safe-area HP agar konten tak bocor di bawah bar) */}
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
            className={`max-w-[480px] mx-auto px-4 pt-2.5 md:p-0 ${
              keyboardOffset > 0 ? "pb-3" : "mobile-dock-spacer"
            }`}
          >
            <button
              type="submit"
              disabled={
                amount <= 0 ||
                isSaving ||
                (isCustomCategory && !customCategory.trim()) ||
                isInsufficientBalance
              }
              className={`w-full py-3.5 min-h-[48px] rounded-pill text-sm font-black transition-transform flex items-center justify-center gap-2 shadow-md ${
                isInsufficientBalance
                  ? "bg-expense/15 border border-expense/40 text-expense cursor-not-allowed"
                  : amount > 0 && (!isCustomCategory || customCategory.trim())
                  ? "bg-accent hover:bg-accent-hover text-[#1F1F1F] active:scale-[0.98] shadow-accent/20 cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
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
          </div>
        </div>
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
                    <p className="text-xs text-muted-foreground truncate">{tx.category}</p>
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
