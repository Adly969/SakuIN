"use client";

import { useEffect, useRef } from "react";
import { getProfileAction } from "@/app/actions/profile";
import { scheduleNativeDailyReminder } from "@/lib/native-notifications";

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
          if (res.data.reminderTime) {
            localStorage.setItem("sakuin_reminder_time", res.data.reminderTime);
          }
          if (res.data.name) {
            localStorage.setItem("sakuin_user_name", res.data.name);
          }

          // Daftarkan ke alarm Android Native jika aktif
          if (res.data.reminderEnabled && res.data.reminderTime) {
            const [h, m] = res.data.reminderTime.split(":").map(Number);
            if (!isNaN(h) && !isNaN(m)) {
              await scheduleNativeDailyReminder(h, m, res.data.name || "Kawan");
            }
          }
        }
      } catch (err) {
        console.error("Gagal sinkron data pengingat dari server:", err);
      }
    };

    // Jalankan sync server di background
    syncFromServer();

    // 2. Fungsi pemicu notifikasi
    const fireNotification = async (userName: string) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      const title = "SakuIN — Waktunya Catat Keuangan!";
      const body = `Halo ${userName}! Sudah mencatat pengeluaran hari ini? Yuk luangkan 10 detik agar batas harianmu tetap aman!`;

      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            icon: "/logo-mark.png",
            badge: "/logo-mark.png",
            tag: "sakuin-daily-reminder",
            data: { url: "/record" },
          } as any);
        } else {
          new Notification(title, {
            body,
            icon: "/logo-mark.png",
          });
        }
      } catch (err) {
        console.error("Gagal mengirim notifikasi:", err);
      }
    };

    // 3. Evaluator pengingat real-time
    const checkReminder = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const enabled = localStorage.getItem("sakuin_reminder_enabled") === "true";
        const time = localStorage.getItem("sakuin_reminder_time") || "20:00";
        const userName = localStorage.getItem("sakuin_user_name") || "Kawan";

        if (!enabled || !time) return;

        const now = new Date();
        const nowH = now.getHours();
        const nowM = now.getMinutes();
        const nowTotalMins = nowH * 60 + nowM;

        const parts = time.split(":");
        const targetH = parseInt(parts[0], 10);
        const targetM = parseInt(parts[1], 10);

        if (isNaN(targetH) || isNaN(targetM)) return;
        const targetTotalMins = targetH * 60 + targetM;

        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const fireKey = `${todayStr}_${time}`;

        // Selisih menit dari waktu target
        const diffMins = nowTotalMins - targetTotalMins;

        // Picu jika:
        // a. Waktu target sudah tiba hari ini (diffMins >= 0)
        // b. Masih dalam rentang 45 menit (toleransi HP terkunci / sleep mode lalu dibuka)
        // c. Belum pernah dibunyikan untuk target waktu hari ini
        if (diffMins >= 0 && diffMins <= 45) {
          const lastFired = localStorage.getItem("sakuin_last_reminder_fired");
          if (lastFired === fireKey) return;

          localStorage.setItem("sakuin_last_reminder_fired", fireKey);
          await fireNotification(userName);
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
