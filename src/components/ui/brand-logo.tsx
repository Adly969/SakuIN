import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  iconSize?: number;
  height?: number;
  showSubtitle?: boolean;
  className?: string;
  textColor?: string;
}

export function BrandLogo({
  iconSize,
  height = 32,
  showSubtitle = false,
  className = "",
  textColor = "text-foreground",
}: BrandLogoProps) {
  const size = iconSize || height;

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="Sakuin"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        priority
      />
      <div className="flex flex-col justify-center">
        <span
          className={cn(
            "font-brand font-bold tracking-normal leading-tight select-none",
            size >= 44 ? "text-2xl" : size >= 34 ? "text-xl" : "text-lg",
            textColor
          )}
        >
          Sakuin
        </span>
        {showSubtitle && (
          <p className="text-[10px] font-medium text-muted-foreground -mt-0.5 tracking-tight">
            Tenang Sampai Akhir Bulan
          </p>
        )}
      </div>
    </div>
  );
}

export function BrandText({
  height = 20,
  className = "",
  textColor = "text-foreground",
}: {
  height?: number;
  className?: string;
  textColor?: string;
}) {
  return (
    <span
      className={cn(
        "font-brand font-bold tracking-normal leading-tight select-none",
        height >= 28 ? "text-xl" : height >= 22 ? "text-lg" : "text-base",
        textColor,
        className
      )}
    >
      Sakuin
    </span>
  );
}
