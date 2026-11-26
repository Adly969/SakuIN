import {
  calculateAdaptiveDailyLimit,
  calculateRemainingDays,
  type AllowanceCycle,
  type ReserveMode,
} from "./finance";

/**
 * Sifat pos kategori sesuai Keputusan Desain #1:
 * - daily: jatah = unitAmount * jumlah hari siklus (masuk Batas Hari Ini, default tidak dikunci)
 * - weekly: jatah = unitAmount * hari siklus / 7 (dibulatkan ke ribuan terdekat jika bukan 7 hari)
 * - monthly: jatah = unitAmount langsung (bisa dikunci atau tidak)
 */
export type PotCadence = "daily" | "weekly" | "monthly";

export type PotUsageStatus = "safe" | "warning" | "reached" | "exceeded";

export interface CyclePeriodInfo {
  periodKey: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  cycleDays: number;
  remainingDays: number;
}

export interface CategoryPotInput {
  id: string;
  name: string;
  cadence: PotCadence;
  unitAmount: number;
  isLockedFromDaily: boolean;
  isOther?: boolean; // true untuk pos "Lainnya" (tidak masuk totalAllocated)
  allocatedAmount?: number; // override jika sudah ada penyesuaian periode (Geser Jatah)
  periodSpent: number;
}

export interface CategoryPotComputed {
  id: string;
  name: string;
  cadence: PotCadence;
  unitAmount: number;
  isLockedFromDaily: boolean;
  allocatedAmount: number;
  spent: number;
  remaining: number;
  overAmount: number;
  usagePercent: number;
  status: PotUsageStatus;
}

