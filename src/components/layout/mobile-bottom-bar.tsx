"use client";

import React, { Suspense, useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
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
const CIRCLE_SIZE      = 56;   // diameter of the floating active circle
const CIRCLE_BORDER    = 3;    // border width of the circle
const NOTCH_DEPTH      = 30;   // how far the notch dips from bar top
const CORNER_RADIUS    = 26;   // squircle corner radius
const TAB_COUNT        = 5;

/* ------------------------------------------------------------------ */
/*  SVG NOTCH PATH GENERATOR                                           */
/*  Creates a rounded rectangular bar with a smooth concave notch       */
/*  that hugs the active tab's floating circle.                        */
/* ------------------------------------------------------------------ */

function generateBarPath(
  width: number,
  activeIndex: number,
): string {
  const tabW = width / TAB_COUNT;
  const cx = tabW * (activeIndex + 0.5); // center X of active tab

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
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const isCreateAction =
    pathname === "/transactions" && searchParams.get("action") === "new";

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
  const activeCenterX = tabWidth * (activeIndex + 0.5);
  const ActiveIcon = NAV_ITEMS[activeIndex].icon;

  /* ---- Transitions ---- */
  const springTransition = shouldReduceMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, stiffness: 350, damping: 26 };

  /* ---- SVG path ---- */
  const barPath = useMemo(
    () => generateBarPath(width, activeIndex),
    [width, activeIndex],
  );

  /* ---- Circle position (centered above notch) ---- */
  const circleTop = -(CIRCLE_SIZE / 2) + NOTCH_DEPTH / 2 - 2;

  return (
    <nav
      aria-label="Navigasi Bawah"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none select-none pb-safe"
    >
      <div className="max-w-md mx-auto px-4 pb-2">
        <div
          ref={containerRef}
          className="relative w-full pointer-events-auto"
          style={{ height: BAR_HEIGHT }}
        >
          {/* ========== SVG BAR SHAPE (card surface + notch) ========== */}
          <svg
            width={width}
            height={BAR_HEIGHT}
            viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
            className="absolute inset-0 overflow-visible pointer-events-none"
            style={{
              filter:
                "drop-shadow(0 -2px 12px rgba(0, 0, 0, 0.08)) drop-shadow(0 -1px 4px rgba(0, 0, 0, 0.04))",
            }}
          >
            <defs>
              {/* Add dark-mode specific shadow via class */}
            </defs>
            <path
              d={barPath}
              className="fill-card"
              style={{ transition: "d 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            />
          </svg>

          {/* ========== FLOATING ACTIVE CIRCLE ========== */}
          <motion.div
            initial={false}
            animate={{ x: activeCenterX - CIRCLE_SIZE / 2 }}
            transition={springTransition}
            className="absolute z-20 pointer-events-none"
            style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              top: circleTop,
            }}
          >
            <div
              className="w-full h-full rounded-full bg-card flex items-center justify-center shadow-lg"
              style={{
                border: `${CIRCLE_BORDER}px solid var(--accent-border)`,
              }}
            >
              <ActiveIcon
                className="w-6 h-6 stroke-[2]"
                style={{ color: "var(--accent-text)" }}
              />
            </div>
          </motion.div>

          {/* ========== TAB BUTTONS ========== */}
          <div className="relative z-30 w-full h-full grid grid-cols-5">
            {NAV_ITEMS.map((item, index) => {
              const isActive = activeIndex === index;
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-label={item.name}
                  aria-current={isActive ? "page" : undefined}
                  className="relative flex flex-col items-center justify-center h-full group focus-visible:outline-none"
                  style={{ minHeight: 44 }}
                >
                  {/* Icon: only visible for INACTIVE tabs */}
                  {!isActive && (
                    <div className="flex items-center justify-center mb-1">
                      <Icon className="w-[22px] h-[22px] stroke-[1.5] text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  )}

                  {/* Spacer for active tab (icon is in the floating circle) */}
                  {isActive && <div style={{ height: 24 }} />}

                  {/* Label */}
                  <span
                    className={`text-[11px] leading-tight transition-all ${
                      isActive
                        ? "font-bold text-foreground"
                        : "font-medium text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ========== HOME INDICATOR LINE ========== */}
        <div className="w-28 h-[5px] bg-muted-foreground/25 rounded-full mx-auto mt-2" />
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  EXPORT                                                             */
/* ------------------------------------------------------------------ */

export function MobileBottomBar() {
  return (
    <Suspense fallback={null}>
      <BottomBarContent />
    </Suspense>
  );
}
