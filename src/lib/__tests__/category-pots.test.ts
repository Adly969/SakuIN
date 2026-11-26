import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdaptiveDailyLimit,
  calculateRemainingDays,
  formatIndonesianDate,
  getJakartaCalendarParts,
  getJakartaDateString,
} from "../finance";
import {
  getCyclePeriodInfo,
  calculatePotPeriodAllocation,
  evaluatePotUsage,
  computeCategoryPots,
  calculateAllocationSummary,
  calculateFreePoolUsage,
  calculateLockedCategoryDeduction,
  calculateDailyLimitWithLockedPots,
  resolvePotCategoryKey,
  aggregatePendingOfflineSpentByCategory,
  formatCompactRupiah,
  calculatePotShift,
  suggestDefaultShiftAmount,
  getPreviousCyclePeriodInfo,
  roundExpenseForNextBudget,
  buildPreviousPeriodDrafts,
  evaluatePeriodEndResetAndCarryover,
  shouldSuggestArchivePot,
} from "../category-pots";

test("1. Jatah per sifat (Harian, Mingguan, Bulanan)", () => {
  // Siklus 30 hari
  assert.equal(calculatePotPeriodAllocation(25000, "daily", 30), 750000);
  // Mingguan: 50rb/mgg * 30 / 7 = 214.285 -> dibulatkan ribuan terdekat = 214.000
  assert.equal(calculatePotPeriodAllocation(50000, "weekly", 30), 214000);
  // Bulanan: nominal langsung (tidak dibulatkan)
  assert.equal(calculatePotPeriodAllocation(100000, "monthly", 30), 100000);
  assert.equal(calculatePotPeriodAllocation(123456, "monthly", 30), 123456);
  assert.equal(calculatePotPeriodAllocation(15500, "daily", 30), 465000);

  // Siklus mingguan tepat 7 hari
  assert.equal(calculatePotPeriodAllocation(50000, "weekly", 7), 50000);
  assert.equal(calculatePotPeriodAllocation(25000, "daily", 7), 175000);
});

test("2. Siklus bulanan/mingguan/fleksibel termasuk bukan 28/30 hari (31 hari & Feb 28 hari)", () => {
  // Januari 2026: 31 hari (siklus bulanan tgl 1)
  const janInfo = getCyclePeriodInfo(new Date(2026, 0, 10), "monthly", 1, 1);
  assert.equal(janInfo.cycleDays, 31);
  assert.equal(janInfo.periodStart, "2026-01-01");
  assert.equal(janInfo.periodEnd, "2026-01-31");
  assert.equal(janInfo.remainingDays, 22);
  assert.equal(calculatePotPeriodAllocation(25000, "daily", janInfo.cycleDays), 775000);
  // Mingguan 50rb * 31 / 7 = 221.428 -> 221.000
  assert.equal(calculatePotPeriodAllocation(50000, "weekly", janInfo.cycleDays), 221000);

  // Februari 2026 (non-kabisat: 28 hari, siklus fleksibel)
  const febFlex = getCyclePeriodInfo(new Date(2026, 1, 14), "flexible", 1, 1);
  assert.equal(febFlex.cycleDays, 28);
  assert.equal(febFlex.remainingDays, 15);
  assert.equal(calculatePotPeriodAllocation(50000, "weekly", febFlex.cycleDays), 200000);

  // Siklus bulanan payday tgl 25 melintasi Januari (31 hari) -> 25 Jan..24 Feb (31 hari)
  const payday25 = getCyclePeriodInfo(new Date(2026, 1, 10), "monthly", 25, 1);
  assert.equal(payday25.periodStart, "2026-01-25");
  assert.equal(payday25.periodEnd, "2026-02-24");
  assert.equal(payday25.cycleDays, 31);

  // Siklus mingguan (target Senin = 1, saat hari Rabu)
  const weeklyInfo = getCyclePeriodInfo(new Date(2026, 10, 25), "weekly", 1, 1); // Rabu 25 Nov 2026
  assert.equal(weeklyInfo.cycleDays, 7);
  assert.equal(weeklyInfo.remainingDays, 5); // Kam, Jum, Sab, Min, Sen
});

