"use client";

import React from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";

export function TopHeader() {
  return (
    <header
      style={{
        paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 6px), 12px)",
      }}
      className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 pb-2.5 flex items-center justify-between safe-top-header"
    >
      <Link href="/dashboard" className="flex items-center">
        <BrandLogo height={28} />
      </Link>

      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <Link
          href="/profile"
          aria-label="Buka Profil"
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:border-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <User className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
