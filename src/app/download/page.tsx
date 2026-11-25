"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  Smartphone,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  Share,
  PlusSquare,
  BellRing,
  WifiOff,
  Lock,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getLatestReleaseAction, AppReleaseData } from "@/app/actions/releases";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function DownloadPage() {
  const [release, setRelease] = useState<AppReleaseData | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const [platformTab, setPlatformTab] = useState<"android" | "ios">("android");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installFeedback, setInstallFeedback] = useState<string>("");

  useEffect(() => {
    async function fetchRelease() {
      const res = await getLatestReleaseAction();
      if (res.success && res.data) {
        setRelease(res.data);
      }
    }
    fetchRelease();

    // Deteksi iOS secara halus untuk tab default panduan
    if (typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      setPlatformTab("ios");
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallFeedback("SakuIN sedang dipasang ke layar utama HP kamu!");
      }
      setDeferredPrompt(null);
      return;
    }

    // Jika di iOS atau browser tanpa prompt otomatis, arahkan ke panduan pasang
    setPlatformTab(
      typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? "ios"
        : "android"
    );
    const guideEl = document.getElementById("guide-section");
    if (guideEl) {
      guideEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setInstallFeedback("Ikuti panduan singkat di bawah untuk memasang di layar utama.");
    setTimeout(() => setInstallFeedback(""), 4000);
  };

  const handleCopySha = (hash: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2500);
    }
  };

  const primaryDownloadUrl =
    release?.apkUrlPrimary ||
    "https://github.com/Adly969/SakuIN/releases/download/v1.0.0/sakuin-v1.0.0.apk";
  const githubReleasesUrl = "https://github.com/Adly969/SakuIN/releases";
  const versionLabel = release?.version || "v1.0.0";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col justify-between selection:bg-accent selection:text-[#121212]">
      {/* 1. Minimal Sticky Header */}
      <header
        style={{
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 6px), 10px)",
        }}
        className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md"
      >
        <div className="max-w-[560px] mx-auto px-4 pb-2.5 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center min-h-[44px]">
            <BrandLogo height={28} />
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="min-h-[44px] px-3.5 rounded-full bg-card border border-border hover:border-accent/50 text-xs font-bold text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <span>Buka Web</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Single-Column Centered Content */}
      <main className="max-w-[560px] mx-auto px-4 py-6 sm:py-10 w-full flex-1 space-y-6">
        {/* Hero Block — Dirancang agar Judul + 2 Tombol Besar muat di 390px tanpa scroll */}
        <section className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-5 text-center">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-[11px] font-bold text-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Rilis Resmi {versionLabel} &bull; Gratis</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">
              Pasang SakuIN di HP Kamu
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Kelola uang saku bulanan, mingguan, maupun harian lebih tertata. Ringan, siap offline, dan hemat kuota.
            </p>
          </div>

          {/* Dua Tombol Utama Besar (Selalu Terlihat di 390px) */}
          <div className="space-y-2.5 pt-1">
            <a
              href={primaryDownloadUrl}
              download
              className="w-full min-h-[52px] py-3.5 px-5 rounded-2xl bg-accent hover:brightness-105 text-[#121212] font-black text-sm flex items-center justify-center gap-2.5 shadow-md shadow-accent/15 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Unduh APK Android (~4.5 MB)</span>
            </a>

            <button
              type="button"
              onClick={handleInstallPwa}
              className="w-full min-h-[50px] py-3 px-5 rounded-2xl bg-background hover:bg-muted border border-border text-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span>{deferredPrompt ? "Pasang Langsung ke Layar Utama" : "Pasang PWA (iPhone & Browser)"}</span>
            </button>

            {installFeedback && (
              <p className="text-[11px] font-semibold text-accent pt-0.5">{installFeedback}</p>
            )}
          </div>

          {/* 3 Spec Ringkas Monochrome */}
          <div className="grid grid-cols-3 divide-x divide-border pt-4 border-t border-border/70 text-center">
            <div className="px-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ukuran</p>
              <p className="text-xs font-black text-foreground mt-0.5">~4.5 MB</p>
            </div>
            <div className="px-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Platform</p>
              <p className="text-xs font-black text-foreground mt-0.5">Android &amp; iOS</p>
            </div>
            <div className="px-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mode</p>
              <p className="text-xs font-black text-foreground mt-0.5">Offline Ready</p>
            </div>
          </div>
        </section>

        {/* 3. Keunggulan Ringkas (Monochrome Clean Icons) */}
        <section className="grid grid-cols-3 gap-2.5">
          {[
            { icon: BellRing, title: "Pengingat Harian", desc: "Notifikasi batas jajan" },
            { icon: WifiOff, title: "Siap Offline", desc: "Catat tanpa sinyal" },
            { icon: Lock, title: "Kunci PIN", desc: "Privasi data aman" },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="bg-card border border-border rounded-2xl p-3 text-center space-y-1.5"
              >
                <div className="w-8 h-8 rounded-xl bg-muted border border-border/60 text-foreground flex items-center justify-center mx-auto">
                  <Icon className="w-4 h-4 stroke-[2]" />
                </div>
                <p className="text-[11px] font-bold text-foreground leading-tight">{feat.title}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{feat.desc}</p>
              </div>
            );
          })}
        </section>

        {/* 4. Panduan Pemasangan Berbasis Tab (Android vs iPhone) */}
        <section id="guide-section" className="bg-card border border-border rounded-3xl p-5 sm:p-6 space-y-4 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-black text-foreground">
                Panduan Pemasangan
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Pilih perangkatmu untuk melihat langkah instalasi
              </p>
            </div>

            {/* Segmented Tab */}
            <div className="grid grid-cols-2 p-1 bg-background border border-border rounded-xl text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setPlatformTab("android")}
                className={`px-3.5 py-2 min-h-[38px] rounded-lg transition-all ${
                  platformTab === "android"
                    ? "bg-card text-foreground shadow-xs border border-border font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Android (APK)
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab("ios")}
                className={`px-3.5 py-2 min-h-[38px] rounded-lg transition-all ${
                  platformTab === "ios"
                    ? "bg-card text-foreground shadow-xs border border-border font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                iPhone (Safari)
              </button>
            </div>
          </div>

          {platformTab === "android" ? (
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  title: "Unduh file APK",
                  desc: "Tekan tombol Unduh APK Android di atas. Ukuran file hanya ~4.5 MB.",
                },
                {
                  step: "2",
                  title: 'Pilih "Tetap Download"',
                  desc: "Android selalu memunculkan peringatan untuk aplikasi di luar Play Store. Ketuk Tetap Download.",
                },
                {
                  step: "3",
                  title: "Izinkan & Pasang",
                  desc: "Buka file yang terunduh, aktifkan Izinkan dari sumber ini jika diminta, lalu tekan Pasang.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-background border border-border/80"
                >
                  <div className="w-6 h-6 rounded-full bg-muted border border-border text-foreground font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  <span>Login Google &amp; update fitur otomatis</span>
                </span>
                <a
                  href={githubReleasesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-foreground hover:text-accent inline-flex items-center gap-1 transition-colors py-1"
                >
                  <span>Rilis GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-background border border-border/80">
                <div className="w-6 h-6 rounded-full bg-muted border border-border text-foreground font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Buka di Safari</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Pastikan kamu membuka <strong className="text-foreground">saku-in.vercel.app</strong> menggunakan browser <strong className="text-foreground">Safari</strong> di iPhone/iPad.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-background border border-border/80">
                <div className="w-6 h-6 rounded-full bg-muted border border-border text-foreground font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Ketuk Tombol Bagikan</span>
                    <Share className="w-3.5 h-3.5 text-muted-foreground" />
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Tekan ikon kotak dengan panah ke atas di bagian tengah bawah layar Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-background border border-border/80">
                <div className="w-6 h-6 rounded-full bg-muted border border-border text-foreground font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Tambahkan ke Layar Utama</span>
                    <PlusSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Gulir ke bawah, pilih <strong className="text-foreground">Add to Home Screen</strong>, lalu ketuk <strong className="text-foreground">Add</strong>.
                  </p>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-background hover:bg-muted border border-border text-xs font-bold text-foreground flex items-center justify-center gap-2 transition-colors"
              >
                <span>Langsung Buka Aplikasi Web</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </section>

        {/* 5. Verifikasi Integritas SHA-256 (Compact) */}
        {release?.sha256 && (
          <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-muted-foreground shrink-0 text-[11px]">SHA-256</span>
              <code className="px-2 py-1 bg-background rounded-lg border border-border text-[10px] font-mono text-muted-foreground truncate">
                {release.sha256}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopySha(release.sha256 || "")}
              className="min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background border border-border hover:border-accent text-[11px] font-bold transition-all shrink-0 cursor-pointer"
            >
              {copiedSha ? (
                <>
                  <Check className="w-3 h-3 text-accent" />
                  <span className="text-accent">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
        <div className="max-w-[560px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <span className="font-bold text-foreground">SakuIN &bull; {versionLabel}</span>
          <span className="text-[11px]">Kelola uang saku mahasiswa lebih teratur</span>
        </div>
      </footer>
    </div>
  );
}