test("3. Pembulatan mingguan ke kelipatan Rp 1.000 terdekat (0,5 ke atas), termasuk siklus fleksibel", () => {
  // 35rb * 31 / 7 = 155.000 tepat
  assert.equal(calculatePotPeriodAllocation(35000, "weekly", 31), 155000);
  // 40rb * 30 / 7 = 171.428 -> 171.000
  assert.equal(calculatePotPeriodAllocation(40000, "weekly", 30), 171000);
  // 60rb * 30 / 7 = 257.142 -> 257.000
  assert.equal(calculatePotPeriodAllocation(60000, "weekly", 30), 257000);
  // Pembulatan biasa 0,5 ke atas: 10.500 * 1 / 7 = 1.500 -> 2.000; 3.500 * 1 / 7 = 500 -> 1.000
  assert.equal(calculatePotPeriodAllocation(10500, "weekly", 1), 2000);
  assert.equal(calculatePotPeriodAllocation(3500, "weekly", 1), 1000);
  // 2.800 * 1 / 7 = 400 -> 0
  assert.equal(calculatePotPeriodAllocation(2800, "weekly", 1), 0);
  // Siklus fleksibel bulan April (30 hari) vs Mei (31 hari)
  const aprFlex = getCyclePeriodInfo(new Date(2026, 3, 5), "flexible", 1, 1);
  const mayFlex = getCyclePeriodInfo(new Date(2026, 4, 5), "flexible", 1, 1);
  assert.equal(aprFlex.cycleDays, 30);
  assert.equal(mayFlex.cycleDays, 31);
  assert.equal(calculatePotPeriodAllocation(50000, "weekly", aprFlex.cycleDays), 214000);
  assert.equal(calculatePotPeriodAllocation(50000, "weekly", mayFlex.cycleDays), 221000);
});

test("4. Sisa Batas Hari Ini TANPA pos terkunci harus identik 100% dengan fungsi lama", () => {
  const modes = ["none", "daily_fixed", "percent", "daily_cap"] as const;
  for (const mode of modes) {
    const reserveValue =
      mode === "daily_fixed" ? 10000 : mode === "percent" ? 15 : mode === "daily_cap" ? 45000 : 0;

    const legacy = calculateAdaptiveDailyLimit(1850000, 19, mode, reserveValue, 350000);

    // Kosong & memiliki pos tetapi tidak dikunci
    const withEmpty = calculateDailyLimitWithLockedPots({
      totalBalance: 1850000,
      remainingDays: 19,
      reserveMode: mode,
      reserveValue,
      billLockedTotal: 350000,
      lockedPots: [],
    });

    const withUnlocked = calculateDailyLimitWithLockedPots({
      totalBalance: 1850000,
      remainingDays: 19,
      reserveMode: mode,
      reserveValue,
      billLockedTotal: 350000,
      lockedPots: [
        { allocatedAmount: 750000, periodSpent: 200000, isLockedFromDaily: false },
        { allocatedAmount: 200000, periodSpent: 50000, isLockedFromDaily: false },
      ],
    });

    assert.equal(withEmpty.dailyLimit, legacy.dailyLimit);
    assert.equal(withEmpty.freeBalance, legacy.freeBalance);
    assert.equal(withUnlocked.dailyLimit, legacy.dailyLimit);
    assert.equal(withUnlocked.freeBalance, legacy.freeBalance);
    assert.equal(withUnlocked.lockedCategoryTotal, 0);
  }
});

test("5. Satu dan beberapa pos terkunci (beserta anti double-counting saat terpakai)", () => {
  // Saldo bebas 1.500.000, sisa 30 hari, tanpa Dana Terkunci tagihan.
  // Satu pos terkunci: Kuota 100.000 (terpakai 0), Makan 750.000 (tidak dikunci)
  const oneLocked = calculateDailyLimitWithLockedPots({
    totalBalance: 1500000,
    remainingDays: 30,
    billLockedTotal: 0,
    lockedPots: [
      { allocatedAmount: 750000, periodSpent: 0, isLockedFromDaily: false },
      { allocatedAmount: 100000, periodSpent: 0, isLockedFromDaily: true },
    ],
  });
  // (1.500.000 - 100.000) / 30 = 46.666
  assert.equal(oneLocked.lockedCategoryTotal, 100000);
  assert.equal(oneLocked.dailyLimit, Math.floor(1400000 / 30));

  // Beberapa pos terkunci: Kuota 100rb (terpakai 40rb -> sisa 60rb), Bensin 200rb (terpakai 50rb -> sisa 150rb)
  // Saldo kas sudah berkurang 90rb -> totalBalance = 1.410.000
  const multiLocked = calculateDailyLimitWithLockedPots({
    totalBalance: 1410000,
    remainingDays: 30,
    billLockedTotal: 100000, // misalnya tagihan WiFi 100rb
    lockedPots: [
      { allocatedAmount: 100000, periodSpent: 40000, isLockedFromDaily: true },
      { allocatedAmount: 200000, periodSpent: 50000, isLockedFromDaily: true },
      { allocatedAmount: 500000, periodSpent: 100000, isLockedFromDaily: false },
    ],
  });
  // Sisa pos terkunci = 60rb + 150rb = 210rb; total locked = 100rb + 210rb = 310rb
  // (1.410.000 - 310.000) / 30 = 1.100.000 / 30 = 36.666
  assert.equal(multiLocked.lockedCategoryTotal, 210000);
  assert.equal(multiLocked.lockedTotal, 310000);
  assert.equal(multiLocked.dailyLimit, Math.floor(1100000 / 30));

  // Pos terkunci over-budget (terpakai 130rb dari 100rb): sisa dikunci = 0 (bukan negatif!)
  assert.equal(
    calculateLockedCategoryDeduction([
      { allocatedAmount: 100000, periodSpent: 130000, isLockedFromDaily: true },
    ]),
    0
  );
});

