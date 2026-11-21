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
