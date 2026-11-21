import PublicLanding from "@/components/public-landing";
import { landingCopy } from "@/lib/landing-copy";
import { homePaths, publicMetadata } from "@/lib/site";

export const metadata = publicMetadata("en", homePaths, landingCopy.en.title, landingCopy.en.description);

export default function EnglishHomePage() {
  return <PublicLanding locale="en" />;
}
