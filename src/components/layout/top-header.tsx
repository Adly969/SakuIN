"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CreditCard, HandCoins, User, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";

const QUICK_MENU_ITEMS = [
  {
    href: "/accounts",
    label: "Multi Rekening & Tagihan",
    desc: "Dompet, saldo & dana terkunci",
    icon: CreditCard,
  },
  {
    href: "/debts",
    label: "Utang Piutang",
    desc: "Catatan pinjaman & jatuh tempo",
    icon: HandCoins,
  },
  {
    href: "/profile",
    label: "Profil & Pengaturan",
    desc: "Target harian, anggaran & pengingat",
    icon: Settings,
  },
] as const;

export function TopHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      style={{
        paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 6px), 12px)",
      }}
      className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 pb-2.5 flex items-center justify-between safe-top-header"
    >
      <Link href="/dashboard" className="flex items-center min-h-[44px]">
        <BrandLogo height={28} />
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Menu Cepat Akun & Dompet"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="h-11 min-w-[44px] min-h-[44px] px-2.5 rounded-full bg-card border border-border flex items-center justify-center gap-1 text-foreground hover:border-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <User className="w-5 h-5" />
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Akses cepat fitur dompet dan profil"
              className="absolute right-0 mt-2 w-64 rounded-2xl bg-card border border-border shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              {QUICK_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl transition-colors ${
                      active
                        ? "bg-accent/15 text-foreground"
                        : "text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        active ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
