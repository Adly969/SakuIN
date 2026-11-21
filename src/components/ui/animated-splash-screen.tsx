"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

export function AnimatedSplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    // Cek apakah splash sudah pernah diputar dalam sesi browser saat ini
    const hasPlayed = sessionStorage.getItem("sakuin_splash_played");
    if (hasPlayed) {
      setShowSplash(false);
      return;
    }

    // Vibrasi haptic halus di HP jika didukung
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(20);
      } catch {}
    }

    // Animasi progress bar cepat dan responsif 0% -> 100% (~550ms)
    const startTime = Date.now();
    const duration = 550;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(timer);
        // Jeda sangat singkat (80ms) lalu langsung transisi masuk ke aplikasi
        setTimeout(() => {
          sessionStorage.setItem("sakuin_splash_played", "true");
          setShowSplash(false);
        }, 80);
      }
    }, 16);

    return () => clearInterval(timer);
  }, []);

  const handleSkip = () => {
    sessionStorage.setItem("sakuin_splash_played", "true");
    setShowSplash(false);
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="sakuin-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03, filter: "blur(4px)" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={handleSkip}
            className="fixed inset-0 z-[99999] bg-[#181818] flex flex-col items-center justify-between p-8 select-none overflow-hidden cursor-pointer"
          >
            {/* Top decorative subtle badge */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              style={{
                paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 8px), 16px)",
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-[#D4FF5A]/90 tracking-wider uppercase"
            >
              <Sparkles className="w-3 h-3 text-[#D4FF5A]" />
              <span>Personal Finance for Students</span>
            </motion.div>

            {/* Center Logo & Branding Animation */}
            <div className="flex flex-col items-center text-center my-auto relative">
              {/* Glowing Aura Effect */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{
                  scale: [0.8, 1.25, 1],
                  opacity: [0.25, 0.55, 0.35],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className="absolute w-44 h-44 rounded-full bg-[#D4FF5A]/25 blur-3xl pointer-events-none -top-4"
              />

              {/* Logo Pop with Spring Physics */}
              <motion.div
                initial={{ scale: 0, rotate: -15, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 18,
                  delay: 0.15,
                }}
                className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#222222] border-2 border-[#D4FF5A]/30 p-4 shadow-2xl shadow-[#D4FF5A]/20 flex items-center justify-center mb-6"
              >
                <Image
                  src="/logo.png"
                  alt="SakuIN"
                  width={80}
                  height={80}
                  priority
                  className="object-contain drop-shadow-md"
                />
              </motion.div>

              {/* Brand Title Typing / Tracking Transition */}
              <motion.h1
                initial={{ opacity: 0, y: 15, letterSpacing: "0.15em" }}
                animate={{ opacity: 1, y: 0, letterSpacing: "-0.02em" }}
                transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
                className="text-3xl sm:text-4xl font-black text-white tracking-tight"
                style={{ fontFamily: "'Fredoka', 'Plus Jakarta Sans', sans-serif" }}
              >
                Saku<span className="text-[#D4FF5A]">IN</span>
              </motion.h1>

              {/* Tagline Fade */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="text-xs sm:text-sm font-semibold text-neutral-400 mt-1 tracking-tight"
              >
                Tenang Sampai Akhir Bulan
              </motion.p>
            </div>

            {/* Bottom Progress Bar & Loading Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              style={{
                paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 20px)",
              }}
              className="w-full max-w-[240px] space-y-2.5 text-center"
            >
              {/* Progress Track */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#D4FF5A] via-[#E4FF8A] to-[#D4FF5A] rounded-full shadow-sm shadow-[#D4FF5A]/50"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 px-0.5">
                <span>Memuat dompet pintar...</span>
                <span className="text-[#D4FF5A]">{progress}%</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render Content */}
      {children}
    </>
  );
}
