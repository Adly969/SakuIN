"use client";

import { useEffect, useRef } from "react";
import { getTransactionsAction, getUserCategoriesAction } from "@/app/actions/transactions";
import { getStatisticsDataAction } from "@/app/actions/statistics";
import { getSavingsDataAction } from "@/app/actions/savings";
import { getAccountsAction } from "@/app/actions/accounts";
import { getDebtsAction } from "@/app/actions/debts";

/**
 * DataPrefetcher: Komponen pintar di latar belakang (Background Prefetcher)
 * Ditempatkan di (main)/layout.tsx untuk memuat data semua tab (Riwayat, Statistik, Tabungan,
 * Dompet/Rekening, dan Utang) sesaat setelah aplikasi dibuka.
 * 
 * Hasilnya disimpan ke localStorage sehingga ketika pengguna berpindah tab, data langsung
 * tampil seketika (0ms delay) tanpa memuat skeleton loader yang lambat.
 */
export function DataPrefetcher() {
  const isFetchingRef = useRef(false);
  const lastPrefetchRef = useRef<number>(0);

  const prefetchAllData = async (force = false) => {
    // Hindari duplikasi fetch dalam rentang 15 detik jika tidak dipaksa
    const now = Date.now();
    if (!force && isFetchingRef.current) return;
    if (!force && now - lastPrefetchRef.current < 15000) return;

    isFetchingRef.current = true;
    lastPrefetchRef.current = now;

    try {
      const today = new Date();
      const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

      // Eksekusi semua fetch secara paralel dan graceful (allSettled)
      const results = await Promise.allSettled([
        getTransactionsAction({ month: curMonthKey }),
        getUserCategoriesAction(),
        getStatisticsDataAction({ period: "month", monthKey: curMonthKey, type: "expense" }),
        getSavingsDataAction(),
        getAccountsAction(),
        getDebtsAction(),
      ]);

      // 1. Transactions Cache
      if (results[0].status === "fulfilled" && results[0].value.success && results[0].value.data) {
        try {
          localStorage.setItem("sakuin_cached_transactions", JSON.stringify(results[0].value.data));
        } catch {}
      }

      // 2. Categories Cache
      if (results[1].status === "fulfilled" && results[1].value.success && results[1].value.data) {
        try {
          const catNames = Array.from(new Set(results[1].value.data.map((c) => c.name)));
          localStorage.setItem("sakuin_cached_categories", JSON.stringify(catNames));
        } catch {}
      }

      // 3. Statistics Cache
      if (results[2].status === "fulfilled" && results[2].value.success && results[2].value.data) {
        try {
          localStorage.setItem("sakuin_cached_statistics", JSON.stringify(results[2].value.data));
        } catch {}
      }

      // 4. Savings Cache
      if (results[3].status === "fulfilled" && results[3].value.success && results[3].value.data) {
        try {
          localStorage.setItem("sakuin_cached_savings", JSON.stringify(results[3].value.data));
        } catch {}
      }

      // 5. Accounts Cache
      if (results[4].status === "fulfilled" && results[4].value.success && results[4].value.data) {
        try {
          localStorage.setItem("sakuin_cached_accounts", JSON.stringify(results[4].value.data));
        } catch {}
      }

      // 6. Debts Cache
      if (results[5].status === "fulfilled" && results[5].value.success && results[5].value.data) {
        try {
          localStorage.setItem("sakuin_cached_debts", JSON.stringify(results[5].value.data));
        } catch {}
      }
    } catch (e) {
      console.warn("Background prefetch error:", e);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Delay 300ms setelah mount agar tidak bersaing dengan render awal Dashboard
    const initialTimer = setTimeout(() => {
      prefetchAllData();
    }, 300);

    const handleDataInvalidated = () => {
      // Re-fetch segera jika ada transaksi atau perubahan data
      prefetchAllData(true);
    };

    window.addEventListener("sakuin:data-invalidated", handleDataInvalidated);
    window.addEventListener("sakuin:transaction-added", handleDataInvalidated);
    window.addEventListener("sakuin:sync-complete", handleDataInvalidated);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener("sakuin:data-invalidated", handleDataInvalidated);
      window.removeEventListener("sakuin:transaction-added", handleDataInvalidated);
      window.removeEventListener("sakuin:sync-complete", handleDataInvalidated);
    };
  }, []);

  return null;
}
