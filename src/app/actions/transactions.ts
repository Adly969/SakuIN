"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { transactions, categories, accounts } from "@/db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { evaluateDailyLimitForUser, getJakartaDateKey } from "@/lib/daily-limit-server";

// Skema Validasi Zod Server-side
const createTransactionSchema = z
  .object({
    amount: z
      .number()
      .positive("Nominal harus lebih dari 0")
      .max(1000000000, "Nominal melebihi batas wajar"),
    type: z.enum(["expense", "income"]),
    categoryName: z.string().min(1, "Kategori wajib dipilih"),
    note: z.string().max(200, "Catatan maksimal 200 karakter").optional().nullable(),
    customLabel: z.string().max(60, "Keterangan maksimal 60 karakter").optional().nullable(),
    accountId: z.string().uuid().nullish().or(z.literal("")),
    occurredOn: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      // PRD T3: Kebutuhan Lain WAJIB mengisi keterangan kustom
      if (data.categoryName === "Kebutuhan Lain") {
        return Boolean(data.customLabel && data.customLabel.trim().length > 0);
      }
      return true;
    },
    {
      message: "Keterangan wajib diisi untuk kategori Kebutuhan Lain (T3)",
      path: ["customLabel"],
    }
  );

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export interface GetTransactionsFilter {
  month?: string; // Format "YYYY-MM"
  type?: "all" | "expense" | "income";
  category?: string;
  query?: string;
}

/**
 * 1. Tambah Transaksi Baru (PRD T1, T2, T3)
 */
export async function createTransactionAction(rawInput: CreateTransactionInput) {
  try {
    const validation = createTransactionSchema.safeParse(rawInput);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((e) => e.message).join(", ");
      return { success: false, error: errorMsg };
    }

    const input = validation.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    // Cari kategori resmi pengguna
    let category = await db.query.categories.findFirst({
      where: and(
        eq(categories.userId, userId),
        eq(categories.name, input.categoryName)
      ),
    });

    // Jika kategori tidak ditemukan, arahkan ke Kebutuhan Lain / Lainnya agar tidak mengotori tabel kategori
    if (!category) {
      const fallbackName = input.type === "expense" ? "Kebutuhan Lain" : "Lainnya";
      category = await db.query.categories.findFirst({
        where: and(
          eq(categories.userId, userId),
          eq(categories.name, fallbackName)
        ),
      });

      if (!category) {
        const [newCat] = await db
          .insert(categories)
          .values({
            userId: userId,
            name: fallbackName,
            type: input.type,
            icon: "MoreHorizontal",
            color: "#8A8A8A",
            requiresLabel: true,
            isDefault: true,
          })
          .returning();
        category = newCat;
      }
    }

    const finalCustomLabel = input.customLabel || (input.categoryName !== category.name ? input.categoryName : null);
    const dateStr = input.occurredOn || new Date().toISOString().split("T")[0];
    const targetAccountId = input.accountId && input.accountId.trim() ? input.accountId : null;

    // Validasi saldo rekening jika pengeluaran memakai rekening tertentu
    if (targetAccountId && input.type === "expense") {
      const selectedAcc = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId)),
      });
      if (!selectedAcc) {
        return { success: false, error: "Rekening pembayaran tidak ditemukan" };
      }
      if (Number(selectedAcc.balance) < input.amount) {
        return {
          success: false,
          error: `Saldo ${selectedAcc.name} tidak mencukupi (Saldo: Rp ${Number(selectedAcc.balance).toLocaleString("id-ID")}, Pengeluaran: Rp ${input.amount.toLocaleString("id-ID")})`,
        };
      }
    }

    const [newTransaction] = await db
      .insert(transactions)
      .values({
        userId: userId,
        categoryId: category.id,
        type: input.type,
        amount: BigInt(input.amount),
        occurredOn: dateStr,
        note: input.note || null,
        customLabel: finalCustomLabel,
        accountId: targetAccountId,
      })
      .returning();

    // Update saldo rekening jika dipilih
    if (targetAccountId) {
      if (input.type === "expense") {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${BigInt(input.amount)}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, targetAccountId));
      } else {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${BigInt(input.amount)}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, targetAccountId));
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/record");
    revalidatePath("/transactions");
    revalidatePath("/statistics");
    revalidatePath("/accounts");

    // Evaluasi apakah pengeluaran hari ini mendekati atau mencapai batas harian
    const dailyLimitAlert =
      input.type === "expense" && dateStr === getJakartaDateKey()
        ? await evaluateDailyLimitForUser(userId)
        : null;

    return {
      success: true,
      dailyLimitAlert,
      data: {
        id: newTransaction.id,
        title: input.customLabel || input.categoryName,
        category: input.categoryName,
        type: input.type,
        amount: input.amount,
        date: dateStr,
        note: input.note || input.customLabel || "",
      },
    };
  } catch (error) {
    console.error("Gagal mencatat transaksi:", error);
    return { success: false, error: "Gagal menyimpan transaksi ke database" };
  }
}

/**
 * 2. Ubah / Update Transaksi (PRD T4)
 */
