"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Apple,
  Share,
  Layers,
  ArrowRight,
} from "lucide-react";
import { BrandText } from "@/components/ui/brand-logo";
import { getLatestReleaseAction, AppReleaseData } from "@/app/actions/releases";

export default function DownloadPage() {
  const [release, setRelease] = useState<AppReleaseData | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    async function fetchRelease() {
      const res = await getLatestReleaseAction();
      if (res.success && res.data) {
        setRelease(res.data);
      }
    }
    fetchRelease();
  }, []);

  const handleCopySha = (hash: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2500);
    }
  };

  const formattedSize = release?.sizeBytes
    ? `${(release.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : "2.5 MB";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-accent selection:text-black">
      {/* 1. Simple Navbar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-black text-black shadow-sm group-hover:scale-105 transition-transform">
              S
            </div>
            <BrandText className="text-xl" />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg"
            >
              Masuk
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-black px-3.5 py-1.5 rounded-lg bg-accent text-black hover:brightness-105 transition-all shadow-xs"
            >
              Buka Web App
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/40 text-accent text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Versi Resmi {release?.version || "v1.0.0"} Telah Hadir</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-tight">
            Unduh SakuIN untuk HP Android Kamu
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Aplikasi pencatatan keuangan bulanan mahasiswa paling ringan, cepat, dan hemat kuota.
            Tanpa iklan mengganggu, aman, dan siap dipakai offline.
          </p>
        </div>

        {/* 3. Cards Grid: Android APK vs iOS PWA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Android APK (Utama) */}
          <div className="bg-card border-2 border-accent/50 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-accent text-black text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Disarankan untuk Android
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">SakuIN Android APK</h2>
                  <p className="text-xs text-muted-foreground">
                    Format .apk murni (via Trusted Web Activity)
                  </p>
                </div>
              </div>

              {/* Key Highlights */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-border text-center">
                <div className="p-2 rounded-lg bg-background/50">
                  <span className="block text-[10px] text-muted-foreground font-semibold">Ukuran File</span>
                  <span className="text-xs font-black text-accent">{formattedSize}</span>
                </div>
                <div className="p-2 rounded-lg bg-background/50">
                  <span className="block text-[10px] text-muted-foreground font-semibold">Versi</span>
                  <span className="text-xs font-black text-foreground">{release?.version || "1.0.0"}</span>
                </div>
                <div className="p-2 rounded-lg bg-background/50">
                  <span className="block text-[10px] text-muted-foreground font-semibold">OS Minimum</span>
                  <span className="text-xs font-black text-foreground">Android 7.0+</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span>Sangat ringan (~2.5 MB), hemat kuota mahasiswa</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span>Login Google resmi tetap aman & didukung penuh</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span>Fitur otomatis terupdate tanpa perlu download ulang</span>
                </div>
              </div>
            </div>

            <div className="pt-6 space-y-3">
              <a
                href={release?.apkUrlPrimary || "https://github.com/Adly969/SakuIN/releases"}
                download
                className="w-full py-3.5 px-4 rounded-xl bg-accent text-black font-black text-sm flex items-center justify-center gap-2 hover:brightness-105 active:scale-98 transition-all shadow-md shadow-accent/20 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Unduh APK Resmi ({formattedSize})</span>
              </a>

              {release?.apkUrlMirror && (
                <div className="text-center">
                  <a
                    href={release.apkUrlMirror}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted-foreground hover:text-accent font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Tautan Cadangan / Mirror</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: iOS iPhone & Desktop PWA */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-lg flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
                  <Apple className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">Pengguna iPhone (iOS)</h2>
                  <p className="text-xs text-muted-foreground">
                    Pasang langsung tanpa instal file via Safari
                  </p>
                </div>
              </div>

              {/* Instructions for iOS */}
              <div className="p-3.5 rounded-xl bg-background border border-border space-y-2.5">
                <span className="text-xs font-bold text-foreground block">
                  Cara pasang di iPhone / iPad:
                </span>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>
                    Buka situs <strong className="text-foreground">saku-in.vercel.app</strong> di browser <strong className="text-foreground">Safari</strong>.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span>Tekan tombol</span>
                    <Share className="w-3.5 h-3.5 inline mt-0.5 text-accent shrink-0" />
                    <span><strong>Bagikan (Share)</strong> di menu bawah Safari.</span>
                  </li>
                  <li>
                    Gulir ke bawah dan pilih <strong className="text-foreground">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Selesai! Ikon SakuIN akan muncul seperti aplikasi native di iPhone.
                  </li>
                </ol>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Tanpa memakan memori penyimpanan iPhone</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Mendukung mode offline & notifikasi pengingat harian</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/dashboard"
                className="w-full py-3.5 px-4 rounded-xl bg-card border border-border text-foreground font-black text-sm flex items-center justify-center gap-2 hover:bg-muted active:scale-98 transition-all"
              >
                <span>Buka Versi Web SakuIN</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* 4. Installation Guide (Panduan Mengatasi Peringatan Android) */}
        <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/15 text-accent shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground">
                Panduan Memasang APK di HP Android
              </h3>
              <p className="text-xs text-muted-foreground">
                Mengapa muncul peringatan &quot;File mungkin berbahaya&quot; dan cara menginstalnya?
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="w-7 h-7 rounded-full bg-accent text-black font-black text-xs flex items-center justify-center">
                1
              </div>
              <h4 className="text-xs font-bold text-foreground">Download File APK</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Klik tombol <strong>Unduh APK</strong> di atas. Ukuran hanya ~2.5 MB sehingga unduhan selesai dalam hitungan detik.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="w-7 h-7 rounded-full bg-accent text-black font-black text-xs flex items-center justify-center">
                2
              </div>
              <h4 className="text-xs font-bold text-foreground">Pilih &quot;Tetap Download&quot;</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sistem Android otomatis menampilkan peringatan untuk semua aplikasi di luar Play Store. Pilih <strong>Tetap Download (Download anyway)</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="w-7 h-7 rounded-full bg-accent text-black font-black text-xs flex items-center justify-center">
                3
              </div>
              <h4 className="text-xs font-bold text-foreground">Buka & Pasang (Install)</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Buka file APK. Jika diminta izin instalasi aplikasi tidak dikenal, aktifkan toggle <strong>Izinkan dari sumber ini</strong>, lalu klik <strong>Pasang</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Checksum SHA-256 Verifikasi Integritas */}
        {release?.sha256 && (
          <div className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-muted-foreground shrink-0">SHA-256 Checksum:</span>
              <code className="px-2 py-1 bg-background rounded border border-border text-[11px] font-mono text-muted-foreground truncate max-w-xs sm:max-w-md">
                {release.sha256}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopySha(release.sha256 || "")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:border-accent text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              {copiedSha ? (
                <>
                  <Check className="w-3.5 h-3.5 text-accent" />
                  <span className="text-accent">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Hash</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 6. Changelog / Catatan Rilis */}
        {release?.changelog && (
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-7 space-y-4">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              <span>Catatan Rilis Versi {release.version}</span>
            </h3>
            <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-background p-4 rounded-xl border border-border font-medium">
              {release.changelog}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-foreground">
            SakuIN · Aplikasi Keuangan Mahasiswa Perantau
          </p>
          <p className="text-[11px]">
            Dibangun dengan Next.js, Supabase, dan Trusted Web Activity (TWA) · Dikelola oleh Adly
          </p>
        </div>
      </footer>
    </div>
  );
}
