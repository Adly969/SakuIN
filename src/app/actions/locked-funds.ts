"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { lockedFunds, accounts, transactions, categories } from "@/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getJakartaDateKey } from "@/lib/daily-limit-server";

const lockedFundSchema = z.object({
  name: z.string().trim().min(1, "Nama pos tagihan wajib diisi").max(100),
  amount: z.number().positive("Nominal tagihan harus lebih dari 0").max(1000000000),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
});

const payLockedFundSchema = z.object({
  id: z.string().uuid("ID dana terkunci tidak valid"),
  accountId: z.string().uuid("Rekening tidak valid").nullish().or(z.literal("")),
  recordExpense: z.boolean().default(true),
  occurredOn: z.string().optional(),
});

export type LockedFundInput = z.infer<typeof lockedFundSchema>;
export type PayLockedFundInput = z.infer<typeof payLockedFundSchema>;

function revalidateLockedFundPaths() {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/statistics");
}

/**
 * 1. Ambil daftar Dana Terkunci / Tagihan Wajib pengguna
 */
export async function getLockedFundsAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Pengguna belum login" };
    }

    const rows = await db.query.lockedFunds.findMany({
      where: eq(lockedFunds.userId, userId),
      with: {
        paidAccount: true,
      },
      orderBy: [lockedFunds.isPaid, desc(lockedFunds.createdAt)],
    });

    const formatted = rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: Number(row.amount || 0),
      dueDay: row.dueDay ?? null,
      isPaid: Boolean(row.isPaid),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      paidAccountName: row.paidAccount?.name || null,
      note: row.note || "",
    }));

    const activeLockedTotal = formatted
      .filter((f) => !f.isPaid)
      .reduce((sum, f) => sum + f.amount, 0);
    const paidTotal = formatted
      .filter((f) => f.isPaid)
      .reduce((sum, f) => sum + f.amount, 0);

    return {
      success: true,
      data: {
        funds: formatted,
        activeLockedTotal,
        paidTotal,
      },
    };
  } catch (error) {
    console.error("Gagal mengambil dana terkunci:", error);
    return { success: false, error: "Gagal memuat daftar dana terkunci" };
  }
}

/**
 * 2. Tambah Pos Dana Terkunci / Tagihan Wajib
 */
export async function createLockedFundAction(rawInput: LockedFundInput) {
  try {
    const validation = lockedFundSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validation.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    await db.insert(lockedFunds).values({
      userId,
      name: input.name,
      amount: BigInt(input.amount),
      dueDay: input.dueDay ?? null,
      note: input.note?.trim() || null,
      isPaid: false,
    });

    revalidateLockedFundPaths();
    return { success: true };
  } catch (error) {
    console.error("Gagal menambah dana terkunci:", error);
    return { success: false, error: "Gagal menyimpan tagihan wajib" };
  }
}

/**
 * 3. Ubah Pos Dana Terkunci
 */
export async function updateLockedFundAction(id: string, rawInput: LockedFundInput) {
  try {
    const validation = lockedFundSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validation.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    await db
      .update(lockedFunds)
      .set({
        name: input.name,
        amount: BigInt(input.amount),
        dueDay: input.dueDay ?? null,
        note: input.note?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(lockedFunds.id, id), eq(lockedFunds.userId, userId)));

    revalidateLockedFundPaths();
    return { success: true };
  } catch (error) {
    console.error("Gagal mengubah dana terkunci:", error);
    return { success: false, error: "Gagal memperbarui tagihan wajib" };
  }
}

/**
 * 4. Bayar / Lunasi Tagihan Wajib & Buka Kunci Dana
 */
