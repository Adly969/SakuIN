/**
 * SakuIN Native & Web Notification Engine
 * Sesuai PRD Minggu 6 & 7 (Android Local Notifications via AlarmManager)
 */

export async function isCapacitorNative(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Jika di Android Native (APK)
  if (await isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.requestPermissions();
      return perm.display === "granted";
    } catch (e) {
      console.warn("Gagal request native permission:", e);
      return false;
    }
  }

  // 2. Jika di Web / PWA
  if ("Notification" in window) {
    if (Notification.permission === "granted") return true;
    const res = await Notification.requestPermission();
    return res === "granted";
  }

  return false;
}

export async function sendInstantNotification(
  title: string,
  body: string
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Jika di Android Native (APK)
  if (await isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 10000) + 2000,
            title,
            body,
            schedule: { at: new Date(Date.now() + 500) },
            smallIcon: "ic_stat_icon_config_sample",
            iconColor: "#D4FF5A",
          },
        ],
      });
      return true;
    } catch (e) {
      console.warn("Gagal kirim native instant notification:", e);
    }
  }

  // 2. Jika di Web / PWA
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: "/app-icon.png",
          badge: "/app-icon.png",
        });
        return true;
      } else {
        new Notification(title, {
          body,
          icon: "/app-icon.png",
        });
        return true;
      }
    } catch (e) {
      console.warn("Gagal showNotification di PWA:", e);
    }
  }

  return false;
}

export const REMINDER_SCHEDULE_SLOTS = [
  {
    id: 1001,
    hour: 9,
    minute: 0,
    label: "09:00",
    period: "Pagi",
    title: "SakuIN — Semangat Pagi!",
    body: (name: string) => `Halo ${name}! Semangat beraktivitas hari ini. Jangan lupa catat sarapan atau transport ya!`,
  },
  {
    id: 1002,
    hour: 12,
    minute: 0,
    label: "12:00",
    period: "Siang",
    title: "SakuIN — Waktunya Makan Siang!",
    body: (name: string) => `Halo ${name}! Sudah makan siang? Yuk luangkan 10 detik catat pengeluaran makan siangmu.`,
  },
  {
    id: 1003,
    hour: 15,
    minute: 0,
    label: "15:00",
    period: "Sore",
    title: "SakuIN — Pengingat Sore!",
    body: (name: string) => `Sore ${name}! Beli kopi atau jajan sore? Catat sekarang agar batas harianmu tetap aman.`,
  },
  {
    id: 1004,
    hour: 18,
    minute: 0,
    label: "18:00",
    period: "Petang",
    title: "SakuIN — Catat Pengeluaran Sore!",
    body: (name: string) => `Halo ${name}! Selesai beraktivitas? Jangan lupa catat makan malam atau belanja harianmu.`,
  },
  {
    id: 1005,
    hour: 21,
    minute: 0,
    label: "21:00",
    period: "Malam",
    title: "SakuIN — Rekap Keuangan Malam!",
    body: (name: string) => `Malam ${name}! Sebelum tidur, yuk rekap pengeluaran hari ini agar keuanganmu tetap rapi dan terkontrol.`,
  },
];

export async function scheduleNativeDailyReminder(
  userName: string = "Kawan"
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (await isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");

      // Batalkan alarm pengingat sebelumnya
      await cancelNativeDailyReminder();

      // Daftarkan 5 alarm rutin harian (09:00, 12:00, 15:00, 18:00, 21:00)
      const notifications = REMINDER_SCHEDULE_SLOTS.map((slot) => ({
        id: slot.id,
        title: slot.title,
        body: slot.body(userName),
        schedule: {
          on: {
            hour: slot.hour,
            minute: slot.minute,
          },
          repeats: true,
          allowWhileIdle: true, // Berbunyi tepat waktu meski HP terkunci / mode Doze hemat baterai
        },
        sound: undefined,
        smallIcon: "ic_stat_icon_config_sample",
        iconColor: "#D4FF5A",
      }));

      await LocalNotifications.schedule({ notifications });
      console.log(`[Native Notification] 5 alarm terjadwal: 09:00, 12:00, 15:00, 18:00, 21:00`);
      return true;
    } catch (err) {
      console.error("Gagal menjadwalkan native notification:", err);
      return false;
    }
  }

  return false;
}

export async function cancelNativeDailyReminder(): Promise<void> {
  if (typeof window === "undefined") return;

  if (await isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      // Batalkan semua slot id 1001 - 1005
      await LocalNotifications.cancel({
        notifications: REMINDER_SCHEDULE_SLOTS.map((s) => ({ id: s.id })),
      });
      console.log("[Native Notification] Seluruh alarm pengingat dibatalkan");
    } catch (err) {
      console.error("Gagal membatalkan native notification:", err);
    }
  }
}

export interface DailyLimitAlertPayload {
  todayBudget: number;
  todayExpense: number;
  todayRemaining: number;
  overLimitAmount: number;
  usagePercent: number;
  level: "ok" | "warning" | "reached" | "exceeded";
}

function formatRp(amount: number): string {
  return `Rp ${Math.max(0, Math.round(amount)).toLocaleString("id-ID")}`;
}

/**
 * Mengirim notifikasi pengingat jika pemakaian harian hampir/sudah mencapai batas,
 * lengkap dengan sisa batas hari ini.
 */
export async function notifyDailyLimitAlert(
  snapshot: DailyLimitAlertPayload,
  onNewExpense: boolean = true
): Promise<{ sent: boolean; title?: string; body?: string }> {
  if (typeof window === "undefined") return { sent: false };
  if (snapshot.level === "ok") return { sent: false };

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const storageKey = `sakuin_limit_alert_${todayKey}`;

  if (!onNewExpense) {
    try {
      const prevRaw = localStorage.getItem(storageKey);
      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        if (prev.level === snapshot.level && Date.now() - prev.ts < 3 * 60 * 60 * 1000) {
          return { sent: false };
        }
      }
    } catch {}
  }

  let title = "";
  let body = "";

  if (snapshot.level === "warning") {
    title = `⚠️ Batas Harian Hampir Habis (${snapshot.usagePercent}%)`;
    body = `Terpakai ${formatRp(snapshot.todayExpense)} dari batas ${formatRp(snapshot.todayBudget)}. Sisa jatah hari ini tinggal ${formatRp(snapshot.todayRemaining)}!`;
  } else if (snapshot.level === "reached") {
    title = `🛑 Batas Harian Hari Ini Tercapai!`;
    body = `Pengeluaran hari ini sudah pas ${formatRp(snapshot.todayBudget)}. Sisa batas hari ini: Rp 0.`;
  } else {
    title = `🚨 Batas Harian Terlampaui!`;
    body = `Pengeluaran hari ini ${formatRp(snapshot.todayExpense)} (lebih ${formatRp(snapshot.overLimitAmount)} dari batas ${formatRp(snapshot.todayBudget)}). Sisa batas hari ini: Rp 0.`;
  }

  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ level: snapshot.level, ts: Date.now() })
    );
  } catch {}

  window.dispatchEvent(
    new CustomEvent("sakuin:daily-limit-alert", {
      detail: { title, body, snapshot },
    })
  );

  if ("Notification" in window && Notification.permission === "default") {
    try {
      await requestNotificationPermission();
    } catch {}
  }

  const osSent = await sendInstantNotification(title, body);
  return { sent: osSent, title, body };
}