export async function updateTransactionAction(
  id: string,
  rawInput: CreateTransactionInput
) {
  try {
    const validation = createTransactionSchema.safeParse(rawInput);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((e) => e.message).join(", ");
      return { success: false, error: errorMsg };
    }

    const input = validation.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    // Pastikan transaksi ada dan milik pengguna
    const existing = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt)
      ),
    });

    if (!existing) {
      return { success: false, error: "Transaksi tidak ditemukan" };
    }

    // Cari kategori resmi pengguna
    let category = await db.query.categories.findFirst({
      where: and(
        eq(categories.userId, userId),
        eq(categories.name, input.categoryName)
      ),
    });

    if (!category) {
      const fallbackName = input.type === "expense" ? "Kebutuhan Lain" : "Lainnya";
      category = await db.query.categories.findFirst({
        where: and(
          eq(categories.userId, userId),
          eq(categories.name, fallbackName)
        ),
      });

      if (!category) {
        const [newCat] = await db
          .insert(categories)
          .values({
            userId: userId,
            name: fallbackName,
            type: input.type,
            icon: "MoreHorizontal",
            color: "#8A8A8A",
            requiresLabel: true,
            isDefault: true,
          })
          .returning();
        category = newCat;
      }
    }

    const finalCustomLabel = input.customLabel || (input.categoryName !== category.name ? input.categoryName : null);
    const dateStr = input.occurredOn || existing.occurredOn;
    const targetAccountId = input.accountId && input.accountId.trim() ? input.accountId : null;
    const oldAccountId = existing.accountId;
    const oldAmount = BigInt(existing.amount);
    const newAmount = BigInt(input.amount);

    // Cek saldo jika transaksi baru adalah pengeluaran memakai rekening
    if (targetAccountId && input.type === "expense") {
      const targetAcc = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId)),
      });
      if (!targetAcc) {
        return { success: false, error: "Rekening pembayaran tidak ditemukan" };
      }

      // Hitung saldo efektif rekening tujuan jika rekening lama dan baru sama
      let effectiveBalance = Number(targetAcc.balance);
      if (oldAccountId === targetAccountId) {
        if (existing.type === "expense") {
          effectiveBalance += Number(oldAmount); // kembalikan nominal pengeluaran lama dulu
        } else {
          effectiveBalance -= Number(oldAmount); // kurangi pemasukan lama dulu
        }
      }

      if (effectiveBalance < input.amount) {
        return {
          success: false,
          error: `Saldo ${targetAcc.name} tidak mencukupi untuk nominal baru ini (Tersedia: Rp ${effectiveBalance.toLocaleString("id-ID")}, Dibutuhkan: Rp ${input.amount.toLocaleString("id-ID")})`,
        };
      }
    }

    // 1. Batalkan efek transaksi lama terhadap saldo rekening sebelumnya (reversal)
    if (oldAccountId) {
      if (existing.type === "expense") {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${oldAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, oldAccountId));
      } else {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${oldAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, oldAccountId));
      }
    }

    // 2. Terapkan efek transaksi baru ke rekening baru
    if (targetAccountId) {
      if (input.type === "expense") {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${newAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, targetAccountId));
      } else {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${newAmount}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, targetAccountId));
      }
    }

    // 3. Simpan perubahan transaksi
    await db
      .update(transactions)
      .set({
        categoryId: category.id,
        type: input.type,
        amount: newAmount,
        occurredOn: dateStr,
        note: input.note || null,
        customLabel: finalCustomLabel,
        accountId: targetAccountId,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

    revalidatePath("/dashboard");
    revalidatePath("/record");
    revalidatePath("/transactions");
    revalidatePath("/statistics");
    revalidatePath("/accounts");

    const dailyLimitAlert =
      input.type === "expense" && dateStr === getJakartaDateKey()
        ? await evaluateDailyLimitForUser(userId)
        : null;

    return { success: true, dailyLimitAlert };
  } catch (error) {
    console.error("Gagal mengubah transaksi:", error);
    return { success: false, error: "Gagal memperbarui transaksi di database" };
  }
}

/**
 * 3. Ambil Daftar Transaksi dengan Filter Lengkap (PRD T5)
 */
