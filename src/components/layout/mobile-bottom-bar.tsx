"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PieChart,
  Plus,
  Receipt,
  PiggyBank,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  NAV CONFIG                                                         */
/* ------------------------------------------------------------------ */

interface NavItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard",    name: "Beranda",   href: "/dashboard",    icon: Home },
  { id: "statistics",   name: "Statistik", href: "/statistics",   icon: PieChart },
  { id: "create",       name: "Catat",     href: "/record",       icon: Plus },
  { id: "transactions", name: "Riwayat",   href: "/transactions", icon: Receipt },
  { id: "savings",      name: "Tabungan",  href: "/savings",      icon: PiggyBank },
];

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const BAR_HEIGHT       = 72;   // height of the visible card area
const CIRCLE_SIZE      = 56;   // diameter of the center Catat action button
const NOTCH_DEPTH      = 30;   // how far the notch dips from bar top
const CORNER_RADIUS    = 26;   // squircle corner radius
const TAB_COUNT        = 5;
const CREATE_TAB_INDEX = 2;

/* ------------------------------------------------------------------ */
/*  SVG NOTCH PATH GENERATOR                                           */
/*  Creates a rounded rectangular bar with a fixed center concave      */
/*  notch hugging the primary Catat (+) action button.                 */
/* ------------------------------------------------------------------ */

function generateBarPath(width: number): string {
  const tabW = width / TAB_COUNT;
  const cx = tabW * (CREATE_TAB_INDEX + 0.5); // center X of Catat tab

  // Notch geometry
  const notchHalfW = CIRCLE_SIZE / 2 + 10; // half-width of the concave notch cutout
  const notchLeft  = cx - notchHalfW;
  const notchRight = cx + notchHalfW;
  const notchTop   = 0;
  const notchBottom = NOTCH_DEPTH;
  const r = CORNER_RADIUS;

  // Clamp notch edges so they never go past the bar rounded corners
  const safeLeft  = Math.max(notchLeft, r);
  const safeRight = Math.min(notchRight, width - r);

  // Start from top-left corner, move clockwise
  let d = "";

  // Top-left corner
  d += `M 0 ${r} Q 0 0 ${r} 0 `;

  // Top edge to notch
  d += `L ${safeLeft} ${notchTop} `;

  // Concave notch (smooth bezier curve dipping down)
  d += `C ${safeLeft + 12} ${notchTop}, ${cx - CIRCLE_SIZE / 2 + 2} ${notchBottom}, ${cx} ${notchBottom} `;
  d += `C ${cx + CIRCLE_SIZE / 2 - 2} ${notchBottom}, ${safeRight - 12} ${notchTop}, ${safeRight} ${notchTop} `;

  // Top edge continues to top-right corner
  d += `L ${width - r} 0 `;
  d += `Q ${width} 0 ${width} ${r} `;

  // Right edge down
  d += `L ${width} ${BAR_HEIGHT - r} `;

  // Bottom-right corner
  d += `Q ${width} ${BAR_HEIGHT} ${width - r} ${BAR_HEIGHT} `;

  // Bottom edge
  d += `L ${r} ${BAR_HEIGHT} `;

  // Bottom-left corner
  d += `Q 0 ${BAR_HEIGHT} 0 ${BAR_HEIGHT - r} `;

  // Left edge up, close
  d += `Z`;

  return d;
}

/* ------------------------------------------------------------------ */
/*  BOTTOM BAR CONTENT                                                 */
/* ------------------------------------------------------------------ */

