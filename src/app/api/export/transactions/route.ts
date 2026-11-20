import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // e.g. "2026-11"
    const type = searchParams.get("type"); // e.g. "all", "expense", "income"

    // Fetch user transactions
    const txs = await db.query.transactions.findMany({
      where: and(eq(transactions.userId, user.id), isNull(transactions.deletedAt)),
      orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
      with: {
        category: true,
      },
    });

    // Filter in-memory
    const filtered = txs.filter((tx) => {
      if (month && !tx.occurredOn?.startsWith(month)) {
        return false;
      }
      if (type && type !== "all" && tx.type !== type) {
        return false;
      }
      return true;
    });

    // CSV Header row
    const headers = [
      "ID Transaksi",
      "Tanggal",
      "Tipe",
      "Kategori",
      "Keterangan / Catatan",
      "Nominal (Rp)",
    ];

    // Format rows
    const rows = filtered.map((tx) => {
      const typeLabel = tx.type === "expense" ? "Pengeluaran" : "Pemasukan";
      const catLabel = tx.category?.name || "Umum";
      const noteLabel = (tx.customLabel ? `${tx.customLabel} - ` : "") + (tx.note || "-");
      const cleanNote = noteLabel.replace(/"/g, '""');

      return [
        `"${tx.id}"`,
        `"${tx.occurredOn || ""}"`,
        `"${typeLabel}"`,
        `"${catLabel}"`,
        `"${cleanNote}"`,
        Number(tx.amount),
      ].join(",");
    });

    // UTF-8 BOM (\uFEFF) ensures Excel opens Indonesian characters & Rupiah cleanly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

    const filename = month
      ? `sakuin-transaksi-${month}.csv`
      : `sakuin-transaksi-semua-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error) {
    console.error("Gagal mengekspor transaksi ke CSV:", error);
    return NextResponse.json({ error: "Gagal membuat berkas CSV" }, { status: 500 });
  }
}
