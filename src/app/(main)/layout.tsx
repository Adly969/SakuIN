import React from "react";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileBottomBar } from "@/components/layout/mobile-bottom-bar";
import { TopHeader } from "@/components/layout/top-header";
import { PinLockProvider } from "@/components/auth/pin-lock-provider";
import { OfflineSyncProvider } from "@/components/pwa/offline-sync-provider";
import { PwaInstaller } from "@/components/pwa/pwa-installer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PinLockProvider>
      <OfflineSyncProvider>
        <div className="min-h-screen bg-background flex flex-col lg:flex-row">
          {/* Desktop Sidebar (>= 1024px) */}
          <DesktopSidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header (< 1024px) */}
            <TopHeader />

            {/* Content Container (max ~1200px) */}
            <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
              {children}
            </main>

            {/* Mobile Bottom Navigation Bar (< 1024px) */}
            <MobileBottomBar />
          </div>
        </div>

        {/* PWA Install Prompt Banner */}
        <PwaInstaller />
      </OfflineSyncProvider>
    </PinLockProvider>
  );
}