test("6. Sisa Pos & status pemakaian (aman, 80% waspada, 100% habis, >100% over budget)", () => {
  const safe = evaluatePotUsage(500000, 390000); // 78%
  assert.equal(safe.status, "safe");
  assert.equal(safe.remaining, 110000);
  assert.equal(safe.overAmount, 0);

  const warning = evaluatePotUsage(500000, 400000); // 80% tepat
  assert.equal(warning.status, "warning");
  assert.equal(warning.usagePercent, 80);

  const reached = evaluatePotUsage(500000, 500000); // 100% tepat
  assert.equal(reached.status, "reached");
  assert.equal(reached.remaining, 0);

  const exceeded = evaluatePotUsage(500000, 575000); // 115%
  assert.equal(exceeded.status, "exceeded");
  assert.equal(exceeded.remaining, 0);
  assert.equal(exceeded.overAmount, 75000);
});

test("7. Total dibagi, Sisa Bebas, kelebihan alokasi, & transaksi tanpa jatah masuk Sisa Bebas", () => {
  const pots = [
    { id: "1", name: "Makan", cadence: "daily" as const, unitAmount: 25000, isLockedFromDaily: false, periodSpent: 200000 },
    { id: "2", name: "Transport / Bensin", cadence: "weekly" as const, unitAmount: 50000, isLockedFromDaily: true, periodSpent: 50000 },
    { id: "3", name: "Kuota & Internet", cadence: "monthly" as const, unitAmount: 100000, isLockedFromDaily: true, periodSpent: 0 },
    // Pos Lainnya tidak ikut dijumlah sebagai alokasi tetap
    { id: "4", name: "Lainnya", cadence: "monthly" as const, unitAmount: 0, isLockedFromDaily: false, isOther: true, periodSpent: 120000 },
  ];

  // Dana tersedia 1.500.000, siklus 30 hari
  // Makan = 750.000, Bensin = 214.000, Kuota = 100.000 -> total dibagi = 1.064.000
  // Sisa Bebas = 1.500.000 - 1.064.000 = 436.000
  const summary = calculateAllocationSummary(1500000, pots, 30);
  assert.equal(summary.totalAllocated, 1064000);
  assert.equal(summary.freeRemaining, 436000);
  assert.equal(summary.isOverAllocated, false);
  assert.equal(summary.overAllocatedAmount, 0);

  // Transaksi tanpa jatah (misal di kategori tanpa budget atau Lainnya = 120.000) mengurangi Sisa Bebas
  const freePool = calculateFreePoolUsage(summary.safeFreeRemaining, 120000);
  assert.equal(freePool.remaining, 316000);
  assert.equal(freePool.status, "safe");

  // Kelebihan alokasi: dana cuma 900.000, tetapi total dibagi 1.064.000
  const overSummary = calculateAllocationSummary(900000, pots, 30);
  assert.equal(overSummary.isOverAllocated, true);
  assert.equal(overSummary.overAllocatedAmount, 164000);
  assert.equal(overSummary.freeRemaining, -164000);
  assert.equal(overSummary.safeFreeRemaining, 0);

  // computeCategoryPots menghitung status & sisa per pos sekaligus
  const computed = computeCategoryPots(pots.slice(0, 3), 30);
  assert.equal(computed[0].allocatedAmount, 750000);
  assert.equal(computed[0].remaining, 550000);
  assert.equal(computed[1].allocatedAmount, 214000);
  assert.equal(computed[1].remaining, 164000);
});

