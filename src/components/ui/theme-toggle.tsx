"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-24 h-8 bg-muted rounded-pill animate-pulse" />;
  }

  return (
    <div
      role="group"
      aria-label="Pilih tema tampilan"
      className={cn(
        "inline-flex items-center p-1 bg-muted rounded-pill border border-border text-xs font-medium",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Mode Terang"
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-pill transition-all",
          theme === "light"
            ? "bg-card text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Terang</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Mode Gelap"
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-pill transition-all",
          theme === "dark"
            ? "bg-card text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Gelap</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-label="Ikuti Sistem"
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-pill transition-all",
          theme === "system"
            ? "bg-card text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Laptop className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sistem</span>
      </button>
    </div>
  );
}
