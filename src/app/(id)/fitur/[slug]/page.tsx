import { notFound } from "next/navigation";
import PublicGuide from "@/components/public-guide";
import { findGuide, guideSlugs } from "@/lib/guides";
import { publicMetadata, siteName } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => guideSlugs("id");

export async function generateMetadata({ params }: Props) {
  const guide = findGuide("id", (await params).slug);
  if (!guide) notFound();
  return publicMetadata("id", guide.paths, guide.copy.id.name + " | " + siteName, guide.copy.id.summary);
}

export default async function GuidePage({ params }: Props) {
  const guide = findGuide("id", (await params).slug);
  if (!guide) notFound();
  return <PublicGuide guide={guide} locale="id" />;
}
