"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // Check if already running standalone PWA
    const isApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isApp);

    // Register & Update Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV !== "development") {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("SakuIN Service Worker terdaftar:", reg.scope);
            // Paksa periksa versi terbaru
            reg.update().catch(() => {});
          })
          .catch((err) => {
            console.error("Gagal mendaftarkan Service Worker:", err);
          });
      });

      // Periksa update ketika tab kembali aktif
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
        }
      });
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Only show banner if user hasn't dismissed it in the last 7 days
      const lastDismissed = localStorage.getItem("sakuin_pwa_banner_dismissed");
      if (!lastDismissed || Date.now() - parseInt(lastDismissed, 10) > 7 * 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("sakuin_pwa_banner_dismissed", Date.now().toString());
  };

  if (isStandalone || !showBanner || !deferredPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+128px)] sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-card/95 backdrop-blur-md border border-border p-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-lg bg-accent/15 text-accent shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-black text-foreground">Pasang SakuIN</h4>
            <p className="text-[11px] text-muted-foreground truncate">
              Akses cepat offline dari layar utama HP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            style={{ backgroundColor: "#D4FF5A", color: "#121212" }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black shadow-sm hover:brightness-105 active:scale-95 transition-all !text-neutral-950 font-black cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: "#121212", stroke: "#121212" }} />
            <span className="font-black text-neutral-950" style={{ color: "#121212" }}>Pasang</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            aria-label="Tutup Banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
