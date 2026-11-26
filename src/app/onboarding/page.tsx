"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Utensils,
  Coffee,
  Bike,
  Wifi,
  Shirt,
  GraduationCap,
  Flame,
  Info,
  Calendar,
  Repeat,
  Sparkles,
  Landmark,
  Smartphone,
  Banknote,
  PiggyBank,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { saveOnboardingAction } from "@/app/actions/onboarding";
import {
  calculateRemainingDays,
  calculateAdaptiveDailyLimit,
  INDONESIAN_DAYS,
  type AllowanceCycle,
  type ReserveMode,
} from "@/lib/finance";

interface CategoryChoice {
  id: string;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultChecked: boolean;
}

const STUDENT_CATEGORIES: CategoryChoice[] = [
  { id: "Makan", name: "Makan", desc: "Warteg, kantin, makan sehari-hari", icon: Utensils, defaultChecked: true },
  { id: "Transport / Bensin", name: "Transport / Bensin", desc: "Bensin motor, ojol, angkot, parkir", icon: Bike, defaultChecked: true },
  { id: "Kuota & Internet", name: "Kuota & Internet", desc: "Paket data bulanan", icon: Wifi, defaultChecked: true },
  { id: "Jajan & Nongkrong", name: "Jajan & Nongkrong", desc: "Kopi, kafe, cemilan, nugas bareng", icon: Coffee, defaultChecked: true },
  { id: "Kuliah", name: "Kuliah", desc: "Print tugas, ATK, fotokopi buku", icon: GraduationCap, defaultChecked: true },
  { id: "Laundry", name: "Laundry", desc: "Cuci setrika kiloan", icon: Shirt, defaultChecked: false },
  { id: "Rokok", name: "Rokok", desc: "Khusus yang merokok atau vaping", icon: Flame, defaultChecked: false },
];

