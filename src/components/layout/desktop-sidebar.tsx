"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Home,
  PieChart,
  PlusCircle,
  Receipt,
  PiggyBank,
  User,
  Wallet,
  HandCoins,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { name: "Beranda", href: "/dashboard", icon: Home },
  { name: "Statistik", href: "/statistics", icon: PieChart },
  { name: "Catat Transaksi", href: "/record", icon: PlusCircle },
  { name: "Multi Rekening", href: "/accounts", icon: Wallet },
  { name: "Utang Piutang", href: "/debts", icon: HandCoins },
  { name: "Riwayat", href: "/transactions", icon: Receipt },
  { name: "Tabungan", href: "/savings", icon: PiggyBank },
  { name: "Profil", href: "/profile", icon: User },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  return (
    <aside
      aria-label="Sidebar Desktop"
      className="hidden md:flex flex-col justify-between w-60 lg:w-64 h-[100dvh] sticky top-0 bg-card border-r border-border p-5 lg:p-6 select-none shrink-0 overflow-y-auto"
    >
      <div className="space-y-8">
        {/* Brand Logo */}
        <Link href="/dashboard" className="block group">
          <BrandLogo height={38} showSubtitle={true} />
        </Link>

        {/* Navigation Items */}
        <nav className="space-y-1.5" aria-label="Menu Utama">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                !item.href.includes("?action=new") &&
                pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3.5 px-4 py-3 rounded-card text-sm font-semibold transition-all group",
                  isActive
                    ? "text-[#1F1F1F] bg-accent shadow-md shadow-accent/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-[#1F1F1F] stroke-[2.4]" : "stroke-[1.8]"
                  )}
                />
                <span>{item.name}</span>

                {isActive && (
                  <motion.div
                    layoutId="desktopActiveTabIndicator"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 350, damping: 30 }
                    }
                    className="absolute right-3 w-1.5 h-4 rounded-full bg-[#1F1F1F]"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls: Theme Toggle & User Info */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>

        <Link
          href="/profile"
          className="flex items-center gap-3 p-2 rounded-card hover:bg-muted transition-colors group"
        >
          <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-xs">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              Mahasiswa Perantau
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              adly@sakuin.app
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
