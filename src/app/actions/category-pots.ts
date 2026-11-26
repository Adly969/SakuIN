"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  profiles,
  categories,
  categoryPots,
  categoryPotPeriods,
  categoryPotTransfers,
  transactions,
  accounts,
  savingsEntries,
  lockedFunds,
  budgets,
  categoryBudgets,
} from "@/db/schema";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calculateAdaptiveDailyLimit,
  type AllowanceCycle,
  type ReserveMode,
} from "@/lib/finance";
import {
  getCyclePeriodInfo,
  getPreviousCyclePeriodInfo,
  calculatePotPeriodAllocation,
  calculatePotShift,
  shouldSuggestArchivePot,
  type PotCadence,
} from "@/lib/category-pots";
import { getJakartaDateKey } from "@/lib/daily-limit-server";
import {
  ensureFallbackLainnyaCategory,
  EXCLUDED_BILL_CATEGORIES,
  isProtectedCategory,
} from "@/lib/category-pots-server";

const INITIAL_PRIORITY_ORDER = [
  "makan",
  "transport / bensin",
  "kuota & internet",
  "jajan & nongkrong",
  "kuliah",
  "lainnya",
];

export interface BudgetPotWorkspaceItem {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  defaultCadence: PotCadence;
  cadence: PotCadence;
  unitAmount: number;
  allocatedAmount: number;
  isLockedFromDaily: boolean;
  isSelected: boolean;
  isDefault: boolean;
  isOther: boolean;
  isCustom: boolean;
  periodSpent: number;
  prevAllocatedAmount: number;
  prevPeriodSpent: number;
  suggestArchive: boolean;
}

