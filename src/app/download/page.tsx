"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  ArrowRight,
} from "lucide-react";
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

  const primaryDownloadUrl =
    release?.apkUrlPrimary ||
    "https://github.com/Adly969/SakuIN/releases/download/v1.0.0/sakuin-v1.0.0.apk";
  const githubReleasesUrl = "https://github.com/Adly969/SakuIN/releases";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-accent selection:text-black">
      {/* 1. Header Bersih & Profesional */}
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/app-icon.png"
              alt="SakuIN Logo"
              width={34}
              height={34}
              className="rounded-xl shadow-xs group-hover:scale-105 transition-transform"
              priority
            />
            <span className="font-brand font-black text-lg sm:text-xl text-foreground tracking-tight">
              SakuIN<span className="text-accent">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg"
            >
              Masuk
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-black px-3.5 py-1.5 rounded-full bg-accent text-[#121212] hover:brightness-105 active:scale-95 transition-all shadow-xs"
            >
              Buka Web
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-14 space-y-10 w-full">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-xl mx-auto">
          {/* Glowing App Icon Badge */}
          <div className="relative inline-block mx-auto mb-1">
            <div className="absolute inset-0 bg-accent/25 blur-2xl rounded-full scale-125 pointer-events-none" />
            <Image
              src="/app-icon.png"
              alt="SakuIN App Icon"
              width={76}
              height={76}
              className="rounded-2xl shadow-2xl border border-border/60 relative z-10 mx-auto"
              priority
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/40 text-accent text-xs font-extrabold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Versi Resmi {release?.version || "v1.0.0"}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
            Pasang SakuIN di HP Kamu
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Aplikasi pencatatan keuangan bulanan mahasiswa perantau. Notifikasi alarm harian tepat waktu, siap dipakai offline, dan sangat hemat kuota.
          </p>
        </div>

        {/* Cards Grid: Android APK vs iOS PWA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
          {/* Card 1: Android APK */}
          <div className="bg-card border-2 border-accent/50 rounded-2xl p-5 sm:p-7 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-accent text-[#121212] text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Khusus Android
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    SakuIN Android (APK)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Aplikasi Native Mandiri &bull; ~4.5 MB
                  </p>
                </div>
              </div>

              {/* Info Pills */}
              <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-border/80 text-center">
                <div className="p-2 rounded-lg bg-background/60">
                  <span className="block text-[10px] text-muted-foreground font-semibold">Ukuran</span>
                  <span className="text-xs font-black text-accent">~4.5 MB</span>
                </div>
                <div className="p-2 rounded-lg bg-background/60">
                  <span className="block text-[10px] text-muted-foreground font-semibold">Versi</span>
                  <span className="text-xs font-black text-foreground">{release?.version || "1.0.0"}</span>
                </div>
                <div className="p-2 rounded-lg bg-background/60">
                  <span className="block text-[10px] text-muted-foreground font-semibold">OS</span>
                  <span className="text-xs font-black text-foreground">Android 7+</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span>Notifikasi alarm pasti berbunyi walau app mati</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span>Login Google resmi tetap aman & didukung</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  <span>Update fitur otomatis tanpa download ulang</span>
                </div>
              </div>
            </div>

            <div className="pt-5 space-y-2.5">
              <a
                href={primaryDownloadUrl}
                download
                className="w-full py-3.5 px-4 rounded-xl bg-accent text-[#121212] font-black text-sm flex items-center justify-center gap-2 hover:brightness-105 active:scale-98 transition-all shadow-md shadow-accent/20 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Unduh File APK (~4.5 MB)</span>
              </a>

              <div className="text-center">
                <a
                  href={githubReleasesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-accent font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  <span>Atau lihat daftar rilis di GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Card 2: iOS iPhone (PWA) */}
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-7 shadow-lg flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
                  <Apple className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Pengguna iPhone (iOS)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Pasang instan lewat Safari tanpa download file
                  </p>
                </div>
              </div>

              {/* Instructions Box */}
              <div className="p-3.5 rounded-xl bg-background/80 border border-border/80 space-y-2">
                <span className="text-[11px] font-bold text-foreground block">
                  Cara pasang di iPhone / iPad:
                </span>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>
                    Buka situs <strong className="text-foreground">saku-in.vercel.app</strong> di <strong className="text-foreground">Safari</strong>.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span>Tekan tombol</span>
                    <Share className="w-3.5 h-3.5 inline mt-0.5 text-accent shrink-0" />
                    <span><strong>Bagikan (Share)</strong> di bar bawah Safari.</span>
                  </li>
                  <li>
                    Pilih <strong className="text-foreground">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                </ol>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Tanpa memakan ruang penyimpanan HP</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Mendukung mode offline & notifikasi pengingat</span>
                </div>
              </div>
            </div>

            <div className="pt-5">
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

        {/* 3. Panduan Instalasi APK Android */}
        <section className="bg-card border border-border rounded-2xl p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/15 text-accent shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-foreground">
                Panduan Memasang APK di HP Android
              </h3>
              <p className="text-xs text-muted-foreground">
                Penjelasan jika muncul peringatan &quot;File mungkin berbahaya&quot;
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-background/70 border border-border/80 space-y-1.5">
              <div className="w-6 h-6 rounded-full bg-accent text-[#121212] font-black text-xs flex items-center justify-center">
                1
              </div>
              <h4 className="text-xs font-bold text-foreground">Klik Unduh APK</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tekan tombol unduh di atas. File berukuran ~4.5 MB akan selesai dalam hitungan detik.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-background/70 border border-border/80 space-y-1.5">
              <div className="w-6 h-6 rounded-full bg-accent text-[#121212] font-black text-xs flex items-center justify-center">
                2
              </div>
              <h4 className="text-xs font-bold text-foreground">Pilih &quot;Tetap Download&quot;</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Android menampilkan peringatan ini untuk semua APK di luar Play Store. Pilih <strong>Tetap Download (Download anyway)</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-background/70 border border-border/80 space-y-1.5">
              <div className="w-6 h-6 rounded-full bg-accent text-[#121212] font-black text-xs flex items-center justify-center">
                3
              </div>
              <h4 className="text-xs font-bold text-foreground">Pasang & Izinkan</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Buka file APK. Jika diminta, aktifkan <strong>Izinkan dari sumber ini</strong>, lalu klik <strong>Pasang</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Checksum SHA-256 Integritas */}
        {release?.sha256 && (
          <div className="p-3.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-muted-foreground shrink-0 text-[11px]">SHA-256:</span>
              <code className="px-2 py-0.5 bg-background rounded border border-border text-[10px] font-mono text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                {release.sha256}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopySha(release.sha256 || "")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border hover:border-accent text-[11px] font-bold transition-all shrink-0 cursor-pointer"
            >
              {copiedSha ? (
                <>
                  <Check className="w-3 h-3 text-accent" />
                  <span className="text-accent">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Salin Hash</span>
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto px-4 space-y-1.5">
          <p className="font-bold text-foreground">
            SakuIN · Kelola Uang Saku Mahasiswa
          </p>
          <p className="text-[10px]">
            Dikelola oleh Adly untuk mahasiswa perantau Indonesia &bull; Versi 1.0.0
          </p>
        </div>
      </footer>
    </div>
  );
}
