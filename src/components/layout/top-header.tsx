"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChevronDown,
  CreditCard,
  HandCoins,
  PieChart,
  User,
  Settings,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

const QUICK_MENU_ITEMS = [
  {
    href: "/budgets",
    label: "Atur Jatah Kategori",
    desc: "Bagi jatah pos belanja & kunci batas",
    icon: PieChart,
  },
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 4px), 8px)",
      }}
      className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 pb-1.5 flex items-center justify-between safe-top-header"
    >
      <Link href="/dashboard" className="flex items-center min-h-[44px]">
        <BrandLogo height={24} />
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Menu Cepat Akun & Tema"
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
            aria-label="Akses cepat fitur dompet, profil, dan tema"
            className="absolute right-0 mt-2 w-68 min-w-[264px] rounded-2xl bg-card border border-border shadow-xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150"
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
                  className={`flex items-center gap-3 px-2.5 py-2 min-h-[44px] rounded-xl transition-colors ${
                    active
                      ? "bg-accent/15 text-foreground"
                      : "text-foreground hover:bg-muted/70"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? "bg-accent text-[#1F1F1F]" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              );
            })}

            {/* Pilihan Tema (dipindahkan dari header agar bar atas ringkas) */}
            <div className="pt-1.5 mt-1 border-t border-border/70 px-1 pb-0.5 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 block">
                Tema Tampilan
              </span>
              <div
                role="group"
                aria-label="Pilih tema tampilan"
                className="grid grid-cols-3 gap-1 p-1 bg-background border border-border rounded-xl text-xs font-bold"
              >
                {[
                  { id: "light", label: "Terang", icon: Sun },
                  { id: "dark", label: "Gelap", icon: Moon },
                  { id: "system", label: "Sistem", icon: Laptop },
                ].map((opt) => {
                  const ThemeIcon = opt.icon;
                  const isCurrent = mounted && theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      className={`flex items-center justify-center gap-1 py-2 min-h-[44px] rounded-lg transition-colors ${
                        isCurrent
                          ? "bg-card text-foreground shadow-xs border border-border font-extrabold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ThemeIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
