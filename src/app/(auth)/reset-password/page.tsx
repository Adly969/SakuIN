"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password/confirm`,
    });

    if (error) {
      setErrorMessage(error.message || "Gagal mengirim link reset password.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-md bg-card border border-border rounded-card p-6 sm:p-8 shadow-xl space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Login</span>
        </Link>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Reset Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Kami akan mengirim tautan untuk mengatur ulang kata sandi ke email Anda
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-expense/10 border border-expense/30 rounded-xl text-xs text-expense font-semibold">
            {errorMessage}
          </div>
        )}

        {submitted ? (
          <div className="p-4 bg-accent/10 border border-accent/30 rounded-xl text-center space-y-2">
            <p className="text-sm font-bold text-foreground">
              Link Terkirim!
            </p>
            <p className="text-xs text-muted-foreground">
              Silakan periksa kotak masuk atau spam di email <span className="text-foreground font-semibold">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground" htmlFor="email">
                Email Terdaftar
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@kampus.ac.id"
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? "Mengirim..." : "Kirim Tautan Reset"}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
