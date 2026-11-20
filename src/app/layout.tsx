import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Sakuin — Catat Uang Kiriman, Tenang Sampai Akhir Bulan",
  description: "Aplikasi pencatatan keuangan bulanan untuk mahasiswa perantau. Catat cepat, tahu sisa uang tiap hari, dan bangun kebiasaan menabung.",
  manifest: "/manifest.json?v=4",
  icons: {
    icon: [
      { url: "/app-icon.png?v=4" },
      { url: "/app-icon.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/app-icon.png?v=4", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/app-icon.png?v=4" },
      { url: "/app-icon.png?v=4", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png?v=4" },
    ],
    shortcut: "/app-icon.png?v=4",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SakuIN",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
