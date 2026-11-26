import React from "react";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileBottomBar } from "@/components/layout/mobile-bottom-bar";
import { TopHeader } from "@/components/layout/top-header";
import { PinLockProvider } from "@/components/auth/pin-lock-provider";
import { OfflineSyncProvider } from "@/components/pwa/offline-sync-provider";
import { PwaInstaller } from "@/components/pwa/pwa-installer";
import { ReminderScheduler } from "@/components/pwa/reminder-scheduler";
import { DataPrefetcher } from "@/components/layout/data-prefetcher";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PinLockProvider>
      <OfflineSyncProvider>
        <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
          {/* Desktop / Tablet Sidebar (>= 768px) */}
          <DesktopSidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header (< 768px) */}
            <TopHeader />

            {/* Content Container (max ~1100px, centered) */}
            <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 pt-2.5 pb-28 sm:p-6 lg:p-8 md:pb-8">
              {children}
            </main>

            {/* Mobile Bottom Navigation Bar (< 768px) */}
            <MobileBottomBar />
          </div>
        </div>

        {/* PWA Install Prompt Banner */}
        <PwaInstaller />

        {/* Background Reminder Scheduler */}
        <ReminderScheduler />

        {/* Global Background Data Prefetcher for Instant Tab Switching */}
        <DataPrefetcher />
      </OfflineSyncProvider>
    </PinLockProvider>
  );
}
