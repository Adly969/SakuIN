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

export async function scheduleNativeDailyReminder(
  hour: number,
  minute: number,
  userName: string = "Kawan"
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (await isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");

      // Batalkan alarm pengingat sebelumnya (ID 1001)
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });

      // Daftarkan alarm harian baru langsung ke sistem operasi Android
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1001,
            title: "SakuIN — Waktunya Catat Keuangan!",
            body: `Halo ${userName}! Sudah mencatat pengeluaran hari ini? Yuk luangkan 10 detik agar batas harianmu tetap aman!`,
            schedule: {
              on: {
                hour,
                minute,
              },
              repeats: true,
              allowWhileIdle: true, // Pastikan berbunyi meski HP terkunci / mode Doze hemat baterai!
            },
            sound: undefined,
            smallIcon: "ic_stat_icon_config_sample",
            iconColor: "#D4FF5A",
          },
        ],
      });

      console.log(`[Native Notification] Alarm berhasil didaftarkan untuk jam ${hour}:${minute}`);
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
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
      console.log("[Native Notification] Alarm harian dibatalkan");
    } catch (err) {
      console.error("Gagal membatalkan native notification:", err);
    }
  }
}
