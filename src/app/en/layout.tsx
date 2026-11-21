import { baseMetadata, siteViewport } from "@/lib/site";
import "../globals.css";

export const metadata = baseMetadata;
export const viewport = siteViewport;

export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