type ReservePresetKey = "none" | "daily_5k" | "daily_10k" | "percent_15" | "custom";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");

  // Step 2: Pola Siklus & Nominal
  const [allowanceCycle, setAllowanceCycle] = useState<AllowanceCycle>("monthly");
  const [allowance, setAllowance] = useState("1500000");
  const [payday, setPayday] = useState("1");
  const [paydayWeekday, setPaydayWeekday] = useState("1"); // 1 = Senin

  // Step 3: Saldo Riil Sekarang & Gaya Menyisihkan
  const [bankBalance, setBankBalance] = useState("");
  const [ewalletBalance, setEwalletBalance] = useState("");
  const [cashBalance, setCashBalance] = useState("");

  const [reservePreset, setReservePreset] = useState<ReservePresetKey>("none");
  const [customReserveMode, setCustomReserveMode] = useState<Exclude<ReserveMode, "none">>("daily_fixed");
  const [customReserveValue, setCustomReserveValue] = useState("10000");

  // Step 4: Kategori & Tawaran Motivasi (default mati per PRD UI/UX)
  const [selectedCats, setSelectedCats] = useState<string[]>(
    STUDENT_CATEGORIES.filter((c) => c.defaultChecked).map((c) => c.name)
  );
  const [motivationNotifEnabled, setMotivationNotifEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (catName: string) => {
    setSelectedCats((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const parsedAllowance = parseInt(allowance.replace(/[^0-9]/g, "") || "0", 10);
  const parsedBank = parseInt(bankBalance.replace(/[^0-9]/g, "") || "0", 10);
  const parsedEwallet = parseInt(ewalletBalance.replace(/[^0-9]/g, "") || "0", 10);
  const parsedCash = parseInt(cashBalance.replace(/[^0-9]/g, "") || "0", 10);
  const totalInitialBalance = parsedBank + parsedEwallet + parsedCash;

  const resolvedReserve = useMemo((): { mode: ReserveMode; value: number } => {
    switch (reservePreset) {
      case "none":
        return { mode: "none", value: 0 };
      case "daily_5k":
        return { mode: "daily_fixed", value: 5000 };
      case "daily_10k":
        return { mode: "daily_fixed", value: 10000 };
      case "percent_15":
        return { mode: "percent", value: 15 };
      case "custom":
        return {
          mode: customReserveMode,
          value: parseInt(customReserveValue.replace(/[^0-9]/g, "") || "0", 10),
        };
    }
  }, [reservePreset, customReserveMode, customReserveValue]);

  const previewCalc = useMemo(() => {
    const today = new Date();
    const days = calculateRemainingDays(
      today,
      parseInt(payday || "1", 10),
      allowanceCycle,
      parseInt(paydayWeekday || "1", 10)
    );
    const baseBalance = totalInitialBalance > 0 ? totalInitialBalance : parsedAllowance;
    const adaptive = calculateAdaptiveDailyLimit(
      baseBalance,
      days,
      resolvedReserve.mode,
      resolvedReserve.value
    );
    return { days, baseBalance, ...adaptive };
  }, [payday, allowanceCycle, paydayWeekday, totalInitialBalance, parsedAllowance, resolvedReserve]);

  const handleFinish = async () => {
    if (selectedCats.length === 0) {
      alert("Pilih minimal 1 kategori pengeluaran harianmu");
      return;
    }

    setLoading(true);
    try {
      const res = await saveOnboardingAction({
        name,
        monthlyAllowance: allowanceCycle === "flexible" ? totalInitialBalance : parsedAllowance,
        allowanceCycle,
        paydayDay: parseInt(payday || "1", 10),
        paydayWeekday: parseInt(paydayWeekday || "1", 10),
        reserveMode: resolvedReserve.mode,
        reserveValue: resolvedReserve.value,
        bankBalance: parsedBank,
        ewalletBalance: parsedEwallet,
        cashBalance: parsedCash,
        selectedCategories: selectedCats,
        motivationNotifEnabled,
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

  const stepTitles = ["Kenalan", "Pola Uang Saku", "Saldo & Sisihan", "Pilih Kategori"];

  const formatNumInput = (val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, "") || "0", 10);
    return num > 0 ? num.toLocaleString("id-ID") : "";
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-lg bg-card border border-border rounded-card p-5 sm:p-8 shadow-xl space-y-6">
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
                SakuIN akan menyapamu dan menyesuaikan pengaturan keuangan dengan gaya hidupmu.
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
                className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-background border border-border text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
              className="w-full py-3.5 min-h-[48px] bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Step 2: Pola Uang Saku (Bulanan / Mingguan / Fleksibel) */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                Bagaimana pola uang sakumu?
              </h2>
              <p className="text-xs text-muted-foreground">
                Setiap mahasiswa berbeda. Pilih jadwal pemasukan utamamu agar hitungan harian akurat.
              </p>
            </div>

            {/* 3 Kartu Siklus */}
            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  id: "monthly" as AllowanceCycle,
                  title: "Bulanan",
                  desc: "Dapat uang kiriman atau gaji tiap bulan",
                  icon: Calendar,
                },
                {
                  id: "weekly" as AllowanceCycle,
                  title: "Mingguan",
                  desc: "Dapat uang bekal rutin tiap minggu",
                  icon: Repeat,
                },
                {
                  id: "flexible" as AllowanceCycle,
                  title: "Fleksibel / Tidak Menentu",
                  desc: "Part-time, freelance, atau atur dari saldo yang dipegang",
                  icon: Sparkles,
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = allowanceCycle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAllowanceCycle(opt.id);
                      if (opt.id === "weekly" && parsedAllowance > 1000000) {
                        setAllowance("350000");
                      } else if (opt.id === "monthly" && parsedAllowance < 500000) {
                        setAllowance("1500000");
                      }
                    }}
                    className={`p-3.5 min-h-[56px] rounded-xl border text-left transition-all flex items-center gap-3 ${
                      active
                        ? "border-accent bg-accent/15 ring-1 ring-accent"
                        : "border-border bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        active ? "bg-accent text-[#1F1F1F]" : "bg-muted text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-black text-foreground">{opt.title}</p>
                      <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        active ? "bg-accent border-accent text-[#1F1F1F]" : "border-border"
                      }`}
                    >
                      {active && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Input Nominal & Jadwal sesuai Siklus */}
            {allowanceCycle !== "flexible" ? (
              <div className="space-y-4 pt-1 bg-background border border-border rounded-xl p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {allowanceCycle === "weekly" ? "Nominal Bekal per Minggu" : "Nominal Kiriman per Bulan"}
                  </label>
                  <div className="relative flex items-center bg-card border border-border rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent">
                    <span className="text-sm font-black text-muted-foreground mr-2">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumInput(allowance)}
                      onChange={(e) => setAllowance(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder={allowanceCycle === "weekly" ? "350.000" : "1.500.000"}
                      className="w-full bg-transparent text-foreground text-base sm:text-lg font-black focus:outline-none"
                    />
                  </div>
                </div>

                {allowanceCycle === "monthly" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">
                      Tanggal Kiriman (1 - 31)
                    </label>
                    <select
                      value={payday}
                      onChange={(e) => setPayday(e.target.value)}
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-card border border-border text-foreground text-base sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Tanggal {d} setiap bulan
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">
                      Hari Kiriman / Reset Mingguan
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                        const selected = parseInt(paydayWeekday, 10) === dayIdx;
                        return (
                          <button
                            key={dayIdx}
                            type="button"
                            onClick={() => setPaydayWeekday(String(dayIdx))}
                            className={`py-2 min-h-[40px] rounded-lg text-[11px] font-bold border transition-all ${
                              selected
                                ? "bg-accent text-[#1F1F1F] border-accent font-black"
                                : "bg-card text-muted-foreground border-border hover:text-foreground"
                            }`}
                          >
                            {INDONESIAN_DAYS[dayIdx].slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 bg-background border border-border rounded-xl text-xs text-muted-foreground flex items-start gap-2.5">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>
                  Bagus! Di langkah berikutnya kamu tinggal isi saldo uang yang kamu pegang sekarang, tidak perlu jadwal gajian tetap.
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-3.5 min-h-[48px] border border-border rounded-pill text-foreground text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-3.5 min-h-[48px] bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Saldo yang Dipegang Sekarang & Gaya Menyisihkan (termasuk Tidak Menyisihkan) */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                Uangmu Sekarang &amp; Target Sisihan
              </h2>
              <p className="text-xs text-muted-foreground">
                Daftar di tanggal tua atau baru dapat kiriman? Isi saldo yang ada saat ini agar hitungan langsung akurat.
              </p>
            </div>

            {/* 3A: Saldo Saat Ini */}
            <div className="space-y-2.5 bg-background border border-border rounded-xl p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">Saldo yang Dipegang Saat Ini</span>
                {allowanceCycle !== "flexible" && parsedAllowance > 0 && (
                  <button
                    type="button"
                    onClick={() => setBankBalance(String(parsedAllowance))}
                    className="text-[10px] font-black text-accent hover:underline"
                  >
                    + Isi Penuh ({formatRupiah(parsedAllowance)})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-card border border-border rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                    <Landmark className="w-3.5 h-3.5 text-foreground" />
                    <span>Rekening Bank</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs font-bold text-muted-foreground mr-1">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumInput(bankBalance)}
                      onChange={(e) => setBankBalance(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      className="w-full bg-transparent text-base sm:text-xs font-black text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                    <Smartphone className="w-3.5 h-3.5 text-foreground" />
                    <span>E-Wallet</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs font-bold text-muted-foreground mr-1">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumInput(ewalletBalance)}
                      onChange={(e) => setEwalletBalance(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      className="w-full bg-transparent text-base sm:text-xs font-black text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                    <Banknote className="w-3.5 h-3.5 text-foreground" />
                    <span>Dompet Fisik</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs font-bold text-muted-foreground mr-1">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumInput(cashBalance)}
                      onChange={(e) => setCashBalance(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      className="w-full bg-transparent text-base sm:text-xs font-black text-foreground focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Total saldo awal: <strong className="text-foreground">{formatRupiah(totalInitialBalance)}</strong> (boleh dikosongkan dan diisi nanti di menu Multi Rekening)
              </p>
            </div>

            {/* 3B: Pilihan Menyisihkan (termasuk Tidak Menyisihkan) */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <PiggyBank className="w-4 h-4 text-accent" />
                <label className="text-xs font-bold text-foreground">
                  Mau Otomatis Menyisihkan Sebelum Dihitung Harian?
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: "none" as ReservePresetKey,
                    title: "Tidak Menyisihkan",
                    desc: "Bagi rata semua saldo per hari (0%)",
                  },
                  {
                    id: "daily_5k" as ReservePresetKey,
                    title: "Sisihkan Rp 5.000/hari",
                    desc: "Ringan, aman untuk uang pas-pasan",
                  },
                  {
                    id: "daily_10k" as ReservePresetKey,
                    title: "Sisihkan Rp 10.000/hari",
                    desc: "Ideal, terkumpul ~Rp 300rb/bln",
                  },
                  {
                    id: "percent_15" as ReservePresetKey,
                    title: "Sisihkan 15% Saldo",
                    desc: "Menyesuaikan besar kecilnya saldomu",
                  },
                ].map((opt) => {
                  const active = reservePreset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReservePreset(opt.id)}
                      className={`p-3 min-h-[52px] rounded-xl border text-left transition-all flex flex-col justify-center ${
                        active
                          ? "border-accent bg-accent/15 ring-1 ring-accent"
                          : "border-border bg-background hover:bg-muted/40"
                      }`}
                    >
                      <span className="text-xs font-black text-foreground">{opt.title}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setReservePreset("custom")}
                className={`w-full p-2.5 min-h-[44px] rounded-xl border text-xs font-bold transition-all ${
                  reservePreset === "custom"
                    ? "border-accent bg-accent/15 text-foreground ring-1 ring-accent"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Atur Sendiri (Custom Nominal / Persen / Batas Tetap)
              </button>

              {reservePreset === "custom" && (
                <div className="p-3 bg-background border border-accent/50 rounded-xl space-y-2.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "daily_fixed", label: "Rp / Hari" },
                      { id: "percent", label: "% Saldo" },
                      { id: "daily_cap", label: "Maks / Hari" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setCustomReserveMode(m.id as Exclude<ReserveMode, "none">);
                          if (m.id === "percent") setCustomReserveValue("10");
                          else if (m.id === "daily_cap") setCustomReserveValue("35000");
                          else setCustomReserveValue("10000");
                        }}
                        className={`py-2 min-h-[38px] rounded-lg text-[11px] font-bold border ${
                          customReserveMode === m.id
                            ? "bg-accent text-[#1F1F1F] border-accent font-black"
                            : "bg-card text-muted-foreground border-border"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center bg-card border border-border rounded-xl px-3 py-2">
                    {customReserveMode !== "percent" && (
                      <span className="text-xs font-bold text-muted-foreground mr-1.5">Rp</span>
                    )}
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        customReserveMode === "percent"
                          ? customReserveValue
                          : formatNumInput(customReserveValue)
                      }
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        if (customReserveMode === "percent") {
                          const n = Math.min(90, parseInt(raw || "0", 10));
                          setCustomReserveValue(String(n));
                        } else {
                          setCustomReserveValue(raw);
                        }
                      }}
                      className="w-full bg-transparent text-base sm:text-sm font-black text-foreground focus:outline-none"
                    />
                    {customReserveMode === "percent" && (
                      <span className="text-xs font-bold text-muted-foreground ml-1.5">%</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3C: Live Preview Kalkulasi */}
            <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-muted-foreground">Estimasi Batas Jajan Hari Ini ({previewCalc.days} hari lagi):</span>
                <span className="text-sm font-black text-accent">{formatRupiah(previewCalc.dailyLimit)}/hari</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {resolvedReserve.mode === "none"
                  ? "Mode Tidak Menyisihkan: seluruh saldo dibagi rata sesuai sisa hari."
                  : `Dana disisihkan & diamankan: ${formatRupiah(previewCalc.reservedTotal)} dari ${formatRupiah(previewCalc.baseBalance)}.`}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 py-3.5 min-h-[48px] border border-border rounded-pill text-foreground text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 py-3.5 min-h-[48px] bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2"
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
              <Info className="w-4 h-4 text-[color:var(--accent-text)] shrink-0 mt-0.5" />
              <span>
                Kamu tidak perlu membagi jatah pos sekarang—langsung lihat <strong>Sisa Batas Hari Ini</strong> dulu, dan pengeluaran tak terduga otomatis masuk <strong>Lainnya</strong>. Tagihan wajib (Kos/WiFi/Listrik) bisa dikunci lewat Dana Terkunci.
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

            {/* Tawaran ringan Notifikasi Motivasi Harian (Default mati) */}
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background/70 border border-border cursor-pointer">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-bold text-foreground">
                  Mau dapat 1 kutipan semangat tiap pagi?
                </p>
                <p className="text-xs text-muted-foreground">
                  Opsional, maksimal 1x/hari jam 07:30 (bisa diubah kapan saja di Profil).
                </p>
              </div>
              <input
                type="checkbox"
                checked={motivationNotifEnabled}
                onChange={(e) => setMotivationNotifEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-border accent-accent shrink-0"
              />
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-1/3 py-3.5 min-h-[48px] border border-border rounded-pill text-foreground text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                disabled={loading || selectedCats.length === 0}
                onClick={handleFinish}
                className="flex-1 py-3.5 min-h-[48px] bg-accent hover:bg-accent-hover text-[#1F1F1F] font-bold rounded-pill text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
