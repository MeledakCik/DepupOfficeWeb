import type { Metadata } from "next";
import Workspace from "@/components/workspace";

export const metadata: Metadata = {
  title: "Ruang kerja | DepUp Office",
  description: "Ruang kerja untuk memindai, mengedit, dan mengolah dokumen di perangkat Anda.",
  robots: { index: false, follow: true },
};

export default function OfficePage() {
  return <Workspace />;
}
