/**
 * 10 Kutipan Cadangan Offline (PRD M8)
 * Disimpan di client-side cache agar kartu motivasi di Beranda tetap tampil
 * meskipun pengguna tidak memiliki koneksi internet.
 */

export interface OfflineQuote {
  id: string;
  category: "tabungan" | "orang_tua" | "umum";
  text: string;
}

export const OFFLINE_BACKUP_QUOTES: OfflineQuote[] = [
  {
    id: "off-1",
    category: "tabungan",
    text: "Menabung bukan soal berapa yang tersisa di akhir bulan, tapi berapa yang disisihkan di awal bulan.",
  },
  {
    id: "off-2",
    category: "orang_tua",
    text: "Setiap rupiah kiriman orang tua adalah keringat dan doa yang dititipkan untuk masa depanmu.",
  },
  {
    id: "off-3",
    category: "tabungan",
    text: "Disiplin finansial hari ini adalah kemerdekaan finansialmu di masa depan.",
  },
  {
    id: "off-4",
    category: "umum",
    text: "Bukan tentang seberapa besar uang sakumu, melainkan seberapa bijak kamu mengendalikannya.",
  },
  {
    id: "off-5",
    category: "orang_tua",
    text: "Di balik uang saku yang kamu pegang, ada orang tua yang rela berhemat demi kuliahmu.",
  },
  {
    id: "off-6",
    category: "tabungan",
    text: "Uang kecil yang disisihkan konsisten jauh lebih kuat dibanding uang besar yang langsung dihabiskan.",
  },
  {
    id: "off-7",
    category: "umum",
    text: "Kendalikan pengeluaranmu sebelum pengeluaranmu mengendalikan hidupmu.",
  },
  {
    id: "off-8",
    category: "tabungan",
    text: "Target impian tidak dicapai dalam semalam, melainkan dari nominal kecil yang kamu jaga setiap hari.",
  },
  {
    id: "off-9",
    category: "orang_tua",
    text: "Cara terbaik bersyukur atas kiriman keluarga adalah dengan tidak menyia-nyiakannya untuk hal yang tak perlu.",
  },
  {
    id: "off-10",
    category: "umum",
    text: "Satu catatan transaksi hari ini menghindarkanmu dari kebingungan saldo di akhir bulan.",
  },
];

export function getRandomOfflineQuote(): OfflineQuote {
  const idx = Math.floor(Math.random() * OFFLINE_BACKUP_QUOTES.length);
  return OFFLINE_BACKUP_QUOTES[idx];
}
