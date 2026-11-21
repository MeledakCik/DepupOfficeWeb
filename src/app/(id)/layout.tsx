import { baseMetadata, siteViewport } from "@/lib/site";
import "../globals.css";

export const metadata = baseMetadata;
export const viewport = siteViewport;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
