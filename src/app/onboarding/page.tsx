"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Utensils,
  Coffee,
  Bike,
  Cookie,
  Wifi,
  ShoppingBag,
  Shirt,
  Zap,
  GraduationCap,
  Flame,
  Info,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { saveOnboardingAction } from "@/app/actions/onboarding";

interface CategoryChoice {
  id: string;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultChecked: boolean;
}

const STUDENT_CATEGORIES: CategoryChoice[] = [
  { id: "Makan", name: "Makan", desc: "Warteg, kantin, makan sehari-hari", icon: Utensils, defaultChecked: true },
  { id: "Nongkrong", name: "Nongkrong", desc: "Kafe, nugas bareng, kopi", icon: Coffee, defaultChecked: true },
  { id: "Bensin & Transport", name: "Bensin & Transport", desc: "Bensin motor, ojol, angkot, parkir", icon: Bike, defaultChecked: true },
  { id: "Jajan & Cemilan", name: "Jajan & Cemilan", desc: "Gorengan, boba, jajan sore", icon: Cookie, defaultChecked: true },
  { id: "Kuota & Internet", name: "Kuota & Internet", desc: "Paket data bulanan, wifi kos", icon: Wifi, defaultChecked: true },
  { id: "Kebutuhan Kos", name: "Kebutuhan Kos", desc: "Sabun, odol, deterjen, galon", icon: ShoppingBag, defaultChecked: true },
  { id: "Laundry", name: "Laundry", desc: "Cuci setrika kiloan", icon: Shirt, defaultChecked: true },
  { id: "Listrik & Token", name: "Listrik & Token", desc: "Token listrik kamar kos", icon: Zap, defaultChecked: false },
  { id: "Kuliah & Fotokopi", name: "Kuliah & Fotokopi", desc: "Print tugas, ATK, fotokopi buku", icon: GraduationCap, defaultChecked: true },
  { id: "Rokok / Vape", name: "Rokok / Vape", desc: "Khusus yang merokok atau vaping", icon: Flame, defaultChecked: false },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [allowance, setAllowance] = useState("2500000");
  const [payday, setPayday] = useState("1");
  const [selectedCats, setSelectedCats] = useState<string[]>(
    STUDENT_CATEGORIES.filter((c) => c.defaultChecked).map((c) => c.name)
  );
  const [loading, setLoading] = useState(false);

  const toggleCategory = (catName: string) => {
    setSelectedCats((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const handleFinish = async () => {
    if (selectedCats.length === 0) {
      alert("Pilih minimal 1 kategori pengeluaran harianmu");
      return;
    }

    setLoading(true);
    try {
      const res = await saveOnboardingAction({
        name,
        monthlyAllowance: parseInt(allowance || "0", 10),
        paydayDay: parseInt(payday || "1", 10),
        selectedCategories: selectedCats,
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

  const stepTitles = ["Kenalan", "Uang Kiriman", "Tanggal Kiriman", "Pilih Kategori"];

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-lg bg-card border border-border rounded-card p-6 sm:p-8 shadow-xl space-y-6">
        {/* Step Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Langkah {step} dari 4</span>
            <span className="text-accent">{stepTitles[step - 1]}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
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
                onClick={() => setStep(4)}
                className="flex-1 py-3.5 bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Pilih Kategori</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Pilih Kategori Harian Mahasiswa */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                Pilih Kategori Pengeluaranmu
              </h2>
              <p className="text-xs text-muted-foreground">
                Pilih yang sering kamu gunakan sehari-hari. Kamu bisa menambah atau mengubahnya nanti.
              </p>
            </div>

            {/* Note Info */}
            <div className="p-3 bg-muted/50 border border-border rounded-xl flex items-start gap-2.5 text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                Pengeluaran yang jarang (seperti servis motor, baju, dll.) tetap bisa kamu ketik bebas lewat kategori <strong>Kebutuhan Lain</strong>.
              </span>
            </div>

            {/* Category Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {STUDENT_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCats.includes(cat.name);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.name)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? "border-accent bg-accent/15 text-foreground shadow-xs"
                        : "border-border bg-background/50 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected ? "bg-accent text-[#1F1F1F]" : "bg-muted text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-accent border-accent text-[#1F1F1F]"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight">{cat.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{cat.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-1/3 py-3.5 border border-border rounded-pill text-foreground text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                disabled={loading || selectedCats.length === 0}
                onClick={handleFinish}
                className="flex-1 py-3.5 bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? "Menyiapkan Akun..." : "Mulai Gunakan SakuIN"}</span>
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