export interface PotTransferLogItem {
  id: string;
  fromCategoryId: string;
  fromName: string;
  toCategoryId: string;
  toName: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface ArchivedPotSummary {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  cadence: PotCadence;
  unitAmount: number;
}

export interface BudgetsWorkspaceData {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  cycleDays: number;
  remainingDays: number;
  allowanceCycle: AllowanceCycle;
  previousPeriod: {
    periodKey: string;
    periodStart: string;
    periodEnd: string;
    cycleDays: number;
    hasData: boolean;
  };
  dailyLimitContext: {
    totalBalance: number;
    remainingDays: number;
    reserveMode: ReserveMode;
    reserveValue: number;
    billLockedTotal: number;
    reservedTotal: number;
    availableFunds: number;
  };
  pots: BudgetPotWorkspaceItem[];
  archivedPots: ArchivedPotSummary[];
  recentTransfers: PotTransferLogItem[];
}

export async function getBudgetsWorkspaceAction(): Promise<{
  success: boolean;
  error?: string;
  data?: BudgetsWorkspaceData;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    const today = new Date();
    const todayKey = getJakartaDateKey(today);
    const currentMonthKey = todayKey.slice(0, 7);

    // Pastikan kategori Lainnya (expense) selalu tersedia
    await ensureFallbackLainnyaCategory(userId);

    const [
      userProfile,
      userAccounts,
      activeLockedFunds,
      userSavings,
      userTransactions,
      userCategories,
      userPots,
      monthBudget,
    ] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
      db.query.accounts.findMany({ where: eq(accounts.userId, userId) }),
      db.query.lockedFunds.findMany({
        where: and(eq(lockedFunds.userId, userId), eq(lockedFunds.isPaid, false)),
      }),
      db.query.savingsEntries.findMany({ where: eq(savingsEntries.userId, userId) }),
      db.query.transactions.findMany({
        where: and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
      }),
      db.query.categories.findMany({
        where: and(
          eq(categories.userId, userId),
          eq(categories.type, "expense")
        ),
        orderBy: [asc(categories.sortOrder), asc(categories.name)],
      }),
      db.query.categoryPots.findMany({ where: eq(categoryPots.userId, userId) }),
      db.query.budgets.findFirst({
        where: and(eq(budgets.userId, userId), eq(budgets.month, `${currentMonthKey}-01`)),
      }),
    ]);

    const allowance = Number(userProfile?.monthlyAllowance || 0);
    const paydayDay = userProfile?.paydayDay || 1;
    const allowanceCycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
    const paydayWeekday = userProfile?.paydayWeekday ?? 1;
    const reserveMode = (userProfile?.reserveMode as ReserveMode) || "none";
    const reserveValue = Number(userProfile?.reserveValue || 0);

    const periodInfo = getCyclePeriodInfo(today, allowanceCycle, paydayDay, paydayWeekday);
    const prevPeriodInfo = getPreviousCyclePeriodInfo(today, allowanceCycle, paydayDay, paydayWeekday);

    const [periodOverrides, prevPeriodOverrides, periodTransfers] = await Promise.all([
      db.query.categoryPotPeriods.findMany({
        where: and(
          eq(categoryPotPeriods.userId, userId),
          eq(categoryPotPeriods.periodKey, periodInfo.periodKey)
        ),
      }),
      db.query.categoryPotPeriods.findMany({
        where: and(
          eq(categoryPotPeriods.userId, userId),
          eq(categoryPotPeriods.periodKey, prevPeriodInfo.periodKey)
        ),
      }),
      db.query.categoryPotTransfers.findMany({
        where: and(
          eq(categoryPotTransfers.userId, userId),
          eq(categoryPotTransfers.periodKey, periodInfo.periodKey)
        ),
        orderBy: [desc(categoryPotTransfers.createdAt)],
        limit: 15,
      }),
    ]);

    const legacyCategoryBudgets = monthBudget
      ? await db.query.categoryBudgets.findMany({
          where: eq(categoryBudgets.budgetId, monthBudget.id),
        })
      : [];

    // Hitung total pengeluaran periode berjalan, periode lalu, & bulan berjalan (selaras dengan Dashboard)
    let totalExpenseMonth = 0;
    let totalIncomeMonth = 0;
    const spentByCategoryPeriod: Record<string, number> = {};
    const spentByCategoryPrevPeriod: Record<string, number> = {};

    for (const tx of userTransactions) {
      const amt = Number(tx.amount || 0);
      const txMonthKey = tx.occurredOn ? tx.occurredOn.slice(0, 7) : currentMonthKey;
      if (tx.type === "expense") {
        if (txMonthKey === currentMonthKey) totalExpenseMonth += amt;
        if (
          tx.occurredOn &&
          tx.occurredOn >= periodInfo.periodStart &&
          tx.occurredOn <= periodInfo.periodEnd
        ) {
          spentByCategoryPeriod[tx.categoryId] =
            (spentByCategoryPeriod[tx.categoryId] || 0) + amt;
        }
        if (
          tx.occurredOn &&
          tx.occurredOn >= prevPeriodInfo.periodStart &&
          tx.occurredOn <= prevPeriodInfo.periodEnd
        ) {
          spentByCategoryPrevPeriod[tx.categoryId] =
            (spentByCategoryPrevPeriod[tx.categoryId] || 0) + amt;
        }
      } else if (tx.type === "income") {
        if (txMonthKey === currentMonthKey) totalIncomeMonth += amt;
      }
    }

    let totalSavedMonth = 0;
    for (const s of userSavings) {
      const sMonthKey = s.occurredOn ? s.occurredOn.slice(0, 7) : currentMonthKey;
      if (sMonthKey === currentMonthKey) {
        if (s.type === "deposit") totalSavedMonth += Number(s.amount || 0);
        if (s.type === "withdraw") totalSavedMonth -= Number(s.amount || 0);
      }
    }

    const totalAccountsBalance = userAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const hasAccountsData =
      userAccounts.some((a) => Number(a.balance || 0) !== 0) ||
      userTransactions.some((t) => Boolean(t.accountId));

    const remainingBudget = Math.max(
      0,
      allowance + totalIncomeMonth - totalExpenseMonth - Math.max(0, totalSavedMonth)
    );
    const remainingBalance = hasAccountsData
      ? Math.max(0, totalAccountsBalance)
      : remainingBudget;
    const billLockedTotal = activeLockedFunds.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const baseAdaptive = calculateAdaptiveDailyLimit(
      remainingBalance,
      periodInfo.remainingDays,
      reserveMode,
      reserveValue,
      billLockedTotal
    );

    const availableFunds = baseAdaptive.spendableBalance;

    const potByCatId = new Map(userPots.map((p) => [p.categoryId, p]));
    const potById = new Map(userPots.map((p) => [p.id, p]));
    const catById = new Map(userCategories.map((c) => [c.id, c]));
    const overrideByPotId = new Map(periodOverrides.map((o) => [o.potId, o]));
    const prevOverrideByPotId = new Map(prevPeriodOverrides.map((o) => [o.potId, o]));
    const legacyLimitByCatId = new Map(
      legacyCategoryBudgets.map((cb) => [cb.categoryId, Number(cb.limitAmount || 0)])
    );

    const visibleCats = userCategories.filter(
      (c) => !c.isHidden && !EXCLUDED_BILL_CATEGORIES.has((c.name || "").toLowerCase().trim())
    );
    const archivedPots: ArchivedPotSummary[] = userCategories
      .filter(
        (c) =>
          c.isHidden &&
          !isProtectedCategory(c) &&
          !EXCLUDED_BILL_CATEGORIES.has((c.name || "").toLowerCase().trim())
      )
      .map((c) => {
        const p = potByCatId.get(c.id);
        return {
          categoryId: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          cadence: ((p?.cadence as PotCadence) || (c.defaultCadence as PotCadence) || "monthly"),
          unitAmount: Number(p?.unitAmount || 0),
        };
      });

    visibleCats.sort((a, b) => {
      const idxA = INITIAL_PRIORITY_ORDER.indexOf((a.name || "").toLowerCase().trim());
      const idxB = INITIAL_PRIORITY_ORDER.indexOf((b.name || "").toLowerCase().trim());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    });

    const pots: BudgetPotWorkspaceItem[] = visibleCats.map((cat) => {
      const lower = (cat.name || "").toLowerCase().trim();
      const isOther = lower === "lainnya";
      const existingPot = potByCatId.get(cat.id);
      const override = existingPot ? overrideByPotId.get(existingPot.id) : undefined;
      const prevOverride = existingPot ? prevOverrideByPotId.get(existingPot.id) : undefined;
      const legacyLimit = legacyLimitByCatId.get(cat.id) || 0;

      const defaultCadence = ((cat.defaultCadence as PotCadence) || "monthly");
      const cadence = ((existingPot?.cadence as PotCadence) || defaultCadence);
      const unitAmount = existingPot
        ? Number(existingPot.unitAmount || 0)
        : legacyLimit > 0
        ? legacyLimit
        : 0;

      const storedAllocated = override
        ? Number(override.allocatedAmount || 0)
        : existingPot
        ? calculatePotPeriodAllocation(unitAmount, cadence, periodInfo.cycleDays)
        : legacyLimit > 0
        ? legacyLimit
        : 0;

      const isSelected = isOther
        ? true
        : existingPot
        ? !existingPot.isArchived
        : legacyLimit > 0
        ? true
        : Boolean(cat.isDefault);

      const prevAllocatedAmount = prevOverride
        ? Number(prevOverride.allocatedAmount || 0)
        : existingPot && !existingPot.isArchived && unitAmount > 0
        ? calculatePotPeriodAllocation(unitAmount, cadence, prevPeriodInfo.cycleDays)
        : 0;
      const currentSpent = spentByCategoryPeriod[cat.id] || 0;
      const prevSpent = spentByCategoryPrevPeriod[cat.id] || 0;

      const potCreatedKey = existingPot?.createdAt
        ? getJakartaDateKey(new Date(existingPot.createdAt))
        : cat.createdAt
        ? getJakartaDateKey(new Date(cat.createdAt))
        : todayKey;
      const existedInPrevPeriod =
        Boolean(prevOverride) || potCreatedKey <= prevPeriodInfo.periodEnd;

      const suggestArchive =
        !isOther &&
        isSelected &&
        shouldSuggestArchivePot({
          isArchived: Boolean(cat.isHidden),
          isOther,
          existedInPrevPeriod,
          prevPeriodSpent: prevSpent,
          currentPeriodSpent: currentSpent,
          inactivePeriods: existingPot?.inactivePeriods || 0,
        });

      return {
        categoryId: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        defaultCadence,
        cadence,
        unitAmount,
        allocatedAmount: storedAllocated,
        isLockedFromDaily: isOther ? false : Boolean(existingPot?.isLockedFromDaily),
        isSelected,
        isDefault: Boolean(cat.isDefault),
        isOther,
        isCustom: !cat.isDefault && lower !== "laundry" && lower !== "rokok",
        periodSpent: currentSpent,
        prevAllocatedAmount,
        prevPeriodSpent: prevSpent,
        suggestArchive,
      };
    });

    const hasPrevData =
      prevPeriodOverrides.length > 0 ||
      Object.values(spentByCategoryPrevPeriod).some((v) => v > 0) ||
      pots.some((p) => !p.isOther && p.prevAllocatedAmount > 0);

    const recentTransfers: PotTransferLogItem[] = periodTransfers.map((tr) => {
      const fromPot = potById.get(tr.fromPotId);
      const toPot = potById.get(tr.toPotId);
      const fromCat = fromPot ? catById.get(fromPot.categoryId) : undefined;
      const toCat = toPot ? catById.get(toPot.categoryId) : undefined;
      return {
        id: tr.id,
        fromCategoryId: fromPot?.categoryId || "",
        fromName: fromCat?.name || "Pos Asal",
        toCategoryId: toPot?.categoryId || "",
        toName: toCat?.name || "Pos Tujuan",
        amount: Number(tr.amount || 0),
        note: tr.note,
        createdAt: tr.createdAt.toISOString(),
      };
    });

    return {
      success: true,
      data: {
        periodKey: periodInfo.periodKey,
        periodStart: periodInfo.periodStart,
        periodEnd: periodInfo.periodEnd,
        cycleDays: periodInfo.cycleDays,
        remainingDays: periodInfo.remainingDays,
        allowanceCycle,
        previousPeriod: {
          periodKey: prevPeriodInfo.periodKey,
          periodStart: prevPeriodInfo.periodStart,
          periodEnd: prevPeriodInfo.periodEnd,
          cycleDays: prevPeriodInfo.cycleDays,
          hasData: hasPrevData,
        },
        dailyLimitContext: {
          totalBalance: remainingBalance,
          remainingDays: periodInfo.remainingDays,
          reserveMode,
          reserveValue,
          billLockedTotal,
          reservedTotal: baseAdaptive.reservedTotal,
          availableFunds,
        },
        pots,
        archivedPots,
        recentTransfers,
      },
    };
  } catch (error) {
    console.error("Gagal memuat workspace Atur Jatah Kategori:", error);
    return { success: false, error: "Gagal memuat data pembagian pos kategori" };
  }
}

