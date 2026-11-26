/**
 * Modul Kalkulasi Keuangan SakuIN
 * Sesuai PRD Bagian 6 & 13: Perhitungan saldo, sisa hari, dan batas pemakaian harian
 */

export interface IndonesianDateInfo {
  full: string; // e.g. "Rabu, 18 November 2026"
  short: string; // e.g. "18 Nov 2026"
  dayName: string; // e.g. "Rabu"
  dayNumber: number; // e.g. 18
  monthName: string; // e.g. "November"
  monthShort: string; // e.g. "Nov"
  monthNumber: number; // e.g. 11
  year: number; // e.g. 2026
}

export const INDONESIAN_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const INDONESIAN_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const SHORT_WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface JakartaCalendarParts {
  year: number;
  monthIndex: number; // 0-11
  monthNumber: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0 (Minggu) - 6 (Sabtu)
  dateKey: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
}

/**
 * Mengekstrak tanggal kalender akurat di zona waktu Asia/Jakarta (WIB),
 * aman dari selisih jam UTC pada server Vercel maupun perangkat pengguna.
 */
export function getJakartaCalendarParts(date: Date = new Date()): JakartaCalendarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);

  const year = parseInt(parts.find((p) => p.type === "year")?.value || "", 10) || date.getFullYear();
  const monthNumber =
    parseInt(parts.find((p) => p.type === "month")?.value || "", 10) || date.getMonth() + 1;
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "", 10) || date.getDate();
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value || "";
  const weekday =
    weekdayStr in SHORT_WEEKDAY_TO_INDEX ? SHORT_WEEKDAY_TO_INDEX[weekdayStr] : date.getDay();

  const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;

  return {
    year,
    monthIndex: monthNumber - 1,
    monthNumber,
    day,
    weekday,
    dateKey,
    monthKey,
  };
}

/**
 * Mengembalikan tanggal aktif YYYY-MM-DD dalam zona waktu Asia/Jakarta (WIB).
 */
export function getJakartaDateString(date: Date = new Date()): string {
  return getJakartaCalendarParts(date).dateKey;
}

/**
 * Format tanggal ke bahasa Indonesia (menggunakan kalender WIB agar selalu realtime tepat tanggal).
 */
export function formatIndonesianDate(date: Date = new Date()): IndonesianDateInfo {
  const { year, monthIndex, monthNumber, day, weekday } = getJakartaCalendarParts(date);
  const dayName = INDONESIAN_DAYS[weekday];
  const monthName = INDONESIAN_MONTHS[monthIndex];
  const monthShort = INDONESIAN_MONTHS_SHORT[monthIndex];

  return {
    full: `${dayName}, ${day} ${monthName} ${year}`,
    short: `${day} ${monthShort} ${year}`,
    dayName,
    dayNumber: day,
    monthName,
    monthShort,
    monthNumber,
    year,
  };
}

export interface TargetDeadlineCountdown {
  hasDeadline: boolean;
  diffDays: number | null;
  shortLabel: string | null;
  displayText: string | null;
  formattedDate: string;
  urgency: "none" | "safe" | "soon" | "today" | "overdue";
}

/**
 * Menghitung selisih hari H- / Hari-H / H+ terhadap tenggat waktu tabungan
 * menggunakan kalender Asia/Jakarta (WIB) agar bebas selisih zona waktu.
 */
export function calculateTargetDeadlineCountdown(
  rawTargetDate: string | null | undefined,
  today: Date = new Date()
): TargetDeadlineCountdown {
  if (!rawTargetDate || typeof rawTargetDate !== "string") {
    return {
      hasDeadline: false,
      diffDays: null,
      shortLabel: null,
      displayText: null,
      formattedDate: "Fleksibel",
      urgency: "none",
    };
  }

  const match = rawTargetDate.trim().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return {
      hasDeadline: false,
      diffDays: null,
      shortLabel: null,
      displayText: null,
      formattedDate: rawTargetDate,
      urgency: "none",
    };
  }

  const tYear = Number(match[1]);
  const tMonth = Number(match[2]);
  const tDay = Number(match[3]);
  const monthShort = INDONESIAN_MONTHS_SHORT[tMonth - 1] || String(tMonth);
  const formattedDate = `${tDay} ${monthShort} ${tYear}`;

  const { year, monthNumber, day } = getJakartaCalendarParts(today);
  const targetUtcMs = Date.UTC(tYear, tMonth - 1, tDay);
  const todayUtcMs = Date.UTC(year, monthNumber - 1, day);
  const diffDays = Math.round((targetUtcMs - todayUtcMs) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    const shortLabel = `H-${diffDays}`;
    return {
      hasDeadline: true,
      diffDays,
      shortLabel,
      displayText: `${shortLabel} (${diffDays} hari lagi)`,
      formattedDate,
      urgency: diffDays <= 7 ? "soon" : "safe",
    };
  }

  if (diffDays === 0) {
    return {
      hasDeadline: true,
      diffDays: 0,
      shortLabel: "H-0",
      displayText: "Hari ini (H-0)",
      formattedDate,
      urgency: "today",
    };
  }

  const overdueDays = Math.abs(diffDays);
  const shortLabel = `H+${overdueDays}`;
  return {
    hasDeadline: true,
    diffDays,
    shortLabel,
    displayText: `Terlewat ${overdueDays} hari (${shortLabel})`,
    formattedDate,
    urgency: "overdue",
  };
}

export type AllowanceCycle = "monthly" | "weekly" | "flexible";
export type ReserveMode = "none" | "daily_fixed" | "percent" | "daily_cap";

/**
 * Menghitung sisa hari hingga tanggal/hari kiriman / reset berikutnya
 */
