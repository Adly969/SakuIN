"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  getOfflineQueue,
  syncOfflineQueue,
  QueuedTransaction,
} from "@/lib/offline-queue";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OfflineSyncContextType {
  isOnline: boolean;
  queueCount: number;
  isSyncing: boolean;
  manualSync: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isOnline: true,
  queueCount: 0,
  isSyncing: false,
  manualSync: async () => {},
});

export const useOfflineSync = () => useContext(OfflineSyncContext);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

  const updateQueueStatus = useCallback(() => {
    const queue = getOfflineQueue();
    setQueueCount(queue.length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || typeof window === "undefined" || !navigator.onLine) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    try {
      const res = await syncOfflineQueue();
      if (res.successCount > 0) {
        setSyncToast({
          message: `${res.successCount} transaksi antrean berhasil disinkronkan ke cloud!`,
          type: "success",
        });
        setTimeout(() => setSyncToast(null), 5000);
      }
    } catch (err) {
      console.error("Gagal sinkronisasi antrean:", err);
    } finally {
      setIsSyncing(false);
      updateQueueStatus();
    }
  }, [isSyncing, updateQueueStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    updateQueueStatus();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleQueueChange = () => {
      updateQueueStatus();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("sakuin:offline-queue-changed", handleQueueChange);

    // Initial sync if online and items exist
    if (navigator.onLine) {
      triggerSync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sakuin:offline-queue-changed", handleQueueChange);
    };
  }, [triggerSync, updateQueueStatus]);

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        queueCount,
        isSyncing,
        manualSync: triggerSync,
      }}
    >
      {children}

      {/* Floating Offline Banner / Sync Pill */}
      <AnimatePresence>
        {!isOnline && (
          <motion.aside
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            aria-label="Status Mode Offline"
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-500/90 dark:bg-amber-600/90 backdrop-blur-md text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-2 border border-amber-400/30"
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>Mode Offline</span>
            {queueCount > 0 && (
              <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs">
                {queueCount} menunggu sinyal
              </span>
            )}
          </motion.aside>
        )}

        {isOnline && queueCount > 0 && !isSyncing && (
          <motion.button
            type="button"
            onClick={triggerSync}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-card/95 backdrop-blur-md text-foreground text-xs font-bold rounded-full shadow-lg flex items-center gap-2 border border-border hover:border-accent transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-accent" />
            <span>{queueCount} transaksi menunggu sinkron • Ketuk untuk kirim</span>
          </motion.button>
        )}

        {isOnline && isSyncing && (
          <motion.aside
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            aria-label="Status Sinkronisasi"
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-accent/95 backdrop-blur-md text-[#1F1F1F] text-xs font-black rounded-full shadow-lg flex items-center gap-2 border border-border/40"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Menyinkronkan antrean transaksi...</span>
          </motion.aside>
        )}

        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            aria-live="polite"
            className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-card border border-border text-foreground text-xs font-bold rounded-xl shadow-2xl flex items-center gap-2.5 max-w-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            <span>{syncToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </OfflineSyncContext.Provider>
  );
}
