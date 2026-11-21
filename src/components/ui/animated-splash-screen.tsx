"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AnimatedSplashScreen: Splash screen minimalis, bersih, dan profesional
 * Fokus murni pada logo SakuIN, tipografi merek, dan rangkaian animasi halus kelas atas
 * tanpa teks tambahan yang berantakan.
 */
export function AnimatedSplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState<boolean>(true);

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
        navigator.vibrate([15, 25]);
      } catch {}
    }

    // Timer transisi keluar (~1.4 detik: pas, elegan, dan profesional)
    const timer = setTimeout(() => {
      sessionStorage.setItem("sakuin_splash_played", "true");
      setShowSplash(false);
    }, 1400);

    return () => clearTimeout(timer);
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
            key="sakuin-splash-minimal"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={handleSkip}
            className="fixed inset-0 z-[99999] bg-[#121212] flex flex-col items-center justify-center p-6 select-none overflow-hidden cursor-pointer"
            style={{
              background: "radial-gradient(circle at 50% 48%, #1c2214 0%, #121212 70%)",
            }}
          >
            {/* Ambient Pulsing Aura Orbs */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [0.9, 1.25, 1],
                opacity: [0.35, 0.65, 0.4],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-[#D4FF5A]/20 blur-3xl pointer-events-none"
            />

            {/* Expanding Ripple Ring Animation */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0.6 }}
              animate={{ scale: [0.8, 1.5], opacity: [0.4, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeOut",
              }}
              className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full border border-[#D4FF5A]/30 pointer-events-none"
            />

            {/* Central Branding Hub */}
            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Logo Card with Spring Physics & Floating Levitation */}
              <motion.div
                initial={{ scale: 0, rotate: -12, opacity: 0 }}
                animate={{
                  scale: 1,
                  rotate: 0,
                  opacity: 1,
                  y: [0, -6, 0],
                }}
                transition={{
                  scale: { type: "spring", stiffness: 220, damping: 18, delay: 0.08 },
                  rotate: { type: "spring", stiffness: 200, damping: 20, delay: 0.08 },
                  opacity: { duration: 0.35, delay: 0.05 },
                  y: {
                    duration: 2.4,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                    delay: 0.4,
                  },
                }}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#1C1C1C]/90 border border-[#D4FF5A]/40 p-4 shadow-2xl shadow-[#D4FF5A]/25 flex items-center justify-center mb-6 backdrop-blur-md overflow-hidden"
              >
                {/* Shimmer Light Sweep across Logo Card */}
                <motion.div
                  initial={{ x: "-150%" }}
                  animate={{ x: "180%" }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    repeatDelay: 0.6,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 pointer-events-none"
                />

                <Image
                  src="/logo.png"
                  alt="SakuIN"
                  width={80}
                  height={80}
                  priority
                  className="object-contain drop-shadow-[0_4px_20px_rgba(212,255,90,0.35)]"
                />
              </motion.div>

              {/* Brand Title: SakuIN */}
              <motion.h1
                initial={{ opacity: 0, y: 15, letterSpacing: "0.08em" }}
                animate={{ opacity: 1, y: 0, letterSpacing: "-0.02em" }}
                transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-center drop-shadow-[0_4px_24px_rgba(212,255,90,0.3)]"
                style={{ fontFamily: "'Fredoka', 'Plus Jakarta Sans', sans-serif" }}
              >
                <span>Saku</span>
                <span className="text-[#D4FF5A] ml-0.5">IN</span>
              </motion.h1>

              {/* Sleek Minimalist Pulsing Dots (Micro Loader) */}
              <div className="flex items-center gap-2 mt-6">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{
                      scale: [0.8, 1.4, 0.8],
                      opacity: [0.35, 1, 0.35],
                    }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeInOut",
                    }}
                    className="w-2 h-2 rounded-full bg-[#D4FF5A] shadow-[0_0_8px_rgba(212,255,90,0.8)]"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render Content */}
      {children}
    </>
  );
}