const saveBatchSchema = z.object({
  pots: z
    .array(
      z.object({
        categoryId: z.string().uuid("Kategori tidak valid"),
        isSelected: z.boolean(),
        cadence: z.enum(["daily", "weekly", "monthly"]),
        unitAmount: z.number().min(0).max(1000000000),
        allocatedAmount: z.number().min(0).max(1000000000),
        isLockedFromDaily: z.boolean(),
        sortOrder: z.number().int().min(0).default(0),
      })
    )
    .min(1, "Minimal 1 kategori"),
});

export async function saveCategoryPotsBatchAction(rawInput: z.infer<typeof saveBatchSchema>) {
  try {
    const validation = saveBatchSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const [userProfile, userCats, existingPots] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
      db.query.categories.findMany({
        where: and(eq(categories.userId, userId), eq(categories.type, "expense")),
      }),
      db.query.categoryPots.findMany({ where: eq(categoryPots.userId, userId) }),
    ]);

    const catMap = new Map(userCats.map((c) => [c.id, c]));
    const activeNonOther = validation.data.pots.filter((p) => {
      if (!p.isSelected) return false;
      const c = catMap.get(p.categoryId);
      if (!c) return false;
      const lower = (c.name || "").toLowerCase().trim();
      return lower !== "lainnya" && !EXCLUDED_BILL_CATEGORIES.has(lower);
    });

    if (activeNonOther.length > 8) {
      return {
        success: false,
        error: "Maksimal 8 pos aktif agar pembagian jatah tetap simpel dan mudah dipantau.",
      };
    }

    const allowanceCycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
    const paydayDay = userProfile?.paydayDay || 1;
    const paydayWeekday = userProfile?.paydayWeekday ?? 1;
    const periodInfo = getCyclePeriodInfo(new Date(), allowanceCycle, paydayDay, paydayWeekday);

    const existingPotMap = new Map(existingPots.map((p) => [p.categoryId, p]));

    // Pastikan bulan kalender di tabel `budgets` siap untuk sinkronisasi Kontrol Pos Boros lama
    const monthDate = `${getJakartaDateKey().slice(0, 7)}-01`;
    let legacyBudget = await db.query.budgets.findFirst({
      where: and(eq(budgets.userId, userId), eq(budgets.month, monthDate)),
    });

    for (const item of validation.data.pots) {
      const cat = catMap.get(item.categoryId);
      if (!cat) continue;
      const lower = (cat.name || "").toLowerCase().trim();
      if (EXCLUDED_BILL_CATEGORIES.has(lower) || lower === "lainnya") continue;

      const existing = existingPotMap.get(item.categoryId);
      const safeUnit = Math.max(0, Math.round(item.unitAmount));
      const safeAlloc = Math.max(0, Math.round(item.allocatedAmount));
      const isActive = item.isSelected;

      let potId = existing?.id;

      if (existing) {
        await db
          .update(categoryPots)
          .set({
            cadence: item.cadence,
            unitAmount: BigInt(safeUnit),
            isLockedFromDaily: isActive ? item.isLockedFromDaily : false,
            isArchived: !isActive,
            sortOrder: item.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(categoryPots.id, existing.id));
      } else if (isActive) {
        const [inserted] = await db
          .insert(categoryPots)
          .values({
            userId,
            categoryId: item.categoryId,
            cadence: item.cadence,
            unitAmount: BigInt(safeUnit),
            isLockedFromDaily: item.isLockedFromDaily,
            isArchived: false,
            sortOrder: item.sortOrder,
          })
          .returning();
        potId = inserted.id;
      }

      if (potId && isActive) {
        // Simpan nilai bulat periode ke category_pot_periods agar tidak dihitung ulang tiap hari
        await db
          .insert(categoryPotPeriods)
          .values({
            userId,
            potId,
            periodKey: periodInfo.periodKey,
            periodStart: periodInfo.periodStart,
            periodEnd: periodInfo.periodEnd,
            baseLimit: BigInt(safeAlloc),
            allocatedAmount: BigInt(safeAlloc),
          })
          .onConflictDoUpdate({
            target: [categoryPotPeriods.potId, categoryPotPeriods.periodKey],
            set: {
              periodStart: periodInfo.periodStart,
              periodEnd: periodInfo.periodEnd,
              baseLimit: BigInt(safeAlloc),
              allocatedAmount: BigInt(safeAlloc),
              updatedAt: new Date(),
            },
          });
      }

      // Sinkronkan ke category_budgets lama agar Kontrol Pos Boros lama tetap konsisten
      if (isActive && safeAlloc > 0) {
        if (!legacyBudget) {
          const [createdBudget] = await db
            .insert(budgets)
            .values({
              userId,
              month: monthDate,
              totalLimit: BigInt(safeAlloc),
            })
            .returning();
          legacyBudget = createdBudget;
        }
        await db
          .insert(categoryBudgets)
          .values({
            budgetId: legacyBudget.id,
            categoryId: item.categoryId,
            limitAmount: BigInt(safeAlloc),
          })
          .onConflictDoUpdate({
            target: [categoryBudgets.budgetId, categoryBudgets.categoryId],
            set: {
              limitAmount: BigInt(safeAlloc),
              updatedAt: new Date(),
            },
          });
      } else if (legacyBudget) {
        await db
          .delete(categoryBudgets)
          .where(
            and(
              eq(categoryBudgets.budgetId, legacyBudget.id),
              eq(categoryBudgets.categoryId, item.categoryId)
            )
          );
      }
    }

    revalidatePath("/budgets");
    revalidatePath("/statistics");
    revalidatePath("/dashboard");
    revalidatePath("/record");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan pembagian pos:", error);
    return { success: false, error: "Gagal menyimpan pembagian jatah kategori" };
  }
}

