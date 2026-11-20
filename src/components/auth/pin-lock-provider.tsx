"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [userName, setUserName] = useState("Kawan");
  const [isChecked, setIsChecked] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await getPinStatusAction();
      if (res.success) {
        setPinEnabled(res.pinEnabled);
        setIsUnlocked(res.isUnlocked);
        setUserName(res.userName || "Kawan");
      }
    } catch (err) {
      console.error("Gagal memeriksa status PIN:", err);
    } finally {
      setIsChecked(true);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const lockNow = async () => {
    await lockAppAction();
    setIsUnlocked(false);
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
          onUnlocked={() => setIsUnlocked(true)}
        />
      )}
      {children}
    </PinLockContext.Provider>
  );
}
