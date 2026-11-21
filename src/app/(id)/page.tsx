import PublicLanding from "@/components/public-landing";
import { landingCopy } from "@/lib/landing-copy";
import { homePaths, publicMetadata } from "@/lib/site";

export const metadata = publicMetadata("id", homePaths, landingCopy.id.title, landingCopy.id.description);

export default function HomePage() {
  return <PublicLanding locale="id" />;
}