function BottomBarContent() {
  const pathname = usePathname();

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /* ---- Active tab index ---- */
  let activeIndex = 0;
  if (pathname.startsWith("/record")) {
    activeIndex = 2;
  } else if (pathname.startsWith("/statistics")) {
    activeIndex = 1;
  } else if (pathname.startsWith("/transactions")) {
    activeIndex = 3;
  } else if (pathname.startsWith("/savings")) {
    activeIndex = 4;
  }

  const tabWidth = width / TAB_COUNT;
  const centerActionX = tabWidth * (CREATE_TAB_INDEX + 0.5);
  const isCreateActive = activeIndex === CREATE_TAB_INDEX;

  /* ---- SVG path (fixed center notch for Catat) ---- */
  const barPath = useMemo(() => generateBarPath(width), [width]);

  /* ---- Circle position (centered above center notch) ---- */
  const circleTop = -(CIRCLE_SIZE / 2) + NOTCH_DEPTH / 2 - 2;

  return (
    <nav
      aria-label="Navigasi Bawah"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none select-none pb-safe"
    >
      {/* Alas penutup halus agar kartu halaman di belakang tidak tembus & tidak membentuk bingkai ganda */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, var(--background) 62%, color-mix(in srgb, var(--background) 80%, transparent) 84%, transparent 100%)",
        }}
      />

      <div className="relative max-w-md mx-auto px-4 pb-1.5">
        <div
          ref={containerRef}
          className="relative w-full pointer-events-auto"
          style={{ height: BAR_HEIGHT }}
        >
          {/* ========== SVG BAR SHAPE (1 wadah bersih + stroke tipis) ========== */}
          <svg
            width={width}
            height={BAR_HEIGHT}
            viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
            className="absolute inset-0 overflow-visible pointer-events-none"
            style={{
              filter:
                "drop-shadow(0 -4px 14px rgba(0, 0, 0, 0.16))",
            }}
          >
            <path
              d={barPath}
              className="fill-card stroke-border"
              strokeWidth={1}
            />
          </svg>

          {/* ========== PERMANENT CENTER CATAT BUTTON (OPSI A) ========== */}
          <div
            aria-hidden="true"
            className="absolute z-20 pointer-events-none"
            style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              left: centerActionX - CIRCLE_SIZE / 2,
              top: circleTop,
            }}
          >
            <div
              className={`w-full h-full rounded-full bg-accent text-[#1F1F1F] flex items-center justify-center shadow-lg transition-transform ${
                isCreateActive
                  ? "ring-2 ring-foreground/25 dark:ring-white/35 scale-[1.03]"
                  : "ring-2 ring-background/90"
              }`}
            >
              <Plus className="w-7 h-7 stroke-[2.6]" />
            </div>
          </div>

          {/* ========== TAB BUTTONS ========== */}
          <div className="relative z-30 w-full h-full grid grid-cols-5">
            {NAV_ITEMS.map((item, index) => {
              const isActive = activeIndex === index;
              const isCenterAction = index === CREATE_TAB_INDEX;
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-label={isCenterAction ? "Catat transaksi" : item.name}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex flex-col items-center justify-center h-full group focus-visible:outline-none ${
                    isCenterAction
                      ? "before:content-[''] before:absolute before:inset-x-0 before:-top-4 before:bottom-0"
                      : ""
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {isCenterAction ? (
                    <div style={{ height: 22 }} />
                  ) : (
                    <div className="relative flex items-center justify-center mb-0.5">
                      <Icon
                        className={`w-[22px] h-[22px] transition-colors ${
                          isActive
                            ? "stroke-[2.2] text-[color:var(--accent-text)]"
                            : "stroke-[1.7] text-muted-foreground group-hover:text-foreground"
                        }`}
                      />
                    </div>
                  )}

                  {/* Label */}
                  <span
                    className={`text-xs leading-tight transition-colors ${
                      isActive
                        ? "font-bold text-[color:var(--accent-text)]"
                        : isCenterAction
                        ? "font-bold text-foreground group-hover:text-[color:var(--accent-text)]"
                        : "font-medium text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {item.name}
                  </span>

                  {/* Active non-color indicator bar (fixed position so baseline never shifts) */}
                  {isActive && !isCenterAction && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1.5 w-4 h-[3px] rounded-full bg-accent"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  EXPORT                                                             */
/* ------------------------------------------------------------------ */

export function MobileBottomBar() {
  return <BottomBarContent />;
}
