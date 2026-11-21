"use client";

import { useEffect, useRef } from "react";
import { getProfileAction } from "@/app/actions/profile";
import {
  scheduleNativeDailyReminder,
  cancelNativeDailyReminder,
  REMINDER_SCHEDULE_SLOTS,
} from "@/lib/native-notifications";

export function ReminderScheduler() {
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // 1. Sinkronisasi preferensi pengingat dari server ke localStorage jika belum ada
    const syncFromServer = async () => {
      try {
        const res = await getProfileAction();
        if (res.success && res.data) {
          if (res.data.reminderEnabled !== undefined) {
            localStorage.setItem("sakuin_reminder_enabled", String(res.data.reminderEnabled));
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
        }
      } catch (err) {
        console.error("Gagal sinkron data pengingat dari server:", err);
      }
    };

    // Jalankan sync server di background
    syncFromServer();

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
            data: { url: "/record" },
          } as any);
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
        const userName = localStorage.getItem("sakuin_user_name") || "Kawan";

        if (!enabled) return;

        const now = new Date();
        const nowH = now.getHours();
        const nowM = now.getMinutes();
        const nowTotalMins = nowH * 60 + nowM;
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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
    };
  }, []);

  return null;
}