export async function payLockedFundAction(rawInput: PayLockedFundInput) {
  try {
    const validation = payLockedFundSchema.safeParse(rawInput);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validation.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    const fund = await db.query.lockedFunds.findFirst({
      where: and(eq(lockedFunds.id, input.id), eq(lockedFunds.userId, userId)),
    });

    if (!fund) {
      return { success: false, error: "Pos tagihan tidak ditemukan" };
    }
    if (fund.isPaid) {
      return { success: false, error: "Tagihan ini sudah ditandai lunas" };
    }

    const amountNum = Number(fund.amount || 0);
    const targetAccountId = input.accountId && input.accountId.trim() ? input.accountId.trim() : null;

    if (targetAccountId) {
      const selectedAcc = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId)),
      });

      if (!selectedAcc) {
        return { success: false, error: "Rekening pembayaran tidak ditemukan" };
      }

      if (Number(selectedAcc.balance) < amountNum) {
        return {
          success: false,
          error: `Saldo ${selectedAcc.name} tidak mencukupi (Tersedia: Rp ${Number(selectedAcc.balance).toLocaleString("id-ID")}, Tagihan: Rp ${amountNum.toLocaleString("id-ID")})`,
        };
      }

      const updatedAcc = await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${BigInt(amountNum)}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accounts.id, targetAccountId),
            eq(accounts.userId, userId),
            gte(accounts.balance, BigInt(amountNum))
          )
        )
        .returning();

      if (updatedAcc.length === 0) {
        return {
          success: false,
          error: `Saldo ${selectedAcc.name} tidak mencukupi untuk membayar tagihan`,
        };
      }
    }

    // Catat transaksi pengeluaran jika diinginkan (ketika dibayar melalui rekening / kas aktif)
    if (input.recordExpense && targetAccountId) {
      let category = await db.query.categories.findFirst({
        where: and(eq(categories.userId, userId), eq(categories.name, "Kebutuhan Lain")),
      });

      if (!category) {
        const [newCat] = await db
          .insert(categories)
          .values({
            userId,
            name: "Kebutuhan Lain",
            type: "expense",
            icon: "MoreHorizontal",
            color: "#8A8A8A",
            requiresLabel: true,
            isDefault: true,
          })
          .returning();
        category = newCat;
      }

      const dateStr = input.occurredOn || getJakartaDateKey();
      await db.insert(transactions).values({
        userId,
        categoryId: category.id,
        type: "expense",
        amount: BigInt(amountNum),
        occurredOn: dateStr,
        note: fund.note || "Pembayaran tagihan wajib (Dana Terkunci)",
        customLabel: fund.name,
        accountId: targetAccountId,
      });
    }

    await db
      .update(lockedFunds)
      .set({
        isPaid: true,
        paidAt: new Date(),
        paidAccountId: targetAccountId,
        updatedAt: new Date(),
      })
      .where(and(eq(lockedFunds.id, fund.id), eq(lockedFunds.userId, userId)));

    revalidateLockedFundPaths();
    return { success: true };
  } catch (error) {
    console.error("Gagal memproses pelunasan tagihan wajib:", error);
    return { success: false, error: "Gagal memproses pelunasan tagihan" };
  }
}

/**
 * 5. Aktifkan Kembali Tagihan Wajib (untuk siklus bulan/minggu baru)
 */
export async function reopenLockedFundAction(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    await db
      .update(lockedFunds)
      .set({
        isPaid: false,
        paidAt: null,
        paidAccountId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(lockedFunds.id, id), eq(lockedFunds.userId, userId)));

    revalidateLockedFundPaths();
    return { success: true };
  } catch (error) {
    console.error("Gagal mengaktifkan kembali dana terkunci:", error);
    return { success: false, error: "Gagal mengaktifkan tagihan" };
  }
}

/**
 * 6. Hapus Pos Dana Terkunci
 */
export async function deleteLockedFundAction(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Pengguna belum login" };

    await db
      .delete(lockedFunds)
      .where(and(eq(lockedFunds.id, id), eq(lockedFunds.userId, userId)));

    revalidateLockedFundPaths();
    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus dana terkunci:", error);
    return { success: false, error: "Gagal menghapus pos dana terkunci" };
  }
}
