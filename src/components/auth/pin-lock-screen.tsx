"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Delete, Lock, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { verifyPinAction } from "@/app/actions/pin";
import { createClient } from "@/lib/supabase/client";

interface PinLockScreenProps {
  userName?: string;
  onUnlocked: () => void;
}

export function PinLockScreen({ userName = "Kawan", onUnlocked }: PinLockScreenProps) {
  const [pin, setPin] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isShake, setIsShake] = useState(false);

  // Handle digit input
  const handleDigit = useCallback(
    (digit: string) => {
      if (isVerifying) return;
      if (pin.length < 6) {
        setErrorMessage("");
        setPin((prev) => prev + digit);
      }
    },
    [pin, isVerifying]
  );

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (isVerifying) return;
    setErrorMessage("");
    setPin((prev) => prev.slice(0, -1));
  }, [isVerifying]);

  // Handle auto-verify when PIN reaches 6 digits
  useEffect(() => {
    if (pin.length === 6) {
      const verify = async () => {
        setIsVerifying(true);
        setErrorMessage("");

        try {
          const res = await verifyPinAction(pin);
          if (res.success) {
            onUnlocked();
          } else {
            setIsShake(true);
            setErrorMessage(res.error || "PIN yang kamu masukkan salah");
            setTimeout(() => {
              setIsShake(false);
              setPin("");
              setIsVerifying(false);
            }, 600);
          }
        } catch (err) {
          setIsShake(true);
          setErrorMessage("Gagal memverifikasi PIN");
          setTimeout(() => {
            setIsShake(false);
            setPin("");
            setIsVerifying(false);
          }, 600);
        }
      };
      verify();
    }
  }, [pin, onUnlocked]);

  // Listen to physical keyboard events (0-9, Backspace)
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

  // Handle logout / masuk dengan password
  const handleLogout = async () => {
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

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-between p-6 select-none overflow-y-auto">
      {/* Top Header */}
      <div
        style={{
          paddingTop: "max(calc(env(safe-area-inset-top) + 14px), 54px)",
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

        {/* 6 Dots Indicator */}
        <motion.div
          animate={isShake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center gap-3.5 py-2"
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <motion.div
                key={idx}
                initial={false}
                animate={{
                  scale: isFilled ? 1.15 : 1,
                  backgroundColor: isFilled ? "var(--accent)" : "transparent",
                  borderColor: isFilled
                    ? "var(--accent)"
                    : errorMessage
                    ? "var(--expense)"
                    : "var(--border)",
                }}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                  errorMessage && !isFilled ? "border-expense" : ""
                }`}
              />
            );
          })}
        </motion.div>

        {/* Error / Status Text */}
        <div className="h-5">
          {errorMessage ? (
            <p className="text-xs font-bold text-expense animate-fade-in">
              {errorMessage}
            </p>
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

        {/* Numeric Keypad Grid */}
        <div className="w-full grid grid-cols-3 gap-3 pt-2 max-w-[280px]">
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
                    onClick={handleBackspace}
                    disabled={isVerifying || pin.length === 0}
                    className="h-14 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
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
                  onClick={() => handleDigit(item)}
                  disabled={isVerifying || pin.length >= 6}
                  className="h-14 rounded-full bg-card hover:bg-muted border border-border text-foreground text-xl font-bold active:scale-95 active:bg-accent/20 transition-all shadow-sm flex items-center justify-center"
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
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 py-1 px-3 rounded-full hover:bg-muted"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Lupa PIN? Masuk dengan Password</span>
        </button>
      </div>
    </div>
  );
}
