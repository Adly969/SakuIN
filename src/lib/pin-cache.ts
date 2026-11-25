/**
 * Cache verifikator PIN lokal (SHA-256 + userId salt) untuk Instant Unlock (< 10ms)
 * di WebView APK / PWA agar tidak menunggu round-trip server setiap membuka PIN.
 * PIN mentah TIDAK pernah disimpan di penyimpanan lokal.
 */

const PIN_VERIFIER_STORAGE_KEY = "sakuin_pin_verifier";

interface StoredPinVerifier {
  userId: string;
  pinVersion: string;
  verifier: string;
}

async function computeLocalPinHash(userId: string, pin: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return "";
  const data = new TextEncoder().encode(`sakuin-pin-v1:${userId}:${pin}`);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getStoredPinVerifier(): StoredPinVerifier | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PIN_VERIFIER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPinVerifier;
    if (!parsed?.userId || !parsed?.verifier || !parsed?.pinVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLocalPinVerifier(
  userId: string,
  pin: string,
  pinVersion: string
): Promise<void> {
  if (typeof window === "undefined" || !userId || !pinVersion) return;
  try {
    const verifier = await computeLocalPinHash(userId, pin);
    if (!verifier) return;
    const payload: StoredPinVerifier = { userId, pinVersion, verifier };
    localStorage.setItem(PIN_VERIFIER_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function clearLocalPinVerifier(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PIN_VERIFIER_STORAGE_KEY);
  } catch {}
}

export function syncLocalPinVersion(userId: string, serverPinVersion: string): void {
  const stored = getStoredPinVerifier();
  if (!stored) return;
  if (stored.userId !== userId || stored.pinVersion !== serverPinVersion) {
    clearLocalPinVerifier();
  }
}

/**
 * Mengembalikan:
 * - true: PIN cocok secara lokal (< 5ms)
 * - false: verifier lokal ada dan PIN salah
 * - null: belum ada verifier lokal (fallback ke verifikasi server)
 */
export async function verifyLocalPin(pin: string): Promise<boolean | null> {
  const stored = getStoredPinVerifier();
  if (!stored) return null;
  try {
    const candidate = await computeLocalPinHash(stored.userId, pin);
    if (!candidate) return null;
    return candidate === stored.verifier;
  } catch {
    return null;
  }
}
