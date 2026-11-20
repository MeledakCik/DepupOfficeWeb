import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DepUp Office | Ruang kerja dokumen",
  description: "Pindai, sunting, dan kelola dokumen Anda langsung di browser.",
  icons: { icon: "/brand/depup-mark.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#1e1150", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