test("8. Konsistensi offline queue, alias kategori, & format ringkas", () => {
  // Alias sebelum Sprint 2 dipetakan ke nama pos resmi
  assert.equal(resolvePotCategoryKey("Nongkrong"), "jajan & nongkrong");
  assert.equal(resolvePotCategoryKey("Jajan & Cemilan"), "jajan & nongkrong");
  assert.equal(resolvePotCategoryKey("Bensin"), "transport / bensin");
  assert.equal(resolvePotCategoryKey("Kuota"), "kuota & internet");

  // Agregasi pengeluaran di antrean offline hanya menghitung expense dalam rentang periode
  const pending = aggregatePendingOfflineSpentByCategory(
    [
      { type: "expense", amount: 25000, categoryName: "Makan", occurredOn: "2026-11-15" },
      { type: "expense", amount: 15000, categoryName: "Nongkrong", occurredOn: "2026-11-20" },
      { type: "income", amount: 500000, categoryName: "Uang Kiriman", occurredOn: "2026-11-20" },
      { type: "expense", amount: 40000, categoryName: "Makan", occurredOn: "2026-10-30" }, // di luar periode
    ],
    "2026-11-01",
    "2026-11-30",
    "2026-11-26"
  );

  assert.equal(pending["makan"], 25000);
  assert.equal(pending["jajan & nongkrong"], 15000);
  assert.equal(pending["uang kiriman"], undefined);

  // Simulasi sebelum & sesudah sinkron tidak dobel:
  // Offline: serverSpent=100rb + pending=25rb => sisa 375rb dari jatah 500rb
  const offlineUsage = evaluatePotUsage(500000, 100000 + (pending["makan"] || 0));
  assert.equal(offlineUsage.remaining, 375000);

  // Setelah sinkron: antrean kosong & serverSpent sudah jadi 125rb => sisa tetap 375rb
  const afterSyncQueue = aggregatePendingOfflineSpentByCategory([], "2026-11-01", "2026-11-30", "2026-11-26");
  const syncedUsage = evaluatePotUsage(500000, 125000 + (afterSyncQueue["makan"] || 0));
  assert.equal(syncedUsage.remaining, 375000);

  // Format ringkas rupiah
  assert.equal(formatCompactRupiah(540000), "Rp 540rb");
  assert.equal(formatCompactRupiah(542500), "Rp 542.500");
  assert.equal(formatCompactRupiah(0), "Rp 0");
});

test("9. Geser jatah: total dana tetap, tidak boleh melebihi sisa pos asal, & saran otomatis", () => {
  // Nongkrong jatah 300rb (terpakai 100rb -> sisa 200rb), Makan jatah 500rb (terpakai 550rb -> defisit 50rb)
  const suggested = suggestDefaultShiftAmount({
    toAllocated: 500000,
    toSpent: 550000,
    fromRemaining: 200000,
  });
  assert.equal(suggested, 50000);

  const shiftOk = calculatePotShift({
    fromAllocated: 300000,
    fromSpent: 100000,
    toAllocated: 500000,
    requestedAmount: suggested,
  });
  assert.equal(shiftOk.valid, true);
  assert.equal(shiftOk.nextFromAllocated, 250000);
  assert.equal(shiftOk.nextToAllocated, 550000);
  assert.equal(shiftOk.totalBefore, shiftOk.totalAfter); // total dana tidak berubah (800rb)

  // Melebihi sisa pos asal (sisa 200rb, minta 250rb) harus ditolak
  const shiftFail = calculatePotShift({
    fromAllocated: 300000,
    fromSpent: 100000,
    toAllocated: 500000,
    requestedAmount: 250000,
  });
  assert.equal(shiftFail.valid, false);
  assert.equal(shiftFail.totalBefore, shiftFail.totalAfter);
});