export function calculateRemainingDays(
  today: Date = new Date(),
  paydayDay: number = 1,
  cycle: AllowanceCycle = "monthly",
  paydayWeekday: number = 1
): number {
  const { year: currentYear, monthIndex: currentMonth, day: currentDay, weekday: currentWeekday } =
    getJakartaCalendarParts(today);

  if (cycle === "weekly") {
    const normalizedTarget = ((paydayWeekday % 7) + 7) % 7;
    const diff = (normalizedTarget - currentWeekday + 7) % 7;
    return diff === 0 ? 7 : diff;
  }

  if (cycle === "flexible") {
    const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    return Math.max(1, lastDayOfMonth - currentDay + 1);
  }

  const clampTargetDay = (y: number, mIdx: number, targetDay: number) => {
    const maxD = new Date(Date.UTC(y, mIdx + 1, 0)).getUTCDate();
    return Math.min(Math.max(1, targetDay), maxD);
  };

  let targetMs: number;
  const paydayThisMonth = clampTargetDay(currentYear, currentMonth, paydayDay);

  if (currentDay < paydayThisMonth) {
    targetMs = Date.UTC(currentYear, currentMonth, paydayThisMonth);
  } else {
    const nextPayday = clampTargetDay(currentYear, currentMonth + 1, paydayDay);
    targetMs = Date.UTC(currentYear, currentMonth + 1, nextPayday);
  }

  const startMs = Date.UTC(currentYear, currentMonth, currentDay);
  const diffDays = Math.ceil((targetMs - startMs) / (1000 * 60 * 60 * 24));

  return Math.max(1, diffDays);
}

/**
 * Menghitung batas harian adaptif berdasarkan gaya menyisihkan pengguna:
 * - 'none': Tidak menyisihkan (bagi rata penuh)
 * - 'daily_fixed': Sisihkan nominal tetap per hari (misal Rp 5.000 / Rp 10.000 per hari)
 * - 'percent': Sisihkan persentase dari total saldo (misal 10% / 15% / 20%)
 * - 'daily_cap': Batas harian maksimal tetap (misal Rp 35.000/hari)
 */
export function calculateAdaptiveDailyLimit(
  totalBalance: number,
  remainingDays: number,
  reserveMode: ReserveMode = "none",
  reserveValue: number = 0,
  lockedTotal: number = 0
): {
  dailyLimit: number;
  reservedTotal: number;
  spendableBalance: number;
  lockedTotal: number;
  freeBalance: number;
} {
  const safeTotal = Math.max(0, totalBalance);
  const appliedLocked = Math.min(safeTotal, Math.max(0, lockedTotal));
  const safeBalance = Math.max(0, safeTotal - appliedLocked);
  const safeDays = Math.max(1, remainingDays);
  const safeVal = Math.max(0, reserveValue);

  if (reserveMode === "daily_fixed" && safeVal > 0) {
    const reservedTotal = Math.min(safeBalance, safeVal * safeDays);
    const spendableBalance = Math.max(0, safeBalance - reservedTotal);
    return {
      dailyLimit: Math.floor(spendableBalance / safeDays),
      reservedTotal,
      spendableBalance,
      lockedTotal: appliedLocked,
      freeBalance: safeBalance,
    };
  }

  if (reserveMode === "percent" && safeVal > 0) {
    const pct = Math.min(90, safeVal);
    const reservedTotal = Math.round(safeBalance * (pct / 100));
    const spendableBalance = Math.max(0, safeBalance - reservedTotal);
    return {
      dailyLimit: Math.floor(spendableBalance / safeDays),
      reservedTotal,
      spendableBalance,
      lockedTotal: appliedLocked,
      freeBalance: safeBalance,
    };
  }

  if (reserveMode === "daily_cap" && safeVal > 0) {
    const dailyLimit = Math.min(safeBalance, safeVal);
    const spendableBalance = Math.min(safeBalance, dailyLimit * safeDays);
    const reservedTotal = Math.max(0, safeBalance - spendableBalance);
    return {
      dailyLimit,
      reservedTotal,
      spendableBalance,
      lockedTotal: appliedLocked,
      freeBalance: safeBalance,
    };
  }

  // Default: 'none' (Tidak menyisihkan / Bagi Rata)
  return {
    dailyLimit: Math.floor(safeBalance / safeDays),
    reservedTotal: 0,
    spendableBalance: safeBalance,
    lockedTotal: appliedLocked,
    freeBalance: safeBalance,
  };
}

/**
 * Menghitung sisa uang
 * Sisa = Uang Kiriman - Total Pengeluaran - Total Tabungan
 */
export function calculateRemainingBalance(
  allowance: number,
  totalExpenses: number,
  totalSavings: number = 0
): number {
  return Math.max(0, allowance - totalExpenses - totalSavings);
}

/**
 * Menghitung batas pemakaian harian
 * Batas per hari = Sisa Uang / Sisa Hari
 */
export function calculateDailyLimit(remainingBalance: number, remainingDays: number): number {
  if (remainingDays <= 0) return remainingBalance;
  return Math.floor(remainingBalance / remainingDays);
}

/**
 * Status kondisi keuangan harian
 */
export function getSpendingStatus(dailyLimit: number): {
  status: "safe" | "warning" | "danger";
  label: string;
  color: string;
} {
  if (dailyLimit >= 65000) {
    return {
      status: "safe",
      label: "Aman",
      color: "#D4FF5A", // Lime
    };
  } else if (dailyLimit >= 30000) {
    return {
      status: "warning",
      label: "Waspada",
      color: "#FFB04A", // Orange
    };
  } else {
    return {
      status: "danger",
      label: "Kritis",
      color: "#FF7B7B", // Coral / Red
    };
  }
}