const createCustomPotSchema = z.object({
  name: z.string().trim().min(1, "Nama pos wajib diisi").max(40, "Nama pos maksimal 40 karakter"),
  cadence: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
});

export async function createCustomCategoryPotAction(
  rawInput: z.infer<typeof createCustomPotSchema>
): Promise<{
  success: boolean;
  error?: string;
  data?: BudgetPotWorkspaceItem;
}> {
  try {
    const validation = createCustomPotSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { name, cadence } = validation.data;
    const lower = name.toLowerCase().trim();

    if (EXCLUDED_BILL_CATEGORIES.has(lower)) {
      return {
        success: false,
        error: "Kos, WiFi, dan Listrik dikelola melalui Dana Terkunci di halaman Rekening.",
      };
    }

    if (lower === "lainnya" || lower === "kebutuhan lain") {
      return {
        success: false,
        error: "Kategori Lainnya sudah tersedia otomatis sebagai penampung Sisa Bebas.",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const existingCats = await db.query.categories.findMany({
      where: and(eq(categories.userId, userId), eq(categories.type, "expense")),
    });

    const match = existingCats.find((c) => (c.name || "").toLowerCase().trim() === lower);

    let categoryRow = match;
    if (categoryRow) {
      if (categoryRow.isHidden) {
        const [unhidden] = await db
          .update(categories)
          .set({ isHidden: false, defaultCadence: cadence, updatedAt: new Date() })
          .where(eq(categories.id, categoryRow.id))
          .returning();
        categoryRow = unhidden;
      }
    } else {
      const [inserted] = await db
        .insert(categories)
        .values({
          userId,
          name,
          type: "expense",
          icon: "Tag",
          color: "#8CCBFF",
          isDefault: false,
          isHidden: false,
          requiresLabel: false,
          defaultCadence: cadence,
          sortOrder: existingCats.length + 1,
        })
        .returning();
      categoryRow = inserted;
    }

    revalidatePath("/budgets");
    revalidatePath("/record");

    return {
      success: true,
      data: {
        categoryId: categoryRow.id,
        name: categoryRow.name,
        icon: categoryRow.icon,
        color: categoryRow.color,
        defaultCadence: (categoryRow.defaultCadence as PotCadence) || cadence,
        cadence,
        unitAmount: 0,
        allocatedAmount: 0,
        isLockedFromDaily: false,
        isSelected: true,
        isDefault: Boolean(categoryRow.isDefault),
        isOther: false,
        isCustom: !categoryRow.isDefault && lower !== "laundry" && lower !== "rokok",
        periodSpent: 0,
        prevAllocatedAmount: 0,
        prevPeriodSpent: 0,
        suggestArchive: false,
      },
    };
  } catch (error) {
    console.error("Gagal menambah pos kategori kustom:", error);
    return { success: false, error: "Gagal menambahkan pos baru" };
  }
}

/**
 * Aksi ringkas dari konfirmasi Hari Kiriman (Payday):
 * Me-reset jatah pos ke patokan semula untuk periode baru (bukan hasil geser sementara periode lalu).
 */
export async function reusePreviousPeriodPotsAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const [userProfile, activePots] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
      db.query.categoryPots.findMany({
        where: and(eq(categoryPots.userId, userId), eq(categoryPots.isArchived, false)),
      }),
    ]);

    const candidatePots = activePots.filter((p) => Number(p.unitAmount || 0) > 0);
    if (candidatePots.length === 0) {
      return { success: false, error: "Belum ada pembagian pos dari periode lalu" };
    }

    const allowanceCycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
    const paydayDay = userProfile?.paydayDay || 1;
    const paydayWeekday = userProfile?.paydayWeekday ?? 1;
    const periodInfo = getCyclePeriodInfo(new Date(), allowanceCycle, paydayDay, paydayWeekday);

    for (const pot of candidatePots) {
      // Reset ke patokan semula sesuai sifat pos dan panjang siklus baru
      const nextAlloc = calculatePotPeriodAllocation(
        Number(pot.unitAmount || 0),
        (pot.cadence as PotCadence) || "monthly",
        periodInfo.cycleDays
      );
      if (nextAlloc <= 0) continue;

      await db
        .insert(categoryPotPeriods)
        .values({
          userId,
          potId: pot.id,
          periodKey: periodInfo.periodKey,
          periodStart: periodInfo.periodStart,
          periodEnd: periodInfo.periodEnd,
          baseLimit: BigInt(nextAlloc),
          allocatedAmount: BigInt(nextAlloc),
        })
        .onConflictDoUpdate({
          target: [categoryPotPeriods.potId, categoryPotPeriods.periodKey],
          set: {
            periodStart: periodInfo.periodStart,
            periodEnd: periodInfo.periodEnd,
            baseLimit: BigInt(nextAlloc),
            allocatedAmount: BigInt(nextAlloc),
            updatedAt: new Date(),
          },
        });
    }

    revalidatePath("/budgets");
    revalidatePath("/statistics");
    revalidatePath("/dashboard");
    revalidatePath("/record");

    return { success: true, count: candidatePots.length };
  } catch (error) {
    console.error("Gagal memakai pembagian periode lalu:", error);
    return { success: false, error: "Gagal memakai pembagian periode lalu" };
  }
}

