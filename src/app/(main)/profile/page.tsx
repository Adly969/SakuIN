"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import {
  getProfileAction,
  updateProfileAction,
} from "@/app/actions/profile";
import { setupPinAction, disablePinAction } from "@/app/actions/pin";
import { saveLocalPinVerifierSync, clearLocalPinVerifier } from "@/lib/pin-cache";
import { usePinLock } from "@/components/auth/pin-lock-provider";
import {
  scheduleNativeDailyReminder,
  cancelNativeDailyReminder,
  scheduleNativeMotivationNotif,
  cancelNativeMotivationNotif,
  requestNotificationPermission,
  sendInstantNotification,
  isCapacitorNative,
  REMINDER_SCHEDULE_SLOTS,
} from "@/lib/native-notifications";
import { getRandomOfflineQuote } from "@/lib/offline-quotes";
import {
  LogOut,
  Wallet,
  HandCoins,
  Target,
  ArrowRight,
  Calendar,
  Edit3,
  X,
  Check,
  CheckCircle2,
  User,
  ShieldCheck,
  Lock,
  KeyRound,
  Trash2,
  Bell,
  Clock,
  Sparkles,
  Download,
  Smartphone,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { INDONESIAN_DAYS, type AllowanceCycle, type ReserveMode } from "@/lib/finance";
import { motion, AnimatePresence } from "framer-motion";

interface StudentProfile {
  name: string;
  email: string;
  allowance: number;
  payday: number;
  allowanceCycle: AllowanceCycle;
  paydayWeekday: number;
  reserveMode: ReserveMode;
  reserveValue: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { pinEnabled, lockNow, refreshPinStatus } = usePinLock();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showMotivation, setShowMotivation] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [motivationNotifEnabled, setMotivationNotifEnabled] = useState(false);
  const [motivationNotifTime, setMotivationNotifTime] = useState("07:30");
  const [isLoading, setIsLoading] = useState(true);

  // Edit Profile Allowance Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAllowance, setEditAllowance] = useState("");
  const [editPayday, setEditPayday] = useState(1);
  const [editCycle, setEditCycle] = useState<AllowanceCycle>("monthly");
  const [editWeekday, setEditWeekday] = useState(1);
  const [editReserveMode, setEditReserveMode] = useState<ReserveMode>("none");
  const [editReserveValue, setEditReserveValue] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // PIN Setup Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinStep, setPinStep] = useState<"input" | "confirm">("input");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);

  const loadProfileData = async () => {
    setIsLoading(true);
    try {
      const res = await getProfileAction();
      if (res.success && res.data) {
        setProfile({
          name: res.data.name,
          email: res.data.email,
          allowance: res.data.monthlyAllowance,
          payday: res.data.paydayDay,
          allowanceCycle: res.data.allowanceCycle || "monthly",
          paydayWeekday: res.data.paydayWeekday ?? 1,
          reserveMode: res.data.reserveMode || "none",
          reserveValue: res.data.reserveValue ?? 0,
        });
        setShowMotivation(res.data.showMotivation);
        setReminderEnabled(res.data.reminderEnabled);
        setReminderTime(res.data.reminderTime || "20:00");
        setMotivationNotifEnabled(res.data.motivationNotifEnabled ?? false);
        setMotivationNotifTime(res.data.motivationNotifTime || "07:30");
        setEditName(res.data.name);
        setEditAllowance(res.data.monthlyAllowance.toString());
        setEditPayday(res.data.paydayDay);
        setEditCycle(res.data.allowanceCycle || "monthly");
        setEditWeekday(res.data.paydayWeekday ?? 1);
        setEditReserveMode(res.data.reserveMode || "none");
        setEditReserveValue(String(res.data.reserveValue ?? 0));
      } else {
        router.push("/login");
      }
    } catch (err) {
      console.error("Gagal memuat profil:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const handleOpenEdit = () => {
    if (profile) {
      setEditName(profile.name);
      setEditAllowance(profile.allowance.toString());
      setEditPayday(profile.payday);
      setEditCycle(profile.allowanceCycle);
      setEditWeekday(profile.paydayWeekday);
      setEditReserveMode(profile.reserveMode);
      setEditReserveValue(String(profile.reserveValue));
    }
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || isSaving) return;

    setIsSaving(true);
    const allowanceNum = parseInt(editAllowance.replace(/[^0-9]/g, "") || "0", 10);
    const paydayNum = Math.min(31, Math.max(1, editPayday));
    const reserveValNum =
      editReserveMode === "none"
        ? 0
        : editReserveMode === "percent"
        ? Math.min(90, Math.max(0, parseInt(editReserveValue.replace(/[^0-9]/g, "") || "0", 10)))
        : parseInt(editReserveValue.replace(/[^0-9]/g, "") || "0", 10);

    try {
      const res = await updateProfileAction({
        name: editName.trim(),
        monthlyAllowance: allowanceNum,
        paydayDay: paydayNum,
        allowanceCycle: editCycle,
        paydayWeekday: editWeekday,
        reserveMode: editReserveMode,
        reserveValue: reserveValNum,
        showMotivation,
      });

      if (res.success) {
        setProfile({
          name: editName.trim(),
          email: profile?.email || "",
          allowance: allowanceNum,
          payday: paydayNum,
          allowanceCycle: editCycle,
          paydayWeekday: editWeekday,
          reserveMode: editReserveMode,
          reserveValue: reserveValNum,
        });
        setIsEditModalOpen(false);
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
        setToastMessage("Pengaturan profil berhasil diperbarui!");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        alert(res.error || "Gagal memperbarui profil");
      }
    } catch (err) {
      console.error("Gagal simpan profil:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMotivation = async () => {
    const nextVal = !showMotivation;
    setShowMotivation(nextVal);
    if (!profile) return;

    try {
      await updateProfileAction({
        name: profile.name,
        monthlyAllowance: profile.allowance,
        paydayDay: profile.payday,
        showMotivation: nextVal,
        reminderEnabled,
        reminderTime,
      });
    } catch (err) {
      console.error("Gagal update preferensi motivasi:", err);
    }
  };

  const handleToggleReminder = async () => {
    const nextVal = !reminderEnabled;
    setReminderEnabled(nextVal);
    localStorage.setItem("sakuin_reminder_enabled", String(nextVal));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("sakuin:reminder-updated"));
    }
    if (!profile) return;

    if (nextVal) {
      await requestNotificationPermission();
      await scheduleNativeDailyReminder(profile.name || "Kawan");
    } else {
      await cancelNativeDailyReminder();
    }

    try {
      await updateProfileAction({
        name: profile.name,
        monthlyAllowance: profile.allowance,
        paydayDay: profile.payday,
        showMotivation,
        reminderEnabled: nextVal,
        reminderTime: "09:00",
      });
      setToastMessage(nextVal ? "Pengingat harian aktif!" : "Pengingat dinonaktifkan");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Gagal update pengingat:", err);
    }
  };

  const handleToggleMotivationNotif = async () => {
    const nextVal = !motivationNotifEnabled;
    setMotivationNotifEnabled(nextVal);
    localStorage.setItem("sakuin_motivation_notif_enabled", String(nextVal));
    localStorage.setItem("sakuin_motivation_notif_time", motivationNotifTime);
    window.dispatchEvent(new Event("sakuin:reminder-updated"));
    if (!profile) return;

    if (nextVal) {
      await requestNotificationPermission();
      await scheduleNativeMotivationNotif(motivationNotifTime, getRandomOfflineQuote().text);
    } else {
      await cancelNativeMotivationNotif();
    }

    try {
      await updateProfileAction({
        name: profile.name,
        monthlyAllowance: profile.allowance,
        paydayDay: profile.payday,
        motivationNotifEnabled: nextVal,
        motivationNotifTime,
      });
      setToastMessage(
        nextVal
          ? `Notifikasi motivasi harian aktif (jam ${motivationNotifTime})`
          : "Notifikasi motivasi harian dimatikan"
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Gagal update notifikasi motivasi:", err);
    }
  };

  const handleChangeMotivationTime = async (nextTime: string) => {
    setMotivationNotifTime(nextTime);
    localStorage.setItem("sakuin_motivation_notif_time", nextTime);
    localStorage.removeItem("sakuin_last_motivation_notif");
    window.dispatchEvent(new Event("sakuin:reminder-updated"));
    if (!profile) return;

    if (motivationNotifEnabled) {
      await scheduleNativeMotivationNotif(nextTime, getRandomOfflineQuote().text);
    }

    try {
      await updateProfileAction({
        name: profile.name,
        monthlyAllowance: profile.allowance,
        paydayDay: profile.payday,
        motivationNotifEnabled,
        motivationNotifTime: nextTime,
      });
      setToastMessage(`Jam notifikasi motivasi diubah ke ${nextTime}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err) {
      console.error("Gagal ubah jam motivasi:", err);
    }
  };

  const handleChangeReminderTime = async (newTime: string) => {
    setReminderTime(newTime);
    localStorage.setItem("sakuin_reminder_time", newTime);
    // Hapus last fired agar waktu baru bisa langsung dites pada hari yang sama
    localStorage.removeItem("sakuin_last_reminder_fired");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("sakuin:reminder-updated"));
    }
    if (!profile) return;

    if (reminderEnabled) {
      await scheduleNativeDailyReminder(profile.name || "Kawan");
    }

    try {
      await updateProfileAction({
        name: profile.name,
        monthlyAllowance: profile.allowance,
        paydayDay: profile.payday,
        showMotivation,
        reminderEnabled,
        reminderTime: newTime,
      });
      setToastMessage(`Jam pengingat diatur ke ${newTime}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Gagal update jam pengingat:", err);
    }
  };

  const handleTestNotification = async () => {
    const isNative = await isCapacitorNative();
    const hasPermission = await requestNotificationPermission();

    if (!hasPermission) {
      alert("Izin notifikasi diblokir atau belum diaktifkan. Silakan aktifkan izin notifikasi di setelan HP atau browser kamu.");
      return;
    }

    const title = "SakuIN — Pengingat Keuangan";
    const body = `Halo ${profile?.name || "Mahasiswa"}! Sudah catat pengeluaran hari ini? Yuk cek batas harianmu!`;

    const sent = await sendInstantNotification(title, body);
    if (sent) {
      setToastMessage("Notifikasi uji coba berhasil dikirim ke perangkat!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      if (!isNative && !("Notification" in window)) {
        alert("Browser ini belum mendukung notifikasi web. Jika di iPhone, pastikan SakuIN sudah dipasang ke Layar Utama (Add to Home Screen).");
      } else {
        setToastMessage("Pengingat notifikasi siap aktif!");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    }
  };

  // Open PIN Setup Modal
  const openPinModal = () => {
    setPinStep("input");
    setPinInput("");
    setPinConfirm("");
    setPinError("");
    setIsPinModalOpen(true);
  };

  // Submit PIN Setup
  const handleNextOrSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (pinStep === "input") {
      if (!/^\d{6}$/.test(pinInput)) {
        setPinError("PIN harus terdiri dari 6 digit angka");
        return;
      }
      setPinStep("confirm");
      return;
    }

    if (pinStep === "confirm") {
      if (pinConfirm !== pinInput) {
        setPinError("Konfirmasi PIN tidak cocok dengan PIN pertama");
        return;
      }

      setIsSavingPin(true);
      try {
        const res = await setupPinAction(pinConfirm);
        if (res.success) {
          if ("userId" in res && res.userId && "pinVersion" in res && res.pinVersion) {
            saveLocalPinVerifierSync(res.userId, pinConfirm, res.pinVersion);
          }
          setIsPinModalOpen(false);
          await refreshPinStatus();
          setToastMessage("Kunci PIN 6-digit berhasil diaktifkan!");
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
        } else {
          setPinError(res.error || "Gagal menyimpan PIN");
        }
      } catch (err) {
        setPinError("Terjadi kesalahan saat menyimpan PIN");
      } finally {
        setIsSavingPin(false);
      }
    }
  };

  // Disable PIN
  const handleDisablePin = async () => {
    const ok = window.confirm("Yakin ingin menonaktifkan Kunci PIN? Aplikasi tidak akan meminta PIN lagi saat dibuka.");
    if (!ok) return;

    try {
      const res = await disablePinAction();
      if (res.success) {
        clearLocalPinVerifier();
        await refreshPinStatus();
        setToastMessage("Kunci PIN berhasil dinonaktifkan");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        alert(res.error || "Gagal menonaktifkan PIN");
      }
    } catch (err) {
      console.error("Gagal nonaktifkan PIN:", err);
    }
  };

  const handleLogout = async () => {
    clearLocalPinVerifier();
    localStorage.removeItem("sakuin_pin_active");
    sessionStorage.removeItem("sakuin_pin_session_unlocked");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const initial = profile?.name ? profile.name.charAt(0).toUpperCase() : "M";

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-2">
      {/* Header */}
      <div className="px-1">
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Profil & Pengaturan
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Kelola preferensi akun, uang kiriman, keamanan, dan tema
        </p>
      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-accent/20 border border-accent/40 text-foreground flex items-center gap-2.5 shadow-md"
          >
            <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Identity Card */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-accent/20 text-accent font-black text-xl flex items-center justify-center shrink-0 border-2 border-accent/40">
            {initial}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-foreground truncate">
              {profile?.name || "Memuat..."}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {profile?.email || "..."}
            </p>
            <span className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
              Mahasiswa SakuIN
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenEdit}
          className="p-2 rounded-lg bg-background hover:bg-muted border border-border text-foreground transition-all shrink-0"
          title="Ubah Nama & Pengaturan"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </section>

      {/* Financial Allowance & Payday Settings */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-extrabold text-foreground">
              Siklus Keuangan &amp; Target Harian
            </h3>
          </div>
          <button
            type="button"
            onClick={handleOpenEdit}
            className="text-xs font-bold text-accent hover:underline flex items-center gap-1 min-h-[36px] px-2"
          >
            <span>Ubah</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-background border border-border rounded-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/20 text-accent shrink-0">
              <Wallet className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                {profile?.allowanceCycle === "weekly"
                  ? "Bekal Mingguan"
                  : profile?.allowanceCycle === "flexible"
                  ? "Pola Pemasukan"
                  : "Uang Kiriman Bulanan"}
              </p>
              <p className="text-sm font-black text-foreground truncate">
                {!profile
                  ? "Rp ..."
                  : profile.allowanceCycle === "flexible"
                  ? "Fleksibel / Mandiri"
                  : formatRupiah(profile.allowance)}
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-background border border-border rounded-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/20 text-accent shrink-0">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                Jadwal Siklus
              </p>
              <p className="text-sm font-black text-foreground truncate">
                {profile?.allowanceCycle === "weekly"
                  ? `Setiap Hari ${INDONESIAN_DAYS[profile.paydayWeekday ?? 1]}`
                  : profile?.allowanceCycle === "flexible"
                  ? "Berbasis Saldo Saat Ini"
                  : `Setiap Tanggal ${profile?.payday ?? 1}`}
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-background border border-border rounded-lg flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
              Gaya Menyisihkan Harian
            </p>
            <p className="text-xs font-black text-foreground mt-0.5">
              {profile?.reserveMode === "daily_fixed" && profile.reserveValue > 0
                ? `Sisihkan ${formatRupiah(profile.reserveValue)} / hari sebelum dibagi`
                : profile?.reserveMode === "percent" && profile.reserveValue > 0
                ? `Sisihkan ${profile.reserveValue}% dari saldo sebelum dibagi`
                : profile?.reserveMode === "daily_cap" && profile.reserveValue > 0
                ? `Batas Harian Tetap Maks ${formatRupiah(profile.reserveValue)} / hari`
                : "Tidak Menyisihkan (Bagi Rata Penuh)"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenEdit}
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground shrink-0"
          >
            Atur
          </button>
        </div>
      </section>

      {/* Fitur Keuangan: Atur Jatah Kategori, Multi Rekening & Utang Piutang */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-3">
        <h3 className="text-sm font-extrabold text-foreground">
          Fitur Dompet &amp; Catatan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/budgets"
            className="p-3.5 min-h-[44px] bg-background hover:bg-muted/50 border border-accent/40 rounded-xl flex items-center justify-between gap-2 group transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0 border border-accent/30">
                <Target className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-foreground truncate">Atur Jatah Kategori</p>
                <p className="text-xs text-muted-foreground truncate">Bagi pos belanja sekaligus</p>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
          </Link>

          <Link
            href="/accounts"
            className="p-3.5 min-h-[44px] bg-background hover:bg-muted/50 border border-border rounded-xl flex items-center justify-between gap-2 group transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/60">
                <Wallet className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-foreground truncate">Multi Rekening</p>
                <p className="text-xs text-muted-foreground truncate">Kelola Bank &amp; E-Wallet</p>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
          </Link>

          <Link
            href="/debts"
            className="p-3.5 min-h-[44px] bg-background hover:bg-muted/50 border border-border rounded-xl flex items-center justify-between gap-2 group transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/60">
                <HandCoins className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-foreground truncate">Utang Piutang</p>
                <p className="text-xs text-muted-foreground truncate">Catat Pinjaman Teman</p>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
          </Link>
        </div>
      </section>

      {/* Keamanan & Kunci PIN (Gaya Fintech Quick Unlock) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-extrabold text-foreground">
              Keamanan Aplikasi (PIN 6-Digit)
            </h3>
          </div>

          {pinEnabled ? (
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-accent/20 text-accent">
              PIN Aktif
            </span>
          ) : (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
              Belum Aktif
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {pinEnabled
            ? "Aplikasi SakuIN terlindungi. Saat dibuka kembali, cukup masukkan 6 digit PIN tanpa perlu mengetik email & password."
            : "Buka aplikasi super cepat dalam 2 detik dengan 6 digit PIN tanpa perlu mengetik password panjang, sekaligus menjaga privasi saldomu dari teman kos."}
        </p>

        {pinEnabled ? (
          <div className="space-y-2 pt-1 border-t border-border/60">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openPinModal}
                className="py-2.5 px-3 rounded-full bg-background hover:bg-muted border border-border text-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <KeyRound className="w-3.5 h-3.5 text-accent" />
                <span>Ubah PIN</span>
              </button>

              <button
                type="button"
                onClick={lockNow}
                className="py-2.5 px-3 rounded-full bg-accent hover:brightness-110 text-[#1F1F1F] text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Kunci Sekarang</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleDisablePin}
              className="w-full py-2 px-3 text-expense hover:bg-expense/10 rounded-full text-xs font-bold transition-colors"
            >
              Nonaktifkan Kunci PIN
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPinModal}
            className="w-full py-3 bg-accent hover:brightness-110 text-[#1F1F1F] font-black rounded-full text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Lock className="w-4 h-4 stroke-[2.5]" />
            <span>Aktifkan Kunci PIN Sekarang</span>
          </button>
        )}
      </section>

      {/* Appearance & Preferences */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <h3 className="text-sm font-extrabold text-foreground">
          Tampilan & Motivasi
        </h3>

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs font-bold text-foreground">Mode Tampilan</p>
            <p className="text-xs text-muted-foreground">
              Gelap, Terang, atau Ikuti Sistem
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between py-1 border-t border-border/60 pt-3">
          <div>
            <p className="text-xs font-bold text-foreground">Kartu Motivasi Harian</p>
            <p className="text-xs text-muted-foreground">
              Tampilkan pesan motivasi keuangan di beranda
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleMotivation}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              showMotivation ? "bg-accent" : "bg-muted"
            }`}
          >
            <div
              className={`bg-[#1F1F1F] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                showMotivation ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-1 border-t border-border/60 pt-3">
          <div>
            <p className="text-xs font-bold text-foreground">Animasi Splash Screen</p>
            <p className="text-xs text-muted-foreground">
              Putar ulang animasi pembuka saat membuka aplikasi
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("sakuin_splash_played");
              window.location.reload();
            }}
            className="px-3 py-1.5 rounded-lg bg-background hover:bg-muted border border-border text-foreground text-xs font-bold transition-all"
          >
            Putar Ulang
          </button>
        </div>
      </section>

      {/* Pengingat Harian (Notification Reminder - PRD N1 & R1) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/15 text-accent">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                Pengingat Catat Harian
              </h3>
              <p className="text-xs text-muted-foreground">
                Notifikasi otomatis agar tidak lupa mencatat pengeluaran
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleReminder}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              reminderEnabled ? "bg-accent" : "bg-muted"
            }`}
          >
            <div
              className={`bg-[#1F1F1F] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                reminderEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {reminderEnabled && (
          <div className="space-y-3.5 pt-3 border-t border-border/60">
            <div>
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>Jadwal Pengingat (Tiap 3 Jam)</span>
                </div>
                <span className="text-xs text-accent font-black bg-accent/15 px-2 py-0.5 rounded-full">
                  5 Kali Sehari
                </span>
              </div>

              {/* Grid 5 Slot Jam */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {REMINDER_SCHEDULE_SLOTS.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-2 rounded-lg bg-background/70 border border-border/70 flex items-center justify-between"
                  >
                    <div>
                      <span className="block text-xs font-black text-foreground">
                        {slot.label}
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">
                        {slot.period}
                      </span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Banner Mode Tenang Jam Istirahat */}
            <div className="p-3 rounded-lg bg-background/40 border border-border/50 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
              <span className="text-sm">🌙</span>
              <div>
                <strong className="text-foreground font-semibold">Mode Hening Istirahat:</strong> Jam 00:00 (tengah malam), 03:00, dan 06:00 pagi otomatis tanpa notifikasi agar tidur dan waktu istirahatmu tidak terganggu.
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestNotification}
              className="w-full py-2.5 px-3 rounded-lg border border-border hover:bg-muted text-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98"
            >
              <Bell className="w-3.5 h-3.5 text-accent" />
              <span>Uji Coba Notifikasi Sekarang</span>
            </button>
          </div>
        )}
      </section>

      {/* Notifikasi Motivasi Harian Terpisah (PRD UI/UX Tahap 2 - Maks 1x/hari) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-accent/15 text-accent shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-foreground">
                Notifikasi Motivasi Harian
              </h3>
              <p className="text-xs text-muted-foreground">
                Terpisah dari pengingat penting • Maksimal 1x sehari di jam pilihanmu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleMotivationNotif}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
              motivationNotifEnabled ? "bg-accent" : "bg-muted"
            }`}
          >
            <div
              className={`bg-[#1F1F1F] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                motivationNotifEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {motivationNotifEnabled && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Jam Kirim (1x / Hari)</span>
            </label>
            <input
              type="time"
              value={motivationNotifTime}
              onChange={(e) => handleChangeMotivationTime(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}
      </section>

      {/* Unduh Aplikasi SakuIN (PRD Minggu 7) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent/15 text-accent">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                Unduh Aplikasi SakuIN
              </h3>
              <p className="text-xs text-muted-foreground">
                Pasang APK Android resmi (~2.5 MB) atau gunakan PWA di iPhone
              </p>
            </div>
          </div>
          <Link
            href="/download"
            className="px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-black hover:brightness-105 transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Unduh</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Ekspor Data CSV (PRD P2 & Section 11) */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-accent/15 text-accent">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground">
              Ekspor Data Keuangan (CSV)
            </h3>
            <p className="text-xs text-muted-foreground">
              Unduh rekap transaksi untuk Microsoft Excel atau Google Sheets
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Berkas CSV menyertakan tanggal, waktu, kategori, keterangan/catatan, tipe, dan nominal Rupiah lengkap dengan encoding UTF-8 standar Excel.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/60">
          <a
            href={`/api/export/transactions?month=${new Date().toISOString().slice(0, 7)}`}
            download
            className="py-2.5 px-3 rounded-full bg-background hover:bg-muted border border-border text-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 text-center"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Ekspor Bulan Ini</span>
          </a>

          <a
            href="/api/export/transactions"
            download
            className="py-2.5 px-3 rounded-full bg-accent hover:brightness-110 text-[#1F1F1F] text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 text-center shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Semua Riwayat</span>
          </a>
        </div>
      </section>

      {/* Logout */}
      <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-md">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3.5 px-4 rounded-full border border-border hover:bg-muted text-foreground text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
          <span>Keluar dari Akun</span>
        </button>
      </section>

      {/* Modal Setup PIN 6-Digit */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-accent" />
                  <h3 className="text-sm sm:text-base font-black text-foreground">
                    {pinStep === "input" ? "Buat PIN 6-Digit" : "Konfirmasi PIN 6-Digit"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleNextOrSubmitPin} className="space-y-4">
                <p className="text-xs text-muted-foreground text-center">
                  {pinStep === "input"
                    ? "Masukkan 6 digit angka rahasia yang mudah kamu ingat."
                    : "Masukkan kembali 6 digit angka untuk memastikan kecocokan."}
                </p>

                {/* Input PIN Display */}
                <div className="space-y-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    required
                    value={pinStep === "input" ? pinInput : pinConfirm}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                      if (pinStep === "input") setPinInput(val);
                      else setPinConfirm(val);
                    }}
                    placeholder="● ● ● ● ● ●"
                    className="w-full text-center tracking-[0.5em] text-2xl font-black px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  {pinError && (
                    <p className="text-xs font-bold text-expense text-center">
                      {pinError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {pinStep === "confirm" && (
                    <button
                      type="button"
                      onClick={() => {
                        setPinStep("input");
                        setPinConfirm("");
                        setPinError("");
                      }}
                      className="w-1/3 py-3 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-full transition-all"
                    >
                      Kembali
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={
                      (pinStep === "input" ? pinInput.length !== 6 : pinConfirm.length !== 6) ||
                      isSavingPin
                    }
                    className="flex-1 py-3 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#1F1F1F] font-black rounded-full text-xs shadow-md transition-all active:scale-98"
                  >
                    {isSavingPin
                      ? "Menyimpan..."
                      : pinStep === "input"
                      ? "Lanjut ke Konfirmasi"
                      : "Simpan & Aktifkan PIN"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Ubah Pengaturan Siklus & Sisihan Harian */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    Pengaturan Siklus &amp; Sisihan
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sesuaikan jadwal uang saku dan target sisihan harianmu
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-10 h-10 rounded-xl bg-background hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form id="profile-edit-form" onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Nama Panggilan
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Contoh: Dina"
                    className="w-full px-4 py-2.5 min-h-[44px] rounded-xl bg-background border border-border text-foreground text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Pilihan Siklus */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Siklus Uang Saku</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "monthly", label: "Bulanan" },
                      { id: "weekly", label: "Mingguan" },
                      { id: "flexible", label: "Fleksibel" },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setEditCycle(c.id as AllowanceCycle)}
                        className={`py-2.5 min-h-[40px] rounded-xl text-xs font-bold border transition-all ${
                          editCycle === c.id
                            ? "bg-accent text-[#1F1F1F] border-accent font-black"
                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {editCycle !== "flexible" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground">
                        {editCycle === "weekly" ? "Bekal per Minggu" : "Uang Kiriman Bulanan"}
                      </label>
                      <div className="relative flex items-center bg-background border border-border rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent">
                        <span className="text-xs font-bold text-muted-foreground mr-1.5 select-none">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            editAllowance
                              ? parseInt(editAllowance.replace(/[^0-9]/g, "") || "0", 10).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={(e) => setEditAllowance(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="Contoh: 1.500.000"
                          className="w-full bg-transparent text-base sm:text-sm font-extrabold text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                      </div>
                    </div>

                    {editCycle === "monthly" ? (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground">
                          Tanggal Kiriman Bulanan (1 - 31)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          required
                          value={editPayday}
                          onChange={(e) => setEditPayday(parseInt(e.target.value, 10) || 1)}
                          className="w-full px-4 py-2.5 min-h-[44px] rounded-xl bg-background border border-border text-foreground text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">
                          Hari Kiriman Mingguan
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setEditWeekday(d)}
                              className={`py-2 min-h-[38px] rounded-lg text-xs font-bold border ${
                                editWeekday === d
                                  ? "bg-accent text-[#1F1F1F] border-accent font-black"
                                  : "bg-background text-muted-foreground border-border"
                              }`}
                            >
                              {INDONESIAN_DAYS[d].slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Pilihan Gaya Menyisihkan Harian */}
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <label className="text-xs font-bold text-foreground block">
                    Gaya Menyisihkan Harian
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "none", label: "Tidak Menyisihkan (0%)" },
                      { id: "daily_fixed", label: "Sisihkan Rp / Hari" },
                      { id: "percent", label: "Sisihkan % Saldo" },
                      { id: "daily_cap", label: "Batas Maks / Hari" },
                    ].map((rm) => (
                      <button
                        key={rm.id}
                        type="button"
                        onClick={() => {
                          setEditReserveMode(rm.id as ReserveMode);
                          if (rm.id === "none") setEditReserveValue("0");
                          else if (rm.id === "percent" && parseInt(editReserveValue || "0", 10) > 90) setEditReserveValue("15");
                          else if (rm.id === "daily_fixed" && parseInt(editReserveValue || "0", 10) === 0) setEditReserveValue("10000");
                          else if (rm.id === "daily_cap" && parseInt(editReserveValue || "0", 10) === 0) setEditReserveValue("35000");
                        }}
                        className={`p-2.5 min-h-[42px] rounded-xl text-xs font-bold border transition-all text-left ${
                          editReserveMode === rm.id
                            ? "bg-accent/15 border-accent text-foreground ring-1 ring-accent"
                            : "bg-background border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {rm.label}
                      </button>
                    ))}
                  </div>

                  {editReserveMode !== "none" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center bg-background border border-border rounded-xl px-3.5 py-2.5">
                        {editReserveMode !== "percent" && (
                          <span className="text-xs font-bold text-muted-foreground mr-1.5">Rp</span>
                        )}
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            editReserveMode === "percent"
                              ? editReserveValue
                              : parseInt(editReserveValue.replace(/[^0-9]/g, "") || "0", 10) > 0
                              ? parseInt(editReserveValue.replace(/[^0-9]/g, "") || "0", 10).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            if (editReserveMode === "percent") {
                              setEditReserveValue(String(Math.min(90, parseInt(raw || "0", 10))));
                            } else {
                              setEditReserveValue(raw);
                            }
                          }}
                          className="w-full bg-transparent text-base sm:text-sm font-black text-foreground focus:outline-none"
                        />
                        {editReserveMode === "percent" && (
                          <span className="text-xs font-bold text-muted-foreground ml-1.5">%</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(editReserveMode === "percent"
                          ? [10, 15, 20, 30]
                          : editReserveMode === "daily_fixed"
                          ? [5000, 10000, 15000, 20000]
                          : [25000, 35000, 50000, 75000]
                        ).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setEditReserveValue(String(preset))}
                            className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-xs font-bold text-foreground hover:border-accent"
                          >
                            {editReserveMode === "percent" ? `${preset}%` : formatRupiah(preset)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </form>

              <div className="shrink-0 border-t border-border bg-card px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
                <button
                  type="submit"
                  form="profile-edit-form"
                  disabled={isSaving}
                  className="w-full py-3 min-h-[48px] bg-accent hover:brightness-110 disabled:opacity-50 text-[#1F1F1F] font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all active:scale-[0.98]"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
