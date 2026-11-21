"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AnimatedSplashScreen: Splash screen murni tipografi (Pure Typography)
 * Elegan, minimalis, dan profesional tanpa ikon gambar — hanya nama merek "SakuIN"
 * dengan pendaran neon dinamis, gelombang ripple, dan animasi floating kelas atas.
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

    // Durasi animasi ~2.5 detik sesuai permintaan
    const timer = setTimeout(() => {
      sessionStorage.setItem("sakuin_splash_played", "true");
      setShowSplash(false);
    }, 2500);

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
            key="sakuin-splash-typography"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.06, filter: "blur(12px)" }}
            transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
            onClick={handleSkip}
            className="fixed inset-0 z-[99999] bg-[#121212] flex flex-col items-center justify-center p-6 select-none overflow-hidden cursor-pointer"
            style={{
              background: "radial-gradient(circle at 50% 50%, #1a2212 0%, #121212 70%)",
            }}
          >
            {/* Ambient Pulsing Aura Orbs */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [0.9, 1.3, 1],
                opacity: [0.35, 0.7, 0.4],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              className="absolute w-80 h-80 sm:w-[420px] sm:h-[420px] rounded-full bg-[#D4FF5A]/20 blur-3xl pointer-events-none"
            />

            {/* Dual Expanding Ripple Rings Animation */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: [0.7, 1.8], opacity: [0.45, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeOut",
              }}
              className="absolute w-52 h-52 sm:w-64 sm:h-64 rounded-full border border-[#D4FF5A]/30 pointer-events-none"
            />
            <motion.div
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: [0.7, 1.8], opacity: [0.45, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: 0.8,
                ease: "easeOut",
              }}
              className="absolute w-52 h-52 sm:w-64 sm:h-64 rounded-full border border-[#D4FF5A]/20 pointer-events-none"
            />

            {/* Central Pure Typography Brand Hero */}
            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Brand Title: SakuIN with Breathing Levitation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.82, letterSpacing: "0.18em" }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  letterSpacing: "-0.03em",
                  y: [0, -6, 0],
                }}
                transition={{
                  opacity: { duration: 0.5, ease: "easeOut" },
                  scale: { type: "spring", stiffness: 180, damping: 18, delay: 0.05 },
                  letterSpacing: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                  y: {
                    duration: 2.2,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                    delay: 0.3,
                  },
                }}
                className="relative select-none"
              >
                <h1
                  className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-tight flex items-center justify-center drop-shadow-[0_4px_30px_rgba(212,255,90,0.35)]"
                  style={{ fontFamily: "'Fredoka', 'Plus Jakarta Sans', sans-serif" }}
                >
                  <span className="drop-shadow-sm">Saku</span>
                  <span className="text-[#D4FF5A] ml-1 drop-shadow-[0_0_28px_rgba(212,255,90,0.7)]">
                    IN
                  </span>
                </h1>

                {/* Animated Glowing Accent Underline */}
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="h-1 bg-gradient-to-r from-transparent via-[#D4FF5A] to-transparent rounded-full mt-2.5 shadow-[0_0_12px_rgba(212,255,90,0.8)] mx-auto"
                />
              </motion.div>

              {/* Sleek Minimalist Pulsing Micro Dots */}
              <div className="flex items-center gap-2.5 mt-8">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{
                      scale: [0.8, 1.45, 0.8],
                      opacity: [0.3, 1, 0.3],
                    }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay: i * 0.22,
                      ease: "easeInOut",
                    }}
                    className="w-2.5 h-2.5 rounded-full bg-[#D4FF5A] shadow-[0_0_10px_rgba(212,255,90,0.9)]"
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
