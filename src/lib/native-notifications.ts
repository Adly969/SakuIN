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
  body: string,
  url: string = "/dashboard"
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
            extra: { url },
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
          data: { url },
        } as NotificationOptions & { data?: { url: string } });
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
        extra: { url: "/dashboard" },
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

const MOTIVATION_NOTIF_ID = 1006;

export async function scheduleNativeMotivationNotif(
  timeStr: string = "07:30",
  quoteText: string = "Menabung sedikit demi sedikit membuat akhir bulan lebih tenang."
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!(await isCapacitorNative())) return false;

  const [hhRaw, mmRaw] = timeStr.split(":");
  const hour = Math.min(23, Math.max(0, parseInt(hhRaw || "7", 10) || 7));
  const minute = Math.min(59, Math.max(0, parseInt(mmRaw || "30", 10) || 30));

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: MOTIVATION_NOTIF_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: MOTIVATION_NOTIF_ID,
          title: "SakuIN — Semangat Keuangan Hari Ini",
          body: quoteText,
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#D4FF5A",
          extra: { url: "/dashboard" },
        },
      ],
    });
    return true;
  } catch (err) {
    console.error("Gagal jadwalkan notifikasi motivasi:", err);
    return false;
  }
}

export async function cancelNativeMotivationNotif(): Promise<void> {
  if (typeof window === "undefined") return;
  if (await isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: [{ id: MOTIVATION_NOTIF_ID }] });
    } catch {}
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

export interface CategoryLimitAlertPayload {
  categoryName: string;
  spent: number;
  limit: number;
  remaining: number;
  overAmount: number;
  usagePercent: number;
  level: "ok" | "warning" | "reached" | "exceeded";
}

/**
 * Mengirim notifikasi ketika pengeluaran kategori tertentu mendekati/melewati batas bulanan
 */
export async function notifyCategoryLimitAlert(
  snapshot: CategoryLimitAlertPayload
): Promise<boolean> {
  if (typeof window === "undefined" || snapshot.level === "ok") return false;

  let title = "";
  let body = "";
  if (snapshot.level === "warning") {
    title = `⚠️ Pos ${snapshot.categoryName} Hampir Batas (${snapshot.usagePercent}%)`;
    body = `Terpakai ${formatRp(snapshot.spent)} dari batas ${formatRp(snapshot.limit)}. Sisa bulan ini: ${formatRp(snapshot.remaining)}.`;
  } else if (snapshot.level === "reached") {
    title = `🛑 Batas Kategori ${snapshot.categoryName} Tercapai!`;
    body = `Pengeluaran ${snapshot.categoryName} sudah mencapai ${formatRp(snapshot.limit)} bulan ini.`;
  } else {
    title = `🚨 Pos ${snapshot.categoryName} Over Budget!`;
    body = `Terpakai ${formatRp(snapshot.spent)} (lebih ${formatRp(snapshot.overAmount)} dari batas ${formatRp(snapshot.limit)}).`;
  }

  window.dispatchEvent(
    new CustomEvent("sakuin:smart-alert", {
      detail: {
        title,
        body,
        level: snapshot.level,
      },
    })
  );

  return sendInstantNotification(title, body, "/budgets");
}

export interface DebtDueAlertPayload {
  id: string;
  type: "payable" | "receivable";
  personName: string;
  remainingAmount: number;
  dueDate: string;
  urgency: "overdue" | "today" | "tomorrow";
}

/**
 * Mengirim pengingat jatuh tempo utang/piutang (H-1, Hari-H, atau Lewat Jatuh Tempo)
 * Deduped 1x per hari per item.
 */
export async function notifyDebtDueAlerts(dueDebts: DebtDueAlertPayload[]): Promise<void> {
  if (typeof window === "undefined" || dueDebts.length === 0) return;

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const unnotified = dueDebts.filter((d) => {
    try {
      return !localStorage.getItem(`sakuin_debt_due_${todayKey}_${d.id}`);
    } catch {
      return false;
    }
  });

  if (unnotified.length === 0) return;

  const first = unnotified[0];
  const isReceivable = first.type === "receivable";
  const prefix =
    first.urgency === "overdue"
      ? "⏰ Jatuh Tempo Terlewat!"
      : first.urgency === "today"
      ? "📅 Jatuh Tempo Hari Ini!"
      : "🔔 Pengingat Besok Jatuh Tempo";

  const title =
    unnotified.length > 1
      ? `${prefix} (${unnotified.length} catatan)`
      : `${prefix} — ${first.personName}`;

  const actionLabel = isReceivable
    ? `Piutang dari ${first.personName}`
    : `Utang ke ${first.personName}`;
  const body =
    unnotified.length > 1
      ? `${actionLabel} (${formatRp(first.remainingAmount)}) dan ${unnotified.length - 1} catatan lain perlu ditindaklanjuti.`
      : `${actionLabel} sebesar ${formatRp(first.remainingAmount)} (tenggat ${first.dueDate}).`;

  for (const item of unnotified) {
    try {
      localStorage.setItem(`sakuin_debt_due_${todayKey}_${item.id}`, "1");
    } catch {}
  }

  window.dispatchEvent(
    new CustomEvent("sakuin:smart-alert", {
      detail: {
        title,
        body,
        level: first.urgency === "overdue" ? "exceeded" : "warning",
      },
    })
  );

  await sendInstantNotification(title, body);
}

/**
 * Mengirim notifikasi pengingat hari kiriman (1x per hari kiriman)
 */
export async function notifyPaydayReminder(payday: {
  dateKey: string;
  suggestedAmount: number;
  cycle: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const storageKey = `sakuin_payday_notif_${payday.dateKey}`;
  try {
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, "1");
  } catch {
    return;
  }

  const title = "💸 Hari Ini Jadwal Kiriman Masuk!";
  const body = `Jadwal ${payday.cycle === "weekly" ? "mingguan" : "bulanan"} (${formatRp(payday.suggestedAmount)}) sudah tiba. Konfirmasi catat masuk di Beranda!`;

  await sendInstantNotification(title, body, "/dashboard");
}

/**
 * Mengirim notifikasi motivasi kontekstual (maks 1x per hari, mengikuti toggle motivasi).
 * Dipicu saat batas harian menipis atau streak hemat di bawah batas tercapai.
 */
export async function notifyContextualMotivation(params: {
  remainingPercent?: number;
  todayRemaining?: number;
  streakDays?: number;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("sakuin_motivation_notif_enabled") !== "true") {
      return false;
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const storageKey = `sakuin_contextual_motivation_${todayKey}`;
    if (localStorage.getItem(storageKey)) return false;

    let title = "";
    let body = "";

    if (params.streakDays && params.streakDays >= 3) {
      title = `🔥 ${params.streakDays} Hari Berturut-turut Aman!`;
      body = `Mantap! Kamu berhasil menjaga pengeluaran di bawah batas harian selama ${params.streakDays} hari beruntun.`;
    } else if (
      params.remainingPercent !== undefined &&
      params.remainingPercent > 0 &&
      params.remainingPercent <= 25 &&
      (params.todayRemaining ?? 0) > 0
    ) {
      title = "💡 Jaga Ritme Hari Ini";
      body = `Sisa batas harianmu tinggal ${formatRp(params.todayRemaining ?? 0)}. Tahan jajan impulsif biar besok tetap lega!`;
    } else {
      return false;
    }

    localStorage.setItem(storageKey, "1");
    return await sendInstantNotification(title, body, "/dashboard");
  } catch {
    return false;
  }
}
