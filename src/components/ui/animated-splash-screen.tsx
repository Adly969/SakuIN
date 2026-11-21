"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";

/**
 * AnimatedSplashScreen: Splash screen kelas profesional standar aplikasi Fintech modern
 * (GoPay, Blu, Revolut).
 * 
 * - Durasi ideal: ~1.4 detik (cukup waktu untuk memperlihatkan branding elegan tanpa membuat user bosan)
 * - Animasi masuk: Spring physics halus & ambient glow
 * - Progress bar: Sleek minimalist neon track dengan cubic-bezier easing
 * - Tap to skip: Tetap aktif jika pengguna ingin langsung masuk seketika
 */
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
        navigator.vibrate([15, 30, 20]);
      } catch {}
    }

    // Durasi total 1350ms dengan cubic easing
    const startTime = Date.now();
    const duration = 1350;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const linearPct = Math.min(1, elapsed / duration);
      // Easing out cubic: 1 - pow(1 - t, 3)
      const easedPct = Math.round((1 - Math.pow(1 - linearPct, 3)) * 100);
      setProgress(easedPct);

      if (elapsed >= duration) {
        clearInterval(timer);
        // Jeda sangat halus (180ms) setelah 100% lalu transisi masuk ke aplikasi
        setTimeout(() => {
          sessionStorage.setItem("sakuin_splash_played", "true");
          setShowSplash(false);
        }, 180);
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
            exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleSkip}
            className="fixed inset-0 z-[99999] bg-[#121212] flex flex-col items-center justify-between p-6 sm:p-8 select-none overflow-hidden cursor-pointer"
            style={{
              background: "radial-gradient(ellipse at 50% 40%, #1e2417 0%, #121212 75%)",
            }}
          >
            {/* Top decorative subtle badge */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
              style={{
                paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 8px), 16px)",
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[10.5px] font-bold text-[#D4FF5A] tracking-wider uppercase backdrop-blur-md shadow-xs"
            >
              <Sparkles className="w-3 h-3 text-[#D4FF5A]" />
              <span>Personal Finance for Students</span>
            </motion.div>

            {/* Center Logo & Branding Animation */}
            <div className="flex flex-col items-center text-center my-auto relative">
              {/* Glowing Ambient Light Aura */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [0.9, 1.2, 1.05],
                  opacity: [0.35, 0.6, 0.45],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className="absolute w-56 h-56 rounded-full bg-[#D4FF5A]/20 blur-3xl pointer-events-none -top-8"
              />

              {/* Logo Card with Smooth Spring Physics */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  delay: 0.12,
                }}
                className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#1C1C1C] border border-[#D4FF5A]/35 p-4 shadow-2xl shadow-[#D4FF5A]/15 flex items-center justify-center mb-5 backdrop-blur-sm"
              >
                <Image
                  src="/logo.png"
                  alt="SakuIN"
                  width={80}
                  height={80}
                  priority
                  className="object-contain drop-shadow-[0_4px_16px_rgba(212,255,90,0.3)]"
                />
              </motion.div>

              {/* Brand Title */}
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.28, ease: "easeOut" }}
                className="text-3xl sm:text-4xl font-black text-white tracking-tight"
                style={{ fontFamily: "'Fredoka', 'Plus Jakarta Sans', sans-serif" }}
              >
                Saku<span className="text-[#D4FF5A]">IN</span>
              </motion.h1>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.42, ease: "easeOut" }}
                className="text-xs sm:text-sm font-semibold text-neutral-400 mt-1 tracking-tight"
              >
                Tenang Sampai Akhir Bulan
              </motion.p>
            </div>

            {/* Bottom Progress Bar & Loading Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              style={{
                paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 8px), 16px)",
              }}
              className="w-full max-w-[260px] space-y-3 text-center"
            >
              {/* Minimalist Progress Track */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5 backdrop-blur-sm">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#B5E63B] via-[#D4FF5A] to-[#E8FFA1] rounded-full shadow-[0_0_12px_rgba(212,255,90,0.6)]"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>

              {/* Status and Percentage */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 px-1">
                <span className="tracking-wide">
                  {progress < 40
                    ? "Menyiapkan dompet pintar..."
                    : progress < 85
                    ? "Menyelaraskan data finansial..."
                    : "Siap digunakan!"}
                </span>
                <span className="text-[#D4FF5A] font-bold font-mono">{progress}%</span>
              </div>

              {/* Security Footnote */}
              <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] font-medium text-neutral-500">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4FF5A]/70" />
                <span>Terenkripsi & Aman • SakuIN v1.0</span>
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
