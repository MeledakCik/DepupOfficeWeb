import type { Metadata, Viewport } from "next";

export const siteName = "DepUp Office";
export const logo = "/brand/depup-office-192.png";
const configuredOrigin = process.env.SITE_URL?.trim();

function readOrigin() {
  if (!configuredOrigin) return undefined;
  const url = new URL(configuredOrigin);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("SITE_URL harus berupa origin HTTPS, tanpa path atau parameter.");
  }
  return url.origin;
}

export const siteOrigin = readOrigin();
export const absoluteUrl = (path: string) => siteOrigin ? new URL(path, siteOrigin).href : undefined;

export const baseMetadata: Metadata = {
  metadataBase: siteOrigin ? new URL(siteOrigin) : undefined,
  icons: {
    icon: [
      { url: "/brand/depup-office-48.png", sizes: "48x48", type: "image/png" },
      { url: logo, sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/brand/depup-office-180.png", sizes: "180x180", type: "image/png" },
  },
  manifest: "/manifest.webmanifest",
};

export const siteViewport: Viewport = { themeColor: "#0037ff", width: "device-width", initialScale: 1 };

export type PublicLocale = "id" | "en";
export type LocalizedPaths = Record<PublicLocale, string>;
export const homePaths: LocalizedPaths = { id: "/", en: "/en/" };
export const languages = (paths: LocalizedPaths) => siteOrigin ? {
  "id-ID": absoluteUrl(paths.id)!,
  en: absoluteUrl(paths.en)!,
  "x-default": absoluteUrl(paths.en)!,
} : undefined;

export function publicMetadata(locale: PublicLocale, paths: LocalizedPaths, title: string, description: string): Metadata {
  const url = absoluteUrl(paths[locale]);
  const image = absoluteUrl(`/brand/office-social-${locale}.jpg`);
  const imageAlt = locale === "id" ? "DepUp Office, alat dokumen di browser" : "DepUp Office, browser-based document tools";
  return {
    title,
    description,
    robots: siteOrigin ? { index: true, follow: true, googleBot: { "max-image-preview": "large" } } : { index: false, follow: true },
    alternates: url ? { canonical: url, languages: languages(paths) } : undefined,
    openGraph: {
      type: "website", siteName, title, description, url,
      locale: locale === "id" ? "id_ID" : "en_US",
      alternateLocale: locale === "id" ? ["en_US"] : ["id_ID"],
      images: image ? [{ url: image, width: 1200, height: 630, alt: imageAlt }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [{ url: image, alt: imageAlt }] : undefined },
  };
}
