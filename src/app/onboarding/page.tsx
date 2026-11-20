"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { saveOnboardingAction } from "@/app/actions/onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [allowance, setAllowance] = useState("2500000");
  const [payday, setPayday] = useState("1");
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const res = await saveOnboardingAction({
        name,
        monthlyAllowance: parseInt(allowance || "0", 10),
        paydayDay: parseInt(payday || "1", 10),
      });
      if (!res.success) {
        alert(res.error || "Gagal menyimpan data onboarding");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Gagal menyimpan onboarding:", err);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-lg bg-card border border-border rounded-card p-6 sm:p-10 shadow-xl space-y-8">
        {/* Step Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Langkah {step} dari 3</span>
            <span className="text-accent">
              {step === 1 ? "Kenalan" : step === 2 ? "Uang Kiriman" : "Tanggal Kiriman"}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Nama Panggilan */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                Siapa nama panggilanmu?
              </h2>
              <p className="text-xs text-muted-foreground">
                SakuIN akan menyapamu dan memberi motivasi harian dengan namamu.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground" htmlFor="onboarding-name">
                Nama Panggilan
              </label>
              <input
                id="onboarding-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Dina"
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
              className="w-full py-3.5 bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Step 2: Uang Kiriman Bulanan */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                Berapa uang kirimanmu sebulan?
              </h2>
              <p className="text-xs text-muted-foreground">
                Uang kiriman ini akan jadi patokan anggaran dan sisa pemakaian harianmu.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">
                Nominal Bulanan
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={allowance}
                  onChange={(e) => setAllowance(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <p className="text-xs font-semibold text-accent">
                {formatRupiah(parseInt(allowance || "0"))} per bulan
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-3.5 border border-border rounded-pill text-foreground text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-3.5 bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Tanggal Kiriman */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                Biasa menerima kiriman tanggal berapa?
              </h2>
              <p className="text-xs text-muted-foreground">
                Untuk pengingat awal siklus bulanan dan kalkulasi sisa hari.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">
                Tanggal dalam Bulan (1 - 31)
              </label>
              <select
                value={payday}
                onChange={(e) => setPayday(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tanggal {d} setiap bulan
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-background border border-border rounded-2xl flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-accent shrink-0" />
              <p className="text-xs text-muted-foreground">
                7 Kategori pengeluaran & 4 pemasukan bawaan sudah disiapkan secara otomatis untukmu!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 py-3.5 border border-border rounded-pill text-foreground text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleFinish}
                className="flex-1 py-3.5 bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? "Menyiapkan..." : "Mulai Gunakan SakuIN"}</span>
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
