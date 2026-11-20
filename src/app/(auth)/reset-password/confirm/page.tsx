"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, CheckCircle2, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Simpan token recovery untuk re-auth jika cookies browser mobile terblokir
  const tokenRef = useRef<{ accessToken?: string; refreshToken?: string }>({});

  useEffect(() => {
    async function verifyRecoverySession() {
      const supabase = createClient();

      if (typeof window === "undefined") {
        setCheckingSession(false);
        return;
      }

      // 1. Cek jika URL membawa pesan error spesifik dari Supabase (misal otp_expired)
      const hashRaw = window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash;
      const searchRaw = window.location.search.startsWith("?")
        ? window.location.search.substring(1)
        : window.location.search;

      const hashParams = new URLSearchParams(hashRaw);
      const searchParams = new URLSearchParams(searchRaw);

      const errorDesc =
        hashParams.get("error_description") || searchParams.get("error_description");
      if (errorDesc) {
        setErrorMessage(decodeURIComponent(errorDesc).replace(/\+/g, " "));
        setCheckingSession(false);
        return;
      }

      // 2. Ekstrak access_token dan refresh_token dari hash URL (Implicit Flow Recovery)
      const hashAccessToken = hashParams.get("access_token");
      const hashRefreshToken = hashParams.get("refresh_token");

      if (hashAccessToken && hashRefreshToken) {
        tokenRef.current = {
          accessToken: hashAccessToken,
          refreshToken: hashRefreshToken,
        };
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });
          if (!error && data?.session) {
            setHasValidSession(true);
            setCheckingSession(false);
            return;
          }
        } catch (setErr) {
          console.warn("Gagal setSession dari hash:", setErr);
        }
      }

      // 3. Ekstrak ?code= dari query params (PKCE Flow)
      const code = searchParams.get("code");
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data?.session) {
            setHasValidSession(true);
            setCheckingSession(false);
            return;
          }
        } catch (exchangeErr) {
          console.warn("Gagal exchangeCodeForSession:", exchangeErr);
        }
      }

      // 4. Ekstrak token_hash atau token (Verify OTP Flow)
      const tokenHash = searchParams.get("token_hash") || searchParams.get("token");
      if (tokenHash) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (!error && data?.session) {
            setHasValidSession(true);
            setCheckingSession(false);
            return;
          }
        } catch (otpErr) {
          console.warn("Gagal verifyOtp recovery:", otpErr);
        }
      }

      // 5. Cek apakah sudah ada session aktif yang tersimpan
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setHasValidSession(true);
          setCheckingSession(false);
          return;
        }
      } catch (sessErr) {
        console.warn("Gagal cek getSession:", sessErr);
      }

      // 6. Dengarkan event auth perubahan sesaat jika token masih diproses di latar
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || s) {
          setHasValidSession(true);
          setCheckingSession(false);
        }
      });

      // Timeout 1.5 detik jika tidak ada sesi valid
      const timer = setTimeout(() => {
        setCheckingSession(false);
      }, 1500);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    }

    verifyRecoverySession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage("Kata sandi minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Pastikan session aktif sebelum update kata sandi
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession && tokenRef.current.accessToken && tokenRef.current.refreshToken) {
        await supabase.auth.setSession({
          access_token: tokenRef.current.accessToken,
          refresh_token: tokenRef.current.refreshToken,
        });
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes("auth session missing") ||
          error.message?.toLowerCase().includes("session")
        ) {
          setErrorMessage(
            "Sesi reset kata sandi telah berakhir atau sudah pernah digunakan. Tautan dari email hanya berlaku 1 kali. Silakan minta tautan baru."
          );
          setHasValidSession(false);
        } else {
          setErrorMessage(error.message || "Gagal memperbarui kata sandi.");
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err?.message || "Terjadi kesalahan. Silakan coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-md bg-card border border-border rounded-card p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-1.5">
          <Image
            src="/logo.png"
            alt="Sakuin"
            width={48}
            height={48}
            className="mx-auto mb-2 object-contain"
            priority
          />
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Atur Kata Sandi Baru
          </h1>
          <p className="text-xs text-muted-foreground">
            Masukkan kata sandi baru untuk akun SakuIN kamu
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-expense/10 border border-expense/30 rounded-xl text-xs text-expense font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {checkingSession ? (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
            <p className="text-xs font-semibold text-muted-foreground">
              Memverifikasi sesi reset kata sandi...
            </p>
          </div>
        ) : success ? (
          <div className="p-4 bg-accent/15 border border-accent/40 rounded-xl text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-accent mx-auto" />
            <div>
              <p className="text-sm font-bold text-foreground">
                Kata Sandi Berhasil Diperbarui!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Mengalihkan ke halaman masuk dalam beberapa detik...
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
            >
              <span>Langsung ke Halaman Masuk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : !hasValidSession ? (
          <div className="p-4 bg-muted/30 border border-border rounded-xl text-center space-y-3">
            <AlertCircle className="w-7 h-7 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Tautan Tidak Valid atau Sudah Dipakai
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tautan reset kata sandi hanya berlaku satu kali untuk keamanan akun kamu. Silakan minta tautan baru dan langsung buka tautan terbaru dari email.
              </p>
            </div>
            <Link
              href="/reset-password"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-accent text-[#121212] font-black text-xs hover:brightness-105 active:scale-98 transition-all shadow-xs"
            >
              <span>Minta Tautan Reset Baru</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground" htmlFor="newPassword">
                Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-3.5 pr-10 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground" htmlFor="confirmPassword">
                Ulangi Kata Sandi Baru
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru"
                className="w-full px-3.5 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
          >
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