const shiftPotSchema = z.object({
  fromCategoryId: z.string().uuid("Pos asal tidak valid"),
  toCategoryId: z.string().uuid("Pos tujuan tidak valid"),
  amount: z.number().positive("Nominal harus lebih dari Rp 0").max(1000000000),
  note: z.string().max(120).optional(),
});

/**
 * Menggeser sebagian jatah dari satu pos yang masih bersisa ke pos tujuan
 * dalam periode berjalan. Total dana tidak berubah dan dicatat di `category_pot_transfers`.
 */
export async function shiftCategoryPotAction(
  rawInput: z.infer<typeof shiftPotSchema>
): Promise<{
  success: boolean;
  error?: string;
  data?: {
    fromName: string;
    toName: string;
    shiftedAmount: number;
    nextFromAllocated: number;
    nextToAllocated: number;
  };
}> {
  try {
    const validation = shiftPotSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(", "),
      };
    }
    const input = validation.data;
    if (input.fromCategoryId === input.toCategoryId) {
      return { success: false, error: "Pos asal dan tujuan harus berbeda" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const [userProfile, userCats, userPots, userTransactions] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
      db.query.categories.findMany({
        where: and(eq(categories.userId, userId), eq(categories.type, "expense")),
      }),
      db.query.categoryPots.findMany({
        where: and(eq(categoryPots.userId, userId), eq(categoryPots.isArchived, false)),
      }),
      db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          isNull(transactions.deletedAt)
        ),
      }),
    ]);

    const catById = new Map(userCats.map((c) => [c.id, c]));
    const potByCatId = new Map(userPots.map((p) => [p.categoryId, p]));
    const fromCat = catById.get(input.fromCategoryId);
    const toCat = catById.get(input.toCategoryId);
    const fromPot = potByCatId.get(input.fromCategoryId);
    const toPot = potByCatId.get(input.toCategoryId);

    if (!fromCat || !toCat || !fromPot || !toPot) {
      return { success: false, error: "Pos asal atau tujuan tidak ditemukan" };
    }

    const allowanceCycle = (userProfile?.allowanceCycle as AllowanceCycle) || "monthly";
    const paydayDay = userProfile?.paydayDay || 1;
    const paydayWeekday = userProfile?.paydayWeekday ?? 1;
    const periodInfo = getCyclePeriodInfo(new Date(), allowanceCycle, paydayDay, paydayWeekday);

    const periodRows = await db.query.categoryPotPeriods.findMany({
      where: and(
        eq(categoryPotPeriods.userId, userId),
        eq(categoryPotPeriods.periodKey, periodInfo.periodKey)
      ),
    });
    const rowByPotId = new Map(periodRows.map((r) => [r.potId, r]));

    const fromBase = calculatePotPeriodAllocation(
      Number(fromPot.unitAmount || 0),
      (fromPot.cadence as PotCadence) || "monthly",
      periodInfo.cycleDays
    );
    const toBase = calculatePotPeriodAllocation(
      Number(toPot.unitAmount || 0),
      (toPot.cadence as PotCadence) || "monthly",
      periodInfo.cycleDays
    );

    const fromRow = rowByPotId.get(fromPot.id);
    const toRow = rowByPotId.get(toPot.id);
    const fromAllocated = fromRow ? Number(fromRow.allocatedAmount || 0) : fromBase;
    const toAllocated = toRow ? Number(toRow.allocatedAmount || 0) : toBase;

    const fromSpent = userTransactions
      .filter(
        (tx) =>
          tx.categoryId === fromCat.id &&
          tx.occurredOn &&
          tx.occurredOn >= periodInfo.periodStart &&
          tx.occurredOn <= periodInfo.periodEnd
      )
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const calc = calculatePotShift({
      fromAllocated,
      fromSpent,
      toAllocated,
      requestedAmount: input.amount,
    });
    if (!calc.valid) {
      return { success: false, error: calc.error || "Nominal geser jatah tidak valid" };
    }

    await Promise.all([
      db
        .insert(categoryPotPeriods)
        .values({
          userId,
          potId: fromPot.id,
          periodKey: periodInfo.periodKey,
          periodStart: periodInfo.periodStart,
          periodEnd: periodInfo.periodEnd,
          baseLimit: BigInt(fromRow ? Number(fromRow.baseLimit || fromBase) : fromBase),
          allocatedAmount: BigInt(calc.nextFromAllocated),
        })
        .onConflictDoUpdate({
          target: [categoryPotPeriods.potId, categoryPotPeriods.periodKey],
          set: {
            allocatedAmount: BigInt(calc.nextFromAllocated),
            updatedAt: new Date(),
          },
        }),
      db
        .insert(categoryPotPeriods)
        .values({
          userId,
          potId: toPot.id,
          periodKey: periodInfo.periodKey,
          periodStart: periodInfo.periodStart,
          periodEnd: periodInfo.periodEnd,
          baseLimit: BigInt(toRow ? Number(toRow.baseLimit || toBase) : toBase),
          allocatedAmount: BigInt(calc.nextToAllocated),
        })
        .onConflictDoUpdate({
          target: [categoryPotPeriods.potId, categoryPotPeriods.periodKey],
          set: {
            allocatedAmount: BigInt(calc.nextToAllocated),
            updatedAt: new Date(),
          },
        }),
      db.insert(categoryPotTransfers).values({
        userId,
        periodKey: periodInfo.periodKey,
        fromPotId: fromPot.id,
        toPotId: toPot.id,
        amount: BigInt(calc.shiftedAmount),
        note: input.note?.trim() || `Geser jatah ${fromCat.name} → ${toCat.name}`,
      }),
    ]);

    // Sinkronkan category_budgets bulan berjalan jika sudah ada barisnya
    const monthDate = `${getJakartaDateKey().slice(0, 7)}-01`;
    const legacyBudget = await db.query.budgets.findFirst({
      where: and(eq(budgets.userId, userId), eq(budgets.month, monthDate)),
    });
    if (legacyBudget) {
      for (const pair of [
        { categoryId: fromCat.id, nextVal: calc.nextFromAllocated },
        { categoryId: toCat.id, nextVal: calc.nextToAllocated },
      ]) {
        if (pair.nextVal > 0) {
          await db
            .insert(categoryBudgets)
            .values({
              budgetId: legacyBudget.id,
              categoryId: pair.categoryId,
              limitAmount: BigInt(pair.nextVal),
            })
            .onConflictDoUpdate({
              target: [categoryBudgets.budgetId, categoryBudgets.categoryId],
              set: { limitAmount: BigInt(pair.nextVal), updatedAt: new Date() },
            });
        } else {
          await db
            .delete(categoryBudgets)
            .where(
              and(
                eq(categoryBudgets.budgetId, legacyBudget.id),
                eq(categoryBudgets.categoryId, pair.categoryId)
              )
            );
        }
      }
    }

    revalidatePath("/budgets");
    revalidatePath("/statistics");
    revalidatePath("/dashboard");
    revalidatePath("/record");

    return {
      success: true,
      data: {
        fromName: fromCat.name,
        toName: toCat.name,
        shiftedAmount: calc.shiftedAmount,
        nextFromAllocated: calc.nextFromAllocated,
        nextToAllocated: calc.nextToAllocated,
      },
    };
  } catch (error) {
    console.error("Gagal memindahkan jatah antar pos:", error);
    return { success: false, error: "Gagal memindahkan jatah antar pos" };
  }
}

