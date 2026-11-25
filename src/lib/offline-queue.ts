/**
 * Modul Antrean Offline Transaksi (PRD T6)
 * Menyimpan transaksi secara lokal di localStorage saat offline,
 * dan otomatis mengirimkannya ke database saat perangkat kembali online.
 */

import { CreateTransactionInput, createTransactionAction } from "@/app/actions/transactions";

export interface QueuedTransaction extends CreateTransactionInput {
  queueId: string;
  queuedAt: string;
}

const STORAGE_KEY = "sakuin_offline_tx_queue";

export function getOfflineQueue(): QueuedTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedTransaction[];
  } catch (err) {
    console.error("Gagal membaca antrean offline:", err);
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedTransaction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("sakuin:offline-queue-changed", { detail: { count: queue.length } }));
  } catch (err) {
    console.error("Gagal menyimpan antrean offline:", err);
  }
}

export function enqueueOfflineTransaction(input: CreateTransactionInput): QueuedTransaction {
  const queue = getOfflineQueue();
  const queuedTx: QueuedTransaction = {
    ...input,
    queueId: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    queuedAt: new Date().toISOString(),
  };

  queue.push(queuedTx);
  saveOfflineQueue(queue);
  return queuedTx;
}

export function removeOfflineTransaction(queueId: string): void {
  const queue = getOfflineQueue().filter((item) => item.queueId !== queueId);
  saveOfflineQueue(queue);
}

export function clearOfflineQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("sakuin:offline-queue-changed", { detail: { count: 0 } }));
}

/**
 * Sinkronisasi seluruh antrean offline ke server
 */
export async function syncOfflineQueue(): Promise<{
  successCount: number;
  failCount: number;
  total: number;
}> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { successCount: 0, failCount: 0, total: 0 };
  }

  let successCount = 0;
  let failCount = 0;
  const remainingQueue: QueuedTransaction[] = [];

  for (const item of queue) {
    try {
      const res = await createTransactionAction({
        type: item.type,
        amount: item.amount,
        categoryName: item.categoryName,
        note: item.note,
        customLabel: item.customLabel,
        accountId: item.accountId ?? undefined,
        occurredOn: item.occurredOn,
      });

      if (res.success) {
        successCount++;
      } else {
        failCount++;
        remainingQueue.push(item);
      }
    } catch {
      failCount++;
      remainingQueue.push(item);
    }
  }

  saveOfflineQueue(remainingQueue);

  // Dispatch sync event so pages can re-fetch
  if (typeof window !== "undefined" && successCount > 0) {
    window.dispatchEvent(
      new CustomEvent("sakuin:sync-complete", {
        detail: { successCount, failCount, total: queue.length },
      })
    );
  }

  return { successCount, failCount, total: queue.length };
}
