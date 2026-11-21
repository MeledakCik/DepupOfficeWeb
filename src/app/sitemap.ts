import type { MetadataRoute } from "next";
import { guides } from "@/lib/guides";
import { absoluteUrl, homePaths, languages, siteOrigin } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteOrigin) return [];
  return [homePaths, ...guides.map(({ paths }) => paths)].flatMap((paths) =>
    [paths.id, paths.en].map((path) => ({ url: absoluteUrl(path)!, alternates: { languages: languages(paths) } })),
  );
}
