"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getPinStatusAction, lockAppAction } from "@/app/actions/pin";
import { PinLockScreen } from "./pin-lock-screen";

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

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [userName, setUserName] = useState("Kawan");
  const [isChecked, setIsChecked] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await getPinStatusAction();
      if (res.success) {
        setPinEnabled(res.pinEnabled);
        setUserName(res.userName || "Kawan");

        if (res.pinEnabled) {
          // Jika PIN aktif, periksa apakah sesi browser/PWA saat ini sudah di-unlock
          const isSessionUnlocked =
            typeof window !== "undefined" &&
            sessionStorage.getItem(SESSION_UNLOCKED_KEY) === "true";
          setIsUnlocked(isSessionUnlocked);
        } else {
          // Jika pengguna belum mengaktifkan PIN
          setIsUnlocked(true);
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

  const lockNow = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
    }
    await lockAppAction();
    setIsUnlocked(false);
  };

  const handleUnlocked = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, "true");
    }
    setIsUnlocked(true);
  };

  return (
    <PinLockContext.Provider
      value={{
        pinEnabled,
        isUnlocked,
        refreshPinStatus: checkStatus,
        lockNow,
      }}
    >
      {/* If PIN is enabled and user is locked, show PinLockScreen */}
      {isChecked && pinEnabled && !isUnlocked && (
        <PinLockScreen
          userName={userName}
          onUnlocked={handleUnlocked}
        />
      )}
      {children}
    </PinLockContext.Provider>
  );
}
