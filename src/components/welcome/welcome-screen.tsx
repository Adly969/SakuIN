"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Zap, Target, PiggyBank } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

export function WelcomeScreen() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const handleStart = (destination: string) => {
    // Set cookie so returning users don't see the welcome screen again
    document.cookie = "sakuin_welcomed=true; path=/; max-age=31536000; SameSite=Lax";
    router.push(destination);
  };

  const floatAnimation = shouldReduceMotion
    ? undefined
    : {
        y: [0, -8, 0],
        transition: {
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };

  const floatAnimationDelay = shouldReduceMotion
    ? undefined
    : {
        y: [0, -10, 0],
        transition: {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut" as const,
          delay: 0.8,
        },
      };

  return (
    <main className="min-h-screen w-full bg-[#D4FF5A] text-[#1F1F1F] flex flex-col justify-between p-6 sm:p-10 md:p-16 selection:bg-[#1F1F1F] selection:text-[#D4FF5A]">
      {/* Top Header / Brand */}
      <header className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <BrandLogo height={36} textColor="text-[#1F1F1F]" />
        <span className="text-xs font-semibold uppercase tracking-wider bg-[#1F1F1F]/10 px-3 py-1 rounded-pill">
          v2.0
        </span>
      </header>

      {/* Main Content: Responsive layout (1 column on mobile, 2 columns on desktop) */}
      <div className="w-full max-w-7xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center py-6">
        {/* Left Column (Desktop) / Illustration (Mobile) */}
        <div className="lg:col-span-6 flex justify-center items-center order-1 lg:order-1">
          <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
            {/* Darker Lime Backdrop Circle */}
            <div
              className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-[#C1EB4A]/80 shadow-inner"
              aria-hidden="true"
            />

            {/* Custom SVG Line Art Illustration */}
            <svg
              className="relative w-full h-full z-10"
              viewBox="0 0 400 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Central Wallet & Hands Line Art */}
              <g stroke="#1F1F1F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {/* Hand outline */}
                <path d="M120 280 C120 240, 150 220, 180 220 L240 220 C270 220, 290 250, 280 290" />
                <path d="M100 310 C120 300, 140 290, 170 290 L260 290" />

                {/* Dompet / Wallet */}
                <rect x="130" y="150" width="140" height="95" rx="16" fill="#D4FF5A" />
                <path d="M130 185 L270 185" />
                {/* Wallet flap & clasp */}
                <path d="M230 185 C230 175, 260 175, 260 185 L260 205 C260 215, 230 215, 230 205 Z" fill="#1F1F1F" />
                <circle cx="245" cy="195" r="3.5" fill="#D4FF5A" />

                {/* Struk / Receipt sticking out */}
                <path d="M155 150 L155 110 L165 118 L175 110 L185 118 L195 110 L205 118 L205 150" fill="#FFFFFF" />
                <line x1="165" y1="126" x2="195" y2="126" stroke="#8A8A8A" strokeWidth="2" />
                <line x1="165" y1="134" x2="185" y2="134" stroke="#8A8A8A" strokeWidth="2" />

                {/* Bank Card sticking out */}
                <rect x="180" y="125" width="80" height="50" rx="8" fill="#1F1F1F" stroke="#1F1F1F" />
                <circle cx="196" cy="142" r="6" fill="#D4FF5A" />
                <circle cx="206" cy="142" r="6" fill="#D4FF5A" fillOpacity="0.6" />
              </g>

              {/* Floating Coins with gentle transform */}
              <motion.g animate={floatAnimation}>
                {/* Coin 1 */}
                <circle cx="95" cy="140" r="22" fill="#D4FF5A" stroke="#1F1F1F" strokeWidth="2.5" />
                <circle cx="95" cy="140" r="15" stroke="#1F1F1F" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="95" y="146" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1F1F1F">Rp</text>
              </motion.g>

              <motion.g animate={floatAnimationDelay}>
                {/* Coin 2 */}
                <circle cx="310" cy="130" r="18" fill="#D4FF5A" stroke="#1F1F1F" strokeWidth="2.5" />
                <text x="310" y="136" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1F1F1F">Rp</text>
              </motion.g>

              {/* Floating QR Code Badge */}
              <motion.g animate={floatAnimation}>
                <rect x="290" y="240" width="46" height="46" rx="10" fill="#1F1F1F" />
                {/* Simplified QR dots in lime */}
                <rect x="297" y="247" width="12" height="12" rx="3" fill="#D4FF5A" />
                <rect x="317" y="247" width="12" height="12" rx="3" fill="#D4FF5A" />
                <rect x="297" y="267" width="12" height="12" rx="3" fill="#D4FF5A" />
                <rect x="317" y="267" width="5" height="5" fill="#D4FF5A" />
              </motion.g>

              {/* Floating small sparkles/stars */}
              <motion.g animate={floatAnimationDelay}>
                <path
                  d="M100 230 L103 238 L111 241 L103 244 L100 252 L97 244 L89 241 L97 238 Z"
                  fill="#1F1F1F"
                />
              </motion.g>
            </svg>
          </div>
        </div>

        {/* Right Column: Hero Typography & Subtitle */}
        <div className="lg:col-span-6 flex flex-col justify-center order-2 lg:order-2 space-y-6">
          {/* 3-line Large Title with Pill Dark Button */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-[#1F1F1F]">
            Catat Uang Kiriman,{" "}
            <br />
            <span className="inline-flex items-center gap-2">
              Tenang Sampai
              <span className="inline-flex items-center justify-center bg-[#1F1F1F] text-[#D4FF5A] px-3.5 py-1 rounded-pill mx-1 shadow-md">
                <ArrowRight className="w-5 h-5 sm:w-7 sm:h-7" />
              </span>
            </span>{" "}
            <br />
            Akhir Bulan
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl font-medium text-[#1F1F1F]/80 max-w-lg leading-relaxed">
            Catat, atur, dan tabung uang bulananmu dalam hitungan detik. Tanpa ribet, bebas cemas di tanggal tua.
          </p>

          {/* Feature highlights pill badges with SVG icons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-pill bg-[#1F1F1F]/10 text-[#1F1F1F]">
              <Zap className="w-3.5 h-3.5 fill-[#1F1F1F]" />
              <span>Cepat 3 Ketukan</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-pill bg-[#1F1F1F]/10 text-[#1F1F1F]">
              <Target className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Batas Pemakaian Harian</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-pill bg-[#1F1F1F]/10 text-[#1F1F1F]">
              <PiggyBank className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Target Tabungan</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions: "Lewati" on left, "Mulai" with circular dark arrow button on right */}
      <footer className="w-full max-w-7xl mx-auto flex items-center justify-between pt-6 border-t border-[#1F1F1F]/15">
        <button
          type="button"
          onClick={() => handleStart("/login")}
          className="text-base sm:text-lg font-bold text-[#1F1F1F]/70 hover:text-[#1F1F1F] px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1F1F]"
        >
          Lewati
        </button>

        <button
          type="button"
          onClick={() => handleStart("/register")}
          className="group flex items-center gap-3 bg-[#1F1F1F] text-[#D4FF5A] pl-6 pr-2 py-2 rounded-pill font-bold text-base sm:text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1F1F]"
        >
          <span>Mulai</span>
          <div className="w-10 h-10 rounded-full bg-[#D4FF5A] text-[#1F1F1F] flex items-center justify-center group-hover:rotate-45 transition-transform duration-300">
            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
          </div>
        </button>
      </footer>
    </main>
  );
}
