"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Delete, Lock, KeyRound, ShieldCheck } from "lucide-react";
import { verifyPinAction } from "@/app/actions/pin";
import {
  verifyLocalPin,
  saveLocalPinVerifier,
  clearLocalPinVerifier,
} from "@/lib/pin-cache";
import { createClient } from "@/lib/supabase/client";

interface PinLockScreenProps {
  userName?: string;
  pinStatusSynced?: boolean;
  onUnlocked: () => void;
}

export function PinLockScreen({
  userName = "Kawan",
  pinStatusSynced = false,
  onUnlocked,
}: PinLockScreenProps) {
  const [pin, setPin] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isShake, setIsShake] = useState(false);
  const isVerifyingRef = useRef(false);

  // Instant digit input (tanpa dependency `pin` agar tidak re-render/re-bind listener tiap ketukan)
  const handleDigit = useCallback((digit: string) => {
    if (isVerifyingRef.current) return;
    setErrorMessage("");
    setPin((prev) => {
      if (prev.length >= 6) return prev;
      return prev + digit;
    });
  }, []);

  // Instant backspace
  const handleBackspace = useCallback(() => {
    if (isVerifyingRef.current) return;
    setErrorMessage("");
    setPin((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  // Auto-verify ketika genap 6 digit
  useEffect(() => {
    if (pin.length !== 6 || isVerifyingRef.current) return;

    let cancelled = false;
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setErrorMessage("");

    (async () => {
      try {
        // 1. Cek cepat di perangkat (< 5ms)
        const localMatch = await verifyLocalPin(pin);
        if (cancelled) return;

        if (localMatch === true) {
          onUnlocked();
          // Sinkronkan cookie server di background tanpa memblokir UI
          void verifyPinAction(pin).catch(() => {});
          return;
        }

        // Jika versi PIN sudah sinkron dengan server dan tidak cocok secara lokal, tolak instan
        if (localMatch === false && (pinStatusSynced || !navigator.onLine)) {
          setIsShake(true);
          setErrorMessage("PIN yang kamu masukkan salah");
          setTimeout(() => {
            if (cancelled) return;
            setIsShake(false);
            setPin("");
            isVerifyingRef.current = false;
            setIsVerifying(false);
          }, 450);
          return;
        }

        // 2. Fallback verifikasi server (misal baru pertama buka di perangkat ini)
        const res = await verifyPinAction(pin);
        if (cancelled) return;

        if (res.success) {
          if ("userId" in res && res.userId && "pinVersion" in res && res.pinVersion) {
            void saveLocalPinVerifier(res.userId, pin, res.pinVersion);
          }
          onUnlocked();
        } else {
          setIsShake(true);
          setErrorMessage(res.error || "PIN yang kamu masukkan salah");
          setTimeout(() => {
            if (cancelled) return;
            setIsShake(false);
            setPin("");
            isVerifyingRef.current = false;
            setIsVerifying(false);
          }, 450);
        }
      } catch {
        if (cancelled) return;
        setIsShake(true);
        setErrorMessage("Gagal memverifikasi PIN");
        setTimeout(() => {
          if (cancelled) return;
          setIsShake(false);
          setPin("");
          isVerifyingRef.current = false;
          setIsVerifying(false);
        }, 450);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pin, pinStatusSynced, onUnlocked]);

  // Listen to physical keyboard events (0-9, Backspace) — hanya dipasang 1x
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleBackspace]);

  const handleLogout = async () => {
    clearLocalPinVerifier();
    localStorage.removeItem("sakuin_pin_active");
    sessionStorage.removeItem("sakuin_pin_session_unlocked");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const keypadRows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "backspace"],
  ];

  // Helper 0ms touch: gunakan onPointerDown di sentuhan jari (APK/WebView) dan fallback onClick untuk keyboard/screen reader
  const lastPointerAtRef = useRef<number>(0);

  const triggerDigit = (digit: string, fromPointer: boolean) => {
    if (fromPointer) {
      lastPointerAtRef.current = Date.now();
      handleDigit(digit);
    } else if (Date.now() - lastPointerAtRef.current > 450) {
      handleDigit(digit);
    }
  };

  const triggerBackspace = (fromPointer: boolean) => {
    if (fromPointer) {
      lastPointerAtRef.current = Date.now();
      handleBackspace();
    } else if (Date.now() - lastPointerAtRef.current > 450) {
      handleBackspace();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-between p-6 select-none overflow-y-auto touch-manipulation">
      {/* Top Header */}
      <div
        style={{
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 6px), 12px)",
        }}
        className="w-full flex items-center justify-between max-w-sm pb-2 safe-top-header"
      >
        <BrandLogo height={28} />
        <div className="flex items-center gap-1 text-[11px] font-bold text-accent px-2.5 py-1 rounded-full bg-accent/15">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Quick Unlock</span>
        </div>
      </div>

      {/* Middle: PIN Dots & Title */}
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6 my-auto py-4">
        <div className="space-y-1.5">
          <div className="w-12 h-12 rounded-full bg-card border border-border mx-auto flex items-center justify-center text-accent shadow-md">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-foreground tracking-tight pt-2">
            Masukkan PIN SakuIN
          </h1>
          <p className="text-xs text-muted-foreground">
            Hai <strong className="text-foreground">{userName}</strong>, masukkan 6 digit PIN untuk membuka kunci
          </p>
        </div>

        {/* 6 Dots Indicator — Pure CSS GPU-only transition agar 0ms tanpa frame lag */}
        <div
          className={`flex items-center justify-center gap-3.5 py-2 ${
            isShake ? "animate-bounce" : ""
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border-2 transform transition-transform duration-75 ${
                  isFilled
                    ? "scale-110 bg-accent border-accent"
                    : errorMessage
                    ? "scale-100 bg-transparent border-expense"
                    : "scale-100 bg-transparent border-border"
                }`}
              />
            );
          })}
        </div>

        {/* Error / Status Text */}
        <div className="h-5">
          {errorMessage ? (
            <p className="text-xs font-bold text-expense">{errorMessage}</p>
          ) : isVerifying ? (
            <p className="text-xs font-bold text-accent animate-pulse">
              Memverifikasi PIN...
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Ketik 6 digit PIN kamu
            </p>
          )}
        </div>

        {/* Numeric Keypad Grid — 0ms PointerDown Response untuk WebView APK */}
        <div className="w-full grid grid-cols-3 gap-3 pt-2 max-w-[280px] touch-manipulation">
          {keypadRows.map((row, rIdx) =>
            row.map((item, cIdx) => {
              if (item === "") {
                return <div key={`empty-${rIdx}-${cIdx}`} className="h-14" />;
              }

              if (item === "backspace") {
                return (
                  <button
                    key="backspace"
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerBackspace(true);
                    }}
                    onClick={() => triggerBackspace(false)}
                    className={`h-14 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 active:bg-muted/60 transition-transform duration-75 touch-manipulation select-none [-webkit-tap-highlight-color:transparent] ${
                      isVerifying || pin.length === 0 ? "opacity-30 pointer-events-none" : ""
                    }`}
                    aria-label="Hapus digit"
                  >
                    <Delete className="w-5 h-5 stroke-[2]" />
                  </button>
                );
              }

              return (
                <button
                  key={item}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    triggerDigit(item, true);
                  }}
                  onClick={() => triggerDigit(item, false)}
                  className="h-14 rounded-full bg-card hover:bg-muted border border-border text-foreground text-xl font-bold active:scale-[0.92] active:bg-accent/25 transition-transform duration-75 shadow-sm flex items-center justify-center touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
                >
                  {item}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Option: Lupa PIN / Masuk dengan Password */}
      <div className="w-full max-w-sm text-center pt-4 pb-2 border-t border-border/60">
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 py-2 min-h-[44px] px-3 rounded-full hover:bg-muted"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Lupa PIN? Masuk dengan Password</span>
        </button>
      </div>
    </div>
  );
}
