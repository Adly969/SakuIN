"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Periksa apakah ada error di URL (misal: link kadaluarsa)
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("error_description")) {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const desc = params.get("error_description");
        if (desc) {
          setErrorMessage(decodeURIComponent(desc).replace(/\+/g, " "));
        }
      }
    }
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(error.message || "Gagal memperbarui kata sandi. Tautan mungkin sudah kadaluarsa.");
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
          <div className="p-3 bg-expense/10 border border-expense/30 rounded-xl text-xs text-expense font-semibold">
            {errorMessage}
          </div>
        )}

        {success ? (
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
      </div>
    </div>
  );
}
