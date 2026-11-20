"use client";

import { useEffect, useRef } from "react";
import { getProfileAction } from "@/app/actions/profile";

export function ReminderScheduler() {
  const reminderRef = useRef<{ enabled: boolean; time: string; name: string }>({
    enabled: false,
    time: "20:00",
    name: "Kawan",
  });

  useEffect(() => {
    // 1. Sync initial config from localStorage / Server Action
    const syncConfig = async () => {
      try {
        const fromLocalEnabled = localStorage.getItem("sakuin_reminder_enabled");
        const fromLocalTime = localStorage.getItem("sakuin_reminder_time");
        const fromLocalName = localStorage.getItem("sakuin_user_name") || "Kawan";

        if (fromLocalEnabled !== null && fromLocalTime !== null) {
          reminderRef.current = {
            enabled: fromLocalEnabled === "true",
            time: fromLocalTime,
            name: fromLocalName,
          };
        }

        const res = await getProfileAction();
        if (res.success && res.data) {
          reminderRef.current = {
            enabled: res.data.reminderEnabled ?? false,
            time: res.data.reminderTime || "20:00",
            name: res.data.name || "Kawan",
          };
          localStorage.setItem("sakuin_reminder_enabled", String(res.data.reminderEnabled));
          localStorage.setItem("sakuin_reminder_time", res.data.reminderTime || "20:00");
          localStorage.setItem("sakuin_user_name", res.data.name || "Kawan");
        }
      } catch (err) {
        console.error("Gagal sinkron konfigurasi pengingat:", err);
      }
    };

    syncConfig();

    // 2. Scheduler ticker: Periksa setiap 15 detik
    const interval = setInterval(async () => {
      const { enabled, time, name } = reminderRef.current;
      if (!enabled || !time) return;

      const now = new Date();
      const currentHH = String(now.getHours()).padStart(2, "0");
      const currentMM = String(now.getMinutes()).padStart(2, "0");
      const currentHHMM = `${currentHH}:${currentMM}`;

      const todayStr = now.toISOString().split("T")[0];
      const fireKey = `${todayStr}_${time}`;

      // Periksa apakah waktu saat ini cocok dengan jam pengingat dan belum pernah berbunyi pada jam ini hari ini
      if (currentHHMM === time) {
        const lastFired = localStorage.getItem("sakuin_last_reminder_fired");
        if (lastFired === fireKey) {
          return; // Sudah berbunyi pada jadwal hari ini
        }

        // Tandai sudah berbunyi
        localStorage.setItem("sakuin_last_reminder_fired", fireKey);

        // Kirim Notifikasi Sistem
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            try {
              if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification("SakuIN — Waktunya Catat Keuangan!", {
                  body: `Halo ${name}! Sudah catat pengeluaran hari ini? Yuk luangkan 10 detik agar anggaranmu tetap aman!`,
                  icon: "/logo-mark.png",
                  badge: "/logo-mark.png",
                  tag: "sakuin-daily-reminder",
                });
              } else {
                new Notification("SakuIN — Waktunya Catat Keuangan!", {
                  body: `Halo ${name}! Sudah catat pengeluaran hari ini? Yuk luangkan 10 detik agar anggaranmu tetap aman!`,
                  icon: "/logo-mark.png",
                });
              }
            } catch (notifErr) {
              console.error("Gagal memunculkan notifikasi terjadwal:", notifErr);
            }
          }
        }
      }
    }, 15000); // Ticker setiap 15 detik

    return () => clearInterval(interval);
  }, []);

  return null;
}
