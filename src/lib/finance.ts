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

/**
 * Format tanggal ke bahasa Indonesia
 */
export function formatIndonesianDate(date: Date = new Date()): IndonesianDateInfo {
  const dayName = INDONESIAN_DAYS[date.getDay()];
  const dayNumber = date.getDate();
  const monthIndex = date.getMonth();
  const monthName = INDONESIAN_MONTHS[monthIndex];
  const monthShort = INDONESIAN_MONTHS_SHORT[monthIndex];
  const year = date.getFullYear();

  return {
    full: `${dayName}, ${dayNumber} ${monthName} ${year}`,
    short: `${dayNumber} ${monthShort} ${year}`,
    dayName,
    dayNumber,
    monthName,
    monthShort,
    monthNumber: monthIndex + 1,
    year,
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
  if (cycle === "weekly") {
    const currentWeekday = today.getDay();
    const normalizedTarget = ((paydayWeekday % 7) + 7) % 7;
    const diff = (normalizedTarget - currentWeekday + 7) % 7;
    return diff === 0 ? 7 : diff;
  }

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  if (cycle === "flexible") {
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    return Math.max(1, lastDayOfMonth - currentDay + 1);
  }

  let targetDate: Date;

  if (currentDay < paydayDay) {
    // Gajian di bulan ini
    targetDate = new Date(currentYear, currentMonth, paydayDay);
  } else {
    // Gajian di bulan depan
    targetDate = new Date(currentYear, currentMonth + 1, paydayDay);
  }

  // Set jam ke 00:00:00 untuk perbandingan hari murni
  const start = new Date(currentYear, currentMonth, currentDay);
  const diffTime = targetDate.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
  reserveValue: number = 0
): {
  dailyLimit: number;
  reservedTotal: number;
  spendableBalance: number;
} {
  const safeBalance = Math.max(0, totalBalance);
  const safeDays = Math.max(1, remainingDays);
  const safeVal = Math.max(0, reserveValue);

  if (reserveMode === "daily_fixed" && safeVal > 0) {
    const reservedTotal = Math.min(safeBalance, safeVal * safeDays);
    const spendableBalance = Math.max(0, safeBalance - reservedTotal);
    return {
      dailyLimit: Math.floor(spendableBalance / safeDays),
      reservedTotal,
      spendableBalance,
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
    };
  }

  // Default: 'none' (Tidak menyisihkan / Bagi Rata)
  return {
    dailyLimit: Math.floor(safeBalance / safeDays),
    reservedTotal: 0,
    spendableBalance: safeBalance,
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
