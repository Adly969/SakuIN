"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { debts, debtPayments, accounts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getJakartaDateKey } from "@/lib/daily-limit-server";

const createDebtSchema = z.object({
  type: z.enum(["payable", "receivable"]), // 'payable' (Saya Berutang) | 'receivable' (Teman Ngutang)
  personName: z.string().trim().min(1, "Nama orang/teman wajib diisi").max(100),
  amount: z.number().positive("Nominal harus lebih besar dari 0"),
  dueDate: z.string().optional(),
  note: z.string().max(250).optional(),
  accountId: z.string().uuid().optional(),
});

const paymentSchema = z.object({
  debtId: z.string().uuid("ID utang piutang tidak valid"),
  amount: z.number().positive("Nominal cicilan/pelunasan harus lebih dari 0"),
  occurredOn: z.string().optional(),
  note: z.string().max(200).optional(),
  accountId: z.string().uuid().optional(),
});

export async function getDebtsAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: "Silakan login terlebih dahulu" };
    }

    const allDebts = await db.query.debts.findMany({
      where: eq(debts.userId, userId),
      orderBy: [desc(debts.createdAt)],
      with: {
        account: true,
        payments: {
          orderBy: [desc(debtPayments.occurredOn)],
        },
      },
    });

    let totalReceivable = 0; // Uang kita di teman (Piutang)
    let totalPayable = 0;    // Utang kita ke orang lain (Utang)

    allDebts.forEach((d) => {
      const remaining = Math.max(0, Number(d.amount) - Number(d.paidAmount));
      if (d.status !== "paid" && remaining > 0) {
        if (d.type === "receivable") {
          totalReceivable += remaining;
        } else {
          totalPayable += remaining;
        }
      }
    });

    return {
      success: true,
      data: {
        totalReceivable,
        totalPayable,
        debts: allDebts.map((d) => ({
          id: d.id,
          type: d.type as "payable" | "receivable",
          personName: d.personName,
          amount: Number(d.amount),
          paidAmount: Number(d.paidAmount),
          remainingAmount: Math.max(0, Number(d.amount) - Number(d.paidAmount)),
          dueDate: d.dueDate,
          status: d.status as "unpaid" | "partial" | "paid",
          note: d.note || "",
          accountName: d.account?.name || null,
          createdAt: d.createdAt,
          payments: (d.payments || []).map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            occurredOn: p.occurredOn,
            note: p.note || "",
          })),
        })),
      },
    };
  } catch (error) {
    console.error("Gagal mengambil catatan utang piutang:", error);
    return { success: false, error: "Gagal memuat catatan utang piutang" };
  }
}

export async function createDebtAction(rawInput: z.infer<typeof createDebtSchema>) {
  try {
    const validation = createDebtSchema.safeParse(rawInput);
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

    // Jika rekening dipilih:
    if (input.accountId) {
      const acc = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)),
      });

      if (acc) {
        if (input.type === "receivable") {
          // Teman ngutang ke kita: uang kita berkurang
          await db
            .update(accounts)
            .set({
              balance: sql`${accounts.balance} - ${BigInt(input.amount)}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, input.accountId));
        } else {
          // Kita pinjam uang dari teman/orang: saldo kita bertambah
          await db
            .update(accounts)
            .set({
              balance: sql`${accounts.balance} + ${BigInt(input.amount)}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, input.accountId));
        }
      }
    }

    await db.insert(debts).values({
      userId,
      type: input.type,
      personName: input.personName,
      amount: BigInt(input.amount),
      paidAmount: BigInt(0),
      dueDate: input.dueDate || null,
      status: "unpaid",
      note: input.note || null,
      accountId: input.accountId || null,
    });

    revalidatePath("/debts");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Gagal membuat catatan utang piutang:", error);
    return { success: false, error: "Gagal mencatat utang piutang" };
  }
}

export async function recordDebtPaymentAction(rawInput: z.infer<typeof paymentSchema>) {
  try {
    const validation = paymentSchema.safeParse(rawInput);
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

    const existingDebt = await db.query.debts.findFirst({
      where: and(eq(debts.id, input.debtId), eq(debts.userId, userId)),
    });

    if (!existingDebt) {
      return { success: false, error: "Catatan utang piutang tidak ditemukan" };
    }

    const newPaidTotal = Number(existingDebt.paidAmount) + input.amount;
    const isFullyPaid = newPaidTotal >= Number(existingDebt.amount);
    const newStatus = isFullyPaid ? "paid" : "partial";

    // 1. Catat pembayaran / cicilan
    await db.insert(debtPayments).values({
      debtId: input.debtId,
      userId,
      amount: BigInt(input.amount),
      occurredOn: input.occurredOn || new Date().toISOString().split("T")[0],
      note: input.note || null,
      accountId: input.accountId || null,
    });

    // 2. Perbarui status utang
    await db
      .update(debts)
      .set({
        paidAmount: BigInt(newPaidTotal),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(debts.id, input.debtId));

    // 3. Update rekening jika ada
    if (input.accountId) {
      const acc = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)),
      });

      if (acc) {
        if (existingDebt.type === "receivable") {
          // Teman bayar utangnya ke kita: saldo rekening kita bertambah
          await db
            .update(accounts)
            .set({
              balance: sql`${accounts.balance} + ${BigInt(input.amount)}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, input.accountId));
        } else {
          // Kita bayar utang kita ke teman: saldo rekening kita berkurang
          await db
            .update(accounts)
            .set({
              balance: sql`${accounts.balance} - ${BigInt(input.amount)}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, input.accountId));
        }
      }
    }

    revalidatePath("/debts");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Gagal mencatat pembayaran utang:", error);
    return { success: false, error: "Gagal memproses pembayaran utang" };
  }
}

export async function deleteDebtAction(debtId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: false, error: "Silakan login terlebih dahulu" };

    await db
      .delete(debts)
      .where(and(eq(debts.id, debtId), eq(debts.userId, userId)));

    revalidatePath("/debts");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus utang:", error);
    return { success: false, error: "Gagal menghapus catatan utang piutang" };
  }
}

export interface DueDebtReminderItem {
  id: string;
  type: "payable" | "receivable";
  personName: string;
  remainingAmount: number;
  dueDate: string;
  urgency: "overdue" | "today" | "tomorrow";
}

/**
 * Ambil daftar utang/piutang yang jatuh tempo H-1, Hari-H, atau sudah terlewat
 */
export async function getUpcomingDueDebtsAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) return { success: true, data: [] as DueDebtReminderItem[] };

    const allDebts = await db.query.debts.findMany({
      where: eq(debts.userId, userId),
    });

    const now = new Date();
    const todayKey = getJakartaDateKey(now);
    const tomorrowKey = getJakartaDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    const dueList: DueDebtReminderItem[] = [];
    for (const d of allDebts) {
      if (d.status === "paid" || !d.dueDate) continue;
      const remaining = Math.max(0, Number(d.amount) - Number(d.paidAmount));
      if (remaining <= 0) continue;

      if (d.dueDate <= tomorrowKey) {
        const urgency: DueDebtReminderItem["urgency"] =
          d.dueDate < todayKey ? "overdue" : d.dueDate === todayKey ? "today" : "tomorrow";
        dueList.push({
          id: d.id,
          type: d.type as "payable" | "receivable",
          personName: d.personName,
          remainingAmount: remaining,
          dueDate: d.dueDate,
          urgency,
        });
      }
    }

    dueList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { success: true, data: dueList };
  } catch (error) {
    console.error("Gagal mengecek jatuh tempo utang:", error);
    return { success: false, data: [] as DueDebtReminderItem[] };
  }
}
