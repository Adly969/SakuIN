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

/**
 * Menghitung sisa hari hingga tanggal gajian / reset berikutnya
 * Sesuai PRD Bagian 6:
 * Jika hari ini < tanggal gajian: selisih hari di bulan yang sama
 * Jika hari ini >= tanggal gajian: selisih hari hingga tanggal gajian di bulan berikutnya
 */
export function calculateRemainingDays(today: Date = new Date(), paydayDay: number = 1): number {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

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
