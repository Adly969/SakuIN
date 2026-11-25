"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { lockAppAction } from "@/app/actions/pin";
import { clearLocalPinVerifier, syncLocalPinVersion } from "@/lib/pin-cache";
import { PinLockScreen } from "./pin-lock-screen";
import { BrandText } from "@/components/ui/brand-logo";

interface PinLockContextType {
  pinEnabled: boolean;
  isUnlocked: boolean;
  refreshPinStatus: () => Promise<void>;
  lockNow: () => Promise<void>;
}

const PinLockContext = createContext<PinLockContextType>({
  pinEnabled: false,
  isUnlocked: true,
  refreshPinStatus: async () => {},
  lockNow: async () => {},
});

export const usePinLock = () => useContext(PinLockContext);

const SESSION_UNLOCKED_KEY = "sakuin_pin_session_unlocked";
const LOCAL_PIN_ACTIVE_KEY = "sakuin_pin_active";
const LOCAL_USER_NAME_KEY = "sakuin_user_name";

function checkHasPinSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const fromStorage = localStorage.getItem(LOCAL_PIN_ACTIVE_KEY) === "true";
    const fromCookie = document.cookie.includes("sakuin_has_pin=true");
    return fromStorage || fromCookie;
  } catch {
    return false;
  }
}

function checkSessionUnlockedSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_UNLOCKED_KEY) === "true";
  } catch {
    return false;
  }
}

function getUserNameSync(): string {
  if (typeof window === "undefined") return "Kawan";
  try {
    return localStorage.getItem(LOCAL_USER_NAME_KEY) || "Kawan";
  } catch {
    return "Kawan";
  }
}

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  // Evaluasi status PIN secara SINKRON pada milidetik ke-0 agar dashboard tidak sempat render
  const [hasPinHint] = useState<boolean>(checkHasPinSync);
  const [pinEnabled, setPinEnabled] = useState<boolean>(() => checkHasPinSync());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    const hasPin = checkHasPinSync();
    if (!hasPin) return true; // Belum ada PIN, biarkan terbuka
    return checkSessionUnlockedSync(); // Jika ada PIN, harus sudah di-unlock di sesi ini
  });
  const [userName, setUserName] = useState<string>(() => getUserNameSync());
  const [isChecked, setIsChecked] = useState<boolean>(false);

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/pin/status", {
        method: "GET",
        cache: "no-store",
      });
      const res = await response.json();
      if (res.success) {
        setPinEnabled(res.pinEnabled);
        const name = res.userName || "Kawan";
        setUserName(name);

        if (typeof window !== "undefined") {
          if (res.pinEnabled) {
            localStorage.setItem(LOCAL_PIN_ACTIVE_KEY, "true");
            localStorage.setItem(LOCAL_USER_NAME_KEY, name);
            if (res.userId && res.pinVersion) {
              syncLocalPinVersion(res.userId, res.pinVersion);
            }
            const isSessionUnlocked = sessionStorage.getItem(SESSION_UNLOCKED_KEY) === "true";
            setIsUnlocked(isSessionUnlocked);
          } else {
            localStorage.removeItem(LOCAL_PIN_ACTIVE_KEY);
            clearLocalPinVerifier();
            setIsUnlocked(true);
          }
        }
      }
    } catch (err) {
      console.error("Gagal memeriksa status PIN:", err);
    } finally {
      setIsChecked(true);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Kunci otomatis saat aplikasi ditinggalkan / ke background (seperti aplikasi perbankan)
  useEffect(() => {
    if (!pinEnabled) return;

    let hiddenTimestamp = 0;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTimestamp = Date.now();
      } else {
        // Saat kembali ke aplikasi
        if (hiddenTimestamp > 0) {
          const elapsed = Date.now() - hiddenTimestamp;
          // Kunci otomatis jika ditinggalkan lebih dari 20 detik
          if (elapsed > 20 * 1000) {
            sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
            setIsUnlocked(false);
            lockAppAction().catch(() => {});
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pinEnabled]);

  const lockNow = useCallback(async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
    }
    setIsUnlocked(false);
    await lockAppAction();
  }, []);

  const handleUnlocked = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, "true");
    }
    setIsUnlocked(true);
  }, []);

  // 1. Jika belum selesai verifikasi awal dan belum ada hint PIN sama sekali, tampilkan splash minimal sebentar
  if (!isChecked && !hasPinHint) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center">
        <BrandText height={32} />
      </div>
    );
  }

  const isLocked = pinEnabled && !isUnlocked;

  // 2. Saat terkunci, tunda mount children/prefetcher agar jaringan & DB fokus 100% membuka PIN secepat mungkin
  return (
    <PinLockContext.Provider
      value={{
        pinEnabled,
        isUnlocked: !isLocked,
        refreshPinStatus: checkStatus,
        lockNow,
      }}
    >
      {!isLocked && (
        <div className="w-full min-h-screen">
          {children}
        </div>
      )}

      {/* Layar PIN tampil di atas (z-[100]) dengan background 100% solid & transisi halus saat terbuka */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            key="pin-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="fixed inset-0 z-[100] bg-background"
          >
            <PinLockScreen
              userName={userName}
              pinStatusSynced={isChecked}
              onUnlocked={handleUnlocked}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </PinLockContext.Provider>
  );
}
