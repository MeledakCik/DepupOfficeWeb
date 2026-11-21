import { notFound } from "next/navigation";
import PublicGuide from "@/components/public-guide";
import { findGuide, guideSlugs } from "@/lib/guides";
import { publicMetadata, siteName } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => guideSlugs("en");

export async function generateMetadata({ params }: Props) {
  const guide = findGuide("en", (await params).slug);
  if (!guide) notFound();
  return publicMetadata("en", guide.paths, guide.copy.en.name + " | " + siteName, guide.copy.en.summary);
}

export default async function GuidePage({ params }: Props) {
  const guide = findGuide("en", (await params).slug);
  if (!guide) notFound();
  return <PublicGuide guide={guide} locale="en" />;
}