test("10. Pergantian periode (Bulanan, Mingguan, Fleksibel), pratinjau jatah lalu, & reset carryover tanpa defisit", () => {
  // Siklus Bulanan tgl 25 melintasi Februari non-kabisat 2026 (28 hari)
  const marMonthlyPrev = getPreviousCyclePeriodInfo(new Date(2026, 2, 10), "monthly", 25, 1);
  // Periode aktif Mar 10 dg tgl kiriman 25 adalah 25 Feb..24 Mar; sebelumnya adalah 25 Jan..24 Feb (31 hari)
  assert.equal(marMonthlyPrev.periodStart, "2026-01-25");
  assert.equal(marMonthlyPrev.periodEnd, "2026-02-24");
  assert.equal(marMonthlyPrev.cycleDays, 31);

  // Siklus Fleksibel di bulan Maret 2026 -> periode sebelumnya adalah Februari 2026 (28 hari)
  const flexPrev = getPreviousCyclePeriodInfo(new Date(2026, 2, 5), "flexible", 1, 1);
  assert.equal(flexPrev.periodStart, "2026-02-01");
  assert.equal(flexPrev.periodEnd, "2026-02-28");
  assert.equal(flexPrev.cycleDays, 28);

  // Siklus Mingguan (Senin = 1) saat Kamis 26 Nov 2026 -> periode aktif Sen 23..Min 29 Nov, sebelumnya Sen 16..Min 22 Nov
  const weeklyPrev = getPreviousCyclePeriodInfo(new Date(2026, 10, 26), "weekly", 1, 1);
  assert.equal(weeklyPrev.cycleDays, 7);
  assert.equal(weeklyPrev.periodStart, "2026-11-16");
  assert.equal(weeklyPrev.periodEnd, "2026-11-22");

  // Pembulatan pengeluaran asli & dua preset periode berikutnya
  assert.equal(roundExpenseForNextBudget(423000), 420000);
  assert.equal(roundExpenseForNextBudget(426000), 430000);
  assert.equal(roundExpenseForNextBudget(33000), 35000);

  const presetInputs = [
    {
      categoryId: "c1",
      name: "Makan",
      cadence: "daily" as const,
      currentAllocated: 750000,
      prevAllocated: 800000,
      prevSpent: 716000,
      cycleDays: 30,
    },
  ];
  const copied = buildPreviousPeriodDrafts(presetInputs, "copy_previous");
  assert.equal(copied[0].nextAllocated, 800000);
  const adjusted = buildPreviousPeriodDrafts(presetInputs, "adjust_to_spent");
  assert.equal(adjusted[0].nextAllocated, 720000);

  // Reset akhir periode & carryover:
  // Makan sempat digeser ke 800rb tapi patokan semula 25rb/hari (30 hari -> 750rb), terpakai 650rb -> surplus 150rb
  // Nongkrong jatah 200rb, terpakai 280rb -> defisit 80rb (TIDAK dibawa & TIDAK mengurangi surplus Makan!)
  const resetResult = evaluatePeriodEndResetAndCarryover({
    newCycleDays: 30,
    pots: [
      {
        potId: "p1",
        name: "Makan",
        cadence: "daily",
        unitAmount: 25000,
        prevAllocatedAmount: 800000,
        prevSpent: 650000,
      },
      {
        potId: "p2",
        name: "Jajan & Nongkrong",
        cadence: "monthly",
        unitAmount: 200000,
        prevAllocatedAmount: 200000,
        prevSpent: 280000,
      },
    ],
  });

  assert.equal(resetResult.totalPositiveSurplus, 150000);
  assert.equal(resetResult.deficitPotsCount, 1);
  assert.equal(resetResult.perPot[0].resetAllocatedAmount, 750000); // kembali ke patokan semula
  assert.equal(resetResult.perPot[1].carriedDeficitAmount, 0); // defisit tidak dibawa
  assert.equal(resetResult.perPot[1].resetAllocatedAmount, 200000); // tetap patokan semula

  // Uji tawaran arsip 2 periode tanpa pemakaian
  assert.equal(
    shouldSuggestArchivePot({
      isArchived: false,
      existedInPrevPeriod: true,
      prevPeriodSpent: 0,
      currentPeriodSpent: 0,
    }),
    true
  );
  assert.equal(
    shouldSuggestArchivePot({
      isArchived: false,
      existedInPrevPeriod: false, // pos baru dibuat di periode ini
      prevPeriodSpent: 0,
      currentPeriodSpent: 0,
    }),
    false
  );
});

test("11. Kalender WIB (Asia/Jakarta) akurat meski waktu UTC masih kemarin (00:15 WIB)", () => {
  // 2026-11-26T17:15:22Z === 2026-11-27T00:15:22+07:00 (Jumat, 27 Nov 2026 WIB)
  const midnightPlus15Wib = new Date("2026-11-26T17:15:22.000Z");

  assert.equal(getJakartaDateString(midnightPlus15Wib), "2026-11-27");
  const parts = getJakartaCalendarParts(midnightPlus15Wib);
  assert.equal(parts.year, 2026);
  assert.equal(parts.monthNumber, 11);
  assert.equal(parts.day, 27);
  assert.equal(parts.weekday, 5); // Jumat

  const formatted = formatIndonesianDate(midnightPlus15Wib);
  assert.equal(formatted.full, "Jumat, 27 November 2026");
  assert.equal(formatted.short, "27 Nov 2026");

  // Sisa hari & periode siklus tetap memakai tanggal 27 Nov WIB, bukan 26 Nov UTC
  assert.equal(calculateRemainingDays(midnightPlus15Wib, 1, "flexible", 1), 4); // 27,28,29,30 Nov
  const periodInfo = getCyclePeriodInfo(midnightPlus15Wib, "flexible", 1, 1);
  assert.equal(periodInfo.remainingDays, 4);
});
