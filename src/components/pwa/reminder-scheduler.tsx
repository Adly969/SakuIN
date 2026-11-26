"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { getProfileAction } from "@/app/actions/profile";
import { getDashboardDataAction } from "@/app/actions/dashboard";
import { getUpcomingDueDebtsAction } from "@/app/actions/debts";
import {
  isCapacitorNative,
  scheduleNativeDailyReminder,
  cancelNativeDailyReminder,
  scheduleNativeMotivationNotif,
  cancelNativeMotivationNotif,
  notifyDailyLimitAlert,
  notifyDebtDueAlerts,
  notifyPaydayReminder,
  notifyContextualMotivation,
  REMINDER_SCHEDULE_SLOTS,
  type DailyLimitAlertPayload,
} from "@/lib/native-notifications";
import { getRandomOfflineQuote } from "@/lib/offline-quotes";

export function ReminderScheduler() {
  const router = useRouter();
  const isCheckingRef = useRef(false);
  const [inAppAlert, setInAppAlert] = useState<{
    title: string;
    body: string;
    level: DailyLimitAlertPayload["level"];
  } | null>(null);

  useEffect(() => {
    const checkDailyLimitOnWake = async () => {
      try {
        const [dash, dueDebtsRes] = await Promise.all([
          getDashboardDataAction(),
          getUpcomingDueDebtsAction(),
        ]);

        if (dash.success && dash.data) {
          if (dash.data.todayAlertLevel && dash.data.todayAlertLevel !== "ok") {
            await notifyDailyLimitAlert(
              {
                todayBudget: dash.data.todayBudget ?? dash.data.dailyLimit,
                todayExpense: dash.data.todayExpense ?? 0,
                todayRemaining: dash.data.todayRemaining ?? 0,
                overLimitAmount: dash.data.overLimitAmount ?? 0,
                usagePercent: dash.data.todayUsagePercent ?? 0,
                level: dash.data.todayAlertLevel,
              },
              false
            );
          }

          if (dash.data.paydayPrompt) {
            await notifyPaydayReminder(dash.data.paydayPrompt);
          }

          if (dash.data.todayAlertLevel === "warning") {
            await notifyContextualMotivation({
              remainingPercent: Math.max(0, 100 - (dash.data.todayUsagePercent ?? 0)),
              todayRemaining: dash.data.todayRemaining ?? 0,
            });
          }
        }

        if (dueDebtsRes.success && dueDebtsRes.data && dueDebtsRes.data.length > 0) {
          await notifyDebtDueAlerts(dueDebtsRes.data);
        }
      } catch {}
    };

    // 1. Sinkronisasi preferensi pengingat dari server ke localStorage jika belum ada
    const syncFromServer = async () => {
      try {
        const res = await getProfileAction();
        if (res.success && res.data) {
          if (res.data.reminderEnabled !== undefined) {
            localStorage.setItem("sakuin_reminder_enabled", String(res.data.reminderEnabled));
          }
          if (res.data.motivationNotifEnabled !== undefined) {
            localStorage.setItem(
              "sakuin_motivation_notif_enabled",
              String(res.data.motivationNotifEnabled)
            );
          }
          if (res.data.motivationNotifTime) {
            localStorage.setItem("sakuin_motivation_notif_time", res.data.motivationNotifTime);
          }
          if (res.data.name) {
            localStorage.setItem("sakuin_user_name", res.data.name);
          }

          // Daftarkan ke alarm Android Native jika aktif
          if (res.data.reminderEnabled) {
            await scheduleNativeDailyReminder(res.data.name || "Kawan");
          } else {
            await cancelNativeDailyReminder();
          }

          if (res.data.motivationNotifEnabled) {
            await scheduleNativeMotivationNotif(
              res.data.motivationNotifTime || "07:30",
              getRandomOfflineQuote().text
            );
          } else {
            await cancelNativeMotivationNotif();
          }
        }
      } catch (err) {
        console.error("Gagal sinkron data pengingat dari server:", err);
      }
    };

    // Jalankan sync server & cek batas harian di background
    syncFromServer();
    checkDailyLimitOnWake();

    let nativeTapListener: { remove: () => Promise<void> } | null = null;
    isCapacitorNative().then(async (native) => {
      if (!native) return;
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        nativeTapListener = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (action) => {
            const targetUrl =
              (action?.notification?.extra?.url as string | undefined) || "/dashboard";
            router.push(targetUrl);
          }
        );
      } catch {}
    });

    const handleSmartAlertEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        title: string;
        body: string;
        level?: DailyLimitAlertPayload["level"];
        snapshot?: DailyLimitAlertPayload;
      };
      if (detail?.title && detail?.body) {
        setInAppAlert({
          title: detail.title,
          body: detail.body,
          level: detail.level || detail.snapshot?.level || "warning",
        });
      }
    };
    window.addEventListener("sakuin:daily-limit-alert", handleSmartAlertEvent);
    window.addEventListener("sakuin:smart-alert", handleSmartAlertEvent);

    // 2. Fungsi pemicu notifikasi
    const fireNotification = async (title: string, body: string) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            icon: "/app-icon.png",
            badge: "/app-icon.png",
            tag: "sakuin-daily-reminder",
            data: { url: "/dashboard" },
          } as NotificationOptions & { data?: { url: string } });
        } else {
          new Notification(title, {
            body,
            icon: "/app-icon.png",
          });
        }
      } catch (err) {
        console.error("Gagal mengirim notifikasi:", err);
      }
    };

    // 3. Evaluator pengingat real-time untuk 5 slot (09:00, 12:00, 15:00, 18:00, 21:00)
    const checkReminder = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const enabled = localStorage.getItem("sakuin_reminder_enabled") === "true";
        const motivationEnabled =
          localStorage.getItem("sakuin_motivation_notif_enabled") === "true";
        const motivationTime =
          localStorage.getItem("sakuin_motivation_notif_time") || "07:30";
        const userName = localStorage.getItem("sakuin_user_name") || "Kawan";

        const now = new Date();
        const nowH = now.getHours();
        const nowM = now.getMinutes();
        const nowTotalMins = nowH * 60 + nowM;
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        // A. Notifikasi Motivasi Harian Terpisah (maks 1x sehari pada jam pilihan user)
        if (motivationEnabled) {
          const [mhRaw, mmRaw] = motivationTime.split(":");
          const motMins =
            (parseInt(mhRaw || "7", 10) || 7) * 60 + (parseInt(mmRaw || "30", 10) || 30);
          const motDiff = nowTotalMins - motMins;
          const motFireKey = `${todayStr}_motivation`;
          if (
            motDiff >= 0 &&
            motDiff <= 60 &&
            localStorage.getItem("sakuin_last_motivation_notif") !== motFireKey
          ) {
            localStorage.setItem("sakuin_last_motivation_notif", motFireKey);
            await fireNotification(
              "SakuIN — Semangat Keuangan Hari Ini",
              getRandomOfflineQuote().text
            );
          }
        }

        if (!enabled) return;

        for (const slot of REMINDER_SCHEDULE_SLOTS) {
          const targetTotalMins = slot.hour * 60 + slot.minute;
          const diffMins = nowTotalMins - targetTotalMins;

          // Picu jika waktu telah tiba (toleransi 45 menit saat layar dibuka)
          if (diffMins >= 0 && diffMins <= 45) {
            const fireKey = `${todayStr}_slot_${slot.id}`;
            const lastFired = localStorage.getItem(`sakuin_last_reminder_${slot.id}`);
            if (lastFired === fireKey) continue;

            localStorage.setItem(`sakuin_last_reminder_${slot.id}`, fireKey);
            await fireNotification(slot.title, slot.body(userName));
          }
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Evaluasi pertama kali saat mount
    checkReminder();

    // 4. Periksa berkala setiap 10 detik (saat app aktif)
    const interval = setInterval(checkReminder, 10000);

    // 5. Tangkap event ketika HP dibuka/layar dinyalakan (visibilitychange, focus, pageshow)
    const handleWakeup = () => {
      checkReminder();
      checkDailyLimitOnWake();
    };

    const handleReminderUpdated = () => {
      checkReminder();
    };

    document.addEventListener("visibilitychange", handleWakeup);
    window.addEventListener("focus", handleWakeup);
    window.addEventListener("pageshow", handleWakeup);
    window.addEventListener("sakuin:reminder-updated", handleReminderUpdated);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleWakeup);
      window.removeEventListener("focus", handleWakeup);
      window.removeEventListener("pageshow", handleWakeup);
      window.removeEventListener("sakuin:reminder-updated", handleReminderUpdated);
      window.removeEventListener("sakuin:daily-limit-alert", handleSmartAlertEvent);
      window.removeEventListener("sakuin:smart-alert", handleSmartAlertEvent);
      if (nativeTapListener) {
        void nativeTapListener.remove();
      }
    };
  }, [router]);

  if (!inAppAlert) return null;

  const isSevere = inAppAlert.level === "reached" || inAppAlert.level === "exceeded";

  return (
    <div className="fixed top-4 left-4 right-4 max-w-md mx-auto z-[130] pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        className={`rounded-2xl p-3.5 shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
          isSevere
            ? "bg-card/95 border-expense/50 text-foreground"
            : "bg-card/95 border-[#FFB04A]/50 text-foreground"
        }`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isSevere ? "bg-expense/15 text-expense" : "bg-[#FFB04A]/20 text-[#FFB04A]"
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-foreground">{inAppAlert.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{inAppAlert.body}</p>
        </div>
        <button
          type="button"
          onClick={() => setInAppAlert(null)}
          aria-label="Tutup pengingat batas harian"
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