export async function getTransactionsAction(filter?: GetTransactionsFilter) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: true, data: [] };
    }

    const conditions = [
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ];

    // Filter Tipe: expense / income
    if (filter?.type && filter.type !== "all") {
      conditions.push(eq(transactions.type, filter.type));
    }

    // Filter Bulan: YYYY-MM
    if (filter?.month && /^\d{4}-\d{2}$/.test(filter.month)) {
      const [yearStr, monthStr] = filter.month.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = `${yearStr}-${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

      conditions.push(
        sql`${transactions.occurredOn} >= ${startDate} AND ${transactions.occurredOn} <= ${endDate}`
      );
    }

    // Filter Query Pencarian
    if (filter?.query && filter.query.trim().length > 0) {
      const q = `%${filter.query.trim()}%`;
      conditions.push(
        sql`(${transactions.note} ILIKE ${q} OR ${transactions.customLabel} ILIKE ${q})`
      );
    }

    // Filter Kategori
    if (filter?.category && filter.category !== "all") {
      const matchedCat = await db.query.categories.findFirst({
        where: and(
          eq(categories.userId, userId),
          eq(categories.name, filter.category)
        ),
      });
      if (matchedCat) {
        conditions.push(eq(transactions.categoryId, matchedCat.id));
      }
    }

    const txs = await db.query.transactions.findMany({
      where: and(...conditions),
      orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
      with: {
        category: true,
        account: true,
      },
      limit: 100,
    });

    const formatted = txs.map((t) => ({
      id: t.id,
      title: t.customLabel || t.category?.name || "Transaksi",
      category: t.category?.name || "Umum",
      type: t.type as "expense" | "income",
      amount: Number(t.amount),
      date: t.occurredOn,
      note: t.note || "",
      customLabel: t.customLabel || "",
      accountId: t.accountId || undefined,
      accountName: t.account?.name || undefined,
    }));

    return { success: true, data: formatted };
  } catch (error) {
    console.error("Gagal mengambil transaksi:", error);
    return { success: false, error: "Gagal memuat data transaksi" };
  }
}

/**
 * 4. Hapus Transaksi (Soft Delete) dan Kembalikan Saldo Rekening (PRD T4)
 */
export async function deleteTransactionAction(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    const existing = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt)
      ),
    });

    if (!existing) {
      return { success: false, error: "Transaksi tidak ditemukan" };
    }

    // Kembalikan saldo rekening jika transaksi ini terikat rekening
    if (existing.accountId) {
      if (existing.type === "expense") {
        // Pengeluaran dihapus -> saldo dikembalikan (tambah kembali)
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${BigInt(existing.amount)}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existing.accountId));
      } else {
        // Pemasukan dihapus -> saldo ditarik kembali (dikurangi)
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${BigInt(existing.amount)}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existing.accountId));
      }
    }

    await db
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

    revalidatePath("/dashboard");
    revalidatePath("/record");
    revalidatePath("/transactions");
    revalidatePath("/statistics");
    revalidatePath("/accounts");

    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus transaksi:", error);
    return { success: false, error: "Gagal menghapus transaksi" };
  }
}

/**
 * 5. Batalkan Hapus / Urungkan (Restore Soft-deleted) (PRD T4)
 */
export async function restoreTransactionAction(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    const existing = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, id),
        eq(transactions.userId, userId)
      ),
    });

    if (!existing) {
      return { success: false, error: "Transaksi tidak ditemukan" };
    }

    // Terapkan kembali efek transaksi ke rekening
    if (existing.accountId) {
      if (existing.type === "expense") {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${BigInt(existing.amount)}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existing.accountId));
      } else {
        await db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${BigInt(existing.amount)}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existing.accountId));
      }
    }

    await db
      .update(transactions)
      .set({ deletedAt: null })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

    revalidatePath("/dashboard");
    revalidatePath("/record");
    revalidatePath("/transactions");
    revalidatePath("/statistics");
    revalidatePath("/accounts");

    const dailyLimitAlert =
      existing.type === "expense" && existing.occurredOn === getJakartaDateKey()
        ? await evaluateDailyLimitForUser(userId)
        : null;

    return { success: true, dailyLimitAlert };
  } catch (error) {
    console.error("Gagal memulihkan transaksi:", error);
    return { success: false, error: "Gagal memulihkan transaksi" };
  }
}

/**
 * 6. Ambil Daftar Kategori Pengguna
 */
export async function getUserCategoriesAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: true, data: [] };
    }

    const cats = await db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: [categories.sortOrder, categories.name],
    });

    // Otomatis pastikan kategori pemasukan bawaan bertipe income di database
    const knownIncomeNames = ["uang kiriman", "gaji / upah", "gaji", "upah", "beasiswa", "kerja sambilan", "sambilan", "part time", "hadiah", "pemasukan"];
    for (const c of cats) {
      const lower = (c.name || "").toLowerCase().trim();
      const shouldBeIncome = knownIncomeNames.some((inc) => lower.includes(inc));
      if (shouldBeIncome && c.type !== "income") {
        await db.update(categories).set({ type: "income" }).where(eq(categories.id, c.id));
        c.type = "income";
      }
    }

    // Saring hanya kategori resmi agar catatan satu kali (one-off custom notes) tidak menjadi tombol permanen
    const officialNames = [
      "makan", "nongkrong", "bensin", "bensin & transport", "rokok",
      "listrik", "kuota", "kuota & internet", "laundry", "jajan & cemilan",
      "kebutuhan lain", "uang kiriman", "kerja sambilan", "beasiswa", "gaji / upah", "lainnya"
    ];
    const cleanCats = cats.filter((c) => c.isDefault || officialNames.includes(c.name.toLowerCase().trim()));

    return {
      success: true,
      data: cleanCats.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        requiresLabel: c.requiresLabel ?? false,
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil kategori:", error);
    return { success: false, error: "Gagal mengambil kategori" };
  }
}

export async function getCategoriesAction() {
  return getUserCategoriesAction();
}
