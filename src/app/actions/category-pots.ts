"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  profiles,
  categories,
  categoryPots,
  categoryPotPeriods,
  transactions,
  accounts,
  savingsEntries,
  lockedFunds,
  budgets,
  categoryBudgets,
} from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calculateAdaptiveDailyLimit,
  type AllowanceCycle,
  type ReserveMode,
} from "@/lib/finance";
import {
  getCyclePeriodInfo,
  calculatePotPeriodAllocation,
  type PotCadence,
} from "@/lib/category-pots";
import { getJakartaDateKey } from "@/lib/daily-limit-server";
import {
  ensureFallbackLainnyaCategory,
  EXCLUDED_BILL_CATEGORIES,
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
}

export interface BudgetsWorkspaceData {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  cycleDays: number;
  remainingDays: number;
  allowanceCycle: AllowanceCycle;
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
          eq(categories.type, "expense"),
          eq(categories.isHidden, false)
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

    const periodOverrides = await db.query.categoryPotPeriods.findMany({
      where: and(
        eq(categoryPotPeriods.userId, userId),
        eq(categoryPotPeriods.periodKey, periodInfo.periodKey)
      ),
    });

    const legacyCategoryBudgets = monthBudget
      ? await db.query.categoryBudgets.findMany({
          where: eq(categoryBudgets.budgetId, monthBudget.id),
        })
      : [];

    // Hitung total pengeluaran periode & bulan berjalan (selaras dengan Dashboard)
    let totalExpenseMonth = 0;
    let totalIncomeMonth = 0;
    const spentByCategoryPeriod: Record<string, number> = {};

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
    const overrideByPotId = new Map(periodOverrides.map((o) => [o.potId, o]));
    const legacyLimitByCatId = new Map(
      legacyCategoryBudgets.map((cb) => [cb.categoryId, Number(cb.limitAmount || 0)])
    );

    const filteredCats = userCategories.filter(
      (c) => !EXCLUDED_BILL_CATEGORIES.has((c.name || "").toLowerCase().trim())
    );

    filteredCats.sort((a, b) => {
      const idxA = INITIAL_PRIORITY_ORDER.indexOf((a.name || "").toLowerCase().trim());
      const idxB = INITIAL_PRIORITY_ORDER.indexOf((b.name || "").toLowerCase().trim());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    });

    const pots: BudgetPotWorkspaceItem[] = filteredCats.map((cat) => {
      const lower = (cat.name || "").toLowerCase().trim();
      const isOther = lower === "lainnya";
      const existingPot = potByCatId.get(cat.id);
      const override = existingPot ? overrideByPotId.get(existingPot.id) : undefined;
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
        periodSpent: spentByCategoryPeriod[cat.id] || 0,
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
      },
    };
  } catch (error) {
    console.error("Gagal menambah pos kategori kustom:", error);
    return { success: false, error: "Gagal menambahkan pos baru" };
  }
}
