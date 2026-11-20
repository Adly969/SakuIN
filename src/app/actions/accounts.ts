"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { accounts, transfers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Nama rekening/dompet wajib diisi").max(100),
  type: z.enum(["bank", "ewallet", "cash"]),
  accountNumber: z.string().trim().max(60).optional(),
  initialBalance: z.number().min(0, "Saldo awal tidak boleh negatif").default(0),
  color: z.string().max(30).default("#D4FF5A"),
  icon: z.string().max(50).default("Wallet"),
});

const adjustBalanceSchema = z.object({
  id: z.string().uuid("ID rekening tidak valid"),
  newBalance: z.number().min(0, "Saldo tidak boleh negatif"),
  note: z.string().max(200).optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string().uuid("Rekening asal tidak valid"),
  toAccountId: z.string().uuid("Rekening tujuan tidak valid"),
  amount: z.number().positive("Nominal transfer harus lebih besar dari 0"),
  adminFee: z.number().min(0, "Biaya admin tidak boleh negatif").default(0),
  occurredOn: z.string().optional(),
  note: z.string().max(200).optional(),
});

export async function getAccountsAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Silakan login terlebih dahulu" };
    }

    let userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
      orderBy: [accounts.isDefault, accounts.createdAt],
    });

    // Jika user belum punya rekening sama sekali, buatkan 3 rekening standar mahasiswa
    if (userAccounts.length === 0) {
      await db.insert(accounts).values([
        {
          userId,
          name: "Dompet Tunai",
          type: "cash",
          color: "#5BAA6B",
          icon: "Banknote",
          isDefault: true,
          balance: BigInt(0),
        },
        {
          userId,
          name: "Rekening Bank (BCA / Mandiri)",
          type: "bank",
          color: "#8CCBFF",
          icon: "Landmark",
          isDefault: false,
          balance: BigInt(0),
        },
        {
          userId,
          name: "E-Wallet (GoPay / DANA)",
          type: "ewallet",
          color: "#FFB04A",
          icon: "Smartphone",
          isDefault: false,
          balance: BigInt(0),
        },
      ]);

      userAccounts = await db.query.accounts.findMany({
        where: eq(accounts.userId, userId),
        orderBy: [accounts.isDefault, accounts.createdAt],
      });
    }

    const totalBalance = userAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    return {
      success: true,
      data: {
        totalBalance,
        accounts: userAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type as "bank" | "ewallet" | "cash",
          accountNumber: a.accountNumber || "",
          balance: Number(a.balance),
          color: a.color,
          icon: a.icon,
          isDefault: a.isDefault,
          createdAt: a.createdAt,
        })),
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data rekening:", error);
    return { success: false, error: "Gagal memuat daftar rekening" };
  }
}

export async function createAccountAction(rawInput: z.infer<typeof createAccountSchema>) {
  try {
    const validation = createAccountSchema.safeParse(rawInput);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Silakan login terlebih dahulu" };

    const input = validation.data;

    // Periksa apakah ini rekening pertama (jadikan default)
    const existingCount = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
    });

    const isDefault = existingCount.length === 0;

    await db.insert(accounts).values({
      userId,
      name: input.name,
      type: input.type,
      accountNumber: input.accountNumber || null,
      balance: BigInt(input.initialBalance),
      color: input.color,
      icon: input.icon,
      isDefault,
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/record");

    return { success: true };
  } catch (error) {
    console.error("Gagal membuat rekening:", error);
    return { success: false, error: "Gagal menambahkan rekening" };
  }
}

export async function adjustBalanceAction(rawInput: z.infer<typeof adjustBalanceSchema>) {
  try {
    const validation = adjustBalanceSchema.safeParse(rawInput);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Silakan login terlebih dahulu" };

    const input = validation.data;

    await db
      .update(accounts)
      .set({
        balance: BigInt(input.newBalance),
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, input.id), eq(accounts.userId, userId)));

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/record");

    return { success: true };
  } catch (error) {
    console.error("Gagal menyesuaikan saldo:", error);
    return { success: false, error: "Gagal memperbarui saldo" };
  }
}

export async function transferBalanceAction(rawInput: z.infer<typeof transferSchema>) {
  try {
    const validation = transferSchema.safeParse(rawInput);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Silakan login terlebih dahulu" };

    const input = validation.data;

    if (input.fromAccountId === input.toAccountId) {
      return { success: false, error: "Rekening asal dan tujuan tidak boleh sama" };
    }

    // Ambil rekening asal
    const fromAcc = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, input.fromAccountId), eq(accounts.userId, userId)),
    });

    if (!fromAcc) {
      return { success: false, error: "Rekening asal tidak ditemukan" };
    }

    const totalDeduction = input.amount + input.adminFee;
    if (Number(fromAcc.balance) < totalDeduction) {
      return {
        success: false,
        error: `Saldo ${fromAcc.name} tidak cukup (Saldo: Rp ${Number(fromAcc.balance).toLocaleString("id-ID")})`,
      };
    }

    // Ambil rekening tujuan
    const toAcc = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, input.toAccountId), eq(accounts.userId, userId)),
    });

    if (!toAcc) {
      return { success: false, error: "Rekening tujuan tidak ditemukan" };
    }

    // Eksekusi pemindahan saldo
    await db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} - ${BigInt(totalDeduction)}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, input.fromAccountId));

    await db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} + ${BigInt(input.amount)}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, input.toAccountId));

    // Catat riwayat transfer
    await db.insert(transfers).values({
      userId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amount: BigInt(input.amount),
      adminFee: BigInt(input.adminFee),
      occurredOn: input.occurredOn || new Date().toISOString().split("T")[0],
      note: input.note || null,
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/record");

    return { success: true };
  } catch (error) {
    console.error("Gagal melakukan transfer saldo:", error);
    return { success: false, error: "Gagal memproses transfer antar rekening" };
  }
}

export async function deleteAccountAction(accountId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Silakan login terlebih dahulu" };

    const totalAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
    });

    if (totalAccounts.length <= 1) {
      return { success: false, error: "Kamu harus memiliki minimal satu rekening" };
    }

    await db
      .delete(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/record");

    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus rekening:", error);
    return { success: false, error: "Gagal menghapus rekening" };
  }
}