export interface AllocationSummary {
  availableFunds: number;
  totalAllocated: number;
  freeRemaining: number; // Sisa Bebas = Dana Tersedia - Total Dibagi (bisa negatif jika over-alokasi)
  safeFreeRemaining: number;
  isOverAllocated: boolean;
  overAllocatedAmount: number;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeLocalDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Menghitung periode aktif (periodKey, tanggal mulai/akhir, total hari siklus, dan sisa hari)
 * untuk siklus bulanan, mingguan, dan fleksibel — termasuk bulan 28/29/30/31 hari.
 */
export function getCyclePeriodInfo(
  today: Date = new Date(),
  cycle: AllowanceCycle = "monthly",
  paydayDay: number = 1,
  paydayWeekday: number = 1
): CyclePeriodInfo {
  const startToday = normalizeLocalDate(today);
  const year = startToday.getFullYear();
  const month = startToday.getMonth();
  const day = startToday.getDate();

  if (cycle === "weekly") {
    const remainingDays = calculateRemainingDays(startToday, paydayDay, "weekly", paydayWeekday);
    const periodEndDate = new Date(year, month, day + remainingDays - 1);
    const periodStartDate = new Date(
      periodEndDate.getFullYear(),
      periodEndDate.getMonth(),
      periodEndDate.getDate() - 6
    );
    const periodStart = toIsoDate(periodStartDate);
    const periodEnd = toIsoDate(periodEndDate);
    return {
      periodKey: `${periodStart}_${periodEnd}`,
      periodStart,
      periodEnd,
      cycleDays: 7,
      remainingDays,
    };
  }

  if (cycle === "flexible") {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const periodStartDate = new Date(year, month, 1);
    const periodEndDate = new Date(year, month, lastDay);
    const remainingDays = calculateRemainingDays(startToday, paydayDay, "flexible", paydayWeekday);
    return {
      periodKey: `${year}-${String(month + 1).padStart(2, "0")}`,
      periodStart: toIsoDate(periodStartDate),
      periodEnd: toIsoDate(periodEndDate),
      cycleDays: lastDay,
      remainingDays,
    };
  }

  // Monthly cycle berdasarkan paydayDay (clamp ke hari terakhir bulan bila tanggal gajian 29/30/31)
  const clampDay = (y: number, m: number, targetDay: number) => {
    const maxD = new Date(y, m + 1, 0).getDate();
    return Math.min(Math.max(1, targetDay), maxD);
  };

  let startDate: Date;
  let nextPaydayDate: Date;

  const paydayThisMonth = clampDay(year, month, paydayDay);
  if (day < paydayThisMonth) {
    startDate = new Date(year, month - 1, clampDay(year, month - 1, paydayDay));
    nextPaydayDate = new Date(year, month, paydayThisMonth);
  } else {
    startDate = new Date(year, month, paydayThisMonth);
    nextPaydayDate = new Date(year, month + 1, clampDay(year, month + 1, paydayDay));
  }

  const endDate = new Date(
    nextPaydayDate.getFullYear(),
    nextPaydayDate.getMonth(),
    nextPaydayDate.getDate() - 1
  );

  const cycleDays = Math.max(
    1,
    Math.round((nextPaydayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const remainingDays = Math.max(
    1,
    Math.round((nextPaydayDate.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    periodKey: paydayDay === 1
      ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`
      : `${toIsoDate(startDate)}_${toIsoDate(endDate)}`,
    periodStart: toIsoDate(startDate),
    periodEnd: toIsoDate(endDate),
    cycleDays,
    remainingDays,
  };
}

/**
 * Menghitung jatah pos per siklus sesuai sifatnya (Keputusan Desain #1):
 * - daily: unitAmount * cycleDays (tidak dibulatkan)
 * - weekly: unitAmount * cycleDays / 7 (dibulatkan ke kelipatan Rp 1.000 terdekat, 0,5 ke atas)
 * - monthly: unitAmount langsung (tidak dibulatkan)
 */
export function calculatePotPeriodAllocation(
  unitAmount: number,
  cadence: PotCadence,
  cycleDays: number
): number {
  const safeUnit = Math.max(0, Math.round(unitAmount || 0));
  const safeDays = Math.max(1, Math.round(cycleDays || 1));

  if (safeUnit === 0) return 0;

  if (cadence === "daily") {
    return safeUnit * safeDays;
  }

  if (cadence === "weekly") {
    const raw = (safeUnit * safeDays) / 7;
    return Math.round(raw / 1000) * 1000;
  }

  return safeUnit;
}

/**
 * Menghitung status pemakaian & sisa satu pos kategori (Keputusan Desain #8).
 */
export function evaluatePotUsage(
  allocatedAmount: number,
  periodSpent: number
): {
  allocatedAmount: number;
  spent: number;
  remaining: number;
  overAmount: number;
  usagePercent: number;
  status: PotUsageStatus;
} {
  const safeAllocated = Math.max(0, Math.round(allocatedAmount || 0));
  const safeSpent = Math.max(0, Math.round(periodSpent || 0));
  const remaining = Math.max(0, safeAllocated - safeSpent);
  const overAmount = Math.max(0, safeSpent - safeAllocated);

  const usagePercent =
    safeAllocated > 0
      ? Math.round((safeSpent / safeAllocated) * 100)
      : safeSpent > 0
      ? 100
      : 0;

  let status: PotUsageStatus = "safe";
  if (safeAllocated === 0) {
    status = safeSpent > 0 ? "exceeded" : "safe";
  } else if (safeSpent > safeAllocated) {
    status = "exceeded";
  } else if (safeSpent === safeAllocated || usagePercent >= 100) {
    status = "reached";
  } else if (usagePercent >= 80) {
    status = "warning";
  }

  return {
    allocatedAmount: safeAllocated,
    spent: safeSpent,
    remaining,
    overAmount,
    usagePercent,
    status,
  };
}

/**
 * Evaluasi daftar pos lengkap dengan jatah & status masing-masing.
 */
export function computeCategoryPots(
  pots: CategoryPotInput[],
  cycleDays: number
): CategoryPotComputed[] {
  return pots.map((pot) => {
    const allocatedAmount =
      pot.allocatedAmount !== undefined
        ? Math.max(0, Math.round(pot.allocatedAmount))
        : calculatePotPeriodAllocation(pot.unitAmount, pot.cadence, cycleDays);
    const usage = evaluatePotUsage(allocatedAmount, pot.periodSpent);
    return {
      id: pot.id,
      name: pot.name,
      cadence: pot.cadence,
      unitAmount: Math.max(0, Math.round(pot.unitAmount)),
      isLockedFromDaily: Boolean(pot.isLockedFromDaily),
      ...usage,
    };
  });
}

/**
 * Menghitung Total Dibagi, Sisa Bebas, dan flag Kelebihan Alokasi.
 * Pos "Lainnya" (isOther: true) menampung transaksi tanpa jatah sehingga tidak ikut dijumlah ke total dibagi.
 */
export function calculateAllocationSummary(
  availableFunds: number,
  pots: Array<Pick<CategoryPotInput, "cadence" | "unitAmount" | "allocatedAmount" | "isOther">>,
  cycleDays: number
): AllocationSummary {
  const safeFunds = Math.max(0, Math.round(availableFunds || 0));
  const totalAllocated = pots
    .filter((p) => !p.isOther)
    .reduce((sum, p) => {
      const alloc =
        p.allocatedAmount !== undefined
          ? Math.max(0, Math.round(p.allocatedAmount))
          : calculatePotPeriodAllocation(p.unitAmount, p.cadence, cycleDays);
      return sum + alloc;
    }, 0);

  const freeRemaining = safeFunds - totalAllocated;
  const isOverAllocated = totalAllocated > safeFunds;

  return {
    availableFunds: safeFunds,
    totalAllocated,
    freeRemaining,
    safeFreeRemaining: Math.max(0, freeRemaining),
    isOverAllocated,
    overAllocatedAmount: isOverAllocated ? totalAllocated - safeFunds : 0,
  };
}

/**
 * Menghitung pemakaian pos "Sisa Bebas / Lainnya" (transaksi pada kategori yang tidak punya jatah pos).
 */
export function calculateFreePoolUsage(
  freeRemainingPool: number,
  unallocatedSpent: number
) {
  return evaluatePotUsage(Math.max(0, freeRemainingPool), unallocatedSpent);
}

/**
 * Menghitung total sisa jatah pos yang dikunci dari Batas Hari Ini (`isLockedFromDaily === true`).
 * Menggunakan sisa jatah (`max(0, allocated - spent)`) agar pengeluaran yang sudah terjadi
 * dari pos terkunci tidak terpotong dua kali dari saldo rekening/kas.
 */
export function calculateLockedCategoryDeduction(
  pots: Array<{
    allocatedAmount: number;
    periodSpent: number;
    isLockedFromDaily: boolean;
  }>
): number {
  return pots.reduce((sum, pot) => {
    if (!pot.isLockedFromDaily) return sum;
    const remaining = Math.max(
      0,
      Math.round(pot.allocatedAmount || 0) - Math.max(0, Math.round(pot.periodSpent || 0))
    );
    return sum + remaining;
  }, 0);
}

/**
 * Menghitung Sisa Batas Hari Ini dengan memasukkan pengurangan pos terkunci.
 * Jika tidak ada pos terkunci (`lockedPots` kosong / tidak ada yang dikunci),
 * hasilnya identik 100% dengan `calculateAdaptiveDailyLimit`.
 */
export function calculateDailyLimitWithLockedPots(params: {
  totalBalance: number;
  remainingDays: number;
  reserveMode?: ReserveMode;
  reserveValue?: number;
  billLockedTotal?: number;
  lockedPots?: Array<{
    allocatedAmount: number;
    periodSpent: number;
    isLockedFromDaily: boolean;
  }>;
}) {
  const lockedCategoryTotal = calculateLockedCategoryDeduction(params.lockedPots || []);
  const billLocked = Math.max(0, params.billLockedTotal || 0);
  const combinedLockedTotal = billLocked + lockedCategoryTotal;

  const baseResult = calculateAdaptiveDailyLimit(
    params.totalBalance,
    params.remainingDays,
    params.reserveMode ?? "none",
    params.reserveValue ?? 0,
    combinedLockedTotal
  );

  return {
    ...baseResult,
    billLockedTotal: billLocked,
    lockedCategoryTotal,
  };
}

const CLIENT_CATEGORY_ALIAS_MAP: Record<string, string> = {
  nongkrong: "jajan & nongkrong",
  "jajan & cemilan": "jajan & nongkrong",
  bensin: "transport / bensin",
  "bensin & transport": "transport / bensin",
  kuota: "kuota & internet",
  "kuliah & fotokopi": "kuliah",
  "kebutuhan lain": "lainnya",
};

/**
 * Menormalkan nama kategori (termasuk alias sebelum Sprint 2) agar pencocokan
 * antrean offline dan notifikasi konsisten dengan nama kategori di database.
 */
export function resolvePotCategoryKey(rawName: string): string {
  const normalized = (rawName || "").toLowerCase().trim();
  return CLIENT_CATEGORY_ALIAS_MAP[normalized] || normalized;
}

/**
 * Mengagregasi total pengeluaran di antrean offline yang masuk ke rentang periode aktif.
 * Karena antrean offline hanya menyimpan transaksi yang belum tersinkron ke server,
 * menjumlahkan hasil ini ke `periodSpent` server tidak akan menggandakan hitungan setelah sinkron.
 */
export function aggregatePendingOfflineSpentByCategory(
  queue: Array<{
    type: string;
    amount: number;
    categoryName: string;
    occurredOn?: string | null;
  }>,
  periodStart: string,
  periodEnd: string,
  fallbackDateKey: string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of queue) {
    if (item.type !== "expense") continue;
    const amt = Math.max(0, Math.round(Number(item.amount || 0)));
    if (amt <= 0) continue;
    const txDate = (item.occurredOn || fallbackDateKey).slice(0, 10);
    if (periodStart && periodEnd && (txDate < periodStart || txDate > periodEnd)) {
      continue;
    }
    const key = resolvePotCategoryKey(item.categoryName);
    if (!key) continue;
    result[key] = (result[key] || 0) + amt;
  }
  return result;
}

/**
 * Format ringkas rupiah untuk ruang sempit (misal tombol 3 kolom di /record atau ringkasan 1 baris).
 * Kelipatan ribuan penuh < 1 juta ditulis `Rp Xrb` (contoh: Rp 540rb); selebihnya tetap presisi.
 */
export function formatCompactRupiah(amount: number): string {
  const abs = Math.max(0, Math.round(Math.abs(amount || 0)));
  if (abs === 0) return "Rp 0";
  if (abs >= 1000 && abs < 1_000_000 && abs % 1000 === 0) {
    return `Rp ${Math.round(abs / 1000)}rb`;
  }
  return `Rp ${abs.toLocaleString("id-ID")}`;
}
