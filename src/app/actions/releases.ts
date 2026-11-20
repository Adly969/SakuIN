"use server";

import { db } from "@/db";
import { appReleases } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export interface AppReleaseData {
  id?: string;
  version: string;
  versionCode: number;
  apkUrlPrimary: string;
  apkUrlMirror?: string | null;
  sha256?: string | null;
  sizeBytes: number;
  releasedAt: string;
  changelog?: string | null;
  isLatest: boolean;
}

export async function getLatestReleaseAction(): Promise<{
  success: boolean;
  data: AppReleaseData;
}> {
  try {
    const release = await db.query.appReleases.findFirst({
      where: eq(appReleases.isLatest, true),
      orderBy: [desc(appReleases.versionCode)],
    });

    if (release) {
      return {
        success: true,
        data: {
          id: release.id,
          version: release.version,
          versionCode: release.versionCode,
          apkUrlPrimary: release.apkUrlPrimary,
          apkUrlMirror: release.apkUrlMirror,
          sha256: release.sha256,
          sizeBytes: Number(release.sizeBytes) || 2621440,
          releasedAt: release.releasedAt.toISOString(),
          changelog: release.changelog,
          isLatest: release.isLatest,
        },
      };
    }
  } catch (err) {
    console.error("Gagal mengambil data rilis:", err);
  }

  // Fallback jika database belum terisi
  return {
    success: true,
    data: {
      version: "1.0.0",
      versionCode: 1,
      apkUrlPrimary: "https://github.com/Adly969/SakuIN/releases/download/v1.0.0/sakuin-v1.0.0.apk",
      apkUrlMirror: "https://github.com/Adly969/SakuIN/releases",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      sizeBytes: 2621440,
      releasedAt: new Date().toISOString(),
      changelog:
        "• Rilis perdana SakuIN v1.0.0 untuk Android.\n• Sangat ringan (~2.5 MB), hemat kuota dan memori HP.\n• Fitur lengkap: Multi Rekening, Utang Piutang, Catat Instan, Tabungan, Statistik, dan PWA Offline Ready.\n• Login dengan Akun Google tetap aman via Trusted Web Activity (TWA).",
      isLatest: true,
    },
  };
}