const archivePotSchema = z.object({
  categoryId: z.string().uuid("Kategori tidak valid"),
  archive: z.boolean(),
});

/**
 * Mengarsipkan atau memulihkan pos kategori (bisa dibatalkan kapan saja).
 * Pos terarsip tidak tampil di grid Catat maupun daftar aktif Atur Jatah,
 * tetapi riwayat transaksinya di tabel `transactions` tetap utuh.
 */
export async function archiveCategoryPotAction(
  rawInput: z.infer<typeof archivePotSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = archivePotSchema.safeParse(rawInput);
    if (!validation.success) {
      return { success: false, error: validation.error.issues.map((i) => i.message).join(", ") };
    }
    const { categoryId, archive } = validation.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const cat = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId),
        eq(categories.type, "expense")
      ),
    });
    if (!cat) return { success: false, error: "Kategori tidak ditemukan" };
    if (archive && isProtectedCategory(cat)) {
      return { success: false, error: "Kategori Lainnya tidak dapat diarsipkan" };
    }

    await db
      .update(categories)
      .set({ isHidden: archive, updatedAt: new Date() })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

    const existingPot = await db.query.categoryPots.findFirst({
      where: and(eq(categoryPots.userId, userId), eq(categoryPots.categoryId, categoryId)),
    });

    if (existingPot) {
      await db
        .update(categoryPots)
        .set({
          isArchived: archive,
          isLockedFromDaily: archive ? false : existingPot.isLockedFromDaily,
          inactivePeriods: archive ? Math.max(2, existingPot.inactivePeriods || 2) : 0,
          updatedAt: new Date(),
        })
        .where(eq(categoryPots.id, existingPot.id));
    } else if (archive) {
      await db.insert(categoryPots).values({
        userId,
        categoryId,
        cadence: (cat.defaultCadence as PotCadence) || "monthly",
        unitAmount: BigInt(0),
        isLockedFromDaily: false,
        isArchived: true,
        inactivePeriods: 2,
      });
    }

    if (archive) {
      const monthDate = `${getJakartaDateKey().slice(0, 7)}-01`;
      const legacyBudget = await db.query.budgets.findFirst({
        where: and(eq(budgets.userId, userId), eq(budgets.month, monthDate)),
      });
      if (legacyBudget) {
        await db
          .delete(categoryBudgets)
          .where(
            and(
              eq(categoryBudgets.budgetId, legacyBudget.id),
              eq(categoryBudgets.categoryId, categoryId)
            )
          );
      }
    }

    revalidatePath("/budgets");
    revalidatePath("/record");
    revalidatePath("/statistics");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Gagal mengarsipkan/memulihkan pos:", error);
    return { success: false, error: "Gagal mengubah status arsip pos" };
  }
}
