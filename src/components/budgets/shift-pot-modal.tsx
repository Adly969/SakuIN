"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ArrowRight, ArrowRightLeft, AlertTriangle, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  calculatePotShift,
  suggestDefaultShiftAmount,
} from "@/lib/category-pots";
import { shiftCategoryPotAction } from "@/app/actions/category-pots";

export interface ShiftPotOption {
  categoryId: string;
  name: string;
  allocatedAmount: number;
  spent: number;
}

interface ShiftPotModalProps {
  open: boolean;
  onClose: () => void;
  pots: ShiftPotOption[];
  initialToCategoryId?: string;
  onShifted?: (result: {
    fromName: string;
    toName: string;
    shiftedAmount: number;
    nextFromAllocated: number;
    nextToAllocated: number;
  }) => void;
}

export function ShiftPotModal({
  open,
  onClose,
  pots,
  initialToCategoryId,
  onShifted,
}: ShiftPotModalProps) {
  const [toCategoryId, setToCategoryId] = useState<string>("");
  const [fromCategoryId, setFromCategoryId] = useState<string>("");
  const [amountInput, setAmountInput] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const potsWithRemaining = useMemo(
    () =>
      pots
        .map((p) => ({
          ...p,
          remaining: Math.max(0, p.allocatedAmount - p.spent),
        }))
        .sort((a, b) => b.remaining - a.remaining),
    [pots]
  );

  // Inisialisasi pilihan tujuan, asal (hanya yang bersisa), & nominal otomatis saat dialog dibuka
  useEffect(() => {
    if (!open || potsWithRemaining.length === 0) return;
    setErrorMsg(null);
    setNote("");

    const defaultTo =
      potsWithRemaining.find((p) => p.categoryId === initialToCategoryId) ||
      potsWithRemaining.find((p) => p.remaining === 0) ||
      potsWithRemaining[0];
    const toId = defaultTo?.categoryId || "";
    setToCategoryId(toId);

    const bestSource = potsWithRemaining.find(
      (p) => p.categoryId !== toId && p.remaining > 0
    );
    const fromId = bestSource?.categoryId || "";
    setFromCategoryId(fromId);

    if (bestSource && defaultTo) {
      setAmountInput(
        suggestDefaultShiftAmount({
          toAllocated: defaultTo.allocatedAmount,
          toSpent: defaultTo.spent,
          fromRemaining: bestSource.remaining,
        })
      );
    } else {
      setAmountInput(0);
    }
  }, [open, initialToCategoryId, potsWithRemaining]);

  const sourceCandidates = useMemo(
    () =>
      potsWithRemaining.filter(
        (p) => p.remaining > 0 && p.categoryId !== toCategoryId
      ),
    [potsWithRemaining, toCategoryId]
  );

  const selectedFrom = potsWithRemaining.find(
    (p) => p.categoryId === fromCategoryId
  );
  const selectedTo = potsWithRemaining.find(
    (p) => p.categoryId === toCategoryId
  );

  const handleSelectFrom = (nextFromId: string) => {
    setFromCategoryId(nextFromId);
    setErrorMsg(null);
    const nextFrom = potsWithRemaining.find((p) => p.categoryId === nextFromId);
    if (nextFrom && selectedTo) {
      setAmountInput(
        suggestDefaultShiftAmount({
          toAllocated: selectedTo.allocatedAmount,
          toSpent: selectedTo.spent,
          fromRemaining: nextFrom.remaining,
        })
      );
    }
  };

  const handleSelectTo = (nextToId: string) => {
    setToCategoryId(nextToId);
    setErrorMsg(null);
    const nextTo = potsWithRemaining.find((p) => p.categoryId === nextToId);
    let activeFrom = selectedFrom;
    if (!activeFrom || activeFrom.categoryId === nextToId) {
      activeFrom = potsWithRemaining.find(
        (p) => p.categoryId !== nextToId && p.remaining > 0
      );
      setFromCategoryId(activeFrom?.categoryId || "");
    }
    if (activeFrom && nextTo) {
      setAmountInput(
        suggestDefaultShiftAmount({
          toAllocated: nextTo.allocatedAmount,
          toSpent: nextTo.spent,
          fromRemaining: activeFrom.remaining,
        })
      );
    }
  };

  const shiftPreview = useMemo(() => {
    if (!selectedFrom || !selectedTo) return null;
    return calculatePotShift({
      fromAllocated: selectedFrom.allocatedAmount,
      fromSpent: selectedFrom.spent,
      toAllocated: selectedTo.allocatedAmount,
      requestedAmount: amountInput,
    });
  }, [selectedFrom, selectedTo, amountInput]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFrom || !selectedTo || !shiftPreview?.valid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await shiftCategoryPotAction({
        fromCategoryId: selectedFrom.categoryId,
        toCategoryId: selectedTo.categoryId,
        amount: amountInput,
        note: note.trim() || undefined,
      });

      if (res.success && res.data) {
        window.dispatchEvent(new Event("sakuin:data-invalidated"));
        onShifted?.(res.data);
        onClose();
      } else {
        setErrorMsg(res.error || "Gagal memindahkan jatah pos");
      }
    } catch {
      setErrorMsg("Tidak bisa menghubungi server. Periksa koneksi internetmu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-pot-title"
      className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-accent/15 text-[color:var(--accent-text)] flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="shift-pot-title"
                className="text-sm font-black text-foreground"
              >
                Geser Jatah Antar Pos
              </h2>
              <p className="text-xs text-muted-foreground">
                Pindahkan sisa pos lain tanpa mengubah total danamu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog geser jatah"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sourceCandidates.length === 0 ? (
          <div className="p-4 rounded-xl bg-background border border-border text-xs text-muted-foreground space-y-2">
            <p className="font-bold text-foreground">
              Belum ada pos lain yang masih memiliki sisa jatah untuk digeser.
            </p>
            <p>
              Kamu bisa tambah alokasi dari Sisa Bebas melalui halaman{" "}
              <strong className="text-foreground">Atur Jatah Kategori</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="shift-from-select"
                className="text-xs font-bold text-foreground block"
              >
                Dari pos (hanya yang masih bersisa)
              </label>
              <select
                id="shift-from-select"
                value={fromCategoryId}
                onChange={(e) => handleSelectFrom(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {sourceCandidates.map((p) => (
                  <option key={p.categoryId} value={p.categoryId}>
                    {p.name} (Sisa {formatRupiah(p.remaining)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="shift-to-select"
                className="text-xs font-bold text-foreground block"
              >
                Ke pos
              </label>
              <select
                id="shift-to-select"
                value={toCategoryId}
                onChange={(e) => handleSelectTo(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {potsWithRemaining
                  .filter((p) => p.categoryId !== fromCategoryId)
                  .map((p) => (
                    <option key={p.categoryId} value={p.categoryId}>
                      {p.name}{" "}
                      {p.spent > p.allocatedAmount
                        ? `(Over ${formatRupiah(p.spent - p.allocatedAmount)})`
                        : p.remaining === 0
                        ? "(Habis)"
                        : `(Sisa ${formatRupiah(p.remaining)})`}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="shift-amount-input"
                  className="text-xs font-bold text-foreground"
                >
                  Nominal yang digeser
                </label>
                {selectedFrom && (
                  <button
                    type="button"
                    onClick={() => setAmountInput(selectedFrom.remaining)}
                    className="text-xs font-bold text-[color:var(--accent-text)] hover:underline"
                  >
                    Pakai semua sisa ({formatRupiah(selectedFrom.remaining)})
                  </button>
                )}
              </div>
              <div className="relative flex items-center bg-background border border-border rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-accent">
                <span className="text-sm font-black text-muted-foreground mr-2">
                  Rp
                </span>
                <input
                  id="shift-amount-input"
                  type="text"
                  inputMode="numeric"
                  value={amountInput > 0 ? amountInput.toLocaleString("id-ID") : ""}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "");
                    setAmountInput(clean ? parseInt(clean, 10) : 0);
                  }}
                  placeholder="0"
                  className="flex-1 min-w-0 bg-transparent text-base sm:text-sm font-black text-foreground focus:outline-none"
                />
              </div>
            </div>

            {shiftPreview && selectedFrom && selectedTo && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  shiftPreview.valid
                    ? "bg-background/80 border-border"
                    : "bg-expense/10 border-expense/40"
                }`}
              >
                {shiftPreview.valid ? (
                  <>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{selectedFrom.name}</span>
                      <span className="font-bold text-foreground inline-flex items-center gap-1">
                        {formatRupiah(selectedFrom.allocatedAmount)}
                        <ArrowRight className="w-3 h-3" />
                        {formatRupiah(shiftPreview.nextFromAllocated)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{selectedTo.name}</span>
                      <span className="font-bold text-[color:var(--accent-text)] inline-flex items-center gap-1">
                        {formatRupiah(selectedTo.allocatedAmount)}
                        <ArrowRight className="w-3 h-3" />
                        {formatRupiah(shiftPreview.nextToAllocated)}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground pt-1 border-t border-border/60">
                      Total gabungan tetap {formatRupiah(shiftPreview.totalAfter)} (dana utama tidak berubah).
                    </p>
                  </>
                ) : (
                  <p className="font-bold text-[color:var(--expense-text)] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{shiftPreview.error}</span>
                  </p>
                )}
              </div>
            )}

            {errorMsg && (
              <p className="text-xs font-bold text-[color:var(--expense-text)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-border text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!shiftPreview?.valid || isSubmitting}
                className="flex-1 py-2.5 px-4 min-h-[44px] rounded-full bg-accent text-[#1F1F1F] text-xs font-black hover:brightness-105 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Menyimpan pergeseran..." : "Geser Jatah Sekarang"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
